/* 3D-Größenvergleich: verbreitete Anlagentypen neben dem Kölner Dom (Maßstab 1:1 in Metern).
   three.js wird erst geladen, wenn der Abschnitt in die Nähe des Viewports kommt. */
(function () {
  'use strict';
  var U = window.WKU, WK = window.WK;
  var host = document.getElementById('viz3d');
  var cards = document.getElementById('typecards');
  if (!host || !WK || !WK.typen) return;
  var TY = WK.typen, DOM = WK.dom;
  var selected = -1;

  // Typkarten (auch ohne WebGL nutzbar)
  cards.innerHTML = TY.map(function (t, i) {
    var tip = t.nabe + t.rotor / 2;
    return '<button class="typecard" type="button" data-i="' + i + '" aria-pressed="false">' +
      '<div class="t"><i style="background:var(' + (t.lage === 'auf See' ? '--off' : '--on') + ')"></i>' + t.label + '</div>' +
      '<dl><dt>Leistung</dt><dd>' + U.fmt(t.kw / 1000, t.kw < 1000 ? 1 : 2) + ' MW</dd>' +
      '<dt>Nabenhöhe</dt><dd>' + U.fmt(t.nabe) + ' m</dd><dt>Rotor</dt><dd>' + U.fmt(t.rotor) + ' m</dd>' +
      '<dt>Gesamthöhe</dt><dd>' + U.fmt(tip) + ' m</dd>' +
      '<dt>in Betrieb</dt><dd>' + U.fmt(t.n) + ' (' + t.lage + ')</dd>' +
      '<dt>gebaut</dt><dd>' + t.ibn_von + '–' + t.ibn_bis + '</dd>' +
      '<dt>Ertrag 2025</dt><dd>' + (t.mwh ? U.fmt(t.mwh) + ' MWh' : 'noch kein volles Jahr') + '</dd></dl></button>';
  }).join('');
  cards.addEventListener('click', function (ev) {
    var b = ev.target.closest('.typecard'); if (!b) return;
    select(+b.getAttribute('data-i'), true);
  });
  function markCards() {
    cards.querySelectorAll('.typecard').forEach(function (b) { b.setAttribute('aria-pressed', +b.getAttribute('data-i') === selected ? 'true' : 'false'); });
  }
  var select = function (i) { selected = i; markCards(); };

  function webglOK() {
    try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); } catch (e) { return false; }
  }

  function fallbackSVG() {
    var items = [{ label: 'Kölner Dom', h: DOM.sued, w: 61.5, dom: true }].concat(TY.map(function (t) { return { label: t.label.replace(/^(Enercon|Vestas|Siemens) /, ''), h: t.nabe, r: t.rotor / 2, off: t.lage === 'auf See' }; }));
    var x = 10, parts = [], H = 300, sc = 1.0;
    items.forEach(function (it) {
      var w = it.dom ? it.w : it.r * 2;
      var cx = x + w / 2;
      if (it.dom) parts.push('<rect x="' + x + '" y="' + (H - it.h) + '" width="' + w + '" height="' + it.h + '" fill="var(--ink-2)" opacity=".6"/>');
      else parts.push('<line x1="' + cx + '" x2="' + cx + '" y1="' + H + '" y2="' + (H - it.h) + '" stroke="var(--ink-2)" stroke-width="3"/><circle cx="' + cx + '" cy="' + (H - it.h) + '" r="' + it.r + '" fill="none" stroke="var(' + (it.off ? '--off' : '--on') + ')" stroke-width="1.5"/>');
      parts.push('<text x="' + cx + '" y="' + (H + 14) + '" font-size="10" text-anchor="middle" fill="var(--ink-2)">' + it.label + '</text>');
      x += w + 20;
    });
    host.innerHTML = '<svg viewBox="0 -10 ' + x + ' ' + (H + 30) + '" style="width:100%;height:100%" role="img" aria-label="Seitenansicht der Anlagentypen im Maßstab neben dem Kölner Dom">' + parts.join('') + '</svg>';
  }

  U.onVisible(host, function () {
    if (!webglOK()) { fallbackSVG(); return; }
    U.loadScript('assets/vendor/three.min.js').then(function () { return U.loadScript('assets/vendor/OrbitControls.js'); })
      .then(init).catch(function () { fallbackSVG(); });
  }, '600px 0px');

  function init() {
    var THREE = window.THREE;
    var fb = document.getElementById('viz3dFallback'); if (fb) fb.remove();
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = !coarse;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(32, 1, 1, 30000);
    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.03; controls.minDistance = 60; controls.maxDistance = 6000;
    controls.enableZoom = false; controls.enabled = !coarse;
    renderer.domElement.style.touchAction = coarse ? 'pan-y' : 'none';

    // UI
    var ui = document.createElement('div'); ui.className = 'ui';
    ui.innerHTML = '<button class="btn" type="button" data-a="all">Gesamtansicht</button><button class="btn" type="button" data-a="prev" aria-label="Vorheriger Typ">‹</button><button class="btn" type="button" data-a="next" aria-label="Nächster Typ">›</button>' +
      (coarse ? '<button class="btn" type="button" data-a="touch" aria-pressed="false">Drehen erlauben</button>' : '') +
      '<button class="btn" type="button" data-a="spin" aria-pressed="true">Rotoren</button>';
    host.appendChild(ui);
    var hint = document.createElement('div'); hint.className = 'hint';
    hint.textContent = coarse ? 'Typ wählen oder „Drehen erlauben“' : 'Ziehen: drehen · Klick in die Szene, dann Mausrad: zoomen';
    host.appendChild(hint);

    var dark = U.isDark();
    var mats = {};
    function materials() {
      dark = U.isDark();
      mats.white = new THREE.MeshStandardMaterial({ color: dark ? 0xd9dcdf : 0xf4f4f1, roughness: 0.55, metalness: 0.05 });
      mats.nacelle = new THREE.MeshStandardMaterial({ color: dark ? 0xc4c8cc : 0xe6e7e4, roughness: 0.5 });
      mats.blade = new THREE.MeshStandardMaterial({ color: dark ? 0xe3e5e7 : 0xfbfbf9, roughness: 0.5, side: THREE.DoubleSide });
      mats.stone = new THREE.MeshStandardMaterial({ color: dark ? 0x5a5852 : 0x6d6a62, roughness: 0.95 });
      mats.roof = new THREE.MeshStandardMaterial({ color: dark ? 0x3d4143 : 0x4c5357, roughness: 0.8 });
      mats.tp = new THREE.MeshStandardMaterial({ color: 0xe8b21e, roughness: 0.6 });
      mats.ground = new THREE.MeshLambertMaterial({ color: dark ? 0x222a24 : 0xa9b89c });
      mats.sea = new THREE.MeshLambertMaterial({ color: dark ? 0x0f2233 : 0x7fa9c6 });
      mats.sel = new THREE.MeshStandardMaterial({ color: new THREE.Color(U.css('--accent')), roughness: 0.5, emissive: new THREE.Color(U.css('--accent')), emissiveIntensity: 0.25 });
    }
    materials();

    var hemi = new THREE.HemisphereLight(0xffffff, 0x7d8577, dark ? 0.45 : 0.62); scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xfff6e8, dark ? 0.55 : 0.72);
    function fog() { scene.fog = new THREE.Fog(U.isDark() ? 0x1a2230 : 0xeef3f7, 2500, 9000); }
    fog();
    sun.position.set(-600, 900, 700); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun); scene.add(sun.target);

    // Layout: Dom, dann Anlagen an Land nach Höhe, dann auf See
    var order = TY.map(function (t, i) { return i; });
    var onIdx = order.filter(function (i) { return TY[i].lage !== 'auf See'; }).sort(function (a, b) { return (TY[a].nabe + TY[a].rotor / 2) - (TY[b].nabe + TY[b].rotor / 2); });
    var offIdx = order.filter(function (i) { return TY[i].lage === 'auf See'; }).sort(function (a, b) { return TY[a].rotor - TY[b].rotor; });
    var seq = onIdx.concat(offIdx);
    var x = 0, pos = {}, gap = 35;
    var domW = DOM.breite; // Querhausbreite 86,25 m
    var domX = x + domW / 2; x += domW + 60;
    var seaStart = null;
    seq.forEach(function (i, k) {
      var t = TY[i], r = t.rotor / 2;
      if (t.lage === 'auf See' && seaStart === null) { x += 80; seaStart = x - 40; }
      x += r; pos[i] = x; x += r + gap;
    });
    var total = x;
    var cx = total / 2;

    // Boden und Meer
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(seaStart + 12000, 24000), mats.ground);
    ground.rotation.x = -Math.PI / 2; ground.position.set((seaStart - 12000) / 2, 0, 0); ground.receiveShadow = true; scene.add(ground);
    var sea = new THREE.Mesh(new THREE.PlaneGeometry(12000, 24000), mats.sea);
    sea.rotation.x = -Math.PI / 2; sea.position.set(seaStart + 6000, -0.5, 0); sea.receiveShadow = true; scene.add(sea);

    // Höhenlinien alle 50 m hinter der Szene
    var gridGroup = new THREE.Group();
    var lineMat = new THREE.LineBasicMaterial({ color: dark ? 0x5a6a7a : 0x7f95aa, transparent: true, opacity: 0.35, depthWrite: false });
    var hLabels = [];
    for (var h = 50; h <= 300; h += 50) {
      var g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-30, h, 0), new THREE.Vector3(total + 20, h, 0)]);
      gridGroup.add(new THREE.Line(g, lineMat));
      var hl = document.createElement('div'); hl.className = 'lbl hl'; hl.style.pointerEvents = 'none'; hl.style.transform = 'translate(4px,-50%)'; hl.textContent = h + ' m';
      host.appendChild(hl); hLabels.push({ el: hl, p: new THREE.Vector3(total + 20, h, 0) });
    }
    scene.add(gridGroup);

    // Kölner Dom (vereinfacht; Höhen und Außenmaße laut Hoher Domkirche Köln)
    function dom() {
      var grp = new THREE.Group();
      var L = DOM.laenge, B = 45, facW = DOM.breite_west, towerW = facW * 0.36;
      var z0 = -L / 2; // Westfassade vorne (z = +L/2)
      var add = function (geo, mat, px, py, pz, ry) { var m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); if (ry) m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; grp.add(m); return m; };
      // Langhaus + Chor
      add(new THREE.BoxGeometry(B, 44, L - 35), mats.stone, 0, 22, -10);
      var roofShape = new THREE.Shape(); roofShape.moveTo(-B / 2, 0); roofShape.lineTo(B / 2, 0); roofShape.lineTo(0, DOM.querhaus - 44); roofShape.lineTo(-B / 2, 0);
      var roof = add(new THREE.ExtrudeGeometry(roofShape, { depth: L - 45, bevelEnabled: false }), mats.roof, 0, 44, -10 - (L - 45) / 2);
      // Querhaus
      add(new THREE.BoxGeometry(DOM.breite, 44, 40), mats.stone, 0, 22, -5);
      var qShape = new THREE.Shape(); qShape.moveTo(-20, 0); qShape.lineTo(20, 0); qShape.lineTo(0, DOM.querhaus - 44); qShape.lineTo(-20, 0);
      var q = add(new THREE.ExtrudeGeometry(qShape, { depth: DOM.breite, bevelEnabled: false }), mats.roof, -DOM.breite / 2, 44, -5, Math.PI / 2);
      q.position.set(-DOM.breite / 2, 44, -5); q.rotation.y = Math.PI / 2;
      // Chorhaupt
      add(new THREE.CylinderGeometry(B / 2, B / 2, 44, 20, 1, false, Math.PI / 2, Math.PI), mats.stone, 0, 22, -10 - (L - 35) / 2);
      // Vierungsturm
      add(new THREE.ConeGeometry(4, DOM.vierung - DOM.querhaus + 6, 8), mats.roof, 0, (DOM.vierung + DOM.querhaus - 6) / 2, -5);
      // Westtürme
      [-1, 1].forEach(function (s) {
        var tx = s * (facW / 2 - towerW / 2), tz = L / 2 - towerW / 2;
        var hTop = s < 0 ? DOM.nord : DOM.sued;
        add(new THREE.BoxGeometry(towerW, 96, towerW), mats.stone, tx, 48, tz);
        add(new THREE.CylinderGeometry(towerW * 0.36, towerW * 0.46, 16, 8), mats.stone, tx, 104, tz);
        add(new THREE.ConeGeometry(towerW * 0.36, hTop - 112, 8), mats.stone, tx, 112 + (hTop - 112) / 2, tz);
      });
      // Mittelteil der Westfassade
      add(new THREE.BoxGeometry(facW - 2 * towerW, 58, 14), mats.stone, 0, 29, L / 2 - 7);
      return grp;
    }
    var domG = dom(); domG.position.x = domX; scene.add(domG);

    // Windenergieanlage
    function bladeGeo(R) {
      var s = new THREE.Shape(), c0 = Math.max(1.4, R * 0.085), root = R * 0.04;
      s.moveTo(-c0 * 0.25, root); s.bezierCurveTo(-c0 * 0.6, R * 0.2, -c0 * 0.35, R * 0.7, -R * 0.012, R);
      s.lineTo(R * 0.008, R); s.bezierCurveTo(c0 * 0.18, R * 0.6, c0 * 0.35, R * 0.22, c0 * 0.22, root); s.lineTo(-c0 * 0.25, root);
      return new THREE.ShapeGeometry(s, 16);
    }
    var rotors = [], turbines = [];
    function turbine(t, i) {
      var grp = new THREE.Group(), hub = t.nabe, D = t.rotor, R = D / 2, off = t.lage === 'auf See';
      var rb = Math.max(1.6, Math.min(5.5, hub * 0.032)), rt = rb * 0.5;
      var tower = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, hub, 28), mats.white);
      tower.position.y = hub / 2; tower.castShadow = true; grp.add(tower);
      if (off) {
        var tp = new THREE.Mesh(new THREE.CylinderGeometry(rb * 1.15, rb * 1.15, 22, 28), mats.tp); tp.position.y = 5; grp.add(tp);
      }
      var nl = Math.max(7, D * 0.085), nh = Math.max(3.2, D * 0.036);
      var nac = new THREE.Mesh(new THREE.BoxGeometry(nh * 1.05, nh, nl), mats.nacelle);
      nac.position.set(0, hub, -nl * 0.25); nac.castShadow = true; grp.add(nac);
      var rotor = new THREE.Group(); rotor.position.set(0, hub, nl * 0.28 + 1.5);
      var spinner = new THREE.Mesh(new THREE.SphereGeometry(Math.max(1.6, D * 0.022), 20, 14), mats.nacelle);
      spinner.scale.set(1, 1, 1.35); rotor.add(spinner);
      var bg = bladeGeo(R);
      for (var b = 0; b < 3; b++) {
        var bl = new THREE.Mesh(bg, mats.blade); bl.rotation.z = b * 2 * Math.PI / 3; bl.castShadow = true; rotor.add(bl);
      }
      grp.add(rotor);
      // Drehzahl schematisch: Blattspitzen-Geschwindigkeit ~75 m/s, halbiert
      rotor.userData.w = (75 / R) * 0.5;
      rotor.rotation.z = i * 0.7;
      rotors.push(rotor);
      grp.position.x = pos[i];
      grp.userData = { i: i, tower: tower, nac: nac, rotor: rotor };
      scene.add(grp);
      turbines[i] = grp;
      return grp;
    }
    seq.forEach(function (i) { turbine(TY[i], i); });

    // Beschriftungen
    var labels = [];
    function mkLabel(html, p, onclick, i) {
      var d = document.createElement('div'); d.className = 'lbl'; d.innerHTML = html; host.appendChild(d);
      if (onclick) d.addEventListener('click', onclick);
      labels.push({ el: d, p: p, i: i }); return d;
    }
    mkLabel('<b>Kölner Dom</b><br>' + U.fmt(DOM.sued, 0) + ' m', new THREE.Vector3(domX, DOM.sued + 10, DOM.laenge / 2 - 10), function () { focus(-2); });
    seq.forEach(function (i) {
      var t = TY[i];
      mkLabel('<b>' + t.label.replace(/^(Enercon|Vestas|Siemens) /, '') + '</b> · ' + U.fmt(t.nabe + t.rotor / 2) + ' m<br><span class="lk">' + U.fmt(t.kw / 1000, 1) + ' MW</span>',
        new THREE.Vector3(pos[i], t.nabe + t.rotor / 2 + 10, 0), function () { select(i, true); }, i);
    });

    // Kamera
    var W = 1, H = 1;
    function frameAll(immediate) {
      var h = 290, fov = camera.fov * Math.PI / 180;
      var dH = (h / 2) / Math.tan(fov / 2);
      var dW = ((total + 160) / 2) / Math.tan(fov / 2) / camera.aspect;
      var d = Math.max(dH, dW) * 1.02;
      animateTo(new THREE.Vector3(cx, 115, 0), new THREE.Vector3(cx, 115 + d * 0.1, d), immediate);
    }
    function focus(i) {
      var px, tH, R;
      if (i === -2) { px = domX; tH = DOM.sued; R = 70; }
      else { var t = TY[i]; px = pos[i]; tH = t.nabe + t.rotor / 2; R = t.rotor / 2; }
      var fov = camera.fov * Math.PI / 180;
      var d = Math.max((tH * 0.62) / Math.tan(fov / 2), (R * 2.6) / Math.tan(fov / 2) / camera.aspect);
      animateTo(new THREE.Vector3(px, tH * 0.5, 0), new THREE.Vector3(px + d * 0.35, tH * 0.55, d), false);
    }
    var anim = null;
    function animateTo(target, position, immediate) {
      if (immediate || U.reducedMotion) { controls.target.copy(target); camera.position.copy(position); controls.update(); anim = null; return; }
      anim = { t0: performance.now(), dur: 1100, ft: controls.target.clone(), fp: camera.position.clone(), tt: target, tp: position };
    }
    select = function (i, doFocus) {
      if (selected >= 0 && turbines[selected]) { var u0 = turbines[selected].userData; u0.tower.material = mats.white; u0.nac.material = mats.nacelle; }
      selected = i; markCards();
      labels.forEach(function (l) { l.el.classList.toggle('sel', l.i === i); });
      if (i >= 0 && turbines[i]) { var u = turbines[i].userData; u.tower.material = mats.sel; if (doFocus) focus(i); }
    };

    function resize() {
      var r = host.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
      renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
      sun.shadow.camera.left = -total * 0.7; sun.shadow.camera.right = total * 0.7; sun.shadow.camera.top = 700; sun.shadow.camera.bottom = -700;
      sun.shadow.camera.far = 4000; sun.target.position.set(cx, 0, 0); sun.position.set(cx - 700, 1100, 900); sun.shadow.camera.updateProjectionMatrix();
    }
    function frameStart(immediate) {
      if (W >= 640) { frameAll(immediate); return; }
      // Schmale Bildschirme: Dom und die ersten vier Typen, weiter mit ‹ ›
      var x1 = domX - DOM.breite / 2 - 20, x2 = pos[seq[3]] + TY[seq[3]].rotor / 2 + 20;
      var fov = camera.fov * Math.PI / 180, mid = (x1 + x2) / 2;
      var d = Math.max((200 / 2) / Math.tan(fov / 2), ((x2 - x1) / 2) / Math.tan(fov / 2) / camera.aspect) * 1.05;
      animateTo(new THREE.Vector3(mid, 90, 0), new THREE.Vector3(mid, 90 + d * 0.08, d), immediate);
    }
    resize(); frameStart(true);
    window.addEventListener('resize', function () { resize(); });

    // Interaktion
    renderer.domElement.addEventListener('pointerdown', function () { if (!coarse) controls.enableZoom = true; });
    document.addEventListener('pointerdown', function (ev) { if (!host.contains(ev.target)) controls.enableZoom = false; });
    var spin = true;
    ui.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      var a = b.getAttribute('data-a');
      if (a === 'all') { select(-1); frameStart(false); }
      if (a === 'next' || a === 'prev') {
        var k = seq.indexOf(selected); k = a === 'next' ? (k + 1) % seq.length : (k <= 0 ? seq.length - 1 : k - 1);
        select(seq[k], true);
      }
      if (a === 'spin') { spin = !spin; b.setAttribute('aria-pressed', spin ? 'true' : 'false'); }
      if (a === 'touch') {
        controls.enabled = !controls.enabled; controls.enableZoom = controls.enabled;
        renderer.domElement.style.touchAction = controls.enabled ? 'none' : 'pan-y';
        b.setAttribute('aria-pressed', controls.enabled ? 'true' : 'false'); b.textContent = controls.enabled ? 'Scrollen erlauben' : 'Drehen erlauben';
      }
    });

    var v3 = new THREE.Vector3();
    function place(list, avoid) {
      var placed = [];
      list.forEach(function (l) {
        v3.copy(l.p).project(camera);
        var vis = v3.z < 1 && v3.x > -1.1 && v3.x < 1.1 && v3.y > -1.1 && v3.y < 1.2;
        l.el.style.display = vis ? '' : 'none';
        if (!vis) return;
        var x = (v3.x + 1) / 2 * W, y = (1 - v3.y) / 2 * H;
        if (avoid) {
          var w = l.el.offsetWidth, h = l.el.offsetHeight, moved = true, guard = 0;
          while (moved && guard++ < 12) {
            moved = false;
            for (var q = 0; q < placed.length; q++) {
              var o = placed[q];
              if (Math.abs(o.x - x) < (o.w + w) / 2 + 3 && Math.abs(o.y - y) < (o.h + h) / 2 + 2) { y = o.y - (o.h + h) / 2 - 3; moved = true; }
            }
          }
          placed.push({ x: x, y: y, w: w, h: h });
          y += h / 2; // Transform zentriert vertikal nicht; Ankerpunkt unten
        }
        l.el.style.left = x + 'px'; l.el.style.top = y + 'px';
      });
    }
    var last = performance.now(), visible = true;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible) { last = performance.now(); loop(); } }).observe(host);
    function loop() {
      if (!visible) return;
      var now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (anim) {
        var k = Math.min(1, (now - anim.t0) / anim.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        controls.target.lerpVectors(anim.ft, anim.tt, e); camera.position.lerpVectors(anim.fp, anim.tp, e);
        if (k >= 1) anim = null;
      }
      if (spin && !U.reducedMotion) rotors.forEach(function (r) { r.rotation.z -= r.userData.w * dt; });
      controls.update();
      renderer.render(scene, camera);
      place(labels, true); place(hLabels);
      requestAnimationFrame(loop);
    }
    loop();
    document.addEventListener('wk-theme', function () {
      materials();
      ground.material = mats.ground; sea.material = mats.sea;
      scene.traverse(function (o) { if (o.isMesh && o.material && o.material.color) { /* Farben der Anlagen neu setzen */ } });
      turbines.forEach(function (g) { g.traverse(function (o) { if (o.isMesh) { if (o.material.side === THREE.DoubleSide) o.material = mats.blade; else if (o.geometry.type === 'CylinderGeometry' && o !== g.userData.tower && o.material.color.getHex() !== 0xe8b21e) o.material = mats.white; } }); g.userData.nac.material = mats.nacelle; g.userData.tower.material = g.userData.i === selected ? mats.sel : mats.white; });
      domG.traverse(function (o) { if (o.isMesh) o.material = o.geometry.type === 'ExtrudeGeometry' || o.geometry.type === 'ConeGeometry' && o.position.x === 0 ? mats.roof : mats.stone; });
      hemi.intensity = U.isDark() ? 0.45 : 0.62; fog();
    });
    window.WK3D = { select: select, frameAll: frameAll, focus: focus };
  }
})();
