/* ============================================================
   app.js — perekat aplikasi: routing, event delegation, aksi.
   Semua klik ditangani lewat satu listener (event delegation)
   berdasarkan atribut data-action, jadi tidak perlu re-bind
   setiap kali view dirender.
   ============================================================ */
(function (root) {
  'use strict';

  var ROUTES = {
    dashboard:    { title: 'Dashboard',    sub: 'Ringkasan tabungan kamu 👋', render: function () { Views.dashboard(); } },
    goals:        { title: 'Goals',        sub: 'Kelola semua target tabungan', render: function () { Views.goals(); } },
    statistics:   { title: 'Statistics',   sub: 'Lihat pola menabungmu 📊', render: function () { Views.statistics(); } },
    plan:         { title: 'Saving Plan',  sub: 'Hitung rencana menabung 📅', render: function () { Views.plan(); } },
    achievements: { title: 'Achievements', sub: 'Koleksi badge & streak 🏆', render: function () { Views.achievements(); } },
    settings:     { title: 'Settings',     sub: 'Atur tema, mata uang, pengingat', render: function () { Views.settings(); } }
  };
  var current = 'dashboard';

  /* ---------- Router (hash-based, tanpa library) ---------- */
  function routeName() {
    var h = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return ROUTES[h] ? h : 'dashboard';
  }

  function go(name, force) {
    if (!ROUTES[name]) name = 'dashboard';
    if (name === current && !force) { ROUTES[name].render(); return; }
    current = name;

    Object.keys(ROUTES).forEach(function (k) {
      var v = document.getElementById('view-' + k);
      if (v) v.hidden = (k !== name);
    });
    Utils.$$('[data-nav]').forEach(function (a) {
      a.classList.toggle('is-active', a.dataset.nav === name);
    });
    var st = Store.get();
    document.getElementById('pageTitle').textContent = ROUTES[name].title;
    document.getElementById('pageSubtitle').textContent =
      name === 'dashboard' && st.user.name ? 'Hai ' + st.user.name + ', ' + Views.motivation() : ROUTES[name].sub;

    ROUTES[name].render();
    Views.streakMini();
    document.body.classList.remove('sidebar-open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function rerender() { go(current, true); }

  /* ---------- Tema ---------- */
  function applyTheme() {
    var t = Store.settings().theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
    var b = document.getElementById('themeBtn');
    if (b) b.textContent = t === 'dark' ? '☀️' : '🌙';
  }
  function toggleTheme() {
    var next = Store.settings().theme === 'dark' ? 'light' : 'dark';
    Store.updateSettings({ theme: next });
    applyTheme();
    UI.toast(next === 'dark' ? 'Dark mode aktif 🌙' : 'Light mode aktif ☀️');
    if (current === 'statistics' || current === 'dashboard') rerender();
  }

  /* ---------- Aksi: simpan tabungan ---------- */
  function saveMoney(payload) {
    var before = Calc.goalStats(Store.goal(payload.goalId), Store.get().transactions);
    Store.addTransaction(payload);
    var after = Calc.goalStats(Store.goal(payload.goalId), Store.get().transactions);

    Modals.close();
    rerender();
    UI.toast('+' + Utils.money(payload.amount) + ' ditabung! 💰');
    if (Store.settings().confetti) Confetti.burst(window.innerWidth / 2, window.innerHeight * 0.35, 40);

    // tandai tantangan harian selesai kalau nominalnya cukup
    var ch = Store.settings().challenge;
    if (!ch.done && payload.date === Utils.today() && payload.amount >= ch.amount) {
      ch.done = true; Store.persist(false);
    }

    // milestone 25/50/75%
    [25, 50, 75].forEach(function (m) {
      if (before.progressRaw < m && after.progressRaw >= m && !after.isComplete) {
        setTimeout(function () { UI.toast('Milestone ' + m + '%! ' + Utils.escapeHtml(after.goal.name) + ' 🎊', '🎊'); }, 400);
      }
    });

    // goal selesai -> perayaan besar
    if (!before.isComplete && after.isComplete) {
      Store.updateGoal(after.goal.id, { completedAt: new Date().toISOString() });
      setTimeout(function () { Modals.celebrate(Calc.goalStats(Store.goal(after.goal.id), Store.get().transactions)); }, 350);
      setTimeout(checkAchievements, 2400);
    } else {
      setTimeout(checkAchievements, 700);
    }
  }

  /* ---------- Aksi: buat / edit goal ---------- */
  function saveGoal(id, payload) {
    if (id) {
      Store.updateGoal(id, payload);
      UI.toast('Target diperbarui ✏️');
    } else {
      var g = Store.addGoal(payload);
      UI.toast('Target "' + g.name + '" dibuat! 🚀');
      if (Store.settings().confetti) Confetti.fire({ count: 70, duration: 600 });
    }
    Modals.close();
    rerender();
    setTimeout(checkAchievements, 600);
  }

  /* ---------- Achievements ---------- */
  function checkAchievements() {
    var unlocked = Achievements.evaluate(Store.get());
    if (!unlocked.length) return;
    if (current === 'achievements' || current === 'dashboard') rerender();
    Modals.achievementPopup(unlocked.slice());
  }

  /* ---------- Download helper ---------- */
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------- Reminder sederhana ---------- */
  function reminderTick() {
    var s = Store.settings(), r = s.reminder;
    if (!r.enabled) return;
    var now = new Date();
    var hhmm = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
    if (hhmm < (r.time || '20:00')) return;
    if (r.lastShown === Utils.today()) return;
    if (r.frequency === 'weekly' && now.getDay() !== 1) return;   // Senin
    if (r.frequency === 'monthly' && now.getDate() !== 1) return;  // tanggal 1
    r.lastShown = Utils.today();
    Store.persist(false);
    notify('Time to save! 💰', 'Yuk sisihkan sedikit untuk targetmu hari ini.');
  }
  function notify(title, body) {
    UI.toast(title + ' — ' + body, '🔔');
    try {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'granted') new Notification(title, { body: body, icon: undefined });
      else if (Notification.permission === 'default') Notification.requestPermission();
    } catch (e) { /* notifikasi tidak didukung: cukup toast */ }
  }

  /* ---------- Event delegation ---------- */
  var ACTIONS = {
    'toggle-theme': toggleTheme,
    'toggle-sidebar': function () { document.body.classList.toggle('sidebar-open'); },
    'close-sidebar': function () { document.body.classList.remove('sidebar-open'); },
    'close-modal': function () { Modals.close(); },
    'open-saving': function () { Modals.addSaving(); },
    'new-goal': function () { Modals.close(); Modals.goalForm(); },
    'add-money': function (el) { Modals.addSaving(el.dataset.id); },
    'edit-goal': function (el) { Modals.goalForm(el.dataset.id); },
    'delete-goal': function (el) {
      var g = Store.goal(el.dataset.id); if (!g) return;
      Modals.confirm({
        title: '🗑️ Hapus target?', danger: true, ok: 'Hapus',
        message: 'Target <strong>' + Utils.escapeHtml(g.name) + '</strong> dan seluruh riwayat tabungannya akan hilang permanen.',
        onOk: function () { Store.removeGoal(g.id); rerender(); UI.toast('Target dihapus', '🗑️'); }
      });
    },
    'archive-goal': function (el) { Store.archiveGoal(el.dataset.id, true); rerender(); UI.toast('Target diarsipkan 📦'); },
    'unarchive-goal': function (el) { Store.archiveGoal(el.dataset.id, false); rerender(); UI.toast('Target dikembalikan ↩️'); },
    'delete-tx': function (el) {
      Modals.confirm({
        title: 'Hapus transaksi ini?', danger: true, ok: 'Hapus',
        message: 'Jumlah tabungan dan progress akan disesuaikan kembali.',
        onOk: function () { Store.removeTransaction(el.dataset.id); rerender(); UI.toast('Transaksi dihapus', '🗑️'); }
      });
    },
    'filter-mode': function (el) { Views.setFilterMode(el.dataset.value); },
    'export-csv': function () {
      if (!Store.get().transactions.length) return UI.toast('Belum ada transaksi untuk diekspor', 'ℹ️');
      download('saving-history-' + Utils.today() + '.csv', Store.exportCSV(), 'text/csv;charset=utf-8');
      UI.toast('Riwayat diekspor ke CSV ⬇️');
    },
    'export-json': function () {
      download('smart-saving-backup-' + Utils.today() + '.json', Store.exportJSON(), 'application/json');
      UI.toast('Backup JSON diunduh ⬇️');
    },
    'import-json': function () { Modals.importData(); },
    'reset-data': function () {
      Modals.confirm({
        title: '⚠️ Reset semua data?', danger: true, ok: 'Ya, hapus semua',
        message: 'Semua target, transaksi, badge, dan pengaturan akan dihapus. Sebaiknya backup dulu.',
        onOk: function () { Store.reset(); applyTheme(); rerender(); UI.toast('Data direset', '🧹'); }
      });
    },
    'test-reminder': function () { notify('Time to save! 💰', 'Ini contoh pengingatnya.'); },
    'reroll-challenge': function () {
      var c = Store.settings().challenge;
      var amounts = [5000, 10000, 15000, 20000, 25000, 50000, 75000];
      c.amount = amounts[Math.floor(Math.random() * amounts.length)];
      c.done = false; c.date = Utils.today();
      Store.persist(false); rerender();
      UI.toast('Tantangan baru: ' + Utils.money(c.amount), '🎲');
    },
    'accept-challenge': function () {
      var c = Store.settings().challenge;
      var goals = Store.goals();
      if (!goals.length) return Modals.goalForm();
      Modals.addSaving(goals[0].id);
      setTimeout(function () {
        var i = document.getElementById('sAmount');
        if (i) { i.value = c.amount.toLocaleString('id-ID'); i.dispatchEvent(new Event('input')); }
      }, 120);
    },
    'nospend': function () {
      UI.toast('No-spend day diterima! Simpan uangnya ke target 💪', '🚫');
      if (Store.settings().confetti) Confetti.fire({ count: 60, duration: 600 });
    }
  };

  function onClick(e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var fn = ACTIONS[el.dataset.action];
    if (!fn) return;
    e.preventDefault();
    fn(el);
  }

  /* ---------- Settings switch (checkbox) ---------- */
  function onChange(e) {
    var el = e.target.closest('[data-setting]');
    if (!el) return;
    var key = el.dataset.setting;
    if (key === 'theme') { Store.updateSettings({ theme: el.checked ? 'dark' : 'light' }); applyTheme(); }
    else if (key === 'confetti') { Store.updateSettings({ confetti: el.checked }); if (el.checked) Confetti.fire({ count: 50, duration: 500 }); }
    else if (key === 'reminder') {
      Store.settings().reminder.enabled = el.checked;
      Store.persist(false);
      UI.toast(el.checked ? 'Pengingat diaktifkan 🔔' : 'Pengingat dimatikan 🔕');
      if (el.checked) notify('Time to save! 💰', 'Pengingat aktif. Kami ingatkan sesuai jadwalmu.');
    }
  }

  /* ---------- Keyboard shortcut ---------- */
  function onKey(e) {
    if (e.key === 'Escape') { Modals.close(); document.body.classList.remove('sidebar-open'); return; }
    var typing = /input|textarea|select/i.test((e.target.tagName || ''));
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); Modals.goalForm(); }
    if (e.key === 'a' || e.key === 'A') { e.preventDefault(); Modals.addSaving(); }
    if (e.key === 't' || e.key === 'T') { e.preventDefault(); toggleTheme(); }
  }

  /* ---------- Init ---------- */
  function init() {
    Store.init();
    Store.refreshStreak();
    applyTheme();

    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    document.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', function () { go(routeName()); });

    go(routeName(), true);

    // Cek achievement yang mungkin sudah layak dari data lama (tanpa popup bertumpuk)
    var pending = Achievements.evaluate(Store.get());
    if (pending.length) { Views.streakMini(); }

    reminderTick();
    setInterval(reminderTick, 60000);

    // Sapaan pertama kali
    if (!Store.get().goals.length) {
      setTimeout(function () { UI.toast('Selamat datang! Buat target pertamamu 🎯', '👋'); }, 900);
    }
  }

  root.App = {
    init: init, go: go, rerender: rerender, applyTheme: applyTheme, toggleTheme: toggleTheme,
    saveMoney: saveMoney, saveGoal: saveGoal, checkAchievements: checkAchievements,
    download: download, notify: notify, ROUTES: ROUTES
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : globalThis);
