/* ============================================================
   confetti.js — perayaan sederhana pakai canvas (tanpa library).
   Confetti.fire({ count, duration })  -> hujan confetti
   Confetti.burst(x, y)                -> ledakan kecil di titik tertentu
   ============================================================ */
(function (root) {
  'use strict';

  var COLORS = ['#6d5efc', '#9b5cff', '#22d3ee', '#16c79a', '#fbbf24', '#f43f5e', '#4ade80'];
  var canvas, ctx, particles = [], running = false, endAt = 0;

  function setup() {
    canvas = document.getElementById('confettiCanvas');
    if (!canvas) return false;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    return true;
  }
  function resize() {
    if (!canvas) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function make(x, y, spread, power) {
    var a = Math.random() * Math.PI * 2;
    var v = power * (0.4 + Math.random() * 0.9);
    return {
      x: x, y: y,
      vx: Math.cos(a) * v * spread,
      vy: Math.sin(a) * v - power * 0.5,
      g: 0.16 + Math.random() * 0.14,
      size: 5 + Math.random() * 7,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.28,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      shape: Math.random() < 0.32 ? 'circle' : 'rect',
      life: 1
    };
  }

  function loop() {
    if (!ctx) return;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    var alive = 0;
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (p.life <= 0) continue;
      p.vy += p.g; p.vx *= 0.995;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      if (p.y > window.innerHeight + 40) { p.life = 0; continue; }
      alive++;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.globalAlpha = 0.95;
      if (p.shape === 'circle') { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (alive || Date.now() < endAt) requestAnimationFrame(loop);
    else { running = false; particles = []; ctx.clearRect(0, 0, window.innerWidth, window.innerHeight); }
  }

  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(loop);
  }

  /** Hujan confetti dari atas layar. */
  function fire(opts) {
    opts = opts || {};
    if (!canvas && !setup()) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var count = opts.count || 130;
    var w = window.innerWidth;
    for (var i = 0; i < count; i++) {
      var p = make(Math.random() * w, -20 - Math.random() * 120, 1, 3);
      p.vy = Math.abs(p.vy) * 0.4 + 1;
      particles.push(p);
    }
    endAt = Date.now() + (opts.duration || 900);
    start();
  }

  /** Ledakan kecil (dipakai saat menambah tabungan). */
  function burst(x, y, count) {
    if (!canvas && !setup()) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (var i = 0; i < (count || 34); i++) particles.push(make(x, y, 1.4, 6));
    endAt = Date.now() + 400;
    start();
  }

  /** Confetti dari elemen tertentu (mis. tombol yang diklik). */
  function fromElement(elm, count) {
    if (!elm) return burst(window.innerWidth / 2, window.innerHeight / 2, count);
    var r = elm.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, count);
  }

  root.Confetti = { fire: fire, burst: burst, fromElement: fromElement };
})(typeof window !== 'undefined' ? window : globalThis);
