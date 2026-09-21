"""Baut data/core.js, data/geo.js, data/kreise.js, index.html, quellen.html und sources.md.

Alle Kennzahlen stehen genau einmal in scripts/kennzahlen.py (Wert, Einheit, Stichtag, Quelle,
Link, Fundstelle). Die Seite (Platzhalter {{id}} in src/*.template.html), die Quellenseite und
sources.md werden daraus erzeugt, damit Text, Charts und Quellentabelle nicht auseinanderlaufen.

Aufruf: python scripts/04_build.py [--strict]
"""
import csv, html as html_mod, json, math, re, sys
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import kennzahlen as K  # noqa: E402

CSV = ROOT / "data" / "csv"
RAW = ROOT / "raw"


def fmt(v, dec=None):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return "–"
    if isinstance(v, str):
        return v
    if dec is None:
        dec = 0 if abs(v) >= 100 or float(v).is_integer() else 1
    s = f"{v:,.{dec}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def _area(ring):
    return sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1])) / 2


def _rewind(geom):
    """d3-geo erwartet Außenringe im Uhrzeigersinn (umgekehrt zu RFC 7946), sonst füllt ein
    Polygon die ganze Kugel außer sich selbst."""
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    for poly in polys:
        for i, ring in enumerate(poly):
            a = _area(ring)
            if (i == 0 and a > 0) or (i > 0 and a < 0):
                ring.reverse()
    return geom


def load_geo():
    g = RAW / "geo"
    def gj(p, keep):
        d = json.loads((g / p).read_text())
        for f in d["features"]:
            f["properties"] = {k: f["properties"].get(k) for k in keep}
            if f.get("geometry"):
                _rewind(f["geometry"])
        return d
    lan = gj("lan_s.json", ["gen", "ags"])
    wasser = gj("water_s.json", ["gen"])
    nach = gj("ne_neighbors.json", ["ADM0_A3", "NAME_DE"])
    nach["features"] = [f for f in nach["features"] if f["properties"]["ADM0_A3"] != "DEU"]
    krs = gj("krs_s.json", ["gen", "bez"])
    js = "window.WK_GEO=" + json.dumps({"laender": lan, "wasser": wasser, "nachbarn": nach}, separators=(",", ":"), ensure_ascii=False) + ";\n"
    (ROOT / "data" / "geo.js").write_text(js, encoding="utf-8")
    (ROOT / "data" / "kreise.js").write_text("window.WK_KREISE=" + json.dumps(krs, separators=(",", ":"), ensure_ascii=False) + ";\n", encoding="utf-8")


def offshore_points():
    """Offshore-Anlagen (in Betrieb) für die Übersichtskarte, direkt aus turbines.js."""
    t = (ROOT / "data" / "turbines.js").read_text(encoding="utf-8")
    d = json.loads(t[t.index("=") + 1:].rstrip().rstrip(";"))
    x = 0; out = []
    for i in range(d["n"]):
        x += d["dx"][i]
        if d["s"][i] == 1:
            out.append([x, d["y"][i], d["kw"][i]])
    return out


def build_core():
    k = K.registry()
    ids = {e["id"]: e for e in k}
    WK = {"k": {e["id"]: {"v": e["wert"], "u": e.get("einheit", ""), "t": fmt(e["wert"], e.get("dec"))} for e in k}}
    WK.update(K.chartdata())
    WK["offshore"] = offshore_points()
    js = "window.WK=" + json.dumps(WK, separators=(",", ":"), ensure_ascii=False, allow_nan=False) + ";\n"
    (ROOT / "data" / "core.js").write_text(js, encoding="utf-8")
    return k, ids


def esc(x):
    return html_mod.escape(str(x if x is not None else ""))


def quellen_html(k):
    rows = []
    for e in quellen_rows(k):
        link = f'<a href="{esc(e["url"])}" rel="noopener">{esc(e["quelle"])}</a>' if e.get("url") else esc(e["quelle"])
        fund = esc(e.get("fundstelle") or "") + (("<br><span class=\"small\">" + esc(e["anmerkung"]) + "</span>") if e.get("anmerkung") else "")
        rows.append(f'<tr id="k-{esc(e["id"])}"><td data-l="Kennzahl">{esc(e["kennzahl"])}<br><code>{esc(e["id"])}</code></td>'
                    f'<td class="val" data-l="Wert">{esc(fmt(e["wert"], e.get("dec")))} {esc(e.get("einheit", ""))}</td>'
                    f'<td data-l="Stichtag">{esc(e.get("stichtag", ""))}</td><td data-l="Quelle">{link}</td><td data-l="Fundstelle">{fund}</td></tr>')
    return "\n".join(rows)


def render(template, out, ids, strict, extra=None):
    t = (ROOT / "src" / template).read_text(encoding="utf-8")
    for key, val in (extra or {}).items():
        t = t.replace("{{" + key + "}}", val)
    missing = set()
    def rep(m):
        key, dec = m.group(1), m.group(2)
        e = ids.get(key)
        if e is None or e["wert"] is None:
            missing.add(key); return "–"
        return fmt(e["wert"], int(dec) if dec else e.get("dec"))
    html = re.sub(r"\{\{([a-z0-9_]+)(?:\|(\d))?\}\}", rep, t)
    (ROOT / out).write_text(html, encoding="utf-8")
    if missing:
        print(f"{out}: fehlende Kennzahlen: {sorted(missing)}")
        if strict:
            sys.exit(1)


def quellen_rows(k):
    return [e for e in k if e.get("quelle")]


def build_sources_md(k):
    lines = ["# Quellentabelle: Windkraft in Deutschland", "",
             "Jede Kernzahl der Seite mit Wert, Einheit, Stichtag, Quelle und Link. Erzeugt aus `scripts/kennzahlen.py` "
             "(`python scripts/04_build.py`). Eigene Berechnungen sind als solche markiert und im Skript nachvollziehbar.", "",
             "| ID | Kennzahl | Wert | Einheit | Stichtag / Bezug | Quelle | Fundstelle / Methode |", "|---|---|---|---|---|---|---|"]
    for e in quellen_rows(k):
        src = f"[{e['quelle']}]({e['url']})" if e.get("url") else e["quelle"]
        fund = (e.get("fundstelle") or "").replace("|", "/")
        if e.get("anmerkung"):
            fund += (" – " if fund else "") + e["anmerkung"].replace("|", "/")
        lines.append(f"| `{e['id']}` | {e['kennzahl']} | {fmt(e['wert'], e.get('dec'))} | {e.get('einheit','')} | {e.get('stichtag','')} | {src} | {fund} |")
    lines += ["", "## Datenlizenzen und Kartenquellen", ""] + [f"- {l}" for l in K.LIZENZEN]
    (ROOT / "sources.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    strict = "--strict" in sys.argv
    load_geo()
    k, ids = build_core()
    render("index.template.html", "index.html", ids, strict)
    render("quellen.template.html", "quellen.html", ids, strict, {
        "QUELLEN_ROWS": quellen_html(k),
        "LIZENZ_ITEMS": "\n".join(f"<li>{esc(l)}</li>" for l in K.LIZENZEN)})
    build_sources_md(k)
    size = {p.name: p.stat().st_size for p in (ROOT / "data").glob("*.js")}
    print("ok", size)


if __name__ == "__main__":
    main()
