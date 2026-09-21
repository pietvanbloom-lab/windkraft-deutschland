"""EEG-Jahresabrechnung 2025 (Anlagenstamm- und Bewegungsdaten der vier ÜNB, netztransparenz.de)
-> EEG-Zahlungen an Windanlagen nach Bundesland und Volllaststunden nach Baujahr.

Eingabe: entpackte ZIPs unter $WK_RAW/eeg25/ (Dateien wie auf netztransparenz.de veröffentlicht)
         MaStR-Einheiten ($WK_RAW/mastr/wind.pkl aus 01_mastr.py bzw. EinheitenWind.xml)
Ausgabe: data/csv/eeg2025_*.csv

Definitionen:
- EEG_Zahlung: Zahlung des ÜNB an den Anlagenbetreiber (Marktprämie bzw. bei Einspeisevergütung
  die volle Vergütung, deren Strom der ÜNB selbst vermarktet). Negative Werte sind Korrekturen.
- Strommenge: in der EEG-Abrechnung gemeldete Einspeisung (kWh), auch Monate ohne Prämie.
- Zahlungen der Veräußerungsform 5 „Sonstiges“ (v. a. Kommunalbeteiligung nach § 6 EEG) werden
  nicht zu den Förderzahlungen gezählt, damit die Summen der Anlagen 1a/1b der EEG-Jahresabrechnung
  2025 entsprechen (Wind an Land 1.341,45 Mio. €, auf See 1.453,74 Mio. €).
- Nur Vergütungskategorien Wind (Präfix Wn, Wi, Wr = an Land; Wf = auf See). Zeilen anderer
  Kategorien, deren Anlagenschlüssel mit einer Windanlage kollidiert, werden verworfen.
"""
import glob, os
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = Path(os.environ.get("WK_RAW", ROOT / "raw"))
CSV = ROOT / "data" / "csv"
BL = {"1": "Baden-Württemberg", "2": "Bayern", "3": "Berlin", "4": "Brandenburg", "5": "Bremen", "6": "Hamburg",
      "7": "Hessen", "8": "Mecklenburg-Vorpommern", "9": "Niedersachsen", "10": "Nordrhein-Westfalen",
      "11": "Rheinland-Pfalz", "12": "Saarland", "13": "Sachsen", "14": "Sachsen-Anhalt", "15": "Schleswig-Holstein",
      "16": "Thüringen", "17": "Ausschließliche Wirtschaftszone", "18": "Ausland"}
TSOS = {"50hertz": "50Hertz", "amprion": "Amprion", "tennet": "TenneT", "transnetbw": "TransnetBW"}


def read(path, **kw):
    enc = "utf-8-sig" if "50Hertz" in path else "cp1252"
    d = pd.read_csv(path, sep=";", dtype=str, encoding=enc, encoding_errors="replace", **kw)
    return d


def norm(d):
    d.columns = [c.strip().replace("-", "_").replace(" (Code)", "").replace("installierte_Leistung", "Installierte_Leistung") for c in d.columns]
    return d.loc[:, [c for c in d.columns if c and not c.startswith("Unnamed")]]


def load():
    stamm = []
    for key, name in TSOS.items():
        for p in glob.glob(str(RAW / "eeg25" / f"{key}*stammdaten*" / "**" / "*.csv"), recursive=True):
            d = norm(read(p))
            d = d[d.Energietraeger.isin(["7", "8"])].copy()
            d["tso"] = name
            stamm.append(d)
    S = pd.concat(stamm, ignore_index=True)
    S["k"] = S.tso + "|" + S.EEG_Anlagenschluessel
    keys = set(S.k)
    bew = []
    for key, name in TSOS.items():
        for p in glob.glob(str(RAW / "eeg25" / f"{key}*bewegungsdaten*" / "**" / "*.csv"), recursive=True):
            for ch in read(p, chunksize=500_000):
                ch = norm(ch)
                ch["k"] = name + "|" + ch.EEG_Anlagenschluessel
                ch = ch[ch.k.isin(keys)]
                if len(ch):
                    ch = ch.copy(); ch["tso"] = name
                    bew.append(ch)
    B = pd.concat(bew, ignore_index=True)
    for c in ["Strommenge", "EEG_Zahlung", "EEG_Einnahmen"]:
        B[c] = pd.to_numeric(B[c].str.replace(",", ".", regex=False), errors="coerce").fillna(0)
    B = B[B.Verguetungskategorie.str[:2].isin(["Wn", "Wi", "Wr", "Wf"])]
    S["kw"] = pd.to_numeric(S.Installierte_Leistung.str.replace(",", ".", regex=False), errors="coerce")
    return S, B


def main():
    S, B = load()
    # Zuordnung primär über die EEG-MaStR-Nummer (eindeutig je Anlage), sonst über den
    # Anlagenschlüssel; bei 50Hertz teilen sich mehrere Anlagen einen Anlagenschlüssel.
    Su = S.drop_duplicates("k").set_index("k")
    Sn = S.dropna(subset=["EEG_Mastr_Nr"]).drop_duplicates("EEG_Mastr_Nr").set_index("EEG_Mastr_Nr")
    B["pid"] = B.EEG_Mastr_Nr.where(B.EEG_Mastr_Nr.isin(Sn.index), B.k.map(Su.EEG_Mastr_Nr))
    B["bl"] = B.pid.map(Sn.Bundesland).fillna(B.k.map(Su.Bundesland)).map(BL)
    B["et"] = B.pid.map(Sn.Energietraeger).fillna(B.k.map(Su.Energietraeger)).map({"7": "an Land", "8": "auf See"})
    B["form"] = B.Veraeusserungsform.map({"1": "Einspeisevergütung", "2": "Marktprämie", "3": "Mieterstrom",
                                          "4": "Ausfallvergütung", "5": "Sonstiges"})

    B["zahlung_foerd"] = B.EEG_Zahlung.where(B.form != "Sonstiges", 0.0)
    tot = B.groupby(["et", "form"]).agg(strommenge_twh=("Strommenge", lambda s: s.sum() / 1e9),
                                        zahlung_mio_eur=("zahlung_foerd", lambda s: s.sum() / 1e6),
                                        sonstige_zahlung_mio_eur=("EEG_Zahlung", lambda s: s[B.loc[s.index, "form"] == "Sonstiges"].sum() / 1e6)).reset_index()
    tot.to_csv(CSV / "eeg2025_summen.csv", index=False, float_format="%.3f")
    print(tot)

    bl = B.groupby(["bl", "et"]).agg(strommenge_gwh=("Strommenge", lambda s: s.sum() / 1e6),
                                     zahlung_mio_eur=("zahlung_foerd", lambda s: s.sum() / 1e6),
                                     anlagen=("k", "nunique")).reset_index()
    bl["ct_je_kwh"] = bl.zahlung_mio_eur * 1e8 / (bl.strommenge_gwh * 1e6)
    bl.to_csv(CSV / "eeg2025_laender.csv", index=False, float_format="%.2f")
    print(bl.to_string())

    # Volllaststunden 2025 je Einheit: EEG-Strommenge / MaStR-Bruttoleistung
    w = pd.read_pickle(RAW / "mastr" / "wind.pkl")
    w["kw"] = pd.to_numeric(w.Bruttoleistung, errors="coerce")
    w["ibn"] = pd.to_datetime(w.Inbetriebnahmedatum, errors="coerce")
    w["nabe"] = pd.to_numeric(w.Nabenhoehe, errors="coerce")
    w["rd"] = pd.to_numeric(w.Rotordurchmesser, errors="coerce").round()
    kat = pd.read_pickle(RAW / "mastr" / "kat.pkl"); kv = dict(zip(kat.Id, kat.Wert))
    import importlib.util
    spec = importlib.util.spec_from_file_location("m", Path(__file__).with_name("01_mastr.py")); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    w["marke"] = w.Hersteller.map(kv).map(m.marke)
    w.loc[(w.marke == "Enercon") & w.rd.isin([70, 71]), "rd"] = 71
    w = w[w.EegMaStRNummer.notna()]
    per_eeg = w.groupby("EegMaStRNummer").agg(kw_mastr=("kw", "sum"), n_einh=("kw", "size"), ibn=("ibn", "min"),
                                              nabe=("nabe", "mean"), status=("EinheitBetriebsstatus", lambda s: ",".join(sorted(set(s)))),
                                              lage=("WindAnLandOderAufSee", "first"), marke=("marke", "first"), rd=("rd", "first"))
    e = B[B.pid.notna()].groupby("pid").agg(kwh=("Strommenge", "sum"), eur=("zahlung_foerd", "sum"), bl=("bl", "first"))
    j = e.join(per_eeg, how="inner")
    voll = j[(j.ibn < "2025-01-01") & (j.status == "35") & (j.kw_mastr >= 100) & (j.kwh > 0)].copy()
    voll["vlh"] = voll.kwh / voll.kw_mastr
    voll["jahr"] = voll.ibn.dt.year
    voll["lage"] = voll.lage.map({"888": "an Land", "889": "auf See"})
    print("verknüpft:", len(j), "ganzjährig in Betrieb:", len(voll))

    def agg(g):
        return pd.Series({"einheiten": len(g), "kw": g.kw_mastr.sum(), "mwh": g.kwh.sum() / 1e3,
                          "vlh_gewichtet": g.kwh.sum() / g.kw_mastr.sum(), "vlh_median": g.vlh.median(),
                          "mwh_je_anlage_median": (g.kwh / 1e3 / g.n_einh).median(),
                          "kw_mittel": (g.kw_mastr / g.n_einh).mean(), "nabe_mittel": g.nabe.mean()})
    by_year = voll.groupby(["lage", "jahr"]).apply(agg).reset_index()
    by_year.to_csv(CSV / "eeg2025_vlh_baujahr.csv", index=False, float_format="%.1f")
    by_bl = voll[voll.lage == "an Land"].groupby("bl").apply(agg).reset_index()
    by_bl.to_csv(CSV / "eeg2025_vlh_laender.csv", index=False, float_format="%.1f")
    fam = voll[voll.n_einh == 1].groupby(["lage", "marke", "rd"]).apply(agg).reset_index()
    fam = fam[fam.einheiten >= 20].sort_values("einheiten", ascending=False)
    fam.to_csv(CSV / "eeg2025_vlh_typfamilien.csv", index=False, float_format="%.1f")
    print(fam.head(25).to_string())
    by_lage = voll.groupby("lage").apply(agg).reset_index()
    by_lage.to_csv(CSV / "eeg2025_vlh_gesamt.csv", index=False, float_format="%.1f")
    print(by_lage.to_string()); print(by_year.to_string()); print(by_bl.to_string())


if __name__ == "__main__":
    main()
