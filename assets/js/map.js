/* Deutschlandkarte: Bundesländer als Choroplethe (SVG), Einzelanlagen als Punkte (Canvas).
   Einzelanlagen und Kreisgrenzen werden erst ab einer Zoomstufe nachgeladen. */
(function () {
  'use strict';
  var U = window.WKU, WK = window.WK, G = window.WK_GEO;
  var el = document.getElementById('map');
  if (!el || !window.d3 || !WK || !G) return;

  var POINT_ZOOM = 2.4;
  var byName = {};
  WK.laender.forEach(function (d) { byName[d.name] = d; });
  var neBund = WK.k.ne_bund_2025 ? WK.k.ne_bund_2025.v : 10.72;

  var METRICS = {
    n: { key: 'n', label: 'Anlagen an Land', unit: '', dec: 0, src: 'Marktstammdatenregister, Stand 21.09.2026', btn: 'Anzahl' },
    mw: { key: 'mw', label: 'Leistung an Land', unit: 'MW', dec: 0, src: 'Marktstammdatenregister, Stand 21.09.2026', btn: 'Leistung' },
    zuschlag25_mw: { key: 'zuschlag25_mw', label: 'Zuschläge 2025 (Wind an Land)', unit: 'MW', dec: 0, src: 'Bundesnetzagentur, Statistik Ausschreibungen', btn: 'Zuschläge 2025' },
    eeg_mio: { key: 'eeg_mio', label: 'EEG-Zahlungen 2025 (Wind an Land)', unit: 'Mio. €', dec: 0, src: 'EEG-Jahresabrechnung 2025 (ÜNB), eigene Auswertung', btn: 'Förderung' },
    netzentgelt: { key: 'netzentgelt', label: 'Netzentgelt Haushalte 2025 (netto)', unit: 'ct/kWh', dec: 2, src: 'BNetzA/BKartA, Monitoringbericht 2025, Tab. 25', btn: 'Netzentgelt', diverging: true }
  };
  var metric = 'n';

  var svg = d3.select(el).insert('svg', ':first-child').attr('aria-hidden', 'true');
  var canvas = d3.select(el).insert('canvas', '.map-ui').node();
  var ctx = canvas.getContext('2d');
  var root = svg.append('g');
  var gN = root.append('g'), gW = root.append('g'), gS = root.append('g'), gK = root.append('g'), gB = root.append('g'), gL = root.append('g');
  var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  var proj = d3.geoConicConformal().parallels([48.7, 53.7]).rotate([-10.4, 0]);
  var path = d3.geoPath(proj);
  var t = d3.zoomIdentity, pointsVisible = false, T = null, base = null, qt = null, kreise = false, loadingPts = false;
  var offBase = [];
  var status = document.getElementById('mapStatus');
  var legend = document.getElementById('mapLegend');
  var ui = document.getElementById('mapUi');

  // Metrik-Schaltflächen
  Object.keys(METRICS).forEach(function (k) {
    var b = document.createElement('button');
    b.className = 'btn'; b.type = 'button'; b.textContent = METRICS[k].btn; b.setAttribute('data-metric', k);
    b.setAttribute('aria-pressed', k === metric ? 'true' : 'false');
    b.addEventListener('click', function () { setMetric(k); });
    ui.appendChild(b);
  });

  function fitProjection() {
    var r = el.getBoundingClientRect();
    W = Math.max(200, r.width); H = Math.max(200, r.height);
    var pad = Math.min(W, H) * 0.05;
    var topPad = 52; // Platz für die Schaltflächen
    var box = { type: 'Feature', geometry: { type: 'MultiPoint', coordinates: [[W > 520 ? 3.6 : 5.87, 47.27], [15.04, 55.06], [5.87, 55.06], [15.04, 47.27]] } };
    proj.fitExtent([[pad, topPad], [W - pad, H - pad]], box);
    svg.attr('viewBox', '0 0 ' + W + ' ' + H);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  }

  function draw() {
    gN.selectAll('path').data(G.nachbarn.features).join('path').attr('class', 'neighbor').attr('d', path);
    gW.selectAll('path').data(G.wasser.features).join('path').attr('class', 'coastal').attr('d', path);
    gS.selectAll('path').data(G.laender.features, function (d) { return d.properties.gen; }).join('path')
      .attr('class', 'state').attr('d', path)
      .on('mousemove', function (ev, d) { stateTip(ev, d); })
      .on('mouseleave', function () { U.tip.hide(); })
      .on('click', function (ev, d) { stateTip(ev, d); });
    gB.selectAll('path').data([G.laender]).join('path').attr('class', 'borders').attr('d', path).attr('fill', 'none');
    if (kreise && window.WK_KREISE) gK.selectAll('path').data(window.WK_KREISE.features).join('path').attr('class', 'kreis').attr('d', path);
    offBase = WK.offshore.map(function (p) { var q = proj([p[0] / 1e4 + 5, p[1] / 1e4 + 47]); return [q[0], q[1], p[2]]; });
    if (T) projectTurbines();
    color();
  }

  function values(m) { return WK.laender.map(function (d) { return d[METRICS[m].key]; }).filter(function (v) { return v !== null && v !== undefined; }); }
  function seqColors() { return [1, 2, 3, 4, 5, 6, 7].map(function (i) { return U.css('--seq-' + i); }); }
  function scaleFor(m) {
    var M = METRICS[m], vs = values(m);
    if (M.diverging) {
      var ext = d3.max(vs, function (v) { return Math.abs(v - neBund); });
      return d3.scaleDiverging([neBund - ext, neBund, neBund + ext], d3.interpolateRgbBasis([U.css('--div-neg'), U.css('--div-mid'), U.css('--div-pos')]));
    }
    return d3.scaleSequential([0, d3.max(vs)], d3.interpolateRgbBasis(seqColors()));
  }

  function color() {
    var sc = scaleFor(metric), M = METRICS[metric];
    var fade = pointsVisible;
    gS.selectAll('path.state').transition().duration(U.reducedMotion ? 0 : 700)
      .attr('fill', function (d) {
        var r = byName[d.properties.gen]; var v = r ? r[M.key] : null;
        if (fade) return U.css('--land');
        return (v === null || v === undefined) ? U.css('--land') : sc(v);
      });
    labels();
    renderLegend(sc);
    rankLists();
  }

  function labels() {
    var M = METRICS[metric];
    var data = pointsVisible ? [] : G.laender.features.filter(function (f) {
      return ['Berlin', 'Hamburg', 'Bremen', 'Saarland'].indexOf(f.properties.gen) < 0;
    });
    gL.selectAll('text').data(data, function (d) { return d.properties.gen; }).join('text')
      .attr('class', 'label').attr('text-anchor', 'middle')
      .attr('transform', function (d) { var c = path.centroid(d); return 'translate(' + c[0] + ',' + c[1] + ') scale(' + (1 / t.k) + ')'; })
      .text(function (d) { var r = byName[d.properties.gen]; return r && r[M.key] != null ? U.fmt(r[M.key], M.dec) : ''; });
  }

  function renderLegend(sc) {
    var M = METRICS[metric];
    if (pointsVisible) {
      var yrs = [1995, 2005, 2015, 2025];
      legend.innerHTML = '<div class="ttl">Einzelanlagen (ab 100 kW)</div>' +
        '<div>Farbe: Jahr der Inbetriebnahme</div>' +
        '<div class="bar" style="background:linear-gradient(90deg,' + yrs.map(function (y) { return yearColor(y); }).join(',') + ')"></div>' +
        '<div class="ticks"><span>1995</span><span>2005</span><span>2015</span><span>2025</span></div>' +
        '<div style="margin-top:6px"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + U.css('--off') + ';margin-right:5px"></span>auf See · Größe: Leistung</div>' +
        '<div style="margin-top:4px">Quelle: Marktstammdatenregister, 21.09.2026</div>';
      return;
    }
    var d = sc.domain(), stops = d3.range(0, 1.0001, 0.1).map(function (x) { return sc(d[0] + (d[d.length - 1] - d[0]) * x); });
    var ticks = M.diverging ? [d[0], d[1], d[2]] : [0, d[1] / 2, d[1]];
    legend.innerHTML = '<div class="ttl">' + M.label + (M.unit ? ' (' + M.unit + ')' : '') + '</div>' +
      '<div class="bar" style="background:linear-gradient(90deg,' + stops.join(',') + ')"></div>' +
      '<div class="ticks">' + ticks.map(function (v, i) { return '<span>' + (M.diverging && i === 1 ? 'Ø ' : '') + U.fmt(v, M.dec === 2 ? 1 : 0) + '</span>'; }).join('') + '</div>' +
      '<div style="margin-top:4px">' + M.src + '</div>' +
      (t.k < POINT_ZOOM ? '<div style="margin-top:4px">Hineinzoomen zeigt Einzelanlagen</div>' : '');
  }

  function rankLists() {
    document.querySelectorAll('ol.rank[data-rank]').forEach(function (ol) {
      var k = ol.getAttribute('data-rank'), M = METRICS[k] || METRICS.n;
      var rows = WK.laender.filter(function (d) { return d[k] !== null && d[k] !== undefined; })
        .sort(function (a, b) { return b[k] - a[k]; });
      if (!ol.dataset.done) {
        var top = rows.slice(0, 5);
        ol.innerHTML = top.map(function (d) { return '<li><span>' + d.name + '</span><span>' + U.fmt(d[k], M.dec) + (M.unit ? ' ' + M.unit : '') + '</span></li>'; }).join('') +
          (rows.length > 5 ? '<li><span>…</span><span></span></li><li><span>' + rows[rows.length - 1].name + '</span><span>' + U.fmt(rows[rows.length - 1][k], M.dec) + (M.unit ? ' ' + M.unit : '') + '</span></li>' : '');
        ol.dataset.done = '1';
      }
    });
  }

  function stateTip(ev, d) {
    var r = byName[d.properties.gen];
    if (!r || pointsVisible) return;
    U.tip.show('<b>' + r.name + '</b>' + U.rows([
      ['Anlagen an Land', U.fmt(r.n)], ['Leistung', U.fmt(r.mw) + ' MW'],
      ['Zuschläge 2025', U.fmt(r.zuschlag25_mw) + ' MW'], ['EEG-Zahlungen 2025', U.fmt(r.eeg_mio) + ' Mio. €'],
      ['… je kWh', U.fmt(r.eeg_ct, 2) + ' ct'], ['Volllaststunden 2025', U.fmt(r.vlh) + ' h'],
      ['Netzentgelt Haushalte 2025', U.fmt(r.netzentgelt, 2) + ' ct/kWh']
    ]), ev.clientX, ev.clientY);
  }

  // Punkte
  function yearColor(y) {
    var cs = U.isDark() ? [U.css('--seq-3'), U.css('--seq-5'), U.css('--seq-7')] : [U.css('--seq-2'), U.css('--seq-4'), U.css('--seq-7')];
    var x = Math.max(0, Math.min(1, (y - 1992) / (2026 - 1992)));
    return d3.interpolateRgbBasis(cs)(x);
  }
  function projectTurbines() {
    var n = T.n, x = 0;
    base = new Float32Array(n * 2);
    for (var i = 0; i < n; i++) {
      x += T.dx[i];
      var p = proj([x / 1e4 + 5, T.y[i] / 1e4 + 47]);
      base[2 * i] = p[0]; base[2 * i + 1] = p[1];
    }
    qt = d3.quadtree().x(function (i) { return base[2 * i]; }).y(function (i) { return base[2 * i + 1]; }).addAll(d3.range(n));
  }
  var buckets = null;
  function makeBuckets() {
    var edges = [1995, 2000, 2005, 2010, 2015, 2020, 2027];
    buckets = edges.map(function (e, bi) {
      var lo = bi === 0 ? 0 : edges[bi - 1];
      return { color: yearColor(bi === 0 ? 1993 : (lo + e) / 2 - 0.5), idx: [] };
    });
    for (var i = 0; i < T.n; i++) {
      if (T.s[i]) continue;
      var y = T.j[i], b = 0;
      while (b < edges.length - 1 && y >= edges[b]) b++;
      buckets[b].idx.push(i);
    }
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var k = t.k;
    // Offshore immer sichtbar (Übersicht aus core.js bzw. Detail aus turbines.js)
    ctx.fillStyle = U.css('--off');
    if (!pointsVisible) {
      ctx.globalAlpha = 0.9; ctx.beginPath();
      for (var j = 0; j < offBase.length; j++) {
        var ox = offBase[j][0] * k + t.x, oy = offBase[j][1] * k + t.y;
        ctx.moveTo(ox + 1.3, oy); ctx.arc(ox, oy, 1.3, 0, 6.2832);
      }
      ctx.fill(); ctx.globalAlpha = 1;
      return;
    }
    var rScale = Math.min(1.9, 0.55 + 0.28 * Math.sqrt(k));
    var draw = function (list, fill) {
      ctx.fillStyle = fill; ctx.beginPath();
      for (var m = 0; m < list.length; m++) {
        var i = list[m], x = base[2 * i] * k + t.x, y = base[2 * i + 1] * k + t.y;
        if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
        var r = Math.max(1.1, Math.sqrt(T.kw[i] / 1000) * rScale);
        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 6.2832);
      }
      ctx.fill();
    };
    ctx.globalAlpha = 0.92;
    buckets.forEach(function (b) { draw(b.idx, b.color); });
    draw(offIdx, U.css('--off'));
    ctx.globalAlpha = 1;
  }
  var offIdx = [];

  function loadPoints() {
    if (T || loadingPts) return;
    loadingPts = true;
    status.style.display = 'block'; status.textContent = 'Lade Einzelanlagen …';
    Promise.all([U.loadScript('data/turbines.js'), U.loadScript('data/kreise.js')]).then(function () {
      T = window.WK_TURBINES; kreise = true;
      offIdx = []; for (var i = 0; i < T.n; i++) if (T.s[i]) offIdx.push(i);
      projectTurbines(); makeBuckets();
      gK.selectAll('path').data(window.WK_KREISE.features).join('path').attr('class', 'kreis').attr('d', path);
      status.textContent = U.fmt(T.n) + ' Anlagen geladen';
      setTimeout(function () { status.style.display = 'none'; }, 1800);
      updateMode();
    }).catch(function () { status.textContent = 'Einzelanlagen konnten nicht geladen werden.'; });
  }

  function updateMode() {
    var want = t.k >= POINT_ZOOM;
    if (want && !T) { loadPoints(); }
    var vis = want && !!T;
    if (vis !== pointsVisible) { pointsVisible = vis; color(); }
    gK.style('display', t.k >= POINT_ZOOM ? null : 'none');
    render();
  }

  // Zoom
  var zoom = d3.zoom().scaleExtent([1, 80])
    .filter(function (ev) {
      if (ev.type === 'wheel') return ev.ctrlKey || ev.metaKey || el.dataset.wheel === '1';
      if (ev.type === 'touchstart') return ev.touches.length > 1;
      if (ev.type === 'dblclick') return true;
      return !ev.button;
    })
    .on('zoom', function (ev) {
      t = ev.transform;
      root.attr('transform', t);
      gL.selectAll('text').attr('transform', function (d) { var c = path.centroid(d); return 'translate(' + c[0] + ',' + c[1] + ') scale(' + (1 / t.k) + ')'; });
      updateMode();
      if (!pointsVisible) renderLegend(scaleFor(metric));
    });
  svg.call(zoom);
  // Mausrad ohne Strg: Hinweis zeigen, Seite scrollt weiter
  var hintTimer;
  el.addEventListener('wheel', function (ev) {
    if (ev.ctrlKey || ev.metaKey || el.dataset.wheel === '1') return;
    status.style.display = 'block'; status.textContent = 'Zum Zoomen Strg/⌘ + Mausrad oder die Schaltflächen nutzen';
    clearTimeout(hintTimer); hintTimer = setTimeout(function () { if (!loadingPts || T) status.style.display = 'none'; }, 1600);
  }, { passive: true });
  // Nach einem Klick in die Karte ist das Mausrad-Zoomen frei
  el.addEventListener('pointerdown', function () { el.dataset.wheel = '1'; });
  document.addEventListener('pointerdown', function (ev) { if (!el.contains(ev.target)) el.dataset.wheel = '0'; });

  function zoomTo(bbox, dur) {
    var a = proj([bbox[0], bbox[3]]), b = proj([bbox[2], bbox[1]]);
    var dx = b[0] - a[0], dy = b[1] - a[1], cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
    var k = Math.min(80, 0.9 / Math.max(dx / W, dy / H));
    var tr = d3.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-cx, -cy);
    svg.transition().duration(U.reducedMotion ? 0 : (dur || 1400)).call(zoom.transform, tr);
  }
  function resetZoom(dur) { svg.transition().duration(U.reducedMotion ? 0 : (dur || 1000)).call(zoom.transform, d3.zoomIdentity); }
  document.getElementById('zoomIn').addEventListener('click', function () { svg.transition().duration(400).call(zoom.scaleBy, 2); });
  document.getElementById('zoomOut').addEventListener('click', function () { svg.transition().duration(400).call(zoom.scaleBy, 0.5); });
  document.getElementById('zoomReset').addEventListener('click', function () { resetZoom(700); });

  // Tooltip für Punkte
  el.addEventListener('mousemove', function (ev) {
    if (!pointsVisible || !qt) return;
    var r = el.getBoundingClientRect();
    var mx = (ev.clientX - r.left - t.x) / t.k, my = (ev.clientY - r.top - t.y) / t.k;
    var i = qt.find(mx, my, 10 / t.k);
    if (i === undefined) { U.tip.hide(); return; }
    var typ = T.typen[T.t[i]] || '–';
    U.tip.show('<b>' + T.marken[T.m[i]] + (typ ? ' · ' + typ : '') + '</b>' + U.rows([
      ['Leistung', U.fmt(T.kw[i] / 1000, 2) + ' MW'], ['Nabenhöhe', T.h[i] ? U.fmt(T.h[i]) + ' m' : '–'],
      ['Rotordurchmesser', T.r[i] ? U.fmt(T.r[i]) + ' m' : '–'], ['Inbetriebnahme', T.j[i] || '–'], ['Lage', T.s[i] ? 'auf See' : 'an Land']
    ]), ev.clientX, ev.clientY);
  });
  el.addEventListener('mouseleave', function () { U.tip.hide(); });
  el.addEventListener('click', function (ev) {
    if (!pointsVisible) return;
    el.dispatchEvent(new MouseEvent('mousemove', { clientX: ev.clientX, clientY: ev.clientY }));
  });

  function setMetric(k) {
    metric = k;
    ui.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-metric') === k ? 'true' : 'false'); });
    if (pointsVisible) resetZoom(900);
    color();
  }

  // Scrollytelling
  var STEPS = {
    anzahl: function () { setMetric('n'); if (t.k > 1.05) resetZoom(); },
    leistung: function () { setMetric('mw'); if (t.k > 1.05) resetZoom(); },
    zuschlag: function () { setMetric('zuschlag25_mw'); if (t.k > 1.05) resetZoom(); },
    eeg: function () { setMetric('eeg_mio'); if (t.k > 1.05) resetZoom(); },
    netzentgelt: function () { setMetric('netzentgelt'); if (t.k > 1.05) resetZoom(); },
    zoom: function () { zoomTo([8.35, 53.85, 9.45, 54.75], 1800); },
    frei: function () {}
  };
  var steps = document.querySelectorAll('.step');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        steps.forEach(function (s) { s.classList.toggle('is-active', s === e.target); });
        var f = STEPS[e.target.getAttribute('data-step')]; if (f) f();
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach(function (s) { io.observe(s); });
  }

  function resize() {
    var k = t;
    fitProjection(); draw();
    svg.call(zoom.transform, k);
    updateMode();
  }
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 150); });
  document.addEventListener('wk-theme', function () { if (T) makeBuckets(); color(); render(); });
  fitProjection(); draw(); updateMode();
  window.WKMap = { zoomTo: zoomTo, reset: resetZoom, setMetric: setMetric, loadPoints: loadPoints };
})();
