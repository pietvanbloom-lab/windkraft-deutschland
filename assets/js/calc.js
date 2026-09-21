/* Kostenvergleich auf gleicher Basis und Rechner „Windräder je Kernkraftwerk“.
   Formel (Annuitätenmethode wie Fraunhofer ISE, real):
   LCOE = (CAPEX · CRF(WACC, n) + OPEX_fix) / VLH + OPEX_var + Brennstoff/Wirkungsgrad */
(function () {
  'use strict';
  var U = window.WKU, WK = window.WK;
  var box = document.getElementById('calc');
  if (!box || !WK || !WK.recherche || !WK.recherche.lcoe) return;
  var P = WK.recherche.lcoe.param, SYS = WK.recherche.lcoe.system, K = WK.k;
  var v = function (id) { return K[id] ? K[id].v : null; };

  function crf(w, n) { w = w / 100; return w * Math.pow(1 + w, n) / (Math.pow(1 + w, n) - 1); }
  function lcoe(p, capex, vlh, wacc) {
    var fuel = p.fuel ? p.fuel / p.eta / 1000 : 0; // €/kWh
    return ((capex * crf(wacc, p.life) + p.fix) / vlh + p.var + fuel) * 100; // ct/kWh
  }
  function range(tech, wacc, vlhKkw) {
    var p = P[tech];
    if (tech === 'kkw') return [lcoe(p, p.capex[0], vlhKkw, wacc), lcoe(p, p.capex[1], vlhKkw, wacc)];
    return [lcoe(p, p.capex[0], p.vlh[1], wacc), lcoe(p, p.capex[1], p.vlh[0], wacc)];
  }
  window.WKLCOE = { lcoe: lcoe, range: range, crf: crf };

  var TYPES = {
    neu_on: { label: 'Neue Anlage an Land (Ø Zubau 2025)', mw: v('wg_neu_kw'), vlh: v('vlh_neu_eeg'), lk: 6, lkSrc: 'NEA 2012, Wind an Land bei 30 % Anteil',
      note: 'Leistung: Deutsche WindGuard, Ø Zubau 2025. Volllaststunden: Anlagen der Baujahre 2020–2024 im Jahr 2025 (EEG-Abrechnung × MaStR).' },
    best_on: { label: 'Durchschnittliche Anlage an Land (Bestand)', mw: v('kw_bestand_eeg'), vlh: v('vlh_on_eeg'), lk: 6, lkSrc: 'NEA 2012, Wind an Land bei 30 % Anteil',
      note: 'Leistung und Volllaststunden: ganzjährig betriebene Anlagen 2025 (EEG-Abrechnung × MaStR).' },
    neu_off: { label: 'Neue Anlage auf See (Ø Zubau 2025)', mw: v('wg_off_neu_kw'), vlh: v('vlh_off_eeg'), lk: 11.2, lkSrc: 'NEA 2012, Wind auf See bei 30 % Anteil',
      note: 'Leistung: Deutsche WindGuard, Ø Zubau 2025 auf See. Volllaststunden: Offshore-Flotte 2025 (EEG-Abrechnung × MaStR).' },
    v236: { label: 'Vestas V236 (15 MW) auf See', mw: 15, vlh: v('vlh_off_eeg'), lk: 11.2, lkSrc: 'NEA 2012, Wind auf See bei 30 % Anteil',
      note: 'Leistung laut MaStR 15 MW. Volllaststunden: Offshore-Flotte 2025.' }
  };
  var KKW_MW = v('iaea_isar2_mw'), KKW_VLH = Math.round(v('iaea_isar2_gwh') * 1000 / KKW_MW / 10) * 10;

  box.innerHTML =
    '<fieldset><legend>Annahmen für beide Seiten</legend>' +
    '<label for="cWacc">Kapitalkosten (WACC, real) für alle Technologien <span class="rangeval" id="cWaccV"></span></label><input id="cWacc" type="range" min="2" max="10" step="0.5" value="7">' +
    '<p class="small">7 % ist der Standard von IEA und OECD-NEA. Fraunhofer ISE rechnet dagegen mit 3,9 % für Wind an Land, 6,0 % auf See und 7,8 % für Kernkraft.</p>' +
    '<label for="cVlh">Volllaststunden des Kernkraftwerks <span class="rangeval" id="cVlhV"></span></label><input id="cVlh" type="range" min="3000" max="8500" step="100" value="' + KKW_VLH + '">' +
    '<p class="small">Voreinstellung: Isar 2 im Jahr 2021 (' + U.fmt(v('iaea_isar2_gwh')) + ' GWh bei ' + U.fmt(KKW_MW) + ' MW, IAEA). Fraunhofer ISE setzt 4.300–6.300 h an.</p>' +
    '<label for="cSys">Systemkosten</label><select id="cSys"><option value="0">ohne Systemkosten</option><option value="10">OECD-NEA, Deutschland, 10 % Anteil</option><option value="30" selected>OECD-NEA, Deutschland, 30 % Anteil</option></select>' +
    '<p class="small">Backup-Kapazität, Ausgleichsenergie, Netzanschluss und Netzausbau (NEA 2012, Tab. ES.2), umgerechnet mit 1,30 USD/€; nicht inflationsbereinigt.</p>' +
    '</fieldset>' +
    '<fieldset><legend>Stromgestehungskosten auf gleicher Basis</legend><div id="cBars" aria-live="polite"></div>' +
    '<p class="small" id="cCheck"></p></fieldset>' +
    '<fieldset><legend>Windanlage</legend><label for="cType">Anlagentyp</label><select id="cType">' +
    Object.keys(TYPES).map(function (k) { return '<option value="' + k + '">' + TYPES[k].label + '</option>'; }).join('') + '</select>' +
    '<label for="cWvlh">Volllaststunden der Windanlage <span class="rangeval" id="cWvlhV"></span></label><input id="cWvlh" type="range" min="1200" max="4500" step="1">' +
    '<p class="small" id="cTypeNote"></p></fieldset>' +
    '<fieldset><legend>Rechnung</legend><div class="formula" id="cFormula"></div></fieldset>' +
    '<div class="result"><div class="big" id="cN"></div><div><div id="cNtext"></div><canvas id="cDots" height="120" style="width:100%;height:120px;margin-top:10px"></canvas></div></div>';

  var $ = function (id) { return document.getElementById(id); };
  var TECH = [{ k: 'on', label: 'Wind an Land', c: '--on' }, { k: 'off', label: 'Wind auf See', c: '--off' }, { k: 'kkw', label: 'Kernkraft (neu)', c: '--nuc' }];

  function bars(wacc, vlh, sys) {
    var rows = TECH.map(function (t) {
      var r = range(t.k, wacc, vlh), add = sys ? SYS['p' + sys][t.k] / SYS.kurs / 10 : 0;
      return { t: t, lo: r[0], hi: r[1], add: add };
    });
    var max = Math.ceil(d3max(rows.map(function (r) { return r.hi + r.add; })) / 5) * 5;
    var Wd = 100;
    var html = '<svg viewBox="0 0 320 ' + (rows.length * 46 + 24) + '" style="width:100%;height:auto" role="img" aria-label="Spannen der Stromgestehungskosten">';
    var sx = function (x) { return 96 + x / max * 214; };
    for (var g = 0; g <= max; g += (max > 30 ? 10 : 5)) {
      html += '<line x1="' + sx(g) + '" x2="' + sx(g) + '" y1="4" y2="' + (rows.length * 46 + 4) + '" stroke="var(--grid)" stroke-width="1"/>' +
        '<text x="' + sx(g) + '" y="' + (rows.length * 46 + 18) + '" font-size="9" text-anchor="middle" fill="var(--muted)">' + g + ' ct</text>';
    }
    rows.forEach(function (r, i) {
      var y = 8 + i * 46;
      html += '<text x="0" y="' + (y + 12) + '" font-size="10.5" fill="var(--ink)" font-weight="600">' + r.t.label + '</text>' +
        '<rect x="' + sx(r.lo) + '" y="' + (y + 2) + '" width="' + Math.max(2, sx(r.hi) - sx(r.lo)) + '" height="12" rx="3" fill="var(' + r.t.c + ')" opacity=".35"/>' +
        (r.add ? '<rect x="' + sx(r.lo + r.add) + '" y="' + (y + 18) + '" width="' + Math.max(2, sx(r.hi + r.add) - sx(r.lo + r.add)) + '" height="12" rx="3" fill="var(' + r.t.c + ')"/>' : '') +
        '<text x="0" y="' + (y + 27) + '" font-size="9.5" fill="var(--ink-2)">' + U.fmt(r.lo, 1) + '–' + U.fmt(r.hi, 1) + (r.add ? ' → ' + U.fmt(r.lo + r.add, 1) + '–' + U.fmt(r.hi + r.add, 1) : '') + ' ct/kWh</text>';
    });
    html += '</svg><div class="legend" style="margin-top:6px"><span><i style="background:var(--ink-2);opacity:.35"></i>ohne Systemkosten</span>' + (sys ? '<span><i style="background:var(--ink-2)"></i>mit Systemkosten</span>' : '') + '</div>';
    $('cBars').innerHTML = html;
    return rows;
  }
  function d3max(a) { return Math.max.apply(null, a); }

  function dots(n) {
    var c = $('cDots'), w = c.clientWidth || 300, h = 120, dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = w * dpr; c.height = h * dpr;
    var x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
    var shown = Math.min(n, 5000), cell = Math.max(2, Math.floor(Math.sqrt(w * h / Math.max(1, shown))));
    var per = Math.floor(w / cell);
    x.fillStyle = U.css('--on');
    for (var i = 0; i < shown; i++) { var cx = (i % per) * cell, cy = Math.floor(i / per) * cell; if (cy + cell > h) break; x.fillRect(cx, cy, Math.max(1, cell - 1), Math.max(1, cell - 1)); }
  }

  function update(typeChanged) {
    var wacc = +$('cWacc').value, vlh = +$('cVlh').value, sys = +$('cSys').value;
    $('cWaccV').textContent = U.fmt(wacc, 1) + ' %';
    $('cVlhV').textContent = U.fmt(vlh) + ' h (' + U.fmt(vlh / 87.6, 0) + ' %)';
    var rows = bars(wacc, vlh, sys);
    var T = TYPES[$('cType').value];
    if (typeChanged) $('cWvlh').value = Math.round(T.vlh);
    var wv = +$('cWvlh').value;
    $('cWvlhV').textContent = U.fmt(wv) + ' h';
    $('cTypeNote').textContent = T.note + ' Nennleistung: ' + U.fmt(T.mw, 2) + ' MW.';
    var eKkw = KKW_MW * vlh, eWea = T.mw * wv, n = eKkw / eWea;
    var firm = KKW_MW * (v('nea12_lk_kkw') / 100) / (T.mw * T.lk / 100);
    var firmU = KKW_MW * (v('nea12_lk_kkw') / 100) / (T.mw * 0.01);
    $('cN').innerHTML = U.fmt(n) + '<small>Windanlagen erzeugen im Jahr so viel Strom wie ein Kernkraftwerk wie Isar 2</small>';
    $('cNtext').innerHTML = '<p style="margin:0 0 6px">Für die gleiche <strong>gesicherte Leistung</strong> wären es rechnerisch rund <strong>' + U.fmt(firm, 0) + '</strong> Anlagen (Leistungskredit ' + U.fmt(T.lk, 1) + ' % laut ' + T.lkSrc + ', Kernkraft 97 %) – mit dem Ansatz der Übertragungsnetzbetreiber (1 % gesichert) sogar rund ' + U.fmt(firmU, 0) + '. Diese Lücke schließen in der Praxis Speicher und steuerbare Kraftwerke; ihre Kosten stecken in den Systemkosten links.</p><p class="small" style="margin:0">Jedes Quadrat unten ist eine Windanlage (bis 5.000 dargestellt).</p>';
    $('cFormula').innerHTML =
      '<p><code>Anzahl = (P<sub>KKW</sub> × VLH<sub>KKW</sub>) ÷ (P<sub>WEA</sub> × VLH<sub>WEA</sub>)</code></p>' +
      '<p>= (' + U.fmt(KKW_MW) + ' MW × ' + U.fmt(vlh) + ' h) ÷ (' + U.fmt(T.mw, 2) + ' MW × ' + U.fmt(wv) + ' h)<br>= ' + U.fmt(eKkw / 1000) + ' GWh ÷ ' + U.fmt(eWea / 1000, 1) + ' GWh = <strong>' + U.fmt(n) + '</strong></p>' +
      '<p><code>LCOE = (CAPEX × Annuitätenfaktor + Fixkosten) ÷ VLH + variable Kosten (+ Brennstoff)</code></p>' +
      '<p>Kosten und Lebensdauer nach Fraunhofer ISE 2024: an Land ' + P.on.capex.join('–') + ' €/kW, ' + P.on.vlh.join('–') + ' h, 25 J.; auf See ' + P.off.capex.join('–') + ' €/kW, ' + P.off.vlh.join('–') + ' h, 25 J.; Kernkraft ' + P.kkw.capex.join('–') + ' €/kW, 45 J., Uran ' + P.kkw.fuel + ' €/MWh<sub>th</sub> bei 35 % Wirkungsgrad. Systemkosten (NEA): ' +
      rows.map(function (r) { return r.t.label + ' +' + U.fmt(r.add, 2) + ' ct'; }).join(', ') + '.</p>';
    dots(Math.round(n));
  }
  // Plausibilitätsprüfung: mit den ISE-Kapitalkosten müssen die ISE-Spannen für Wind herauskommen
  var chkOn = range('on', P.on.wacc, 0), chkOff = range('off', P.off.wacc, 0);
  var chkK = [lcoe(P.kkw, P.kkw.capex[0], P.kkw.vlh[1], P.kkw.wacc), lcoe(P.kkw, P.kkw.capex[1], P.kkw.vlh[0], P.kkw.wacc)];
  $('cCheck').innerHTML = 'Kontrolle: Mit den ISE-Kapitalkosten ergibt die Formel ' + U.fmt(chkOn[0], 1) + '–' + U.fmt(chkOn[1], 1) + ' ct/kWh an Land und ' + U.fmt(chkOff[0], 1) + '–' + U.fmt(chkOff[1], 1) +
    ' ct/kWh auf See, wie im ISE-Bericht. Für Kernkraft ergeben sich bei gleichbleibend 4.300–6.300 h ' + U.fmt(chkK[0], 1) + '–' + U.fmt(chkK[1], 1) + ' ct/kWh statt 13,6–49,0: Die Differenz entsteht, weil das ISE eine bis 2045 sinkende Auslastung unterstellt.';
  ['cWacc', 'cVlh', 'cSys', 'cWvlh'].forEach(function (id) { $(id).addEventListener('input', function () { update(false); }); });
  $('cType').addEventListener('change', function () { update(true); });
  update(true);
  document.addEventListener('wk-theme', function () { update(false); });
  window.addEventListener('resize', function () { update(false); });
})();
