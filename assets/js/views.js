/* ============================================================
   views.js — semua fungsi render (HTML string -> DOM).
   Tiap view punya fungsi render<Nama>() yang mengisi container-nya.
   Interaksi (klik) ditangani lewat event delegation di app.js.
   ============================================================ */
(function (root) {
  'use strict';

  /* ---------- UI kecil: toast ---------- */
  var UI = {
    toast: function (msg, ico) {
      var host = document.getElementById('toastRoot');
      if (!host) return;
      var t = Utils.el('<div class="toast"><span class="toast__ico">' + (ico || '✅') + '</span><span>' + Utils.escapeHtml(msg) + '</span></div>');
      host.appendChild(t);
      setTimeout(function () {
        t.classList.add('toast--out');
        setTimeout(function () { t.remove(); }, 320);
      }, 2600);
    }
  };

  /* ---------- Pesan motivasi & tips ---------- */
  var MOTIVATION = [
    'Nabung sedikit-sedikit tetap lebih cepat daripada tidak mulai 🌱',
    'Kamu sedang membangun kebiasaan, bukan cuma menabung 💪',
    'Setiap rupiah punya tujuan hari ini 🎯',
    'Konsistensi mengalahkan jumlah besar sesekali ✨',
    'Target itu dekat kalau langkahnya rutin 🚶',
    'Uang kecil hari ini, barang impian bulan depan 🛍️',
    'Progress kecil tetap progress 🚀'
  ];
  function motivation() {
    var i = (Number(Utils.today().replace(/-/g, '')) || 0) % MOTIVATION.length;
    return MOTIVATION[i];
  }

  /** Tips otomatis berdasarkan kondisi data (Smart Suggestions). */
  function smartTips(ctx) {
    var tips = [], o = ctx.overall, ins = ctx.insights;

    if (!ctx.goals.length) {
      tips.push({ i: '🎯', t: 'Buat target pertamamu — mau nabung buat apa? HP, laptop, sepatu, atau liburan?' });
      return tips;
    }
    // Target hampir selesai
    o.active.forEach(function (s) {
      if (s.progressRaw >= 90) tips.push({ i: '🎉', t: 'Target <strong>' + Utils.escapeHtml(s.goal.name) + '</strong> tinggal <strong>' + Utils.money(s.remaining) + '</strong> lagi! Kamu sudah ' + Math.round(s.progressRaw) + '% menuju goal.' });
      else if (s.progressRaw >= 50 && s.progressRaw < 55) tips.push({ i: '🚀', t: 'Setengah jalan di <strong>' + Utils.escapeHtml(s.goal.name) + '</strong>. Sisa ' + Utils.money(s.remaining) + ' lagi!' });
    });
    // Estimasi berdasarkan kebiasaan
    var first = o.active[0];
    if (first && ins.avgPerDay > 0) {
      var t = Calc.timeToGoal(first.remaining, ins.avgPerDay);
      if (t) tips.push({ i: '💡', t: 'Dengan kebiasaanmu sekarang (~' + Utils.money(ins.avgPerDay) + '/hari), <strong>' + Utils.escapeHtml(first.goal.name) + '</strong> tercapai sekitar <strong>' + Calc.humanDuration(t.days) + '</strong> lagi.' });
    }
    // Simulasi nabung 20rb/hari
    if (first) {
      var sim = Calc.timeToGoal(first.remaining, 20000);
      if (sim) tips.push({ i: '🧮', t: 'Kalau kamu menabung <strong>' + Utils.money(20000) + '</strong> setiap hari, <strong>' + Utils.escapeHtml(first.goal.name) + '</strong> tercapai sekitar <strong>' + Calc.humanDuration(sim.days) + '</strong> lagi.' });
    }
    // Deadline mepet
    o.active.forEach(function (s) {
      if (s.daysLeft !== null && s.daysLeft >= 0 && s.daysLeft <= 30 && s.remaining > 0) {
        tips.push({ i: '⏰', t: '<strong>' + Utils.escapeHtml(s.goal.name) + '</strong> jatuh tempo ' + Utils.relDate(s.goal.targetDate) + '. Perlu ~<strong>' + Utils.money(s.requiredDaily) + '/hari</strong> supaya tepat waktu.' });
      } else if (s.isOverdue) {
        tips.push({ i: '🔁', t: 'Deadline <strong>' + Utils.escapeHtml(s.goal.name) + '</strong> sudah lewat. Atur ulang tanggalnya biar rencanamu realistis lagi.' });
      }
    });
    // Streak
    if (ctx.streak.current >= 3) tips.push({ i: '🔥', t: 'Streak ' + ctx.streak.current + ' hari! Nabung hari ini biar rantainya tidak putus.' });
    else if (ctx.streak.current === 0 && ctx.txs.length) tips.push({ i: '💤', t: 'Streak kamu terputus. Nabung Rp5.000 hari ini cukup untuk memulai lagi.' });

    return tips.slice(0, 4);
  }

  /* ---------- Kartu goal ---------- */
  function statusBadge(s) {
    if (s.isComplete) return '<span class="badge-status badge-status--done">✓ Selesai</span>';
    if (s.isOverdue) return '<span class="badge-status badge-status--soon">⚠ Lewat deadline</span>';
    if (s.daysLeft !== null && s.daysLeft <= 14) return '<span class="badge-status badge-status--soon">⏰ ' + Utils.relDate(s.goal.targetDate) + '</span>';
    return '<span class="badge-status">' + Math.round(s.progressRaw) + '%</span>';
  }

  function goalCard(s) {
    var g = s.goal;
    var media = g.image
      ? '<img src="' + Utils.escapeHtml(g.image) + '" alt="' + Utils.escapeHtml(g.name) + '" loading="lazy">'
      : '<span>' + Utils.escapeHtml(g.icon || '🎯') + '</span>';

    var eta = s.isComplete
      ? '🎉 Tercapai'
      : (s.etaDate ? '📈 Estimasi ' + Utils.fmtDate(s.etaDate) : '📈 Estimasi belum ada');
    var deadline = g.targetDate ? '📅 ' + Utils.fmtDate(g.targetDate) : '📅 Tanpa deadline';

    return '' +
    '<article class="card card--hover goal-card" data-goal="' + g.id + '">' +
      '<div class="goal-card__media">' + media + statusBadge(s) + '</div>' +
      '<div class="goal-card__body">' +
        '<div class="goal-card__top">' +
          '<div style="flex:1;min-width:0">' +
            '<div class="goal-card__name">' + (g.image ? Utils.escapeHtml(g.icon || '🎯') + ' ' : '') + Utils.escapeHtml(g.name) + '</div>' +
            '<div class="goal-card__price">Target ' + Utils.money(s.target) + '</div>' +
          '</div>' +
          '<div class="ring-wrap">' + Charts.ring(s.progress, 62, 7, s.isComplete ? 'money' : '') +
            '<span class="ring-wrap__label" style="font-size:13px">' + Math.round(s.progressRaw) + '%</span>' +
          '</div>' +
        '</div>' +
        '<div>' +
          '<div class="goal-card__nums">' +
            '<span class="goal-card__saved">' + Utils.money(s.saved) + '</span>' +
            '<span class="goal-card__of">/ ' + Utils.money(s.target) + '</span>' +
          '</div>' +
          '<div class="bar' + (s.isComplete ? ' bar--money' : '') + '" style="margin-top:8px">' +
            '<div class="bar__fill" data-width="' + s.progress + '"></div>' +
          '</div>' +
          '<div class="goal-card__foot" style="margin-top:9px">' +
            (s.isComplete
              ? '<span class="pill pill--ok">Lengkap' + (s.overflow > 0 ? ' +' + Utils.money(s.overflow) : '') + '</span>'
              : '<span class="pill">Sisa ' + Utils.money(s.remaining) + '</span>') +
            '<span>' + deadline + '</span>' +
          '</div>' +
          '<div class="goal-card__foot tiny">' + eta +
            (!s.isComplete && s.requiredWeekly ? ' · perlu ' + Utils.money(s.requiredWeekly) + '/minggu' : '') +
          '</div>' +
        '</div>' +
        '<div class="goal-card__actions">' +
          '<button class="btn btn--money btn--sm" data-action="add-money" data-id="' + g.id + '">＋ Add Money</button>' +
          '<button class="icon-btn icon-btn--xs" data-action="edit-goal" data-id="' + g.id + '" title="Edit" aria-label="Edit target">✏️</button>' +
          '<button class="icon-btn icon-btn--xs" data-action="delete-goal" data-id="' + g.id + '" title="Hapus" aria-label="Hapus target">🗑️</button>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function emptyGoals(msg) {
    return '<div class="empty glass">' +
      '<div class="empty__art">🚀</div>' +
      '<h3>' + (msg ? Utils.escapeHtml(msg) : 'Belum ada target') + '</h3>' +
      '<p>Kamu sedang menabung untuk apa? Buat target pertamamu dan lihat progresnya bergerak.</p>' +
      '<button class="btn btn--primary" data-action="new-goal">＋ Create Your First Goal</button>' +
    '</div>';
  }

  /** Animasikan semua progress bar & ring setelah render. */
  function animate(scope) {
    Charts.animateRings(scope);
    Utils.$$('.bar__fill', scope || document).forEach(function (b) {
      if (b.dataset.done) return;
      b.dataset.done = '1';
      requestAnimationFrame(function () { b.style.width = Utils.clamp(Number(b.dataset.width) || 0, 0, 100) + '%'; });
    });
  }

  /* ============================================================
     DASHBOARD
     ============================================================ */
  function renderDashboard() {
    var st = Store.get();
    var ctx = Achievements.context(st);
    var o = ctx.overall, ins = ctx.insights;
    var recent = Store.transactions().slice(0, 6);
    var challenge = dailyChallenge(st);

    var html = '';

    /* Hero */
    html += '<div class="hero section">' +
      '<div class="hero__main">' +
        '<p class="hero__eyebrow">Total tabungan kamu</p>' +
        '<div class="hero__amount">' + Utils.money(o.totalSaved) + '</div>' +
        '<p class="hero__msg">' + Utils.escapeHtml(motivation()) + '</p>' +
        '<div class="hero__chips">' +
          '<span class="chip">🔥 Streak ' + (st.streak.current || 0) + ' hari</span>' +
          '<span class="chip">🎯 ' + o.activeCount + ' target aktif</span>' +
          '<span class="chip">🏆 ' + Object.keys(st.achievements).length + '/' + Achievements.LIST.length + ' badge</span>' +
        '</div>' +
      '</div>' +
      '<div class="hero__ring"><div class="ring-wrap">' + Charts.ring(o.progress, 140, 13, 'white') +
        '<span class="ring-wrap__label" style="font-size:26px">' + Math.round(o.progressRaw) + '%<br><span style="font-size:11px;font-weight:600;opacity:.85">overall</span></span>' +
      '</div></div>' +
    '</div>';

    /* Stat tiles */
    html += '<div class="grid grid--stats section">' +
      statTile('Total Saving', Utils.money(o.totalSaved), ins.txCount + ' kali menabung', '💰') +
      statTile('Active Goals', String(o.activeCount), o.completedCount + ' selesai', '🎯') +
      statTile('Overall Progress', Math.round(o.progressRaw) + '%', 'dari ' + Utils.money(o.totalTarget), '📈') +
      statTile('Kekurangan', Utils.money(o.totalRemaining), 'untuk semua target', '🧾') +
    '</div>';

    /* Smart tips + daily challenge */
    var tips = smartTips(ctx);
    html += '<div class="grid grid--2 section">';
    html += '<div class="card"><div class="card__head"><h3>💡 Smart Tips</h3></div>' +
      (tips.length
        ? '<div style="display:grid;gap:10px">' + tips.map(function (t) {
            return '<div class="tip"><span class="tip__ico">' + t.i + '</span><p>' + t.t + '</p></div>';
          }).join('') + '</div>'
        : '<p class="muted tiny">Mulai menabung untuk mendapatkan saran otomatis.</p>') +
    '</div>';

    html += '<div class="card"><div class="card__head"><h3>🎲 Tantangan Hari Ini</h3>' +
        '<button class="btn btn--ghost btn--sm spacer" data-action="reroll-challenge">🔄 Ganti</button></div>' +
      '<div class="callout" style="display:flex;align-items:center;gap:12px;justify-content:space-between;flex-wrap:wrap">' +
        '<span>' + (challenge.done ? '✅ Selesai! ' : 'Nabung ') + Utils.money(challenge.amount) + ' hari ini</span>' +
        (challenge.done ? '<span class="chip">Mantap 🎉</span>' :
          '<button class="btn btn--sm" data-action="accept-challenge">Terima ✓</button>') +
      '</div>' +
      '<div class="switch-row" style="margin-top:6px">' +
        '<div class="switch-row__text"><strong>🚫 No-spend day</strong><span>Hari ini tidak belanja apa pun di luar kebutuhan.</span></div>' +
        '<button class="btn btn--ghost btn--sm" data-action="nospend">Saya bisa!</button>' +
      '</div>' +
      '<div class="switch-row">' +
        '<div class="switch-row__text"><strong>🧮 Quick calculator</strong><span>Hitung kebutuhan nabung per hari/minggu/bulan.</span></div>' +
        '<a class="btn btn--ghost btn--sm" href="#/plan">Buka</a>' +
      '</div>' +
    '</div>';
    html += '</div>';

    /* Goals */
    html += '<div class="section"><div class="section__head"><h2>🎯 Target kamu</h2>' +
      '<a class="btn btn--ghost btn--sm spacer" href="#/goals">Lihat semua</a>' +
      '<button class="btn btn--primary btn--sm" data-action="new-goal">＋ New Goal</button></div>';
    if (!ctx.goals.length) html += emptyGoals('No goals yet 🚀');
    else {
      var top = o.stats.slice().sort(function (a, b) { return b.progressRaw - a.progressRaw; }).slice(0, 4);
      html += '<div class="grid grid--goals">' + top.map(goalCard).join('') + '</div>';
    }
    html += '</div>';

    /* Recent activity */
    html += '<div class="grid grid--2 section">' +
      '<div class="card"><div class="card__head"><h3>🧾 Aktivitas terakhir</h3></div>' +
        (recent.length ? '<ul>' + recent.map(txRow).join('') + '</ul>'
          : '<p class="muted tiny">Belum ada transaksi. Klik “Add Saving” untuk mulai.</p>') +
      '</div>' +
      '<div class="card"><div class="card__head"><h3>📈 Perjalanan tabungan</h3></div>' +
        '<div class="chart-box" id="dashChart"></div>' +
      '</div>' +
    '</div>';

    var host = document.getElementById('view-dashboard');
    host.innerHTML = html;
    animate(host);
    Charts.line(document.getElementById('dashChart'), Calc.cumulativeSeries(ctx.txs, 60), { height: 240 });
  }

  function statTile(label, value, meta, ico) {
    return '<div class="stat card card--hover">' +
      '<div class="stat__ico">' + ico + '</div>' +
      '<div class="stat__label">' + Utils.escapeHtml(label) + '</div>' +
      '<div class="stat__value">' + value + '</div>' +
      '<div class="stat__meta">' + Utils.escapeHtml(meta) + '</div>' +
    '</div>';
  }

  function txRow(t) {
    var g = Store.goal(t.goalId);
    return '<li class="tx">' +
      '<span class="tx__ico">' + Utils.escapeHtml(g ? (g.icon || '🎯') : '❔') + '</span>' +
      '<span class="tx__body"><strong>' + Utils.escapeHtml(g ? g.name : 'Target terhapus') + '</strong>' +
        '<span>' + Utils.fmtDate(t.date) + (t.note ? ' · ' + Utils.escapeHtml(t.note) : '') + '</span></span>' +
      '<span class="tx__amount">+' + Utils.money(t.amount) + '</span>' +
      '<button class="icon-btn icon-btn--xs" data-action="delete-tx" data-id="' + t.id + '" title="Hapus transaksi" aria-label="Hapus transaksi">✕</button>' +
    '</li>';
  }

  /** Tantangan harian acak (deterministik per tanggal, bisa di-reroll). */
  function dailyChallenge(st) {
    var c = st.settings.challenge;
    var amounts = [5000, 10000, 15000, 20000, 25000, 50000];
    if (c.date !== Utils.today()) {
      var seed = Number(Utils.today().replace(/-/g, '')) % amounts.length;
      c.date = Utils.today();
      c.amount = amounts[seed];
      c.done = false;
      Store.persist(false);
    }
    return c;
  }

  /* ============================================================
     GOALS  (search, filter, sort)
     ============================================================ */
  var goalsFilter = { q: '', mode: 'all', sort: 'progress' };

  function renderGoals() {
    var st = Store.get();
    var showArchived = goalsFilter.mode === 'archived';
    var goals = Store.goals(showArchived).filter(function (g) { return showArchived ? g.archived : !g.archived; });
    var stats = goals.map(function (g) { return Calc.goalStats(g, st.transactions); });

    /* filter */
    var q = goalsFilter.q.toLowerCase().trim();
    var list = stats.filter(function (s) {
      if (q && s.goal.name.toLowerCase().indexOf(q) < 0 && (s.goal.note || '').toLowerCase().indexOf(q) < 0) return false;
      if (goalsFilter.mode === 'active') return !s.isComplete;
      if (goalsFilter.mode === 'completed') return s.isComplete;
      return true;
    });

    /* sort */
    var sorters = {
      progress: function (a, b) { return b.progressRaw - a.progressRaw; },
      deadline: function (a, b) {
        var A = a.daysLeft === null ? 99999 : a.daysLeft, B = b.daysLeft === null ? 99999 : b.daysLeft;
        return A - B;
      },
      newest: function (a, b) { return (a.goal.createdAt < b.goal.createdAt) ? 1 : -1; },
      amount: function (a, b) { return b.target - a.target; },
      remaining: function (a, b) { return a.remaining - b.remaining; }
    };
    list.sort(sorters[goalsFilter.sort] || sorters.progress);

    var chips = [['all', 'Semua'], ['active', 'Active'], ['completed', 'Completed'], ['archived', 'Archived']];

    var html = '<div class="toolbar">' +
      '<label class="search"><span class="search__ico">🔍</span>' +
        '<input class="input" id="goalSearch" type="search" placeholder="Cari target…" value="' + Utils.escapeHtml(goalsFilter.q) + '" aria-label="Cari target">' +
      '</label>' +
      '<div class="filters">' + chips.map(function (c) {
        return '<button data-action="filter-mode" data-value="' + c[0] + '" class="' + (goalsFilter.mode === c[0] ? 'is-active' : '') + '">' + c[1] + '</button>';
      }).join('') + '</div>' +
      '<select class="select" id="goalSort" style="width:auto;margin-left:auto" aria-label="Urutkan">' +
        opt('progress', 'Highest Progress', goalsFilter.sort) +
        opt('deadline', 'Nearest Deadline', goalsFilter.sort) +
        opt('remaining', 'Sisa Terkecil', goalsFilter.sort) +
        opt('amount', 'Target Terbesar', goalsFilter.sort) +
        opt('newest', 'Terbaru', goalsFilter.sort) +
      '</select>' +
      '<button class="btn btn--primary" data-action="new-goal">＋ New Goal</button>' +
    '</div>';

    if (!list.length) {
      html += goals.length
        ? '<div class="empty glass"><div class="empty__art">🔍</div><h3>Tidak ada yang cocok</h3><p>Coba ubah kata kunci atau filternya.</p></div>'
        : emptyGoals(showArchived ? 'Belum ada target diarsipkan 📦' : 'No goals yet 🚀');
    } else {
      html += '<div class="grid grid--goals">' + list.map(function (s) {
        var card = goalCard(s);
        if (s.isComplete && !s.goal.archived) {
          card = card.replace('</div></article>',
            '<button class="btn btn--ghost btn--sm btn--block" data-action="archive-goal" data-id="' + s.goal.id + '">📦 Arsipkan target selesai</button></div></article>');
        }
        if (s.goal.archived) {
          card = card.replace('</div></article>',
            '<button class="btn btn--ghost btn--sm btn--block" data-action="unarchive-goal" data-id="' + s.goal.id + '">↩️ Kembalikan</button></div></article>');
        }
        return card;
      }).join('') + '</div>';
    }

    var host = document.getElementById('view-goals');
    host.innerHTML = html;
    animate(host);

    /* search & sort listener (dibuat ulang setiap render, jadi dipasang di sini) */
    var s = document.getElementById('goalSearch');
    if (s) {
      s.addEventListener('input', Utils.debounce(function () {
        goalsFilter.q = s.value;
        renderGoals();
        var again = document.getElementById('goalSearch');
        if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
      }, 220));
    }
    var so = document.getElementById('goalSort');
    if (so) so.addEventListener('change', function () { goalsFilter.sort = so.value; renderGoals(); });
  }

  function opt(v, label, cur) {
    return '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + label + '</option>';
  }
  function setFilterMode(m) { goalsFilter.mode = m; renderGoals(); }

  /* ============================================================
     STATISTICS
     ============================================================ */
  function renderStatistics() {
    var st = Store.get();
    var goals = Store.goals();
    var txs = st.transactions;
    var ins = Calc.insights(goals, txs);
    var o = Calc.overall(goals, txs);

    var html = '<div class="grid grid--stats section">' +
      statTile('Total Ditabung', Utils.money(ins.total), ins.txCount + ' transaksi', '💰') +
      statTile('Minggu Ini', Utils.money(ins.weekTotal), 'rata-rata ' + Utils.money(ins.avgPerWeek) + '/minggu', '📆') +
      statTile('Bulan Ini', Utils.money(ins.monthTotal), 'rata-rata ' + Utils.money(ins.avgPerMonth) + '/bulan', '🗓️') +
      statTile('Rata-rata / Nabung', Utils.money(ins.avgPerTx), Utils.money(ins.avgPerDay) + '/hari', '📊') +
    '</div>';

    html += '<div class="grid grid--2 section">' +
      '<div class="card"><div class="card__head"><h3>🎯 Target paling dekat</h3></div>' +
        (ins.nearest ? highlightGoal(ins.nearest, ins.nearest.daysLeft !== null
            ? 'Deadline ' + Utils.fmtDate(ins.nearest.goal.targetDate) + ' · ' + Utils.relDate(ins.nearest.goal.targetDate)
            : 'Sisa paling kecil')
          : '<p class="muted tiny">Belum ada target aktif.</p>') +
      '</div>' +
      '<div class="card"><div class="card__head"><h3>🚀 Paling cepat berkembang</h3></div>' +
        (ins.fastest ? highlightGoal(ins.fastest, 'Laju ~' + Utils.money(ins.fastest.ratePerDay) + '/hari' +
            (ins.fastest.etaDays !== null ? ' · estimasi ' + Calc.humanDuration(ins.fastest.etaDays) : ''))
          : '<p class="muted tiny">Belum cukup data. Nabung beberapa kali dulu ya.</p>') +
      '</div>' +
    '</div>';

    html += '<div class="card section"><div class="card__head"><h3>📈 Saving over time</h3>' +
        '<span class="spacer tiny muted">Kumulatif seluruh target</span></div>' +
      '<div class="chart-box" id="chartCumulative"></div>' +
      '<div class="legend"><span><i style="background:#6d5efc"></i>Total tabungan</span></div>' +
    '</div>';

    html += '<div class="grid grid--2 section">' +
      '<div class="card"><div class="card__head"><h3>📊 Monthly saving</h3></div>' +
        '<div class="chart-box" id="chartMonthly"></div></div>' +
      '<div class="card"><div class="card__head"><h3>🏁 Goal progress</h3></div>' +
        (o.stats.length ? '<div style="display:grid;gap:14px">' + o.stats
            .slice().sort(function (a, b) { return b.progressRaw - a.progressRaw; })
            .map(function (s) {
              return '<div>' +
                '<div style="display:flex;gap:8px;font-size:13.5px;font-weight:700"><span>' + Utils.escapeHtml(s.goal.icon || '🎯') + ' ' + Utils.escapeHtml(s.goal.name) + '</span>' +
                  '<span class="spacer" style="margin-left:auto;color:var(--text-2)">' + Math.round(s.progressRaw) + '%</span></div>' +
                '<div class="bar bar--slim' + (s.isComplete ? ' bar--money' : '') + '" style="margin-top:6px"><div class="bar__fill" data-width="' + s.progress + '"></div></div>' +
                '<div class="tiny muted" style="margin-top:4px">' + Utils.money(s.saved) + ' / ' + Utils.money(s.target) + '</div>' +
              '</div>';
            }).join('') + '</div>'
          : '<p class="muted tiny">Belum ada target.</p>') +
      '</div>' +
    '</div>';

    html += '<div class="card section"><div class="card__head"><h3>🧾 Riwayat lengkap</h3>' +
        '<button class="btn btn--ghost btn--sm spacer" data-action="export-csv">⬇️ Export CSV</button></div>' +
      (txs.length ? '<div class="table-scroll"><table class="tbl"><thead><tr><th>Tanggal</th><th>Target</th><th>Catatan</th><th style="text-align:right">Jumlah</th><th></th></tr></thead><tbody>' +
        Store.transactions().map(function (t) {
          var g = Store.goal(t.goalId);
          return '<tr><td>' + Utils.fmtDate(t.date) + '</td>' +
            '<td>' + Utils.escapeHtml(g ? (g.icon || '🎯') + ' ' + g.name : '—') + '</td>' +
            '<td class="muted">' + Utils.escapeHtml(t.note || '—') + '</td>' +
            '<td style="text-align:right;font-weight:700;color:var(--ok)">+' + Utils.money(t.amount) + '</td>' +
            '<td style="text-align:right"><button class="icon-btn icon-btn--xs" data-action="delete-tx" data-id="' + t.id + '" aria-label="Hapus">✕</button></td></tr>';
        }).join('') + '</tbody></table></div>'
        : '<p class="muted tiny">Belum ada transaksi.</p>') +
    '</div>';

    var host = document.getElementById('view-statistics');
    host.innerHTML = html;
    animate(host);
    Charts.line(document.getElementById('chartCumulative'), Calc.cumulativeSeries(txs, 90), { height: 280 });
    Charts.bars(document.getElementById('chartMonthly'), Calc.monthlySeries(txs, 8), { height: 250 });
  }

  function highlightGoal(s, sub) {
    return '<div style="display:flex;gap:14px;align-items:center">' +
      '<div class="ring-wrap">' + Charts.ring(s.progress, 76, 8, s.isComplete ? 'money' : '') +
        '<span class="ring-wrap__label" style="font-size:14px">' + Math.round(s.progressRaw) + '%</span></div>' +
      '<div style="min-width:0">' +
        '<strong style="font-size:16px">' + Utils.escapeHtml(s.goal.icon || '🎯') + ' ' + Utils.escapeHtml(s.goal.name) + '</strong>' +
        '<div class="tiny muted">' + Utils.money(s.saved) + ' / ' + Utils.money(s.target) + ' · sisa ' + Utils.money(s.remaining) + '</div>' +
        '<div class="tiny muted">' + Utils.escapeHtml(sub) + '</div>' +
        '<button class="btn btn--money btn--sm" style="margin-top:8px" data-action="add-money" data-id="' + s.goal.id + '">＋ Add Money</button>' +
      '</div></div>';
  }

  /* ============================================================
     SAVING PLAN (kalkulator + rencana per goal)
     ============================================================ */
  var planInput = { target: 10000000, current: 2000000, date: '' };

  function renderPlan() {
    var st = Store.get();
    var goals = Store.goals();
    var stats = goals.map(function (g) { return Calc.goalStats(g, st.transactions); });
    if (!planInput.date) planInput.date = Utils.addDays(Utils.today(), 365);
    var p = Calc.plan(planInput.target, planInput.current, planInput.date);

    var html = '<div class="grid grid--2 section">';

    /* Kalkulator */
    html += '<div class="card">' +
      '<div class="card__head"><h3>🧮 Quick Calculator</h3></div>' +
      '<div class="field"><label for="planTarget">Target uang</label>' +
        '<div class="input-money"><span class="input-money__cur">' + Utils.currencySymbol() + '</span>' +
        '<input class="input" id="planTarget" inputmode="numeric" value="' + planInput.target.toLocaleString('id-ID') + '"></div></div>' +
      '<div class="field"><label for="planCurrent">Tabungan sekarang</label>' +
        '<div class="input-money"><span class="input-money__cur">' + Utils.currencySymbol() + '</span>' +
        '<input class="input" id="planCurrent" inputmode="numeric" value="' + planInput.current.toLocaleString('id-ID') + '"></div></div>' +
      '<div class="field"><label for="planDate">Target tanggal</label>' +
        '<input class="input" id="planDate" type="date" value="' + planInput.date + '" min="' + Utils.today() + '"></div>' +
      '<div class="field"><label>Pakai data target yang ada</label>' +
        '<select class="select" id="planFromGoal">' +
          '<option value="">— pilih target —</option>' +
          stats.map(function (s) { return '<option value="' + s.goal.id + '">' + Utils.escapeHtml(s.goal.name) + '</option>'; }).join('') +
        '</select></div>' +
    '</div>';

    /* Hasil */
    html += '<div class="card"><div class="card__head"><h3>📅 Rencanamu</h3></div>' +
      '<div id="planOut">' + planOutput(p) + '</div></div>';
    html += '</div>';

    /* Rencana tiap goal */
    html += '<div class="section"><div class="section__head"><h2>🎯 Rencana per target</h2></div>';
    if (!stats.length) html += emptyGoals('Belum ada target 🚀');
    else {
      html += '<div class="card"><div class="table-scroll"><table class="tbl"><thead><tr>' +
        '<th>Target</th><th>Progress</th><th>Sisa</th><th>Deadline</th><th>Per hari</th><th>Per minggu</th><th>Per bulan</th><th>Estimasi</th>' +
        '</tr></thead><tbody>' +
        stats.map(function (s) {
          return '<tr>' +
            '<td><strong>' + Utils.escapeHtml(s.goal.icon || '🎯') + ' ' + Utils.escapeHtml(s.goal.name) + '</strong></td>' +
            '<td>' + Math.round(s.progressRaw) + '%</td>' +
            '<td>' + Utils.money(s.remaining) + '</td>' +
            '<td>' + (s.goal.targetDate ? Utils.fmtDate(s.goal.targetDate) : '—') + '</td>' +
            '<td>' + (s.isComplete ? '✅' : s.requiredDaily !== null ? Utils.money(s.requiredDaily) : '—') + '</td>' +
            '<td>' + (s.isComplete ? '✅' : s.requiredWeekly !== null ? Utils.money(s.requiredWeekly) : '—') + '</td>' +
            '<td>' + (s.isComplete ? '✅' : s.requiredMonthly !== null ? Utils.money(s.requiredMonthly) : '—') + '</td>' +
            '<td>' + (s.isComplete ? 'Tercapai 🎉' : s.etaDate ? Utils.fmtDate(s.etaDate) : 'Belum bisa dihitung') + '</td>' +
          '</tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="tiny muted" style="margin-top:10px">“Per hari/minggu/bulan” = sisa uang dibagi waktu tersisa sampai deadline. “Estimasi” dihitung dari laju menabungmu selama ini.</p>' +
      '</div>';
    }
    html += '</div>';

    var host = document.getElementById('view-plan');
    host.innerHTML = html;
    animate(host);
    bindPlanInputs(stats);
  }

  function planOutput(p) {
    if (!p.valid) return '<p class="muted tiny">Pilih target tanggal yang valid dulu.</p>';
    if (p.reached) return '<div class="callout">🎉 Targetmu sudah tercapai! Saatnya buat target baru.</div>';
    if (p.isPast) return '<div class="callout" style="background:var(--warn-grad)">⚠️ Tanggalnya sudah lewat. Pilih tanggal di masa depan ya.</div>';
    return '' +
      '<div class="callout">💡 Save <strong>' + Utils.money(p.perWeek) + '/week</strong> to reach your goal.</div>' +
      '<div class="plan-result" style="margin-top:14px">' +
        planCell('Sisa uang', Utils.money(p.remaining)) +
        planCell('Per hari', Utils.money(p.perDay)) +
        planCell('Per minggu', Utils.money(p.perWeek)) +
        planCell('Per bulan', Utils.money(p.perMonth)) +
      '</div>' +
      '<div class="bar" style="margin-top:14px"><div class="bar__fill" data-width="' + p.progress + '"></div></div>' +
      '<p class="tiny muted" style="margin-top:8px">Progress ' + Math.round(p.progress) + '% · tersisa <strong>' + p.days + ' hari</strong> (' +
        Math.round(p.weeks) + ' minggu / ' + (Math.round(p.months * 10) / 10) + ' bulan).</p>';
  }
  function planCell(label, value) {
    return '<div class="plan-cell"><div class="plan-cell__label">' + label + '</div><div class="plan-cell__value">' + value + '</div></div>';
  }

  function bindPlanInputs(stats) {
    var t = document.getElementById('planTarget'), c = document.getElementById('planCurrent'),
        d = document.getElementById('planDate'), g = document.getElementById('planFromGoal');
    Utils.attachMoneyMask(t); Utils.attachMoneyMask(c);
    function recalc() {
      planInput.target = Utils.readMoneyInput(t);
      planInput.current = Utils.readMoneyInput(c);
      planInput.date = d.value;
      var out = document.getElementById('planOut');
      out.innerHTML = planOutput(Calc.plan(planInput.target, planInput.current, planInput.date));
      animate(out);
    }
    [t, c, d].forEach(function (n) { if (n) n.addEventListener('input', Utils.debounce(recalc, 200)); });
    if (g) g.addEventListener('change', function () {
      var s = stats.filter(function (x) { return x.goal.id === g.value; })[0];
      if (!s) return;
      t.value = s.target.toLocaleString('id-ID');
      c.value = s.saved.toLocaleString('id-ID');
      if (s.goal.targetDate) d.value = s.goal.targetDate;
      recalc();
    });
  }

  /* ============================================================
     ACHIEVEMENTS
     ============================================================ */
  function renderAchievements() {
    var st = Store.get();
    var list = Achievements.overview(st);
    var unlocked = list.filter(function (a) { return a.unlocked; }).length;
    var pct = Math.round((unlocked / list.length) * 100);

    var html = '<div class="grid grid--2 section">' +
      '<div class="card"><div class="card__head"><h3>🏆 Koleksi badge</h3></div>' +
        '<div style="display:flex;gap:16px;align-items:center">' +
          '<div class="ring-wrap">' + Charts.ring(pct, 92, 10) +
            '<span class="ring-wrap__label" style="font-size:17px">' + unlocked + '<span style="font-size:11px;color:var(--text-3)">/' + list.length + '</span></span></div>' +
          '<div><strong style="font-size:17px">' + pct + '% terkumpul</strong>' +
          '<p class="tiny muted">Terus menabung untuk membuka badge berikutnya.</p></div>' +
        '</div></div>' +
      '<div class="card" style="text-align:center">' +
        '<span style="font-size:44px;display:block" class="streak-mini__flame">🔥</span>' +
        '<div style="font-size:28px;font-weight:800">' + (st.streak.current || 0) + ' Days</div>' +
        '<p class="tiny muted">' + (st.streak.current ? 'Keep saving! Rekor terbaikmu ' + (st.streak.longest || 0) + ' hari.' : 'Nabung hari ini untuk memulai streak.') + '</p>' +
        '<button class="btn btn--money btn--sm" style="margin-top:10px" data-action="open-saving">💰 Nabung sekarang</button>' +
      '</div>' +
    '</div>';

    html += '<div class="section"><div class="section__head"><h2>Semua achievement</h2></div>' +
      '<div class="grid grid--badges">' + list.map(function (a) {
        return '<div class="badge' + (a.unlocked ? ' is-unlocked' : '') + '">' +
          '<span class="badge__ico">' + a.def.icon + '</span>' +
          '<strong>' + Utils.escapeHtml(a.def.name) + '</strong>' +
          '<span>' + Utils.escapeHtml(a.def.desc) + '</span>' +
          (a.unlocked
            ? '<span class="badge__date">✓ ' + Utils.fmtDate(a.date) + '</span>'
            : '<div class="bar bar--slim" style="margin-top:10px"><div class="bar__fill" data-width="' + Math.round(a.progress * 100) + '"></div></div>') +
        '</div>';
      }).join('') + '</div></div>';

    var host = document.getElementById('view-achievements');
    host.innerHTML = html;
    animate(host);
  }

  /* ============================================================
     SETTINGS
     ============================================================ */
  function renderSettings() {
    var st = Store.get(), s = st.settings;
    var currencies = Object.keys(Utils.SYMBOLS);

    var html = '<div class="grid grid--2 section">';

    html += '<div class="card"><div class="card__head"><h3>🎨 Tampilan</h3></div>' +
      '<div class="switch-row"><div class="switch-row__text"><strong>Dark mode</strong><span>Tema gelap yang nyaman di mata.</span></div>' +
        '<label class="switch"><input type="checkbox" data-setting="theme" ' + (s.theme === 'dark' ? 'checked' : '') + '><i></i></label></div>' +
      '<div class="switch-row"><div class="switch-row__text"><strong>Animasi confetti</strong><span>Perayaan saat menabung & target tercapai.</span></div>' +
        '<label class="switch"><input type="checkbox" data-setting="confetti" ' + (s.confetti ? 'checked' : '') + '><i></i></label></div>' +
      '<div class="field" style="margin-top:14px"><label for="setName">Nama panggilan</label>' +
        '<input class="input" id="setName" placeholder="mis. Rafandra" value="' + Utils.escapeHtml(st.user.name || '') + '"></div>' +
      '<div class="field"><label for="setCurrency">Mata uang</label>' +
        '<select class="select" id="setCurrency">' + currencies.map(function (c) {
          return '<option value="' + c + '"' + (s.currency === c ? ' selected' : '') + '>' + c + ' (' + Utils.SYMBOLS[c] + ')</option>';
        }).join('') + '</select>' +
        '<span class="field__hint">Hanya mengubah tampilan format, angka tidak dikonversi.</span></div>' +
    '</div>';

    html += '<div class="card"><div class="card__head"><h3>🔔 Reminder</h3></div>' +
      '<div class="switch-row"><div class="switch-row__text"><strong>Aktifkan pengingat</strong><span>Notifikasi “Time to save! 💰”.</span></div>' +
        '<label class="switch"><input type="checkbox" data-setting="reminder" ' + (s.reminder.enabled ? 'checked' : '') + '><i></i></label></div>' +
      '<div class="field" style="margin-top:14px"><label for="setFreq">Frekuensi</label>' +
        '<select class="select" id="setFreq">' +
          opt('daily', 'Setiap hari', s.reminder.frequency) +
          opt('weekly', 'Setiap minggu (Senin)', s.reminder.frequency) +
          opt('monthly', 'Setiap bulan (tanggal 1)', s.reminder.frequency) +
        '</select></div>' +
      '<div class="field"><label for="setTime">Jam pengingat</label>' +
        '<input class="input" id="setTime" type="time" value="' + Utils.escapeHtml(s.reminder.time) + '"></div>' +
      '<button class="btn btn--ghost btn--sm" data-action="test-reminder">🔔 Coba notifikasi</button>' +
      '<p class="tiny muted" style="margin-top:10px">Pengingat muncul selama tab ini terbuka. Izinkan notifikasi browser untuk pengingat di luar tab.</p>' +
    '</div>';

    html += '</div>';

    html += '<div class="grid grid--2 section">' +
      '<div class="card"><div class="card__head"><h3>💾 Data</h3></div>' +
        '<p class="tiny muted" style="margin-bottom:12px">Semua data tersimpan di browser ini (localStorage). Backup rutin kalau datanya penting.</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn btn--ghost btn--sm" data-action="export-json">⬇️ Backup JSON</button>' +
          '<button class="btn btn--ghost btn--sm" data-action="export-csv">⬇️ Export CSV</button>' +
          '<button class="btn btn--ghost btn--sm" data-action="import-json">⬆️ Restore</button>' +
        '</div>' +
        '<div style="margin-top:16px;border-top:1px solid var(--line);padding-top:14px">' +
          '<button class="btn btn--danger btn--sm" data-action="reset-data">🗑️ Reset semua data</button>' +
        '</div>' +
      '</div>' +
      '<div class="card"><div class="card__head"><h3>📦 Arsip & info</h3></div>' +
        '<p class="tiny muted">Target selesai bisa diarsipkan dari halaman Goals supaya dashboard tetap rapi.</p>' +
        '<ul class="tiny muted" style="margin-top:10px;display:grid;gap:6px">' +
          '<li>🎯 Total target: <strong>' + Store.goals(true).length + '</strong></li>' +
          '<li>📦 Diarsipkan: <strong>' + Store.goals(true).filter(function (g) { return g.archived; }).length + '</strong></li>' +
          '<li>🧾 Transaksi: <strong>' + st.transactions.length + '</strong></li>' +
          '<li>🏆 Badge terbuka: <strong>' + Object.keys(st.achievements).length + '</strong></li>' +
        '</ul>' +
        '<a class="btn btn--ghost btn--sm" style="margin-top:14px" href="#/goals">Kelola target</a>' +
      '</div>' +
    '</div>';

    var host = document.getElementById('view-settings');
    host.innerHTML = html;
    bindSettings();
  }

  function bindSettings() {
    var name = document.getElementById('setName');
    if (name) name.addEventListener('change', function () {
      Store.get().user.name = name.value.trim();
      Store.persist();
      UI.toast('Nama disimpan 👋');
    });
    var cur = document.getElementById('setCurrency');
    if (cur) cur.addEventListener('change', function () {
      Store.updateSettings({ currency: cur.value });
      UI.toast('Mata uang: ' + cur.value + ' ' + Utils.currencySymbol());
      App.rerender();
    });
    var freq = document.getElementById('setFreq');
    if (freq) freq.addEventListener('change', function () {
      var r = Store.settings().reminder; r.frequency = freq.value; Store.persist();
      UI.toast('Frekuensi pengingat diubah 🔔');
    });
    var time = document.getElementById('setTime');
    if (time) time.addEventListener('change', function () {
      var r = Store.settings().reminder; r.time = time.value; Store.persist();
    });
  }

  /* ---------- Sidebar streak mini ---------- */
  function renderStreakMini() {
    var st = Store.get(), host = document.getElementById('streakMini');
    if (!host) return;
    host.innerHTML = '<span class="streak-mini__flame">🔥</span>' +
      '<strong>' + (st.streak.current || 0) + ' Days</strong>' +
      '<p class="tiny muted">' + (st.streak.current ? 'Keep saving!' : 'Mulai streak hari ini') + '</p>';
    var badge = document.getElementById('navGoalCount');
    if (badge) badge.textContent = String(Store.goals().length);
  }

  root.UI = UI;
  root.Views = {
    dashboard: renderDashboard, goals: renderGoals, statistics: renderStatistics,
    plan: renderPlan, achievements: renderAchievements, settings: renderSettings,
    streakMini: renderStreakMini, setFilterMode: setFilterMode, animate: animate,
    goalCard: goalCard, txRow: txRow, motivation: motivation
  };
})(typeof window !== 'undefined' ? window : globalThis);
