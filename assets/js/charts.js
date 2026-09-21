/* Statistik-Charts (Chart.js). Jede Abbildung hat eine Tabellenansicht mit denselben Daten. */
(function () {
  'use strict';
  var U = window.WKU, WK = window.WK;
  if (!window.Chart || !WK) return;
  var C = window.Chart;
  var charts = {};
  var R = WK.recherche || {};

  function theme() {
    C.defaults.font.family = getComputedStyle(document.body).fontFamily;
    C.defaults.font.size = 12;
    C.defaults.color = U.css('--ink-2');
    C.defaults.borderColor = U.css('--grid');
    C.defaults.plugins.legend.display = false;
    C.defaults.plugins.tooltip.backgroundColor = U.css('--surface');
    C.defaults.plugins.tooltip.titleColor = U.css('--ink');
    C.defaults.plugins.tooltip.bodyColor = U.css('--ink-2');
    C.defaults.plugins.tooltip.borderColor = U.css('--border');
    C.defaults.plugins.tooltip.borderWidth = 1;
    C.defaults.plugins.tooltip.padding = 10;
    C.defaults.plugins.tooltip.boxPadding = 4;
    C.defaults.plugins.tooltip.usePointStyle = true;
    C.defaults.animation.duration = U.reducedMotion ? 0 : 700;
    C.defaults.maintainAspectRatio = false;
  }
  var col = function (n) { return U.css('--' + n); };
  var de = function (d) { return function (v) { return U.fmt(v, d || 0); }; };
  function axes(opts) {
    opts = opts || {};
    return {
      x: Object.assign({ grid: { display: false }, border: { color: col('axis') }, ticks: { maxRotation: 0, autoSkipPadding: 8 } }, opts.x || {}),
      y: Object.assign({ grid: { color: col('grid') }, border: { display: false }, ticks: { callback: de(opts.yd) }, beginAtZero: true }, opts.y || {})
    };
  }
  var bar = { maxBarThickness: 24, borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: 'start' };

  function make(name, cfg, table) {
    var fig = document.querySelector('.figure[data-chart="' + name + '"]');
    if (!fig) return;
    U.tables[name] = table;
    var build = function () {
      if (charts[name]) charts[name].destroy();
      charts[name] = new C(fig.querySelector('canvas'), cfg());
    };
    fig._build = build;
    U.onVisible(fig, build, '200px 0px');
  }

  // 1 Ausbau (Leistung)
  var z = WK.zeitreihe;
  make('ausbau', function () {
    return { type: 'line', data: { labels: z.jahr, datasets: [
      { label: 'an Land', data: z.onshore_mw.map(function (v) { return v / 1000; }), borderColor: col('on'), backgroundColor: col('on') + '33', fill: 'origin', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0 },
      { label: 'auf See', data: z.offshore_mw.map(function (v) { return v / 1000; }), borderColor: col('off'), backgroundColor: col('off') + '40', fill: '-1', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0 }
    ] }, options: { interaction: { mode: 'index', intersect: false }, scales: Object.assign(axes(), { y: Object.assign(axes().y, { stacked: true, title: { display: false } }) }),
      plugins: { tooltip: { callbacks: { label: function (c) { return ' ' + c.dataset.label + ': ' + U.fmt(c.parsed.y, 1) + ' GW'; }, footer: function (it) { var s = it.reduce(function (a, c) { return a + c.parsed.y; }, 0); return 'Gesamt: ' + U.fmt(s, 1) + ' GW'; } } } } } };
  }, { cols: ['Jahr', 'an Land (MW)', 'auf See (MW)'], rows: z.jahr.map(function (j, i) { return [j, U.fmt(z.onshore_mw[i]), U.fmt(z.offshore_mw[i])]; }) });

  // 2 Erzeugung
  make('erzeugung', function () {
    return { type: 'bar', data: { labels: z.jahr, datasets: [
      Object.assign({ label: 'an Land', data: z.onshore_twh, backgroundColor: col('on'), stack: 's', borderRadius: 0 }, { maxBarThickness: 24 }),
      Object.assign({ label: 'auf See', data: z.offshore_twh, backgroundColor: col('off'), stack: 's' }, bar)
    ] }, options: { interaction: { mode: 'index', intersect: false }, scales: Object.assign(axes(), { x: Object.assign(axes().x, { stacked: true }), y: Object.assign(axes().y, { stacked: true }) }),
      datasets: { bar: { borderColor: col('surface'), borderWidth: { top: 2, left: 0, right: 0, bottom: 0 } } },
      plugins: { tooltip: { callbacks: { label: function (c) { return ' ' + c.dataset.label + ': ' + U.fmt(c.parsed.y, 1) + ' TWh'; }, footer: function (it) { var s = it.reduce(function (a, c) { return a + c.parsed.y; }, 0); return 'Gesamt: ' + U.fmt(s, 1) + ' TWh'; } } } } } };
  }, { cols: ['Jahr', 'an Land (TWh)', 'auf See (TWh)'], rows: z.jahr.map(function (j, i) { return [j, U.fmt(z.onshore_twh[i], 1), U.fmt(z.offshore_twh[i], 1)]; }) });

  // 3 Monate: Wind vs. PV
  var mo = WK.monate, MN = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  var windM = mo.wind_on.map(function (v, i) { return v + mo.wind_off[i]; });
  make('monate', function () {
    var pt = { pointRadius: 4, pointHoverRadius: 6, pointBorderColor: col('surface'), pointBorderWidth: 2, borderWidth: 2, tension: 0.25 };
    return { type: 'line', data: { labels: MN, datasets: [
      Object.assign({ label: 'Wind', data: windM, borderColor: col('on'), pointBackgroundColor: col('on') }, pt),
      Object.assign({ label: 'Photovoltaik', data: mo.pv, borderColor: col('pv'), pointBackgroundColor: col('pv') }, pt)
    ] }, options: { interaction: { mode: 'index', intersect: false }, scales: axes({ yd: 0 }),
      plugins: { tooltip: { callbacks: { label: function (c) { return ' ' + c.dataset.label + ': ' + U.fmt(c.parsed.y, 1) + ' TWh'; } } } } } };
  }, { cols: ['Monat 2025', 'Wind an Land (TWh)', 'Wind auf See (TWh)', 'Photovoltaik (TWh)'], rows: MN.map(function (m, i) { return [m, U.fmt(mo.wind_on[i], 2), U.fmt(mo.wind_off[i], 2), U.fmt(mo.pv[i], 2)]; }) });

  // 4 Jahrgänge mit Umschalter
  var jg = WK.jahrgang, er = WK.ertrag;
  var VIEWS = {
    mwh: { lab: er.jahr, data: er.mwh, unit: 'MWh', d: 0, sub: 'Median-Jahresertrag 2025 je Anlage nach Baujahr, Megawattstunden', src: 'Quelle: EEG-Jahresabrechnung 2025 (netztransparenz.de), verknüpft mit dem Marktstammdatenregister; nur ganzjährig betriebene Anlagen ab 100 kW; eigene Auswertung' },
    vlh: { lab: er.jahr, data: er.vlh, unit: 'h', d: 0, sub: 'Median-Volllaststunden 2025 nach Baujahr (Jahreserzeugung ÷ Nennleistung)', src: 'Quelle: EEG-Jahresabrechnung 2025 (netztransparenz.de), verknüpft mit dem Marktstammdatenregister; eigene Auswertung' },
    mw: { lab: jg.jahr, data: jg.mw, unit: 'MW', d: 2, sub: 'Mittlere Nennleistung der im jeweiligen Jahr in Betrieb genommenen Anlagen an Land, Megawatt', src: 'Quelle: Marktstammdatenregister (21.09.2026), alle registrierten Anlagen inkl. stillgelegter; eigene Auswertung' },
    nabe: { lab: jg.jahr, data: jg.nabe, unit: 'm', d: 0, sub: 'Mittlere Nabenhöhe der im jeweiligen Jahr in Betrieb genommenen Anlagen an Land, Meter', src: 'Quelle: Marktstammdatenregister (21.09.2026); eigene Auswertung' }
  };
  var view = 'mwh';
  make('jahrgang', function () {
    var v = VIEWS[view];
    document.getElementById('jahrgangSub').textContent = v.sub;
    document.getElementById('jahrgangSrc').textContent = v.src;
    return { type: 'bar', data: { labels: v.lab, datasets: [Object.assign({ label: v.sub, data: v.data, backgroundColor: col('on') }, bar)] },
      options: { scales: axes({ yd: 0 }), plugins: { tooltip: { callbacks: { title: function (it) { return 'Baujahr ' + it[0].label; }, label: function (c) {
        var extra = (view === 'mwh' || view === 'vlh') ? ' (' + U.fmt(er.n[c.dataIndex]) + ' Anlagen)' : ' (' + U.fmt(jg.n[c.dataIndex]) + ' Anlagen)';
        return ' ' + U.fmt(c.parsed.y, v.d) + ' ' + v.unit + extra; } } } } } };
  }, null);
  function jgTable() {
    U.tables.jahrgang = { cols: ['Baujahr', 'Ø Nennleistung (MW)', 'Ø Nabenhöhe (m)', 'Anlagen (MaStR)', 'Median-Ertrag 2025 (MWh)', 'Median-Volllaststunden 2025', 'Anlagen (EEG 2025)'],
      rows: jg.jahr.map(function (j, i) { var k = er.jahr.indexOf(j); return [j, U.fmt(jg.mw[i], 2), U.fmt(jg.nabe[i]), U.fmt(jg.n[i]), k >= 0 ? U.fmt(er.mwh[k]) : '–', k >= 0 ? U.fmt(er.vlh[k]) : '–', k >= 0 ? U.fmt(er.n[k]) : '–']; }) };
  }
  jgTable();
  document.querySelectorAll('.figure[data-chart="jahrgang"] [data-view]').forEach(function (b) {
    b.addEventListener('click', function () {
      view = b.getAttribute('data-view');
      b.parentNode.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      var fig = b.closest('.figure'); if (fig._build) fig._build();
    });
  });

  // 5 Hersteller
  var hs = WK.hersteller;
  var sb = hs.bestand_mw.reduce(function (a, b) { return a + b; }, 0), sz = hs.zubau_mw.reduce(function (a, b) { return a + b; }, 0);
  var pb = hs.bestand_mw.map(function (v) { return v / sb * 100; }), pz = hs.zubau_mw.map(function (v) { return v / sz * 100; });
  make('hersteller', function () {
    var hb = { maxBarThickness: 16, borderRadius: { topRight: 4, bottomRight: 4 }, borderSkipped: 'start' };
    return { type: 'bar', data: { labels: hs.marke, datasets: [
      Object.assign({ label: 'Bestand', data: pb, backgroundColor: col('neutral') }, hb),
      Object.assign({ label: 'Zubau 2025', data: pz, backgroundColor: col('on') }, hb)
    ] }, options: { indexAxis: 'y', scales: { x: { grid: { color: col('grid') }, border: { display: false }, ticks: { callback: function (v) { return v + ' %'; } }, beginAtZero: true }, y: { grid: { display: false }, border: { color: col('axis') } } },
      plugins: { tooltip: { callbacks: { label: function (c) { var mw = c.datasetIndex === 0 ? hs.bestand_mw[c.dataIndex] : hs.zubau_mw[c.dataIndex]; return ' ' + c.dataset.label + ': ' + U.fmt(c.parsed.x, 1) + ' % (' + U.fmt(mw) + ' MW)'; } } } } } };
  }, { cols: ['Hersteller', 'Bestand an Land (MW)', 'Anteil Bestand', 'Zubau 2025 (MW)', 'Anteil Zubau', 'auf See (MW)'],
    rows: hs.marke.map(function (m, i) { return [m, U.fmt(hs.bestand_mw[i]), U.fmt(pb[i], 1) + ' %', U.fmt(hs.zubau_mw[i]), U.fmt(pz[i], 1) + ' %', U.fmt(hs.off_mw[i])]; }) });

  // 6 Ausschreibungsrunden
  var rd = (R.runden || []);
  make('runden', function () {
    var pt = { pointRadius: 4, pointHoverRadius: 6, pointBorderColor: col('surface'), pointBorderWidth: 2, borderWidth: 2 };
    return { type: 'line', data: { labels: rd.map(function (r) { return r.termin; }), datasets: [
      Object.assign({ label: 'Zuschlagswert (Mittel)', data: rd.map(function (r) { return r.wert_ct; }), borderColor: col('on'), pointBackgroundColor: col('on') }, pt),
      Object.assign({ label: 'Höchstwert', data: rd.map(function (r) { return r.hoechst_ct; }), borderColor: col('neutral'), pointBackgroundColor: col('neutral'), stepped: false }, pt)
    ] }, options: { interaction: { mode: 'index', intersect: false }, scales: axes({ yd: 1, y: { beginAtZero: true, suggestedMax: 8 } }),
      plugins: { tooltip: { callbacks: { title: function (it) { return 'Gebotstermin ' + it[0].label; }, label: function (c) { return ' ' + c.dataset.label + ': ' + U.fmt(c.parsed.y, 2) + ' ct/kWh'; },
        afterBody: function (it) { var r = rd[it[0].dataIndex]; return 'Zuschläge: ' + U.fmt(r.menge_mw) + ' MW, Gebote: ' + U.fmt(r.gebote_mw) + ' MW'; } } } } } };
  }, { cols: ['Gebotstermin', 'Zuschlagswert (ct/kWh)', 'Höchstwert (ct/kWh)', 'bezuschlagt (MW)', 'Gebotsmenge (MW)'],
    rows: rd.map(function (r) { return [r.termin, U.fmt(r.wert_ct, 2), U.fmt(r.hoechst_ct, 2), U.fmt(r.menge_mw), U.fmt(r.gebote_mw)]; }) });

  // 7 Merit-Order
  var me = WK.merit;
  make('merit', function () {
    return { type: 'bar', data: { labels: me.klasse, datasets: [Object.assign({ label: 'Day-Ahead-Preis', data: me.preis_mittel, backgroundColor: col('on') }, bar)] },
      options: { scales: axes({ yd: 0, x: { title: { display: true, text: 'Anteil Wind an der Netzlast in der jeweiligen Stunde', color: col('muted') } } }),
        plugins: { tooltip: { callbacks: { title: function (it) { return 'Windanteil ' + it[0].label; }, label: function (c) { return ' Ø ' + U.fmt(c.parsed.y, 1) + ' €/MWh'; },
          afterBody: function (it) { var i = it[0].dataIndex; return ['Median: ' + U.fmt(me.preis_median[i], 1) + ' €/MWh', U.fmt(me.stunden[i]) + ' Stunden, davon ' + U.fmt(me.negativ[i]) + ' mit negativem Preis', 'Ø Solarleistung: ' + U.fmt(me.pv_mittel_gw[i], 1) + ' GW']; } } } } } };
  }, { cols: ['Windanteil an der Netzlast', 'Stunden', 'Ø Preis (€/MWh)', 'Median (€/MWh)', 'Stunden mit negativem Preis', 'Ø Solarleistung (GW)', 'Ø Netzlast (GW)'],
    rows: me.klasse.map(function (k, i) { return [k, U.fmt(me.stunden[i]), U.fmt(me.preis_mittel[i], 1), U.fmt(me.preis_median[i], 1), U.fmt(me.negativ[i]), U.fmt(me.pv_mittel_gw[i], 1), U.fmt(me.last_mittel_gw[i], 1)]; }) });

  // 8 LCOE (Fraunhofer ISE) als Spannen
  var L = (R.lcoe || {}).ise || [];
  make('lcoe', function () {
    return { type: 'bar', data: { labels: L.map(function (d) { return d.tech; }), datasets: [{ label: 'Stromgestehungskosten', data: L.map(function (d) { return [d.lo, d.hi]; }),
      backgroundColor: L.map(function (d) { return col(d.c); }), borderRadius: 4, borderSkipped: false, maxBarThickness: 22 }] },
      options: { indexAxis: 'y', scales: { x: { min: 0, grid: { color: col('grid') }, border: { display: false }, ticks: { callback: function (v) { return v + ' ct'; } }, title: { display: true, text: 'ct/kWh (real, Preisbasis 2024)', color: col('muted') } }, y: { grid: { display: false }, border: { color: col('axis') } } },
        plugins: { tooltip: { callbacks: { label: function (c) { var d = L[c.dataIndex]; return ' ' + U.fmt(d.lo, 1) + ' bis ' + U.fmt(d.hi, 1) + ' ct/kWh'; } } } } } };
  }, { cols: ['Technologie', 'von (ct/kWh)', 'bis (ct/kWh)'], rows: L.map(function (d) { return [d.tech, U.fmt(d.lo, 1), U.fmt(d.hi, 1)]; }) });

  theme();
  document.addEventListener('wk-theme', function () {
    theme();
    document.querySelectorAll('.figure[data-chart]').forEach(function (f) { if (f._build && charts[f.getAttribute('data-chart')]) f._build(); });
  });
})();
