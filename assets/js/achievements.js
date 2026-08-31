/* ============================================================
   achievements.js — daftar badge + mesin evaluasinya.
   Tambah achievement baru? Cukup tambahkan objek di array LIST.
   `test(ctx)` -> true berarti badge terbuka.
   ctx = { goals, txs, overall, streak, insights }
   ============================================================ */
(function (root) {
  'use strict';

  var LIST = [
    { id: 'dream-setter', icon: '🎯', name: 'Dream Setter', desc: 'Membuat target pertama',
      test: function (c) { return c.goals.length >= 1; } },
    { id: 'first-save', icon: '🏆', name: 'First Save', desc: 'Menabung pertama kali',
      test: function (c) { return c.txs.length >= 1; } },
    { id: 'club-100k', icon: '💰', name: 'Rp100K Club', desc: 'Total tabungan 100.000',
      test: function (c) { return c.insights.total >= 100000; }, progress: function (c) { return c.insights.total / 100000; } },
    { id: 'club-1m', icon: '💎', name: 'Juta Pertama', desc: 'Total tabungan 1.000.000',
      test: function (c) { return c.insights.total >= 1000000; }, progress: function (c) { return c.insights.total / 1000000; } },
    { id: 'club-10m', icon: '🏦', name: 'Big Saver', desc: 'Total tabungan 10.000.000',
      test: function (c) { return c.insights.total >= 10000000; }, progress: function (c) { return c.insights.total / 10000000; } },
    { id: 'streak-3', icon: '⚡', name: 'Warming Up', desc: 'Nabung 3 hari berturut-turut',
      test: function (c) { return (c.streak.longest || 0) >= 3; }, progress: function (c) { return (c.streak.longest || 0) / 3; } },
    { id: 'streak-7', icon: '🔥', name: 'Saving Streak', desc: 'Nabung 7 hari berturut-turut',
      test: function (c) { return (c.streak.longest || 0) >= 7; }, progress: function (c) { return (c.streak.longest || 0) / 7; } },
    { id: 'streak-30', icon: '📅', name: 'Monthly Master', desc: 'Nabung 30 hari berturut-turut',
      test: function (c) { return (c.streak.longest || 0) >= 30; }, progress: function (c) { return (c.streak.longest || 0) / 30; } },
    { id: 'halfway', icon: '🚀', name: 'Halfway There', desc: 'Salah satu target mencapai 50%',
      test: function (c) { return c.overall.stats.some(function (s) { return s.progressRaw >= 50; }); },
      progress: function (c) { return Math.max.apply(null, [0].concat(c.overall.stats.map(function (s) { return s.progressRaw / 50; }))); } },
    { id: 'goal-complete', icon: '👑', name: 'Goal Complete', desc: 'Berhasil mencapai satu target',
      test: function (c) { return c.overall.completedCount >= 1; } },
    { id: 'goal-complete-3', icon: '🌟', name: 'Triple Crown', desc: 'Menyelesaikan 3 target',
      test: function (c) { return c.overall.completedCount >= 3; }, progress: function (c) { return c.overall.completedCount / 3; } },
    { id: 'multi-goal', icon: '🧩', name: 'Multi Tasker', desc: 'Punya 3 target aktif sekaligus',
      test: function (c) { return c.overall.activeCount >= 3; }, progress: function (c) { return c.overall.activeCount / 3; } },
    { id: 'whale-save', icon: '🐳', name: 'Whale Deposit', desc: 'Sekali nabung 500.000 atau lebih',
      test: function (c) { return !!c.insights.biggest && c.insights.biggest.amount >= 500000; },
      progress: function (c) { return (c.insights.biggest ? c.insights.biggest.amount : 0) / 500000; } },
    { id: 'consistent-20', icon: '🧱', name: 'Brick by Brick', desc: '20 kali menabung',
      test: function (c) { return c.txs.length >= 20; }, progress: function (c) { return c.txs.length / 20; } },
    { id: 'planner', icon: '🗺️', name: 'The Planner', desc: 'Target dengan deadline & catatan',
      test: function (c) { return c.goals.some(function (g) { return g.targetDate && g.note; }); } },
    { id: 'overachiever', icon: '💥', name: 'Overachiever', desc: 'Tabungan melewati target',
      test: function (c) { return c.overall.stats.some(function (s) { return s.overflow > 0; }); } }
  ];

  function byId(id) { return LIST.filter(function (a) { return a.id === id; })[0] || null; }

  /** Bangun konteks evaluasi dari state. */
  function context(state) {
    var goals = state.goals.filter(function (g) { return !g.archived; });
    var txs = state.transactions;
    return {
      goals: goals, txs: txs,
      overall: Calc.overall(goals, txs),
      insights: Calc.insights(goals, txs),
      streak: state.streak
    };
  }

  /**
   * Cek semua achievement; yang baru terbuka dikembalikan (untuk animasi).
   * @returns {array} daftar definisi achievement yang baru terbuka
   */
  function evaluate(state) {
    var ctx = context(state), unlocked = [];
    LIST.forEach(function (a) {
      var already = !!state.achievements[a.id];
      var pass = false;
      try { pass = !!a.test(ctx); } catch (e) { pass = false; }
      if (pass && !already && Store.unlock(a.id)) unlocked.push(a);
    });
    return unlocked;
  }

  /** Untuk halaman Achievements: status + progress tiap badge. */
  function overview(state) {
    var ctx = context(state);
    return LIST.map(function (a) {
      var date = state.achievements[a.id] || null;
      var p = 1;
      if (!date && a.progress) { try { p = Utils.clamp(a.progress(ctx), 0, 1); } catch (e) { p = 0; } }
      else if (!date) p = 0;
      return { def: a, unlocked: !!date, date: date, progress: p };
    });
  }

  root.Achievements = { LIST: LIST, byId: byId, evaluate: evaluate, overview: overview, context: context };
})(typeof window !== 'undefined' ? window : globalThis);
