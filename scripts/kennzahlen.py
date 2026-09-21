"""Zentrale Liste aller Kernzahlen der Seite und der Chart-Daten.

Jede Kennzahl: id, kennzahl, wert, einheit, stichtag, quelle, url, fundstelle, anmerkung, dec.
Werte aus eigenen Auswertungen werden aus data/csv/ gelesen (Skripte 01–03), Werte aus
Veröffentlichungen stehen als Literal mit Fundstelle hier.
"""
import json
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
CSV = ROOT / "data" / "csv"
RES = json.loads((ROOT / "scripts" / "recherche.json").read_text(encoding="utf-8"))

MASTR = dict(quelle="Bundesnetzagentur, Marktstammdatenregister, Gesamtdatenexport vom 21.09.2026 (EinheitenWind.xml); eigene Auswertung",
             url="https://www.marktstammdatenregister.de/MaStR/Datendownload")
EEG = dict(quelle="Übertragungsnetzbetreiber (netztransparenz.de), EEG-Jahresabrechnung 2025, Anlagenstamm- und Bewegungsdaten; eigene Auswertung",
           url="https://www.netztransparenz.de/de-de/Erneuerbare-Energien-und-Umlagen/EEG/EEG-Abrechnungen/EEG-Jahresabrechnungen/EEG-Bewegungsdaten")
EEGxMASTR = dict(quelle="EEG-Jahresabrechnung 2025 (netztransparenz.de) verknüpft mit Marktstammdatenregister (21.09.2026); eigene Auswertung",
                 url="https://www.netztransparenz.de/de-de/Erneuerbare-Energien-und-Umlagen/EEG/EEG-Abrechnungen/EEG-Jahresabrechnungen/EEG-Bewegungsdaten")
SMARD = dict(quelle="Bundesnetzagentur | SMARD.de, Stundenwerte 2025 (Realisierte Erzeugung, Netzlast, Day-Ahead DE/LU); eigene Auswertung",
             url="https://www.smard.de/home/downloadcenter/download-marktdaten/")
AGEE = dict(quelle="UBA/AGEE-Stat, Zeitreihen zur Entwicklung der erneuerbaren Energien in Deutschland (Stand Februar 2026)",
            url="https://www.umweltbundesamt.de/system/files/document/zeitreihen-zur-entwicklung-der-erneuerbaren-energien-in-deutschland-excel_uba_deu_0_0.xlsx_0.xlsx")
KOELN = dict(quelle="Hohe Domkirche Köln, „Der Dom in Zahlen“", url="https://www.koelner-dom.de/erleben/der-dom-in-zahlen")

LIZENZEN = [
    "Marktstammdatenregister (Bundesnetzagentur): Datenlizenz Deutschland – Namensnennung – Version 2.0 (dl-de/by-2-0), https://www.govdata.de/dl-de/by-2-0. Quellenvermerk: „© Bundesnetzagentur für Elektrizität, Gas, Telekommunikation, Post und Eisenbahnen (Marktstammdatenregister), dl-de/by-2-0“. Datenstand Gesamtdatenexport 21.09.2026; verändert (aggregiert, ohne Betreiber-, Namens- und Adressfelder).",
    "Verwaltungsgrenzen: © BKG (2026) dl-de/by-2-0, Datenquellen: https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg_nuts.pdf (VG2500, Stand 31.12., per WFS bezogen; vereinfacht).",
    "Nachbarstaaten (Kartenhintergrund): Natural Earth, 1:50 Mio. Admin 0 Countries, gemeinfrei (public domain), https://www.naturalearthdata.com.",
    "SMARD: Bundesnetzagentur | SMARD.de, Lizenz CC BY 4.0, https://www.smard.de.",
    "EEG-Jahresabrechnung 2025: veröffentlicht von 50Hertz, Amprion, TenneT, TransnetBW auf netztransparenz.de (Veröffentlichung nach § 77 EEG).",
    "UBA/AGEE-Stat, Fraunhofer ISE, BNetzA, Deutsche WindGuard, OECD-NEA, IEA und weitere: zitiert mit Fundstelle; Rechte bei den Herausgebern.",
    "Bibliotheken (lokal eingebunden): D3.js v7.9.0 (ISC), Chart.js v4.4.7 (MIT), three.js r147 (MIT); Lizenztexte in assets/vendor/.",
]


def csv(name):
    return pd.read_csv(CSV / name)


def registry():
    m = json.loads((CSV / "mastr_meta.json").read_text())
    st = "21.09.2026"
    R = []

    def add(id, kennzahl, wert, einheit, stichtag, src, fundstelle="", anmerkung="", dec=None):
        R.append(dict(id=id, kennzahl=kennzahl, wert=wert, einheit=einheit, stichtag=stichtag,
                      quelle=src["quelle"], url=src.get("url", ""), fundstelle=fundstelle, anmerkung=anmerkung, dec=dec))

    f_st = "EinheitenWind.xml, Feld EinheitBetriebsstatus/WindAnLandOderAufSee, Summe Bruttoleistung"
    add("on_betrieb_n", "Windenergieanlagen an Land in Betrieb", m["on_betrieb_n"], "Anlagen", st, MASTR, f_st,
        f"inkl. {m['on_klein_n']} Kleinanlagen unter 100 kW ({m['on_klein_mw']} MW)")
    add("on_betrieb_gw", "Leistung an Land in Betrieb (brutto)", m["on_betrieb_mw"] / 1e3, "GW", st, MASTR, f_st, dec=1)
    add("off_betrieb_n", "Windenergieanlagen auf See in Betrieb", m["off_betrieb_n"], "Anlagen", st, MASTR, f_st)
    add("off_betrieb_gw", "Leistung auf See in Betrieb (brutto)", m["off_betrieb_mw"] / 1e3, "GW", st, MASTR, f_st, dec=1)
    add("ges_betrieb_n", "Windenergieanlagen in Betrieb gesamt", m["on_betrieb_n"] + m["off_betrieb_n"], "Anlagen", st, MASTR, f_st)
    add("ges_betrieb_gw", "Leistung in Betrieb gesamt", (m["on_betrieb_mw"] + m["off_betrieb_mw"]) / 1e3, "GW", st, MASTR, f_st, dec=1)
    add("on_vorueb_n", "An Land vorübergehend stillgelegt", m["on_voruebergehend_n"], "Anlagen", st, MASTR, f_st)
    add("on_stehen_n", "An Land errichtet (in Betrieb + vorübergehend stillgelegt)", m["on_betrieb_n"] + m["on_voruebergehend_n"], "Anlagen", st, MASTR, f_st)
    add("on_stillgelegt_n", "An Land endgültig stillgelegt (im Register erfasst)", m["on_stillgelegt_n"], "Anlagen", st, MASTR, f_st,
        "nur seit Registerstart 2019 erfasste bzw. nachgetragene Stilllegungen")
    add("on_planung_n", "An Land „in Planung“ registriert", m["on_planung_n"], "Anlagen", st, MASTR, f_st,
        "Registrierung genehmigter bzw. geplanter Anlagen; keine Baugarantie")
    add("on_planung_gw", "Leistung an Land „in Planung“", m["on_planung_mw"] / 1e3, "GW", st, MASTR, f_st, dec=1)
    add("on_klein_n", "Anlagen an Land unter 100 kW in Betrieb", m["on_klein_n"], "Anlagen", st, MASTR, f_st)
    add("on_mittel_mw", "Mittlere Leistung einer Anlage an Land (Bestand)", m["on_mittel_kw"] / 1e3, "MW", st, MASTR, "Mittelwert Bruttoleistung, in Betrieb", dec=2)
    add("off_mittel_mw", "Mittlere Leistung einer Anlage auf See (Bestand)", m["off_mittel_kw"] / 1e3, "MW", st, MASTR, "Mittelwert Bruttoleistung, in Betrieb", dec=1)
    add("off_nordsee_gw", "Leistung auf See, Nordsee", m["off_nordsee_mw"] / 1e3, "GW", st, MASTR, "Feld Seelage = Nordsee", dec=1)
    add("off_ostsee_gw", "Leistung auf See, Ostsee", m["off_ostsee_mw"] / 1e3, "GW", st, MASTR, "Feld Seelage = Ostsee", dec=1)
    add("punkte_n", "Anlagen als Kartenpunkte (in Betrieb, ab 100 kW, mit Koordinaten)", m["punkte_n"], "Anlagen", st, MASTR,
        "Koordinaten auf 4 Nachkommastellen gerundet", f"{m['punkte_ohne_koordinaten']} Anlagen ab 100 kW ohne Koordinaten")

    bl = csv("mastr_laender.csv").set_index("bundesland")
    for key, name in [("ni", "Niedersachsen"), ("bb", "Brandenburg"), ("nw", "Nordrhein-Westfalen"), ("sh", "Schleswig-Holstein"),
                      ("st", "Sachsen-Anhalt"), ("by", "Bayern"), ("bw", "Baden-Württemberg")]:
        add(f"{key}_n", f"Anlagen an Land in Betrieb, {name}", int(bl.loc[name, "anzahl"]), "Anlagen", st, MASTR, "Feld Bundesland")
        add(f"{key}_gw", f"Leistung an Land in Betrieb, {name}", bl.loc[name, "leistung_mw"] / 1e3, "GW", st, MASTR, "Feld Bundesland", dec=1)
    kr = csv("mastr_kreise.csv").set_index("Landkreis")
    add("kreis_nf_n", "Anlagen an Land in Betrieb, Kreis Nordfriesland (meiste Anlagen aller Kreise)", int(kr.loc["Nordfriesland", "anzahl"]), "Anlagen", st, MASTR, "Feld Landkreis")
    add("kreis_di_n", "Anlagen an Land in Betrieb, Kreis Dithmarschen (zweitmeiste Anlagen)", int(kr.loc["Dithmarschen", "anzahl"]), "Anlagen", st, MASTR, "Feld Landkreis")
    sued = bl.loc[["Bayern", "Baden-Württemberg"]]
    add("sued_anteil_pct", "Anteil Bayern + Baden-Württemberg an der Leistung an Land", sued.leistung_mw.sum() / bl.leistung_mw.sum() * 100, "%", st, MASTR, "eigene Berechnung", dec=1)

    # Jahrgänge & Hersteller
    jg = csv("mastr_jahrgaenge.csv"); jg = jg[jg.lage == "an Land"].set_index("ibn_jahr")
    add("neu2025_mw", "Mittlere Leistung der 2025 in Betrieb genommenen Anlagen an Land", jg.loc[2025, "mittel_kw"] / 1e3, "MW", "IBN 2025", MASTR, "Feld Inbetriebnahmedatum, Mittelwert Bruttoleistung", "inkl. Kleinanlagen", dec=1)
    add("neu2025_nabe", "Mittlere Nabenhöhe der 2025 in Betrieb genommenen Anlagen an Land", jg.loc[2025, "nabe_m"], "m", "IBN 2025", MASTR, "Feld Nabenhoehe", "inkl. Kleinanlagen", dec=0)
    add("neu2000_mw", "Mittlere Leistung der 2000 in Betrieb genommenen Anlagen an Land", jg.loc[2000, "mittel_kw"] / 1e3, "MW", "IBN 2000", MASTR, "Feld Inbetriebnahmedatum, nur im Register erfasste Anlagen", dec=1)
    add("neu2000_nabe", "Mittlere Nabenhöhe der 2000 in Betrieb genommenen Anlagen an Land", jg.loc[2000, "nabe_m"], "m", "IBN 2000", MASTR, "Feld Nabenhoehe", dec=0)
    hs = csv("mastr_hersteller.csv").set_index("marke")
    tot_mw = hs.leistung_mw.sum(); tot_z = hs.zubau2025_mw.sum()
    for key, name in [("enercon", "Enercon"), ("vestas", "Vestas"), ("nordex", "Nordex")]:
        add(f"h_{key}_pct", f"Anteil {name} an der Leistung an Land (Bestand)", hs.loc[name, "leistung_mw"] / tot_mw * 100, "%", st, MASTR, "Feld Hersteller, zu Marken zusammengefasst", dec=0)
        add(f"hz_{key}_pct", f"Anteil {name} am Zubau an Land 2025 (MW)", hs.loc[name, "zubau2025_mw"] / tot_z * 100, "%", "IBN 2025", MASTR, "Feld Hersteller, Inbetriebnahme 2025", dec=0)
    add("h_sg_off_pct", "Anteil Siemens Gamesa an der Leistung auf See", hs.loc["Siemens Gamesa", "off_leistung_mw"] / hs.off_leistung_mw.sum() * 100, "%", st, MASTR, "Feld Hersteller", dec=0)

    # EEG 2025
    s = csv("eeg2025_summen.csv")
    on = s[s.et == "an Land"]; off = s[s.et == "auf See"]
    add("eeg_on_mio", "EEG-Zahlungen an Windanlagen an Land 2025", on.zahlung_mio_eur.sum(), "Mio. €", "2025", EEG,
        "Summe EEG_Zahlung, Vergütungskategorien Wind an Land (Wn/Wi/Wr)", "Marktprämie, Einspeise- und Ausfallvergütung; Korrekturbuchungen enthalten", dec=0)
    add("eeg_off_mio", "EEG-Zahlungen an Windanlagen auf See 2025", off.zahlung_mio_eur.sum(), "Mio. €", "2025", EEG, "Vergütungskategorien Wf", dec=0)
    add("eeg_ges_mrd", "EEG-Zahlungen an Windenergie gesamt 2025", (on.zahlung_mio_eur.sum() + off.zahlung_mio_eur.sum()) / 1e3, "Mrd. €", "2025", EEG, "Summe an Land + auf See", dec=2)
    add("eeg_on_twh", "EEG-abgerechnete Strommenge Wind an Land 2025", on.strommenge_twh.sum(), "TWh", "2025", EEG, "Summe Strommenge", "auch Mengen ohne Prämie (sonstige Direktvermarktung)", dec=1)
    add("eeg_off_twh", "EEG-abgerechnete Strommenge Wind auf See 2025", off.strommenge_twh.sum(), "TWh", "2025", EEG, "Summe Strommenge", dec=1)
    add("eeg_on_ct", "EEG-Zahlung je kWh, Wind an Land 2025", on.zahlung_mio_eur.sum() * 1e8 / (on.strommenge_twh.sum() * 1e9), "ct/kWh", "2025", EEG, "Zahlungen / Strommenge", dec=2)
    add("eeg_off_ct", "EEG-Zahlung je kWh, Wind auf See 2025", off.zahlung_mio_eur.sum() * 1e8 / (off.strommenge_twh.sum() * 1e9), "ct/kWh", "2025", EEG, "Zahlungen / Strommenge", dec=2)
    el = csv("eeg2025_laender.csv")
    elo = el[el.et == "an Land"].set_index("bl")
    for key, name in [("ni", "Niedersachsen"), ("sh", "Schleswig-Holstein"), ("bb", "Brandenburg"), ("by", "Bayern")]:
        add(f"eeg_{key}_mio", f"EEG-Zahlungen Wind an Land 2025, {name}", elo.loc[name, "zahlung_mio_eur"], "Mio. €", "2025", EEG, "Bundesland laut EEG-Anlagenstammdaten", dec=0)
        add(f"eeg_{key}_ct", f"EEG-Zahlung je kWh Wind an Land 2025, {name}", elo.loc[name, "ct_je_kwh"], "ct/kWh", "2025", EEG, "Zahlungen / Strommenge", dec=2)
    awz = el[(el.bl == "Ausschließliche Wirtschaftszone")].iloc[0]
    add("eeg_awz_mio", "EEG-Zahlungen an Windparks in der AWZ 2025", awz.zahlung_mio_eur, "Mio. €", "2025", EEG, "Bundesland-Code 17 (AWZ)", dec=0)

    vg = csv("eeg2025_vlh_gesamt.csv").set_index("lage")
    add("vlh_on_eeg", "Volllaststunden Wind an Land 2025 (ganzjährig betriebene EEG-Anlagen)", vg.loc["an Land", "vlh_gewichtet"], "h", "2025", EEGxMASTR,
        f"Summe Strommenge / Summe MaStR-Bruttoleistung, {int(vg.loc['an Land','einheiten'])} Einheiten mit Inbetriebnahme vor 2025", "nach Abregelung; ohne Eigenverbrauch", dec=0)
    add("vlh_off_eeg", "Volllaststunden Wind auf See 2025 (ganzjährig betriebene EEG-Anlagen)", vg.loc["auf See", "vlh_gewichtet"], "h", "2025", EEGxMASTR,
        f"{int(vg.loc['auf See','einheiten'])} Einheiten", dec=0)
    vj = csv("eeg2025_vlh_baujahr.csv"); vj = vj[vj.lage == "an Land"].set_index("jahr")
    add("vlh_bj1995", "Volllaststunden 2025, Anlagen an Land Baujahr 1995 (Median)", vj.loc[1995, "vlh_median"], "h", "2025", EEGxMASTR, dec=0)
    add("vlh_bj2017", "Volllaststunden 2025, Anlagen an Land Baujahr 2017 (Median)", vj.loc[2017, "vlh_median"], "h", "2025", EEGxMASTR, dec=0)
    add("mwh_bj1995", "Jahresertrag 2025 je Anlage an Land, Baujahr 1995 (Median)", vj.loc[1995, "mwh_je_anlage_median"], "MWh", "2025", EEGxMASTR, dec=0)
    add("mwh_bj2024", "Jahresertrag 2025 je Anlage an Land, Baujahr 2024 (Median)", vj.loc[2024, "mwh_je_anlage_median"], "MWh", "2025", EEGxMASTR, dec=0)
    add("mw_bj2024", "Mittlere Leistung der Anlagen Baujahr 2024 in dieser Auswertung", vj.loc[2024, "kw_mittel"] / 1e3, "MW", "2025", EEGxMASTR, dec=1)
    vb = csv("eeg2025_vlh_laender.csv").set_index("bl")
    add("vlh_sh", "Volllaststunden 2025 Wind an Land, Schleswig-Holstein", vb.loc["Schleswig-Holstein", "vlh_gewichtet"], "h", "2025", EEGxMASTR, dec=0)
    add("vlh_by", "Volllaststunden 2025 Wind an Land, Bayern", vb.loc["Bayern", "vlh_gewichtet"], "h", "2025", EEGxMASTR, dec=0)
    add("vlh_bb", "Volllaststunden 2025 Wind an Land, Brandenburg", vb.loc["Brandenburg", "vlh_gewichtet"], "h", "2025", EEGxMASTR, dec=0)

    # SMARD
    sk = json.loads((CSV / "smard_2025_kennzahlen.json").read_text())
    add("smard_anteil_last", "Anteil Wind an der Netzlast 2025", sk["anteil_netzlast_pct"], "%", "2025", SMARD, "Summe Wind an Land + auf See / Summe Netzlast (Stundenwerte)", dec=1)
    add("preis_mittel", "Mittlerer Day-Ahead-Preis DE/LU 2025 (ungewichtet)", sk["preis_mittel"], "€/MWh", "2025", SMARD, "Mittel der 8.760 Stundenwerte", dec=1)
    add("preis_windstark", "Mittlerer Day-Ahead-Preis in den 10 % windstärksten Stunden 2025", sk["preis_windstark_10pct"], "€/MWh", "2025", SMARD, "Stunden mit Windeinspeisung ≥ 90. Perzentil", dec=0)
    add("preis_windschwach", "Mittlerer Day-Ahead-Preis in den 10 % windschwächsten Stunden 2025", sk["preis_windschwach_10pct"], "€/MWh", "2025", SMARD, "Stunden mit Windeinspeisung ≤ 10. Perzentil", dec=0)
    add("std_negativ", "Stunden mit negativem Day-Ahead-Preis 2025", sk["stunden_negativ"], "h", "2025", SMARD, "Stundenwerte < 0 €/MWh", dec=0)
    add("wind_max_gw", "Höchste stündliche Windeinspeisung 2025", sk["wind_max_gw"], "GW", "2025", SMARD, dec=1)
    add("wind_min_gw", "Niedrigste stündliche Windeinspeisung 2025", sk["wind_min_gw"], "GW", "2025", SMARD, dec=1)
    add("std_wind_u5", "Stunden 2025 mit weniger als 5 GW Windeinspeisung", sk["stunden_wind_unter_5gw"], "h", "2025", SMARD, dec=0)

    # Recherche-Werte (Veröffentlichungen), siehe scripts/recherche.json
    for e in RES["kennzahlen"]:
        R.append(dict(e, dec=e.get("dec")))

    # Werte für den Rechner (eigene Auswertung / eigene Rechnung)
    vn = csv("eeg2025_vlh_baujahr.csv"); vn = vn[(vn.lage == "an Land") & vn.jahr.between(2020, 2024)]
    add("vlh_neu_eeg", "Volllaststunden 2025 der Anlagen an Land mit Baujahr 2020–2024", vn.mwh.sum() * 1e3 / vn.kw.sum(), "h", "2025", EEGxMASTR,
        f"Summe Strommenge / Summe Bruttoleistung, {int(vn.einheiten.sum())} Einheiten", "2025 war ein windschwaches Jahr (Fraunhofer ISE: 1.639 h gegenüber 1.759 h im Mittel 2015–2025)", dec=0)
    add("kw_bestand_eeg", "Mittlere Leistung der ganzjährig betriebenen EEG-Anlagen an Land 2025", vg.loc["an Land", "kw_mittel"] / 1e3, "MW", "2025", EEGxMASTR, "Mittelwert MaStR-Bruttoleistung", dec=2)
    add("mastr_stand_txt", "Stand des Marktstammdatenregister-Exports", "21.09.2026", "", st, MASTR, "Dateiname Gesamtdatenexport_20260921_26.1.zip")
    R.extend(rechner(R))

    add("dom_hoehe", "Höhe Südturm Kölner Dom", 157.22, "m", "–", KOELN, "„157,22 m Südturm Höhe“", dec=2)
    return R


def _lcoe(p, capex, vlh, wacc):
    w = wacc / 100; crf = w * (1 + w) ** p["life"] / ((1 + w) ** p["life"] - 1)
    fuel = p.get("fuel", 0) / p.get("eta", 1) / 1000 if p.get("fuel") else 0
    return ((capex * crf + p["fix"]) / vlh + p["var"] + fuel) * 100


def rechner(R):
    """Voreinstellungen des Rechners als belegte Kennzahlen (gleiche Formel wie assets/js/calc.js)."""
    ids = {e["id"]: e["wert"] for e in R}
    L = RES["chart"]["lcoe"]; P = L["param"]; sysc = L["system"]
    src = dict(quelle="Eigene Rechnung: Kosten nach Fraunhofer ISE (2024), Systemkosten nach OECD-NEA (2012), Auslastung Kernkraft nach IAEA (Isar 2, 2021)",
               url="https://www.ise.fraunhofer.de/content/dam/ise/de/documents/publications/studies/DE2024_ISE_Studie_Stromgestehungskosten_Erneuerbare_Energien.pdf")
    vlh_kkw = round(ids["iaea_isar2_gwh"] * 1000 / ids["iaea_isar2_mw"] / 10) * 10
    out = []
    for key, lab in [("on", "Wind an Land"), ("off", "Wind auf See"), ("kkw", "Kernkraft (neu)")]:
        p = P[key]
        lo, hi = (_lcoe(p, p["capex"][0], vlh_kkw, 7), _lcoe(p, p["capex"][1], vlh_kkw, 7)) if key == "kkw" else (_lcoe(p, p["capex"][0], p["vlh"][1], 7), _lcoe(p, p["capex"][1], p["vlh"][0], 7))
        add_ = sysc["p30"][key] / sysc["kurs"] / 10
        out.append(dict(id=f"calc_{key}_lo", kennzahl=f"LCOE {lab}, gleiche Basis inkl. Systemkosten, untere Grenze", wert=lo + add_, einheit="ct/kWh", stichtag="Preisbasis 2024 (Systemkosten: NEA 2012)",
                        fundstelle=f"WACC real 7 % für alle; Kernkraft {vlh_kkw} h; Systemkosten NEA, Deutschland, 30 % Anteil: +{add_:.2f} ct/kWh", anmerkung="Formel im Rechner und in scripts/kennzahlen.py", dec=1, **src))
        out.append(dict(id=f"calc_{key}_hi", kennzahl=f"LCOE {lab}, gleiche Basis inkl. Systemkosten, obere Grenze", wert=hi + add_, einheit="ct/kWh", stichtag="Preisbasis 2024 (Systemkosten: NEA 2012)",
                        fundstelle="wie untere Grenze", anmerkung="", dec=1, **src))
    ew = ids["wg_neu_kw"] * next(e["wert"] for e in R if e["id"] == "vlh_neu_eeg")
    out.append(dict(id="kkw_n_neu_on", kennzahl="Neue Windanlagen an Land mit gleicher Jahreserzeugung wie Isar 2", wert=ids["iaea_isar2_mw"] * vlh_kkw / ew, einheit="Anlagen", stichtag="Erzeugung 2025 bzw. 2021",
                    fundstelle=f"{ids['iaea_isar2_mw']} MW × {vlh_kkw} h ÷ ({ids['wg_neu_kw']} MW × Volllaststunden Baujahr 2020–2024)", anmerkung="Energievergleich, nicht gesicherte Leistung", dec=0, **src))
    out.append(dict(id="kkw_n_firm_on", kennzahl="Neue Windanlagen an Land mit gleicher gesicherter Leistung wie Isar 2 (Leistungskredit 6 %)", wert=ids["iaea_isar2_mw"] * 0.97 / (ids["wg_neu_kw"] * 0.06), einheit="Anlagen", stichtag="NEA 2012",
                    fundstelle="1.410 MW × 97 % ÷ (5,46 MW × 6 %)", anmerkung="Leistungskredite nach NEA 2012, Tab. 4.3A", dec=0, **src))
    out.append(dict(id="kkw_vlh", kennzahl="Volllaststunden Isar 2 im Jahr 2021 (abgeleitet)", wert=vlh_kkw, einheit="h", stichtag="2021",
                    fundstelle="11.421,16 GWh ÷ 1.410 MW, gerundet", anmerkung="", dec=0, **src))
    return out


def chartdata():
    z = csv("agee_zeitreihe_2000_2025.csv")
    mo = csv("smard_monate.csv"); mo = mo[mo.monat.str.startswith("2025")]
    jg = csv("mastr_jahrgaenge.csv"); jg = jg[(jg.lage == "an Land") & (jg.ibn_jahr.between(1995, 2025))]
    vj = csv("eeg2025_vlh_baujahr.csv"); vj = vj[(vj.lage == "an Land") & (vj.jahr.between(1995, 2024))]
    hs = csv("mastr_hersteller.csv")
    top = ["Enercon", "Vestas", "Nordex", "Siemens Gamesa", "GE", "Senvion/REpower"]
    hs["marke2"] = hs.marke.where(hs.marke.isin(top), "Übrige")
    h = hs.groupby("marke2")[["leistung_mw", "zubau2025_mw", "off_leistung_mw"]].sum().reindex(top + ["Übrige"]).reset_index()
    ml = csv("mastr_laender.csv").set_index("bundesland")
    el = csv("eeg2025_laender.csv")
    elo = el[el.et == "an Land"].set_index("bl")
    vb = csv("eeg2025_vlh_laender.csv").set_index("bl")
    reg = RES.get("laender", {})
    laender = []
    for name in ml.index:
        r = {"name": name, "n": int(ml.loc[name, "anzahl"]), "mw": round(float(ml.loc[name, "leistung_mw"]), 1),
             "planung_mw": round(float(ml.loc[name, "planung_mw"]), 1),
             "eeg_mio": round(float(elo.loc[name, "zahlung_mio_eur"]), 1) if name in elo.index else None,
             "eeg_ct": round(float(elo.loc[name, "ct_je_kwh"]), 2) if name in elo.index else None,
             "eeg_gwh": round(float(elo.loc[name, "strommenge_gwh"]), 0) if name in elo.index else None,
             "vlh": round(float(vb.loc[name, "vlh_gewichtet"])) if name in vb.index else None}
        r.update(reg.get(name, {}))
        laender.append(r)
    mer = csv("smard_2025_preis_nach_windanteil.csv")
    fam = csv("eeg2025_vlh_typfamilien.csv")
    tf = csv("mastr_typfamilien.csv")

    def typ(label, lage, marke, rd, era):
        a = tf[(tf.lage == lage) & (tf.marke == marke) & (tf.rd == rd)].iloc[0]
        f = fam[(fam.lage == lage) & (fam.marke == marke) & (fam.rd == rd)]
        return {"label": label, "lage": lage, "hersteller": marke, "kw": float(a.kw_median), "nabe": float(a.nabe_median),
                "rotor": float(rd), "n": int(a.anzahl), "ibn_von": int(a.ibn_von), "ibn_bis": int(a.ibn_bis), "era": era,
                "mwh": round(float(f.iloc[0].mwh_je_anlage_median)) if len(f) else None,
                "vlh": round(float(f.iloc[0].vlh_median)) if len(f) else None,
                "n_ertrag": int(f.iloc[0].einheiten) if len(f) else 0}
    typen = [typ("Enercon E-40", "an Land", "Enercon", 40, "1990er"), typ("Enercon E-70", "an Land", "Enercon", 71, "2000er"),
             typ("Enercon E-82", "an Land", "Enercon", 82, "2000er/10er"), typ("Vestas V90", "an Land", "Vestas", 90, "2000er"),
             typ("Vestas V112", "an Land", "Vestas", 112, "2010er"), typ("Enercon E-160 EP5", "an Land", "Enercon", 160, "2020er"),
             typ("Vestas V162", "an Land", "Vestas", 162, "2020er"), typ("Siemens SWT-3.6-120", "auf See", "Siemens Gamesa", 120, "2010er"),
             typ("Vestas V236-15.0", "auf See", "Vestas", 236, "2020er")]
    return {
        "zeitreihe": z.to_dict("list"),
        "monate": {"monat": mo.monat.tolist(), "wind_on": mo.wind_on.round(2).tolist(), "wind_off": mo.wind_off.round(2).tolist(), "pv": mo.pv.round(2).tolist()},
        "jahrgang": {"jahr": jg.ibn_jahr.astype(int).tolist(), "mw": (jg.mittel_kw / 1e3).round(2).tolist(), "nabe": jg.nabe_m.round(0).tolist(),
                     "rotor": jg.rotor_m.round(0).tolist(), "n": jg.anzahl.astype(int).tolist()},
        "ertrag": {"jahr": vj.jahr.astype(int).tolist(), "vlh": vj.vlh_median.round(0).tolist(), "mwh": vj.mwh_je_anlage_median.round(0).tolist(),
                   "n": vj.einheiten.astype(int).tolist()},
        "hersteller": {"marke": h.marke2.tolist(), "bestand_mw": h.leistung_mw.round(0).tolist(), "zubau_mw": h.zubau2025_mw.round(0).tolist(),
                       "off_mw": h.off_leistung_mw.round(0).tolist()},
        "laender": laender,
        "merit": mer.to_dict("list"),
        "typen": typen,
        "dom": {"sued": 157.22, "nord": 157.18, "laenge": 144.58, "breite_west": 61.54, "vierung": 109.12, "querhaus": 69.95, "breite": 86.25},
        "recherche": RES.get("chart", {}),
    }
