"""Marktstammdatenregister (MaStR) -> aggregierte Kennzahlen und Anlagenpunkte.

Eingabe: EinheitenWind.xml, AnlagenEegWind.xml, Katalogwerte.xml aus dem
MaStR-Gesamtdatenexport (dl-de/by-2-0), entpackt nach $WK_RAW/mastr/.
Ausgabe: data/csv/mastr_*.csv und data/turbines.js

Datenschutz: Es werden keine Betreiber-, Namens-, Adress- oder Flurstücksfelder
übernommen. Einheiten unter 100 kW (überwiegend Kleinwindanlagen, oft privat)
erscheinen nicht als Punkte, nur in den Summen.
"""
import json, os, re, sys
from pathlib import Path
import pandas as pd
from lxml import etree

ROOT = Path(__file__).resolve().parents[1]
RAW = Path(os.environ.get("WK_RAW", ROOT / "raw"))
OUT = ROOT / "data"
CSV = OUT / "csv"
CSV.mkdir(parents=True, exist_ok=True)
STICHTAG = os.environ.get("WK_MASTR_STAND", "2026-09-21")


def parse(path, tag):
    rows = []
    for _, el in etree.iterparse(str(path), tag=tag, encoding="utf-16"):
        rows.append({c.tag: c.text for c in el})
        el.clear()
    return pd.DataFrame(rows)


def load():
    cache = RAW / "mastr" / "wind.pkl"
    if cache.exists():
        w = pd.read_pickle(cache)
    else:
        w = parse(RAW / "mastr" / "EinheitenWind.xml", "EinheitWind")
    kat = parse(RAW / "mastr" / "Katalogwerte.xml", "Katalogwert") if not (RAW / "mastr" / "kat.pkl").exists() else pd.read_pickle(RAW / "mastr" / "kat.pkl")
    kv = dict(zip(kat.Id, kat.Wert))
    w["status"] = w.EinheitBetriebsstatus.map(kv)
    w["lage"] = w.WindAnLandOderAufSee.map({"888": "an Land", "889": "auf See"})
    w["bundesland"] = w.Bundesland.map(kv)
    w["hersteller_roh"] = w.Hersteller.map(kv)
    for c in ["Bruttoleistung", "Nettonennleistung", "Nabenhoehe", "Rotordurchmesser", "Laengengrad", "Breitengrad"]:
        w[c] = pd.to_numeric(w[c], errors="coerce")
    w["ibn"] = pd.to_datetime(w.Inbetriebnahmedatum, errors="coerce")
    w["ibn_jahr"] = w.ibn.dt.year
    w["stilllegung"] = pd.to_datetime(w.DatumEndgueltigeStilllegung, errors="coerce")
    w["marke"] = w.hersteller_roh.map(marke)
    return w


MARKEN = [
    ("enercon", "Enercon"), ("vestas", "Vestas"), ("neg micon", "NEG Micon"), ("nordex", "Nordex"),
    ("siemens", "Siemens Gamesa"), ("gamesa", "Siemens Gamesa"), ("adwen", "Adwen"), ("areva", "Adwen"),
    ("senvion", "Senvion/REpower"), ("repower", "Senvion/REpower"), ("general electric", "GE"),
    ("ge wind", "GE"), ("ge renewable", "GE"), ("tacke", "Tacke"), ("fuhrländer", "Fuhrländer"),
    ("an windenergie", "AN Bonus"), ("bonus", "AN Bonus"), ("dewind", "DeWind"), ("vensys", "Vensys"),
    ("eno ", "eno energy"), ("bard", "BARD"), ("nordtank", "NEG Micon"), ("micon", "NEG Micon"),
]


def marke(h):
    if not isinstance(h, str):
        return "unbekannt"
    s = h.lower()
    for key, b in MARKEN:
        if key in s:
            return b
    return "Sonstige"


def main():
    w = load()
    betrieb = w.status == "In Betrieb"
    on = w.lage == "an Land"
    off = w.lage == "auf See"

    # 1) Bestand nach Status und Lage
    best = (w.groupby(["lage", "status"]).agg(anzahl=("EinheitMastrNummer", "size"),
                                                 leistung_mw=("Bruttoleistung", lambda s: s.sum() / 1e3))
            .reset_index())
    best["stichtag"] = STICHTAG
    best.to_csv(CSV / "mastr_bestand_status.csv", index=False, float_format="%.1f")

    klein = w[betrieb & on & (w.Bruttoleistung < 100)]
    meta = {
        "stichtag": STICHTAG,
        "einheiten_gesamt": int(len(w)),
        "on_betrieb_n": int((betrieb & on).sum()),
        "on_betrieb_mw": round(w[betrieb & on].Bruttoleistung.sum() / 1e3, 1),
        "off_betrieb_n": int((betrieb & off).sum()),
        "off_betrieb_mw": round(w[betrieb & off].Bruttoleistung.sum() / 1e3, 1),
        "on_voruebergehend_n": int(((w.status == "Vorübergehend stillgelegt") & on).sum()),
        "on_stillgelegt_n": int(((w.status == "Endgültig stillgelegt") & on).sum()),
        "on_planung_n": int(((w.status == "In Planung") & on).sum()),
        "on_planung_mw": round(w[(w.status == "In Planung") & on].Bruttoleistung.sum() / 1e3, 1),
        "off_planung_n": int(((w.status == "In Planung") & off).sum()),
        "off_planung_mw": round(w[(w.status == "In Planung") & off].Bruttoleistung.sum() / 1e3, 1),
        "on_klein_n": int(len(klein)),
        "on_klein_mw": round(klein.Bruttoleistung.sum() / 1e3, 1),
        "on_ab100_n": int((betrieb & on & (w.Bruttoleistung >= 100)).sum()),
        "on_ab100_mw": round(w[betrieb & on & (w.Bruttoleistung >= 100)].Bruttoleistung.sum() / 1e3, 1),
        "off_nordsee_n": int((betrieb & off & (w.Seelage == "640")).sum()),
        "off_nordsee_mw": round(w[betrieb & off & (w.Seelage == "640")].Bruttoleistung.sum() / 1e3, 1),
        "off_ostsee_n": int((betrieb & off & (w.Seelage == "639")).sum()),
        "off_ostsee_mw": round(w[betrieb & off & (w.Seelage == "639")].Bruttoleistung.sum() / 1e3, 1),
    }
    op = w[betrieb]
    meta["on_mittel_kw"] = round(op[op.lage == "an Land"].Bruttoleistung.mean())
    meta["off_mittel_kw"] = round(op[op.lage == "auf See"].Bruttoleistung.mean())
    meta["groesste_kw"] = float(op.Bruttoleistung.max())

    # 2) Bundesländer (an Land, in Betrieb) + Offshore nach Meer
    bl = (w[betrieb & on].groupby("bundesland")
          .agg(anzahl=("EinheitMastrNummer", "size"), leistung_mw=("Bruttoleistung", lambda s: s.sum() / 1e3),
               mittel_kw=("Bruttoleistung", "mean"), planung_n=("EinheitMastrNummer", lambda s: 0))
          .reset_index())
    plan = w[(w.status == "In Planung") & on].groupby("bundesland").agg(planung_n=("EinheitMastrNummer", "size"), planung_mw=("Bruttoleistung", lambda s: s.sum() / 1e3))
    bl = bl.drop(columns="planung_n").merge(plan, on="bundesland", how="left")
    zubau25 = w[on & (w.ibn_jahr == 2025) & w.status.isin(["In Betrieb", "Vorübergehend stillgelegt", "Endgültig stillgelegt"])].groupby("bundesland").agg(zubau2025_n=("EinheitMastrNummer", "size"), zubau2025_mw=("Bruttoleistung", lambda s: s.sum() / 1e3))
    bl = bl.merge(zubau25, on="bundesland", how="left").fillna(0)
    bl["stichtag"] = STICHTAG
    bl.to_csv(CSV / "mastr_laender.csv", index=False, float_format="%.1f")

    kr = (w[betrieb & on].groupby("Landkreis").agg(anzahl=("EinheitMastrNummer", "size"), leistung_mw=("Bruttoleistung", lambda s: s.sum() / 1e3))
          .sort_values("anzahl", ascending=False).reset_index())
    kr.to_csv(CSV / "mastr_kreise.csv", index=False, float_format="%.1f")

    # 3) Jahrgänge (Inbetriebnahmejahr), alle Status außer "In Planung"
    gebaut = w[w.status != "In Planung"]
    jg = (gebaut.groupby(["lage", "ibn_jahr"]).agg(
        anzahl=("EinheitMastrNummer", "size"), leistung_mw=("Bruttoleistung", lambda s: s.sum() / 1e3),
        mittel_kw=("Bruttoleistung", "mean"), nabe_m=("Nabenhoehe", "mean"), rotor_m=("Rotordurchmesser", "mean"),
        noch_in_betrieb=("status", lambda s: int((s == "In Betrieb").sum())))
        .reset_index())
    jg = jg[jg.ibn_jahr >= 1990]
    jg.to_csv(CSV / "mastr_jahrgaenge.csv", index=False, float_format="%.1f")

    # 4) Hersteller: Bestand an Land (in Betrieb) und Zubau 2025
    h1 = op[op.lage == "an Land"].groupby("marke").agg(anzahl=("EinheitMastrNummer", "size"), leistung_mw=("Bruttoleistung", lambda s: s.sum() / 1e3))
    z = w[on & (w.ibn_jahr == 2025) & (w.status != "In Planung")]
    h2 = z.groupby("marke").agg(zubau2025_n=("EinheitMastrNummer", "size"), zubau2025_mw=("Bruttoleistung", lambda s: s.sum() / 1e3))
    h3 = op[op.lage == "auf See"].groupby("marke").agg(off_anzahl=("EinheitMastrNummer", "size"), off_leistung_mw=("Bruttoleistung", lambda s: s.sum() / 1e3))
    hs = h1.join(h2, how="outer").join(h3, how="outer").fillna(0).sort_values("leistung_mw", ascending=False).reset_index()
    hs.to_csv(CSV / "mastr_hersteller.csv", index=False, float_format="%.1f")

    # 5) Typfamilien (Marke + Rotordurchmesser), in Betrieb
    op2 = op.copy()
    op2["rd"] = op2.Rotordurchmesser.round()
    op2.loc[(op2.marke == "Enercon") & (op2.rd.isin([70, 71])), "rd"] = 71  # E-70: 71 m Rotor, teils als 70 m gemeldet
    tf = (op2.groupby(["lage", "marke", "rd"]).agg(
        anzahl=("EinheitMastrNummer", "size"), leistung_mw=("Bruttoleistung", lambda s: s.sum() / 1e3),
        kw_median=("Bruttoleistung", "median"), nabe_median=("Nabenhoehe", "median"),
        nabe_p10=("Nabenhoehe", lambda s: s.quantile(.1)), nabe_p90=("Nabenhoehe", lambda s: s.quantile(.9)),
        ibn_von=("ibn_jahr", "min"), ibn_bis=("ibn_jahr", "max"),
        typ_haeufigste=("Typenbezeichnung", lambda s: s.value_counts().index[0] if s.notna().any() else ""))
        .reset_index().sort_values("anzahl", ascending=False))
    clean = lambda t, n: t if (n >= 20 and isinstance(t, str) and not re.search(r"\d{5,}|Nr\.?|Serien|Herstell|Rerferenz|Referenz|\(", t)) else ""
    tf["typ_haeufigste"] = [clean(t, n) for t, n in zip(tf.typ_haeufigste, tf.anzahl)]
    tf.to_csv(CSV / "mastr_typfamilien.csv", index=False, float_format="%.1f")
    neu = w[on & (w.ibn_jahr >= 2024) & (w.status != "In Planung")].copy()
    neu["rd"] = neu.Rotordurchmesser.round()
    tn = (neu.groupby(["marke", "rd"]).agg(anzahl=("EinheitMastrNummer", "size"), kw_median=("Bruttoleistung", "median"),
                                           nabe_median=("Nabenhoehe", "median"),
                                           typ_haeufigste=("Typenbezeichnung", lambda s: s.value_counts().index[0] if s.notna().any() else ""))
          .reset_index().sort_values("anzahl", ascending=False))
    tn["typ_haeufigste"] = [clean(t, n) for t, n in zip(tn.typ_haeufigste, tn.anzahl)]
    tn.to_csv(CSV / "mastr_typfamilien_neu_2024_2026.csv", index=False, float_format="%.1f")

    # 6) Anlagenpunkte (in Betrieb, >= 100 kW, mit Koordinaten)
    pts = op[(op.Bruttoleistung >= 100) & op.Laengengrad.notna() & op.Breitengrad.notna()].copy()
    # Plausibilitätsfilter Koordinaten (Deutschland inkl. AWZ)
    pts = pts[pts.Laengengrad.between(5.5, 15.2) & pts.Breitengrad.between(47.2, 55.3)]
    pts["x"] = ((pts.Laengengrad - 5) * 1e4).round().astype(int)
    pts["y"] = ((pts.Breitengrad - 47) * 1e4).round().astype(int)
    pts = pts.sort_values(["x", "y"])
    marken = sorted(pts.marke.unique())
    # Typbezeichnung: Das Freitextfeld enthält teils Seriennummern und Anmerkungen. Ausgeliefert wird
    # daher nur die häufigste Bezeichnung der Typfamilie (Marke + Rotordurchmesser, mind. 20 Anlagen).
    fam = op.assign(rd=op.Rotordurchmesser.round())
    fam.loc[(fam.marke == "Enercon") & fam.rd.isin([70, 71]), "rd"] = 71
    fl = (fam.groupby(["marke", "rd"]).Typenbezeichnung
          .agg(lambda s: (s.value_counts().index[0], int(s.notna().sum())) if s.notna().any() else ("", 0)))
    ok = lambda t: bool(t) and not re.search(r"\d{5,}|Nr\.?|Serien|Herstell|Rerferenz|Referenz|\(", t)
    famlabel = {k: re.sub(r"\s+", " ", v[0]).strip()[:24] for k, v in fl.items() if v[1] >= 20 and ok(v[0])}
    pts["rd"] = pts.Rotordurchmesser.round()
    pts.loc[(pts.marke == "Enercon") & pts.rd.isin([70, 71]), "rd"] = 71
    pts["typ"] = [famlabel.get((m, r), "") for m, r in zip(pts.marke, pts.rd)]
    typen = pts.typ.value_counts().index.tolist()
    ti = {t: i for i, t in enumerate(typen)}
    mi = {m: i for i, m in enumerate(marken)}
    xs = pts.x.tolist()
    dx = [xs[0]] + [b - a for a, b in zip(xs, xs[1:])]
    payload = {
        "stichtag": STICHTAG,
        "n": int(len(pts)),
        "marken": marken,
        "typen": typen,
        "dx": dx,
        "y": pts.y.tolist(),
        "kw": pts.Bruttoleistung.round().astype(int).tolist(),
        "j": pts.ibn_jahr.fillna(0).astype(int).tolist(),
        "h": pts.Nabenhoehe.fillna(0).round().astype(int).tolist(),
        "r": pts.Rotordurchmesser.fillna(0).round().astype(int).tolist(),
        "m": pts.marke.map(mi).tolist(),
        "t": pts.typ.map(ti).tolist(),
        "s": (pts.lage == "auf See").astype(int).tolist(),
    }
    js = "window.WK_TURBINES=" + json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + ";\n"
    (OUT / "turbines.js").write_text(js, encoding="utf-8")
    meta["punkte_n"] = int(len(pts))
    meta["punkte_ohne_koordinaten"] = int(((op.Bruttoleistung >= 100) & (op.Laengengrad.isna() | op.Breitengrad.isna())).sum())
    (CSV / "mastr_meta.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))
    print(json.dumps(meta, indent=1, ensure_ascii=False))
    print("turbines.js", len(js) / 1e3, "kB")


if __name__ == "__main__":
    main()
