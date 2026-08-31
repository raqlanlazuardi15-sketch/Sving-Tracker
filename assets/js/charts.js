/* ============================================================
   charts.js — chart SVG ringan tanpa library eksternal.
   Charts.line(container, points, opts)  -> area + line chart
   Charts.bars(container, bars, opts)    -> bar chart vertikal
   Charts.ring(percent, size, stroke)    -> SVG circular progress
   ============================================================ */
(function (root) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var uidc = 0;

  function niceMax(v) {
    if (v <= 0) return 1;
    var pow = Math.pow(10, Math.floor(Math.log10(v)));
    var n = v / pow;
    var step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * pow;
  }

  function svgEl(name, attrs) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    return e;
  }

  function ensureTip(container) {
    var tip = container.querySelector('.chart-tip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'chart-tip';
      container.appendChild(tip);
    }
    return tip;
  }

  function emptyState(container, msg) {
    container.innerHTML = '<div class="chart-empty">' + Utils.escapeHtml(msg || 'Belum ada data 📉<br>Mulai menabung dulu ya!') + '</div>';
  }

  /* ---------------- LINE / AREA CHART ---------------- */
  function line(container, points, opts) {
    opts = opts || {};
    if (!container) return;
    container.style.position = 'relative';
    if (!points || points.length < 2) { emptyState(container, opts.empty); return; }

    var W = 720, H = opts.height || 260;
    var pad = { t: 18, r: 14, b: 30, l: 58 };
    var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    var maxY = niceMax(Math.max.apply(null, points.map(function (p) { return p.y; })));
    var id = 'grad' + (++uidc);

    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': opts.label || 'Grafik tabungan' });

    var defs = svgEl('defs');
    var lg = svgEl('linearGradient', { id: id, x1: '0', y1: '0', x2: '0', y2: '1' });
    lg.appendChild(svgEl('stop', { offset: '0%', 'stop-color': '#6d5efc', 'stop-opacity': '.45' }));
    lg.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#22d3ee', 'stop-opacity': '0' }));
    defs.appendChild(lg);
    svg.appendChild(defs);

    var X = function (i) { return pad.l + (iw * i) / (points.length - 1); };
    var Y = function (v) { return pad.t + ih - (ih * v) / maxY; };

    // grid + label sumbu Y
    for (var g = 0; g <= 4; g++) {
      var val = (maxY / 4) * g, y = Y(val);
      svg.appendChild(svgEl('line', { x1: pad.l, y1: y, x2: W - pad.r, y2: y, stroke: 'currentColor', 'stroke-opacity': '.1', 'stroke-dasharray': g ? '4 6' : '0' }));
      var t = svgEl('text', { x: pad.l - 8, y: y + 4, 'text-anchor': 'end', 'font-size': '11', fill: 'currentColor', 'fill-opacity': '.5' });
      t.textContent = Utils.moneyShort(val);
      svg.appendChild(t);
    }

    // path
    var dLine = '', dArea = '';
    points.forEach(function (p, i) {
      var x = X(i), y = Y(p.y);
      dLine += (i ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    });
    dArea = dLine + ' L' + X(points.length - 1).toFixed(1) + ' ' + (pad.t + ih) + ' L' + pad.l + ' ' + (pad.t + ih) + ' Z';

    svg.appendChild(svgEl('path', { d: dArea, fill: 'url(#' + id + ')' }));
    var stroke = svgEl('path', { d: dLine, fill: 'none', stroke: '#6d5efc', 'stroke-width': '3', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    svg.appendChild(stroke);

    // label sumbu X (maks 5 label)
    var every = Math.ceil(points.length / 5);
    points.forEach(function (p, i) {
      if (i % every && i !== points.length - 1) return;
      var t = svgEl('text', { x: X(i), y: H - 8, 'text-anchor': 'middle', 'font-size': '11', fill: 'currentColor', 'fill-opacity': '.5' });
      t.textContent = Utils.fmtDate(p.x).replace(/\s\d{4}$/, '');
      svg.appendChild(t);
    });

    // titik interaktif (hover -> tooltip)
    var tip = ensureTip(container);
    points.forEach(function (p, i) {
      var c = svgEl('circle', { cx: X(i), cy: Y(p.y), r: 12, fill: 'transparent', style: 'cursor:pointer' });
      var dot = svgEl('circle', { cx: X(i), cy: Y(p.y), r: 0, fill: '#fff', stroke: '#6d5efc', 'stroke-width': '3' });
      c.addEventListener('mouseenter', function () {
        dot.setAttribute('r', '5');
        tip.textContent = Utils.fmtDate(p.x) + ' · ' + Utils.money(p.y);
        var rect = container.getBoundingClientRect();
        tip.style.left = (X(i) / W * rect.width) + 'px';
        tip.style.top = (Y(p.y) / H * rect.height) + 'px';
        tip.classList.add('is-on');
      });
      c.addEventListener('mouseleave', function () { dot.setAttribute('r', '0'); tip.classList.remove('is-on'); });
      svg.appendChild(dot); svg.appendChild(c);
    });

    container.innerHTML = '';
    container.appendChild(svg);
    container.appendChild(tip);

    // animasi gambar garis
    try {
      var len = stroke.getTotalLength();
      stroke.style.strokeDasharray = len; stroke.style.strokeDashoffset = len;
      stroke.getBoundingClientRect();
      stroke.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(.22,.68,0,1)';
      stroke.style.strokeDashoffset = '0';
    } catch (e) { /* getTotalLength tidak tersedia: lewati animasi */ }
  }

  /* ---------------- BAR CHART ---------------- */
  function bars(container, data, opts) {
    opts = opts || {};
    if (!container) return;
    container.style.position = 'relative';
    if (!data || !data.length) { emptyState(container, opts.empty); return; }

    var W = 720, H = opts.height || 250;
    var pad = { t: 18, r: 14, b: 34, l: 58 };
    var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    var maxY = niceMax(Math.max.apply(null, data.map(function (d) { return d.value; })));
    var slot = iw / data.length;
    var bw = Math.min(46, slot * 0.6);
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': opts.label || 'Grafik bar' });
    var tip = ensureTip(container);

    for (var g = 0; g <= 4; g++) {
      var val = (maxY / 4) * g, y = pad.t + ih - (ih * val) / maxY;
      svg.appendChild(svgEl('line', { x1: pad.l, y1: y, x2: W - pad.r, y2: y, stroke: 'currentColor', 'stroke-opacity': '.1', 'stroke-dasharray': g ? '4 6' : '0' }));
      var t = svgEl('text', { x: pad.l - 8, y: y + 4, 'text-anchor': 'end', 'font-size': '11', fill: 'currentColor', 'fill-opacity': '.5' });
      t.textContent = Utils.moneyShort(val);
      svg.appendChild(t);
    }

    data.forEach(function (d, i) {
      var h = maxY ? (ih * d.value) / maxY : 0;
      var x = pad.l + slot * i + (slot - bw) / 2;
      var y = pad.t + ih - h;
      var r = svgEl('rect', { x: x, y: pad.t + ih, width: bw, height: 0, rx: Math.min(9, bw / 2), fill: opts.color || '#6d5efc', style: 'cursor:pointer;transition:y .8s cubic-bezier(.22,.68,0,1),height .8s cubic-bezier(.22,.68,0,1),opacity .2s' });
      r.addEventListener('mouseenter', function () {
        r.style.opacity = '.75';
        tip.textContent = d.label + ' · ' + Utils.money(d.value);
        var rect = container.getBoundingClientRect();
        tip.style.left = ((x + bw / 2) / W * rect.width) + 'px';
        tip.style.top = (y / H * rect.height) + 'px';
        tip.classList.add('is-on');
      });
      r.addEventListener('mouseleave', function () { r.style.opacity = '1'; tip.classList.remove('is-on'); });
      svg.appendChild(r);
      setTimeout(function () { r.setAttribute('y', y); r.setAttribute('height', Math.max(2, h)); }, 40 + i * 45);

      var lt = svgEl('text', { x: x + bw / 2, y: H - 10, 'text-anchor': 'middle', 'font-size': '11', fill: 'currentColor', 'fill-opacity': '.6' });
      lt.textContent = d.label;
      svg.appendChild(lt);
    });

    container.innerHTML = '';
    container.appendChild(svg);
    container.appendChild(tip);
  }

  /* ---------------- CIRCULAR PROGRESS ---------------- */
  /** Kembalikan markup ring SVG. percent 0..100 */
  function ring(percent, size, stroke, gradient) {
    size = size || 92; stroke = stroke || 9;
    var p = Utils.clamp(Number(percent) || 0, 0, 100);
    var r = (size - stroke) / 2, c = 2 * Math.PI * r;
    var off = c * (1 - p / 100);
    var gid = 'ring' + (++uidc);
    var col = gradient === 'money' ? ['#16c79a', '#4ade80'] : gradient === 'white' ? ['#ffffff', '#e0e7ff'] : ['#6d5efc', '#22d3ee'];
    return '' +
      '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
        '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0%" stop-color="' + col[0] + '"/><stop offset="100%" stop-color="' + col[1] + '"/>' +
        '</linearGradient></defs>' +
        '<circle class="ring__bg" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke-width="' + stroke + '"/>' +
        '<circle class="ring__fg" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke-width="' + stroke + '"' +
          ' stroke="url(#' + gid + ')" stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + c.toFixed(2) + '"' +
          ' data-offset="' + off.toFixed(2) + '"/>' +
      '</svg>';
  }

  /** Jalankan animasi semua ring yang belum dianimasikan. */
  function animateRings(scope) {
    Utils.$$('.ring__fg', scope || document).forEach(function (c) {
      if (c.dataset.done) return;
      c.dataset.done = '1';
      requestAnimationFrame(function () { c.setAttribute('stroke-dashoffset', c.dataset.offset); });
    });
  }

  root.Charts = { line: line, bars: bars, ring: ring, animateRings: animateRings, niceMax: niceMax };
})(typeof window !== 'undefined' ? window : globalThis);
