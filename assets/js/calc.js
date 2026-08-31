/* ============================================================
   calc.js — semua perhitungan tabungan (pure functions).
   Rumus inti:
     progress  = (saved / target) * 100
     remaining = max(0, target - saved)
   Progress asli tetap disimpan (bisa >100%), progress bar dibatasi 100%.
   ============================================================ */
(function (root) {
  'use strict';

  var WEEK = 7, MONTH = 30.4375; // rata-rata hari per bulan (365.25/12)

  /** Total tabungan sebuah goal dari daftar transaksi. */
  function savedOf(goalId, txs) {
    return Utils.sum(txs.filter(function (t) { return t.goalId === goalId; }), function (t) { return t.amount; });
  }

  /**
   * Statistik lengkap satu goal.
   * @param {object} goal
   * @param {array} txs seluruh transaksi (akan difilter di dalam)
   */
  function goalStats(goal, txs) {
    txs = txs || [];
    var mine = txs.filter(function (t) { return t.goalId === goal.id; });
    var saved = Utils.sum(mine, function (t) { return t.amount; }) + (Number(goal.initialAmount) || 0);
    var target = Math.max(0, Number(goal.targetAmount) || 0);

    var progressRaw = target > 0 ? (saved / target) * 100 : (saved > 0 ? 100 : 0);
    var progress = Utils.clamp(progressRaw, 0, 100);      // untuk progress bar
    var remaining = Math.max(0, target - saved);
    var overflow = Math.max(0, saved - target);           // kelebihan tabungan
    var isComplete = target > 0 ? saved >= target : false;

    var today = Utils.today();
    var daysLeft = goal.targetDate ? Utils.daysBetween(today, goal.targetDate) : null;
    var isOverdue = daysLeft !== null && daysLeft < 0 && !isComplete;

    // Kebutuhan menabung agar tepat waktu (dibagi sisa hari, minimal 1 hari)
    var d = daysLeft !== null ? Math.max(1, daysLeft) : null;
    var requiredDaily = d ? remaining / d : null;
    var requiredWeekly = d ? remaining / (d / WEEK) : null;
    var requiredMonthly = d ? remaining / (d / MONTH) : null;

    // Laju menabung aktual = total / jumlah hari sejak transaksi pertama
    var dates = mine.map(function (t) { return t.date; }).sort();
    var firstDate = dates[0] || Utils.toISO(goal.createdAt || today);
    var elapsed = Math.max(1, (Utils.daysBetween(firstDate, today) || 0) + 1);
    var ratePerDay = mine.length ? Utils.sum(mine, function (t) { return t.amount; }) / elapsed : 0;

    // Estimasi tanggal selesai berdasarkan laju aktual
    var etaDays = null, etaDate = null;
    if (isComplete) { etaDays = 0; etaDate = goal.completedAt ? Utils.toISO(goal.completedAt) : today; }
    else if (ratePerDay > 0 && remaining > 0) {
      etaDays = Math.ceil(remaining / ratePerDay);
      etaDate = Utils.addDays(today, etaDays);
    }

    return {
      goal: goal, saved: saved, target: target,
      progress: progress, progressRaw: progressRaw, progressLabel: Math.round(progress),
      remaining: remaining, overflow: overflow, isComplete: isComplete,
      daysLeft: daysLeft, isOverdue: isOverdue,
      requiredDaily: requiredDaily, requiredWeekly: requiredWeekly, requiredMonthly: requiredMonthly,
      ratePerDay: ratePerDay, etaDays: etaDays, etaDate: etaDate,
      txCount: mine.length, lastSaveDate: dates.length ? dates[dates.length - 1] : null
    };
  }

  /** Ringkasan seluruh goal (untuk dashboard). */
  function overall(goals, txs) {
    var stats = goals.map(function (g) { return goalStats(g, txs); });
    var totalSaved = Utils.sum(stats, function (s) { return s.saved; });
    var totalTarget = Utils.sum(stats, function (s) { return s.target; });
    var completed = stats.filter(function (s) { return s.isComplete; });
    var active = stats.filter(function (s) { return !s.isComplete; });
    return {
      stats: stats, totalSaved: totalSaved, totalTarget: totalTarget,
      totalRemaining: Math.max(0, totalTarget - totalSaved),
      progress: totalTarget > 0 ? Utils.clamp((totalSaved / totalTarget) * 100, 0, 100) : 0,
      progressRaw: totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0,
      activeCount: active.length, completedCount: completed.length,
      active: active, completed: completed
    };
  }

  /**
   * Saving plan mandiri (kalkulator): butuh nabung berapa per hari/minggu/bulan?
   */
  function plan(target, current, targetDate, fromDate) {
    target = Math.max(0, Number(target) || 0);
    current = Math.max(0, Number(current) || 0);
    var remaining = Math.max(0, target - current);
    var from = fromDate || Utils.today();
    var days = Utils.daysBetween(from, targetDate);
    var valid = days !== null;
    var usableDays = valid ? Math.max(1, days) : null;
    return {
      target: target, current: current, remaining: remaining,
      days: days, valid: valid, isPast: valid && days < 0,
      reached: remaining === 0,
      perDay: usableDays ? remaining / usableDays : null,
      perWeek: usableDays ? remaining / (usableDays / WEEK) : null,
      perMonth: usableDays ? remaining / (usableDays / MONTH) : null,
      weeks: usableDays ? usableDays / WEEK : null,
      months: usableDays ? usableDays / MONTH : null,
      progress: target > 0 ? Utils.clamp((current / target) * 100, 0, 100) : 0
    };
  }

  /** Berapa lama target tercapai kalau nabung `perDay` per hari? */
  function timeToGoal(remaining, perDay) {
    if (!perDay || perDay <= 0) return null;
    var days = Math.ceil(remaining / perDay);
    return { days: days, weeks: Math.ceil(days / WEEK), months: Math.round((days / MONTH) * 10) / 10, date: Utils.addDays(Utils.today(), days) };
  }

  /** Kalimat durasi enak dibaca: "8 bulan", "3 minggu", "12 hari" */
  function humanDuration(days) {
    if (days == null) return '—';
    if (days <= 0) return 'sekarang';
    if (days < 14) return days + ' hari';
    if (days < 60) return Math.round(days / WEEK) + ' minggu';
    if (days < 365) return Math.round(days / MONTH) + ' bulan';
    var y = Math.floor(days / 365), m = Math.round((days % 365) / MONTH);
    return y + ' tahun' + (m ? ' ' + m + ' bulan' : '');
  }

  /** Seri kumulatif tabungan per hari (untuk chart "saving over time"). */
  function cumulativeSeries(txs, maxPoints) {
    if (!txs.length) return [];
    var byDate = Utils.groupSum(txs, function (t) { return t.date; }, function (t) { return t.amount; });
    var dates = Object.keys(byDate).sort();
    var start = dates[0], end = Utils.today();
    if (end < dates[dates.length - 1]) end = dates[dates.length - 1];
    var out = [], acc = 0, cursor = start, guard = 0;
    while (cursor <= end && guard++ < 4000) {
      acc += byDate[cursor] || 0;
      out.push({ x: cursor, y: acc });
      cursor = Utils.addDays(cursor, 1);
    }
    // Kurangi titik kalau terlalu panjang supaya chart tetap ringan
    var limit = maxPoints || 90;
    if (out.length > limit) {
      var step = Math.ceil(out.length / limit), thin = [];
      for (var i = 0; i < out.length; i += step) thin.push(out[i]);
      if (thin[thin.length - 1] !== out[out.length - 1]) thin.push(out[out.length - 1]);
      out = thin;
    }
    return out;
  }

  /** Total per bulan (untuk bar chart). */
  function monthlySeries(txs, months) {
    var byMonth = Utils.groupSum(txs, function (t) { return Utils.monthKey(t.date); }, function (t) { return t.amount; });
    var keys = Object.keys(byMonth).sort();
    if (months && keys.length > months) keys = keys.slice(-months);
    return keys.map(function (k) { return { key: k, label: Utils.monthLabel(k), value: byMonth[k] }; });
  }

  /** Statistik agregat untuk halaman Statistics. */
  function insights(goals, txs) {
    var all = txs.slice();
    var total = Utils.sum(all, function (t) { return t.amount; });
    var thisWeek = Utils.weekKey(Utils.today());
    var thisMonth = Utils.monthKey(Utils.today());
    var weekTotal = Utils.sum(all.filter(function (t) { return Utils.weekKey(t.date) === thisWeek; }), function (t) { return t.amount; });
    var monthTotal = Utils.sum(all.filter(function (t) { return Utils.monthKey(t.date) === thisMonth; }), function (t) { return t.amount; });

    var dates = all.map(function (t) { return t.date; }).sort();
    var spanDays = dates.length ? Math.max(1, (Utils.daysBetween(dates[0], Utils.today()) || 0) + 1) : 0;
    var activeDays = Object.keys(Utils.groupSum(all, function (t) { return t.date; }, function () { return 1; })).length;

    var stats = goals.map(function (g) { return goalStats(g, txs); });
    var pending = stats.filter(function (s) { return !s.isComplete; });

    // Target paling dekat: deadline terdekat, kalau tak ada deadline pakai sisa uang terkecil
    var nearest = pending.filter(function (s) { return s.daysLeft !== null; })
      .sort(function (a, b) { return a.daysLeft - b.daysLeft; })[0]
      || pending.slice().sort(function (a, b) { return a.remaining - b.remaining; })[0] || null;

    // Paling cepat berkembang: laju per hari tertinggi
    var fastest = stats.slice().sort(function (a, b) { return b.ratePerDay - a.ratePerDay; })[0] || null;

    return {
      total: total, weekTotal: weekTotal, monthTotal: monthTotal,
      txCount: all.length,
      avgPerTx: all.length ? total / all.length : 0,
      avgPerDay: spanDays ? total / spanDays : 0,
      avgPerWeek: spanDays ? total / (spanDays / WEEK) : 0,
      avgPerMonth: spanDays ? total / (spanDays / MONTH) : 0,
      avgPerActiveDay: activeDays ? total / activeDays : 0,
      activeDays: activeDays, spanDays: spanDays,
      biggest: all.slice().sort(function (a, b) { return b.amount - a.amount; })[0] || null,
      nearest: nearest, fastest: fastest && fastest.ratePerDay > 0 ? fastest : null,
      stats: stats
    };
  }

  root.Calc = {
    savedOf: savedOf, goalStats: goalStats, overall: overall, plan: plan, timeToGoal: timeToGoal,
    humanDuration: humanDuration, cumulativeSeries: cumulativeSeries, monthlySeries: monthlySeries,
    insights: insights, WEEK: WEEK, MONTH: MONTH
  };
})(typeof window !== 'undefined' ? window : globalThis);
