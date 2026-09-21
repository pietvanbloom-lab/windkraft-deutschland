"""Prüft die Seite im Headless-Chromium und erzeugt die Screenshots in screenshots/.

Aufruf: python scripts/05_screenshots.py [URL]   (Standard: file://…/index.html, also wie per Doppelklick)
Meldet Konsolenfehler und fehlgeschlagene Requests; Exit-Code 1 bei Fehlern.
"""
import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = sys.argv[1] if len(sys.argv) > 1 else (ROOT / "index.html").as_uri()
OUT = ROOT / "screenshots"
OUT.mkdir(exist_ok=True)
errors = []


def watch(page):
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type in ("error", "warning") and "GL Driver Message" not in m.text else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("requestfailed", lambda r: errors.append(f"requestfailed: {r.url} {r.failure}"))


def scroll_to(page, sel, block="start", wait=1.2):
    page.eval_on_selector(sel, f"e => e.scrollIntoView({{block: '{block}'}})")
    time.sleep(wait)


def desktop(p, theme="light"):
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1, color_scheme=theme)
    page = ctx.new_page(); watch(page)
    page.goto(URL); time.sleep(1.5)
    sfx = "" if theme == "light" else "-dunkel"
    page.screenshot(path=OUT / f"01-start{sfx}.png")
    # Karte: Bundesländer (Schritt Leistung) – Karte mittig
    scroll_to(page, '.step[data-step="leistung"]', "center", 2.0)
    page.locator(".map-stage").screenshot(path=OUT / f"02-karte-bundeslaender{sfx}.png")
    scroll_to(page, '.step[data-step="netzentgelt"]', "center", 2.0)
    page.locator(".map-stage").screenshot(path=OUT / f"03-karte-netzentgelte{sfx}.png")
    scroll_to(page, '.step[data-step="zoom"]', "center", 4.5)
    page.locator(".map-stage").screenshot(path=OUT / f"04-karte-einzelanlagen{sfx}.png")
    # Tooltip auf einer Anlage testen
    info = page.evaluate("() => ({pts: window.WK_TURBINES ? window.WK_TURBINES.n : 0})")
    # Charts
    for name, fn in [("ausbau", "05-chart-ausbau-erzeugung"), ("jahrgang", "06-chart-ertrag-nach-baujahr"), ("merit", "08-chart-merit-order"), ("runden", "07-chart-ausschreibungen"), ("lcoe", "10-chart-lcoe")]:
        scroll_to(page, f'.figure[data-chart="{name}"]', "center", 1.6)
        target = page.locator(".two") if name == "ausbau" else page.locator(f'.figure[data-chart="{name}"]')
        target.screenshot(path=OUT / f"{fn}{sfx}.png")
    # 3D
    scroll_to(page, "#viz3d", "center", 6.0)
    page.locator("#viz3d").screenshot(path=OUT / f"09-3d-vergleich{sfx}.png")
    page.click('.typecard[data-i="6"]'); time.sleep(2.5)
    page.locator("#viz3d").screenshot(path=OUT / f"09b-3d-v162{sfx}.png")
    # Rechner
    scroll_to(page, "#calc", "start", 1.2)
    page.locator("#calc").screenshot(path=OUT / f"11-rechner-kernkraft{sfx}.png")
    scroll_to(page, "#fazit", "start", 1.0)
    page.screenshot(path=OUT / f"12-fazit{sfx}.png")
    b.close()
    return info


def mobile(p):
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page(); watch(page)
    t0 = time.time(); page.goto(URL, wait_until="load"); load = time.time() - t0
    page.screenshot(path=OUT / "20-mobil-start.png")
    scroll_to(page, '.step[data-step="leistung"]', "end", 2.0)
    page.screenshot(path=OUT / "21-mobil-karte.png")
    scroll_to(page, '.step[data-step="zoom"]', "end", 4.5)
    page.screenshot(path=OUT / "22-mobil-einzelanlagen.png")
    scroll_to(page, "#viz3d", "center", 6.0)
    page.screenshot(path=OUT / "23-mobil-3d.png")
    scroll_to(page, "#calc", "start", 1.2)
    page.screenshot(path=OUT / "24-mobil-rechner.png")
    b.close()
    return load


with sync_playwright() as p:
    info = desktop(p)
    load = mobile(p)
    if "--dark" in sys.argv:
        desktop(p, "dark")
print("Einzelanlagen geladen:", info, "Ladezeit mobil (lokal):", round(load, 2), "s")
if errors:
    print("\n".join(errors)); sys.exit(1)
print("keine Konsolenfehler")
