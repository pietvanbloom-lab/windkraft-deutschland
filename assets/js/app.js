/* Gemeinsame Helfer: Formatierung, Farben, Tooltip, Nachladen, Tabellenansicht, Theme. */
(function () {
  'use strict';
  var U = window.WKU = {};
  var nf = {};
  U.fmt = function (v, d) {
    if (v === null || v === undefined || isNaN(v)) return '–';
    d = d || 0;
    if (!nf[d]) nf[d] = new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
    return nf[d].format(v);
  };
  U.css = function (name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); };
  U.isDark = function () {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  };
  U.reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Skripte per <script>-Tag nachladen (funktioniert auch unter file://, anders als fetch)
  var loading = {};
  U.loadScript = function (src) {
    if (!loading[src]) {
      loading[src] = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = src; s.async = true;
        s.onload = resolve;
        s.onerror = function () { reject(new Error('Laden fehlgeschlagen: ' + src)); };
        document.head.appendChild(s);
      });
    }
    return loading[src];
  };

  U.onVisible = function (el, cb, margin) {
    if (!('IntersectionObserver' in window)) { cb(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); cb(); } });
    }, { rootMargin: margin || '400px 0px' });
    io.observe(el);
  };

  // Tooltip
  var tip = document.getElementById('tooltip');
  U.tip = {
    show: function (html, x, y) {
      tip.innerHTML = html; tip.classList.add('show');
      var r = tip.getBoundingClientRect();
      var px = x + 14, py = y + 14;
      if (px + r.width > window.innerWidth - 8) px = x - r.width - 14;
      if (py + r.height > window.innerHeight - 8) py = y - r.height - 14;
      tip.style.left = Math.max(8, px) + 'px'; tip.style.top = Math.max(8, py) + 'px';
    },
    hide: function () { tip.classList.remove('show'); }
  };
  U.rows = function (pairs) {
    return pairs.map(function (p) { return '<div class="row"><span>' + p[0] + '</span><span>' + p[1] + '</span></div>'; }).join('');
  };

  // Tabellenansicht je Abbildung
  U.tables = {};
  U.renderTable = function (fig) {
    var name = fig.getAttribute('data-chart');
    var t = U.tables[name];
    var wrap = fig.querySelector('.tablewrap');
    if (wrap) { wrap.remove(); return false; }
    if (!t) return false;
    wrap = document.createElement('div'); wrap.className = 'tablewrap';
    var h = '<table class="data"><thead><tr>' + t.cols.map(function (c) { return '<th scope="col">' + c + '</th>'; }).join('') + '</tr></thead><tbody>';
    t.rows.forEach(function (r) { h += '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; });
    wrap.innerHTML = h + '</tbody></table>';
    fig.appendChild(wrap);
    return true;
  };
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('.tbtn');
    if (!b) return;
    var open = U.renderTable(b.closest('.figure'));
    b.textContent = open ? 'Tabelle ausblenden' : 'Tabelle';
  });

  // Farbschema
  var btn = document.getElementById('themeBtn');
  if (btn) btn.addEventListener('click', function () {
    var next = U.isDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('wk-theme', next); } catch (e) {}
    document.dispatchEvent(new CustomEvent('wk-theme'));
  });
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var fire = function () { if (!document.documentElement.getAttribute('data-theme')) document.dispatchEvent(new CustomEvent('wk-theme')); };
    if (mq.addEventListener) mq.addEventListener('change', fire); else if (mq.addListener) mq.addListener(fire);
  }

  // Aktiven Abschnitt in der Navigation markieren
  var links = Array.prototype.slice.call(document.querySelectorAll('.topnav a[href^="#"]'));
  if ('IntersectionObserver' in window && links.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(function (a) { var s = document.querySelector(a.getAttribute('href')); if (s) io.observe(s); });
  }
})();
