"""SMARD (Bundesnetzagentur) -> Erzeugung, Netzlast, Day-Ahead-Preis.

Lädt die öffentlichen Chart-Daten von smard.de (Lizenz CC BY 4.0, Quelle: Bundesnetzagentur | SMARD.de)
und schreibt Jahres-, Monats- und Stundenauswertungen nach data/csv/smard_*.csv.
Filter-IDs: 4067 Wind an Land, 1225 Wind auf See, 410 Netzlast, 4169 Day-Ahead DE/LU, 4068 PV.
"""
import datetime as dt, json, os
from pathlib import Path
import pandas as pd, requests, numpy as np

ROOT = Path(__file__).resolve().parents[1]
RAW = Path(os.environ.get("WK_RAW", ROOT / "raw"))
CSV = ROOT / "data" / "csv"
F = {4067: "wind_on", 1225: "wind_off", 410: "last", 4169: "preis", 4068: "pv", 4359: "residual",
     1223: "braunkohle", 4069: "steinkohle", 4071: "erdgas", 4066: "biomasse", 1226: "wasser", 1228: "sonst_ee",
     1227: "sonst_konv", 4070: "pumpspeicher", 1224: "kernenergie"}
S = requests.Session(); S.headers["User-Agent"] = "Mozilla/5.0"
BASE = "https://www.smard.de/app/chart_data"


def series(fid, res, since=None):
    idx = S.get(f"{BASE}/{fid}/DE/index_{res}.json", timeout=60).json()["timestamps"]
    rows = []
    for t in idx:
        if since and t < since:
            continue
        rows += S.get(f"{BASE}/{fid}/DE/{fid}_DE_{res}_{t}.json", timeout=60).json()["series"]
    s = pd.Series({a: b for a, b in rows}, dtype=float)
    s.index = pd.to_datetime(s.index, unit="ms", utc=True).tz_convert("Europe/Berlin")
    return s


def main():
    cache = RAW / "smard" / "hourly.pkl"
    if cache.exists():
        h = pd.read_pickle(cache).tz_convert("Europe/Berlin")
    else:
        since = int(dt.datetime(2024, 12, 20, tzinfo=dt.timezone.utc).timestamp() * 1000)
        h = pd.DataFrame({n: series(f, "hour", since) for f, n in F.items()})
    y = h[h.index.year == 2025].copy()
    assert len(y) == 8760 and y.wind_on.notna().all()

    # Jahreswerte 2015-2025
    yr = pd.DataFrame({n: series(f, "year") for f, n in F.items() if n in ("wind_on", "wind_off", "last", "preis", "pv")})
    yr.index = yr.index.year
    for c in ["wind_on", "wind_off", "last", "pv"]:
        yr[c] = yr[c] / 1e6
    yr.index.name = "jahr"
    yr.round(2).to_csv(CSV / "smard_jahre.csv")

    # Monatswerte (TWh) 2024-2026
    mo = pd.DataFrame({n: series(f, "month") for f, n in F.items() if n in ("wind_on", "wind_off", "last", "pv")}) / 1e6
    mo = mo[mo.index >= "2024-01-01"]
    mo.index = mo.index.strftime("%Y-%m")
    mo.index.name = "monat"
    mo.round(3).to_csv(CSV / "smard_monate.csv")

    # Kennzahlen 2025
    gen = ["wind_on", "wind_off", "pv", "braunkohle", "steinkohle", "erdgas", "biomasse", "wasser", "sonst_ee", "sonst_konv", "pumpspeicher"]
    tot = y[gen].sum().sum() / 1e6
    wind = (y.wind_on.sum() + y.wind_off.sum()) / 1e6
    y["wind"] = y.wind_on + y.wind_off
    y["wind_anteil"] = y.wind / y["last"]
    k = {
        "jahr": 2025,
        "wind_on_twh": round(y.wind_on.sum() / 1e6, 2), "wind_off_twh": round(y.wind_off.sum() / 1e6, 2),
        "netzlast_twh": round(y["last"].sum() / 1e6, 2), "erzeugung_twh": round(tot, 2),
        "anteil_erzeugung_pct": round(wind / tot * 100, 1), "anteil_netzlast_pct": round(wind / (y["last"].sum() / 1e6) * 100, 1),
        "preis_mittel": round(y.preis.mean(), 2), "stunden_negativ": int((y.preis < 0).sum()),
        "wind_max_gw": round(y.wind.max() / 1e3, 1), "wind_min_gw": round(y.wind.min() / 1e3, 2),
        "stunden_wind_unter_5gw": int((y.wind < 5000).sum()),
        "stunden_wind_ueber_last_50pct": int((y.wind_anteil > .5).sum()),
    }
    q = y.wind.quantile([.1, .9])
    k["preis_windschwach_10pct"] = round(y[y.wind <= q[.1]].preis.mean(), 1)
    k["preis_windstark_10pct"] = round(y[y.wind >= q[.9]].preis.mean(), 1)
    # Preis nach Windanteil an der Netzlast (Korrelation, keine Kausalanalyse)
    bins = [0, .1, .2, .3, .4, .5, .6, 2]
    labels = ["<10 %", "10–20 %", "20–30 %", "30–40 %", "40–50 %", "50–60 %", "≥60 %"]
    y["klasse"] = pd.cut(y.wind_anteil, bins=bins, labels=labels, right=False)
    mo2 = y.groupby("klasse", observed=False).agg(stunden=("preis", "size"), preis_mittel=("preis", "mean"),
                                                  preis_median=("preis", "median"),
                                                  negativ=("preis", lambda s: int((s < 0).sum())),
                                                  pv_mittel_gw=("pv", lambda s: s.mean() / 1e3),
                                                  last_mittel_gw=("last", lambda s: s.mean() / 1e3)).reset_index()
    mo2.round(2).to_csv(CSV / "smard_2025_preis_nach_windanteil.csv", index=False)
    # Monatliche Wind-Tagesprofile: Tagesmittel 2025 für Linienchart
    d = y.resample("D").agg({"wind_on": "sum", "wind_off": "sum", "last": "sum", "preis": "mean"})
    d[["wind_on", "wind_off", "last"]] /= 1e3  # GWh
    d.index = d.index.strftime("%Y-%m-%d"); d.index.name = "tag"
    d.round(2).to_csv(CSV / "smard_2025_tage.csv")
    (CSV / "smard_2025_kennzahlen.json").write_text(json.dumps(k, indent=1, ensure_ascii=False))
    print(json.dumps(k, indent=1, ensure_ascii=False)); print(mo2.round(1).to_string()); print(yr.round(2).to_string())


if __name__ == "__main__":
    main()
