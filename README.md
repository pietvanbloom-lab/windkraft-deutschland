# Windkraft in Deutschland

Scrollbare, interaktive Präsentation über Windenergieanlagen in Deutschland: Bestand und Standorte, Stromerzeugung, Leistung einzelner Anlagen, Hersteller, Förderung, Wirkung auf Strompreise sowie Kosten im Vergleich mit Kernkraft. Jede Kernzahl ist in [`sources.md`](sources.md) und auf der Seite [`quellen.html`](quellen.html) mit Wert, Einheit, Stichtag, Quelle, Link und Fundstelle belegt.

**Live:** https://pietvanbloom-lab.github.io/windkraft-deutschland/

Datenstand: Marktstammdatenregister (Gesamtexport) vom 21.09.2026; Jahreswerte 2025.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `index.html` | Präsentation (erzeugt aus `src/index.template.html`) |
| `quellen.html`, `sources.md` | Quellentabelle (erzeugt aus `scripts/kennzahlen.py` und `scripts/recherche.json`) |
| `assets/` | CSS, JavaScript, lokal eingebundene Bibliotheken (D3 7.9.0, Chart.js 4.4.7, three.js r147) |
| `data/core.js`, `data/geo.js` | Kennzahlen, Chart-Daten und Ländergrenzen, beim Seitenaufruf geladen |
| `data/turbines.js`, `data/kreise.js` | 31.013 Einzelanlagen und Kreisgrenzen, erst beim Hineinzoomen nachgeladen |
| `data/csv/` | Zwischenergebnisse der Auswertungen (CSV/JSON) |
| `scripts/` | Auswertungs- und Build-Skripte |
| `screenshots/` | Karte (Bundesländer, Einzelanlagen), 3D-Vergleich, Charts, Rechner, Mobilansicht |

Die Seite braucht keinen Build-Schritt und kein Backend: Alle Daten sind als Momentaufnahme in JavaScript-Dateien eingebettet und werden per `<script>` geladen, daher läuft sie auch per Doppelklick auf `index.html` (file://).

## Daten neu erzeugen

Rohdaten liegen nicht im Repository (Größe). Erwartet werden sie unter `raw/` (oder `$WK_RAW`):

- `raw/mastr/EinheitenWind.xml`, `Katalogwerte.xml`: aus dem [MaStR-Gesamtdatenexport](https://www.marktstammdatenregister.de/MaStR/Datendownload)
- `raw/eeg25/`: die acht ZIP-Dateien „EEG-Zahlungen Anlagenstammdaten/Bewegungsdaten 2025“ der vier Übertragungsnetzbetreiber von [netztransparenz.de](https://www.netztransparenz.de/de-de/Erneuerbare-Energien-und-Umlagen/EEG/EEG-Abrechnungen/EEG-Jahresabrechnungen/EEG-Bewegungsdaten), entpackt
- `raw/geo/`: BKG VG2500 (Länder, Kreise) per WFS und Natural Earth Admin 0 (1:50 Mio.), vereinfacht mit mapshaper

```bash
python scripts/01_mastr.py      # Bestand, Bundesländer, Jahrgänge, Hersteller, Anlagenpunkte
python scripts/02_eeg.py        # EEG-Zahlungen 2025 je Bundesland, Volllaststunden nach Baujahr
python scripts/03_smard.py      # SMARD-Stundenwerte 2025: Erzeugung, Netzlast, Preise
python scripts/04_build.py --strict   # core.js, index.html, quellen.html, sources.md
python scripts/05_screenshots.py      # Prüfung im Headless-Chromium und Screenshots
```

Benötigt: Python 3 mit pandas, lxml, openpyxl, requests, playwright.

## Datenschutz

Aus dem Marktstammdatenregister werden keine Betreiber-, Namens-, Adress- oder Flurstücksfelder übernommen, ebenso keine MaStR-Nummern und keine Freitext-Typbezeichnungen (dort stehen teils Seriennummern); ausgeliefert wird nur die häufigste Bezeichnung einer Typfamilie. Anlagen unter 100 kW (meist private Kleinwindanlagen) erscheinen nicht als Punkte. Koordinaten sind auf vier Nachkommastellen gerundet.

## Lizenzen und Quellenvermerke

- Marktstammdatenregister: © Bundesnetzagentur, [Datenlizenz Deutschland – Namensnennung – 2.0](https://www.govdata.de/dl-de/by-2-0), verändert (aggregiert und gefiltert).
- Verwaltungsgrenzen: © BKG (2026) dl-de/by-2-0, Datenquellen: https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg_nuts.pdf
- Nachbarstaaten: Natural Earth, gemeinfrei.
- SMARD: Bundesnetzagentur | SMARD.de, CC BY 4.0.
- Weitere Quellen (UBA/AGEE-Stat, Deutsche WindGuard, BNetzA, Übertragungsnetzbetreiber, Fraunhofer ISE, OECD-NEA, IAEA u. a.) sind in `sources.md` mit Fundstelle zitiert.
- Bibliotheken: D3.js (ISC), Chart.js (MIT), three.js (MIT); Lizenztexte in `assets/vendor/`.
