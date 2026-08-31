/* ============================================================
   store.js — satu-satunya tempat data disentuh.
   Semua akses data lewat Store.*  → nanti kalau mau pindah ke
   database + login multi-user, cukup ganti isi `Adapter` di bawah
   (mis. fetch ke REST API) tanpa mengubah UI sama sekali.
   ============================================================ */
(function (root) {
  'use strict';

  var KEY = 'sst.data.v1';   // versi dinaikkan kalau struktur berubah
  var listeners = [];

  /* ---------- Bentuk data default ---------- */
  function defaultState() {
    return {
      version: 1,
      user: { id: 'local', name: '' },      // siap dipakai multi-user nanti
      goals: [],                            // lihat makeGoal()
      transactions: [],                     // lihat makeTx()
      achievements: {},                     // { achievementId: 'YYYY-MM-DD' }
      streak: { current: 0, longest: 0, lastSaveDate: null },
      settings: {
        theme: 'light',
        currency: 'IDR',
        reminder: { enabled: false, frequency: 'daily', time: '20:00', lastShown: null },
        confetti: true,
        challenge: { date: null, amount: 0, done: false }
      },
      meta: { createdAt: new Date().toISOString(), lastOpened: null }
    };
  }

  function makeGoal(input) {
    return {
      id: Utils.uid('goal'),
      name: String(input.name || 'Target Baru').trim(),
      icon: input.icon || '🎯',
      targetAmount: Math.max(0, Number(input.targetAmount) || 0),
      initialAmount: Math.max(0, Number(input.initialAmount) || 0),
      targetDate: input.targetDate || '',
      productUrl: input.productUrl || '',
      image: input.image || '',          // dataURL hasil upload (opsional)
      note: input.note || '',
      archived: false,
      completedAt: null,
      createdAt: new Date().toISOString()
    };
  }

  function makeTx(input) {
    return {
      id: Utils.uid('tx'),
      goalId: input.goalId,
      amount: Math.round(Number(input.amount) || 0),
      date: input.date || Utils.today(),
      note: input.note || '',
      createdAt: new Date().toISOString()
    };
  }

  /* ---------- Adapter penyimpanan (localStorage) ---------- */
  var Adapter = {
    read: function () {
      try {
        var raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { console.warn('Gagal membaca data:', e); return null; }
    },
    write: function (state) {
      try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
      catch (e) {
        console.warn('Gagal menyimpan data:', e);
        if (root.UI && UI.toast) UI.toast('Penyimpanan browser penuh 😥', '⚠️');
        return false;
      }
    }
  };

  var state = null;

  /** Gabungkan data lama dengan default (biar aman saat ada field baru) */
  function migrate(saved) {
    var base = defaultState();
    if (!saved || typeof saved !== 'object') return base;
    var s = Object.assign(base, saved);
    s.settings = Object.assign(base.settings, saved.settings || {});
    s.settings.reminder = Object.assign(base.settings.reminder, (saved.settings || {}).reminder || {});
    s.settings.challenge = Object.assign(base.settings.challenge, (saved.settings || {}).challenge || {});
    s.streak = Object.assign(base.streak, saved.streak || {});
    s.user = Object.assign(base.user, saved.user || {});
    s.meta = Object.assign(base.meta, saved.meta || {});
    s.goals = Array.isArray(saved.goals) ? saved.goals : [];
    s.transactions = Array.isArray(saved.transactions) ? saved.transactions : [];
    s.achievements = saved.achievements && typeof saved.achievements === 'object' ? saved.achievements : {};
    return s;
  }

  function init() {
    state = migrate(Adapter.read());
    state.meta.lastOpened = new Date().toISOString();
    Utils.setCurrency(state.settings.currency);
    persist(false);
    return state;
  }

  function get() { return state || init(); }
  function persist(notify) {
    Adapter.write(state);
    if (notify !== false) listeners.forEach(function (fn) { fn(state); });
  }
  function subscribe(fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; }

  /* ---------- Goals ---------- */
  function goals(includeArchived) {
    return get().goals.filter(function (g) { return includeArchived ? true : !g.archived; });
  }
  function goal(id) { return get().goals.find(function (g) { return g.id === id; }) || null; }

  function addGoal(input) {
    var g = makeGoal(input);
    get().goals.push(g);
    // Uang awal dicatat sebagai transaksi supaya riwayat & statistik konsisten
    if (g.initialAmount > 0) {
      state.transactions.push(makeTx({ goalId: g.id, amount: g.initialAmount, date: Utils.today(), note: 'Tabungan awal' }));
      g.initialAmount = 0;
    }
    persist();
    return g;
  }

  function updateGoal(id, patch) {
    var g = goal(id); if (!g) return null;
    Object.assign(g, patch);
    persist();
    return g;
  }

  function removeGoal(id) {
    var s = get();
    s.goals = s.goals.filter(function (g) { return g.id !== id; });
    s.transactions = s.transactions.filter(function (t) { return t.goalId !== id; });
    persist();
  }

  function archiveGoal(id, flag) { return updateGoal(id, { archived: flag !== false }); }

  /* ---------- Transactions ---------- */
  function transactions(goalId) {
    var list = get().transactions;
    if (goalId) list = list.filter(function (t) { return t.goalId === goalId; });
    return list.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  }
  function addTransaction(input) {
    var t = makeTx(input);
    get().transactions.push(t);
    touchStreak(t.date);
    persist();
    return t;
  }
  function removeTransaction(id) {
    var s = get();
    s.transactions = s.transactions.filter(function (t) { return t.id !== id; });
    persist();
  }

  /* ---------- Streak ---------- */
  /** Streak naik kalau menabung di hari berurutan; reset kalau bolong. */
  function touchStreak(dateISO) {
    var s = get(), st = s.streak, d = dateISO || Utils.today();
    if (st.lastSaveDate === d) return st;                    // sudah dihitung hari ini
    var gap = st.lastSaveDate ? Utils.daysBetween(st.lastSaveDate, d) : null;
    if (gap === null) st.current = 1;
    else if (gap === 1) st.current += 1;
    else if (gap > 1) st.current = 1;
    else if (gap < 0) return st;                              // transaksi backdate: streak tak berubah
    st.lastSaveDate = d;
    st.longest = Math.max(st.longest || 0, st.current);
    return st;
  }
  /** Dipanggil saat app dibuka: kalau bolong >1 hari, streak jadi 0. */
  function refreshStreak() {
    var st = get().streak;
    if (!st.lastSaveDate) { st.current = 0; return st; }
    var gap = Utils.daysBetween(st.lastSaveDate, Utils.today());
    if (gap !== null && gap > 1) st.current = 0;
    return st;
  }

  /* ---------- Settings & achievements ---------- */
  function settings() { return get().settings; }
  function updateSettings(patch) {
    Object.assign(get().settings, patch);
    if (patch.currency) Utils.setCurrency(patch.currency);
    persist();
    return get().settings;
  }
  function unlock(id) {
    var a = get().achievements;
    if (a[id]) return false;
    a[id] = Utils.today();
    persist(false);
    return true;
  }

  /* ---------- Export / import / reset ---------- */
  function exportJSON() { return JSON.stringify(get(), null, 2); }
  function importJSON(text) {
    var parsed = JSON.parse(text);
    state = migrate(parsed);
    Utils.setCurrency(state.settings.currency);
    persist();
  }
  function exportCSV() {
    var rows = [['date', 'goal', 'amount', 'note']];
    transactions().slice().reverse().forEach(function (t) {
      var g = goal(t.goalId);
      rows.push([t.date, (g ? g.name : 'Terhapus'), t.amount, (t.note || '').replace(/"/g, "'")]);
    });
    return rows.map(function (r) {
      return r.map(function (c) { return '"' + String(c) + '"'; }).join(',');
    }).join('\n');
  }
  function reset() { state = defaultState(); persist(); }

  root.Store = {
    init: init, get: get, subscribe: subscribe, persist: persist,
    goals: goals, goal: goal, addGoal: addGoal, updateGoal: updateGoal, removeGoal: removeGoal, archiveGoal: archiveGoal,
    transactions: transactions, addTransaction: addTransaction, removeTransaction: removeTransaction,
    refreshStreak: refreshStreak, settings: settings, updateSettings: updateSettings, unlock: unlock,
    exportJSON: exportJSON, exportCSV: exportCSV, importJSON: importJSON, reset: reset,
    _defaultState: defaultState
  };
})(typeof window !== 'undefined' ? window : globalThis);
