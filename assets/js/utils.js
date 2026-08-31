/* ============================================================
   utils.js — helper murni (format uang, tanggal, DOM, dsb)
   Tidak punya dependensi ke modul lain.
   ============================================================ */
(function (root) {
  'use strict';

  /* ---------- Uang ---------- */
  var currency = { code: 'IDR', locale: 'id-ID', symbol: 'Rp' };

  var SYMBOLS = { IDR: 'Rp', USD: '$', EUR: '€', SGD: 'S$', MYR: 'RM', JPY: '¥', GBP: '£', AUD: 'A$' };
  var LOCALES = { IDR: 'id-ID', USD: 'en-US', EUR: 'de-DE', SGD: 'en-SG', MYR: 'ms-MY', JPY: 'ja-JP', GBP: 'en-GB', AUD: 'en-AU' };

  function setCurrency(code) {
    currency.code = code || 'IDR';
    currency.symbol = SYMBOLS[currency.code] || currency.code + ' ';
    currency.locale = LOCALES[currency.code] || 'en-US';
  }
  function currencySymbol() { return currency.symbol; }
  function currencyCode() { return currency.code; }

  /** Format angka penuh: Rp15.000.000 */
  function money(n) {
    n = Math.round(Number(n) || 0);
    return currency.symbol + n.toLocaleString(currency.locale);
  }
  /** Format ringkas untuk chart/label: Rp15,0 jt */
  function moneyShort(n) {
    n = Number(n) || 0;
    var abs = Math.abs(n), s = currency.symbol;
    if (currency.code === 'IDR') {
      if (abs >= 1e9) return s + trim(n / 1e9) + ' M';
      if (abs >= 1e6) return s + trim(n / 1e6) + ' jt';
      if (abs >= 1e3) return s + trim(n / 1e3) + ' rb';
      return s + Math.round(n);
    }
    if (abs >= 1e9) return s + trim(n / 1e9) + 'B';
    if (abs >= 1e6) return s + trim(n / 1e6) + 'M';
    if (abs >= 1e3) return s + trim(n / 1e3) + 'K';
    return s + Math.round(n);
  }
  function trim(v) { return (Math.round(v * 10) / 10).toString().replace('.', ','); }

  /** Ambil angka dari input bebas: "Rp 1.500.000" / "1,5jt" -> 1500000 */
  function parseAmount(str) {
    if (typeof str === 'number') return isFinite(str) ? str : 0;
    if (!str) return 0;
    var s = String(str).toLowerCase().trim();
    var mult = 1;
    if (/(jt|juta|m(?![a-z]))/.test(s)) mult = 1e6;
    else if (/(rb|ribu|k(?![a-z]))/.test(s)) mult = 1e3;
    s = s.replace(/[^0-9.,]/g, '');
    if (mult > 1) {
      // pada notasi singkat, koma/titik dianggap desimal: "1,5jt"
      s = s.replace(/\./g, '.').replace(/,/g, '.');
      var parts = s.split('.');
      if (parts.length > 2) s = parts.shift() + '.' + parts.join('');
      return Math.round((parseFloat(s) || 0) * mult);
    }
    // angka penuh: titik & koma dianggap pemisah ribuan
    s = s.replace(/[.,]/g, '');
    return Math.round(parseFloat(s) || 0);
  }

  /** Pasang auto-format ribuan pada input teks uang */
  function attachMoneyMask(input) {
    if (!input) return;
    input.addEventListener('input', function () {
      var caretEnd = input.selectionStart === input.value.length;
      var v = parseAmount(input.value);
      input.dataset.raw = String(v);
      input.value = v ? v.toLocaleString(currency.locale) : '';
      if (caretEnd) { try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {} }
    });
  }
  function readMoneyInput(input) { return input ? parseAmount(input.value) : 0; }

  /* ---------- Tanggal ---------- */
  var DAY = 86400000;
  function toISO(d) {
    var dt = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dt)) return '';
    return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() { return toISO(new Date()); }
  /** Tengah hari lokal supaya aman dari pergeseran timezone */
  function parseDate(iso) {
    if (!iso) return null;
    var p = String(iso).slice(0, 10).split('-');
    if (p.length !== 3) return null;
    var d = new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0, 0);
    return isNaN(d) ? null : d;
  }
  function daysBetween(fromISO, toISOStr) {
    var a = parseDate(fromISO), b = parseDate(toISOStr);
    if (!a || !b) return null;
    return Math.round((b - a) / DAY);
  }
  function addDays(iso, n) {
    var d = parseDate(iso) || new Date();
    d.setDate(d.getDate() + n);
    return toISO(d);
  }
  function fmtDate(iso, style) {
    var d = parseDate(iso);
    if (!d) return '—';
    var opt = style === 'long'
      ? { day: 'numeric', month: 'long', year: 'numeric' }
      : { day: 'numeric', month: 'short', year: 'numeric' };
    return d.toLocaleDateString(currency.locale, opt);
  }
  /** "hari ini", "3 hari lagi", "2 hari lalu" */
  function relDate(iso) {
    var diff = daysBetween(today(), iso);
    if (diff === null) return '—';
    if (diff === 0) return 'hari ini';
    if (diff === 1) return 'besok';
    if (diff === -1) return 'kemarin';
    if (diff > 0) return diff + ' hari lagi';
    return Math.abs(diff) + ' hari lalu';
  }
  /** Kunci minggu ISO: 2026-W12 */
  function weekKey(iso) {
    var d = parseDate(iso); if (!d) return '';
    var t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var day = (t.getDay() + 6) % 7;              // Senin = 0
    t.setDate(t.getDate() - day + 3);            // Kamis minggu ini
    var firstThu = new Date(t.getFullYear(), 0, 4);
    var fday = (firstThu.getDay() + 6) % 7;
    firstThu.setDate(firstThu.getDate() - fday + 3);
    var week = 1 + Math.round((t - firstThu) / (7 * DAY));
    return t.getFullYear() + '-W' + pad(week);
  }
  function monthKey(iso) { return String(iso || '').slice(0, 7); }
  function monthLabel(key) {
    var d = parseDate(key + '-01'); if (!d) return key;
    return d.toLocaleDateString(currency.locale, { month: 'short', year: '2-digit' });
  }

  /* ---------- Misc ---------- */
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function sum(arr, pick) {
    return arr.reduce(function (a, x) { return a + (pick ? Number(pick(x)) || 0 : Number(x) || 0); }, 0);
  }
  function groupSum(arr, keyFn, valFn) {
    var out = {};
    arr.forEach(function (x) {
      var k = keyFn(x);
      out[k] = (out[k] || 0) + (Number(valFn(x)) || 0);
    });
    return out;
  }
  function debounce(fn, ms) {
    var t; return function () {
      var a = arguments, self = this;
      clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms || 200);
    };
  }
  /** Buat elemen dari string HTML */
  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /** Animasi angka naik (untuk statistik) */
  function animateNumber(node, to, formatter, ms) {
    if (!node) return;
    var from = Number(node.dataset.val || 0), dur = ms || 700, start = 0;
    node.dataset.val = String(to);
    var fmt = formatter || money;
    if (from === to) { node.textContent = fmt(to); return; }
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      node.textContent = fmt(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  root.Utils = {
    setCurrency: setCurrency, currencySymbol: currencySymbol, currencyCode: currencyCode, SYMBOLS: SYMBOLS,
    money: money, moneyShort: moneyShort, parseAmount: parseAmount, attachMoneyMask: attachMoneyMask, readMoneyInput: readMoneyInput,
    toISO: toISO, today: today, parseDate: parseDate, daysBetween: daysBetween, addDays: addDays,
    fmtDate: fmtDate, relDate: relDate, weekKey: weekKey, monthKey: monthKey, monthLabel: monthLabel,
    uid: uid, clamp: clamp, escapeHtml: escapeHtml, sum: sum, groupSum: groupSum, debounce: debounce,
    el: el, $: $, $$: $$, animateNumber: animateNumber, DAY: DAY
  };
})(typeof window !== 'undefined' ? window : globalThis);
