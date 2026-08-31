/* ============================================================
   modals.js — semua dialog: tambah tabungan, buat/edit target,
   konfirmasi, perayaan goal selesai, dan popup achievement.
   ============================================================ */
(function (root) {
  'use strict';

  var ICONS = ['🎯', '📱', '💻', '👟', '📷', '🎮', '🎧', '⌚', '🚲', '🏍️', '🚗', '✈️', '🏠', '📚', '🎸', '🐱', '💍', '🩺', '🎒', '🛏️'];
  var QUICK = [5000, 10000, 20000, 50000, 100000];

  /* ---------- Shell modal ---------- */
  function open(html, opts) {
    opts = opts || {};
    close();
    var wrap = Utils.el('<div class="modal-backdrop" role="dialog" aria-modal="true"><div class="modal' + (opts.cls ? ' ' + opts.cls : '') + '">' + html + '</div></div>');
    wrap.addEventListener('mousedown', function (e) { if (e.target === wrap && !opts.sticky) close(); });
    document.getElementById('modalRoot').appendChild(wrap);
    document.body.style.overflow = 'hidden';
    var first = wrap.querySelector('input,select,textarea,button');
    if (first && !opts.noFocus) setTimeout(function () { first.focus(); }, 60);
    Views.animate(wrap);
    return wrap;
  }
  function close() {
    var root_ = document.getElementById('modalRoot');
    if (root_) root_.innerHTML = '';
    document.body.style.overflow = '';
  }
  function head(title, sub) {
    return '<div class="modal__head"><div><h2>' + title + '</h2>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' +
      '<button class="icon-btn icon-btn--xs modal__close" data-action="close-modal" aria-label="Tutup">✕</button></div>';
  }

  /* ============================================================
     1. ADD SAVING
     ============================================================ */
  function addSaving(preselectGoalId) {
    var goals = Store.goals().filter(function (g) { return !g.archived; });
    if (!goals.length) {
      UI.toast('Buat target dulu ya 🎯', 'ℹ️');
      return goalForm();
    }
    var st = Store.get();
    var stats = goals.map(function (g) { return Calc.goalStats(g, st.transactions); });

    var html = head('💰 Add Saving', 'Catat uang yang kamu tabung hari ini') +
      '<form id="savingForm" novalidate>' +
        '<div class="field"><label for="sGoal">Pilih target</label>' +
          '<select class="select" id="sGoal">' + stats.map(function (s) {
            return '<option value="' + s.goal.id + '"' + (preselectGoalId === s.goal.id ? ' selected' : '') + '>' +
              Utils.escapeHtml((s.goal.icon || '🎯') + ' ' + s.goal.name) + ' — ' + Math.round(s.progressRaw) + '% (sisa ' + Utils.money(s.remaining) + ')' +
            '</option>';
          }).join('') + '</select></div>' +

        '<div class="field"><label for="sAmount">Jumlah uang</label>' +
          '<div class="input-money"><span class="input-money__cur">' + Utils.currencySymbol() + '</span>' +
          '<input class="input" id="sAmount" inputmode="numeric" placeholder="0" autocomplete="off"></div></div>' +

        '<div class="field"><label>Quick amount</label>' +
          '<div class="quick-amounts">' + QUICK.map(function (q) {
            return '<button type="button" data-quick="' + q + '">+' + Utils.money(q) + '</button>';
          }).join('') + '<button type="button" data-quick="rest" title="Langsung lunasi sisanya">🎯 Lunasi sisa</button></div></div>' +

        '<div class="field__row">' +
          '<div class="field"><label for="sDate">Tanggal</label>' +
            '<input class="input" id="sDate" type="date" value="' + Utils.today() + '" max="' + Utils.today() + '"></div>' +
          '<div class="field"><label for="sNote">Catatan (opsional)</label>' +
            '<input class="input" id="sNote" placeholder="mis. sisa uang jajan" maxlength="60"></div>' +
        '</div>' +

        '<div id="sPreview" class="link-preview" style="display:none"></div>' +

        '<div class="modal__foot">' +
          '<button type="button" class="btn btn--ghost" data-action="close-modal">Batal</button>' +
          '<button type="submit" class="btn btn--money">💰 Simpan tabungan</button>' +
        '</div>' +
      '</form>';

    var wrap = open(html);
    var amount = wrap.querySelector('#sAmount');
    var goalSel = wrap.querySelector('#sGoal');
    Utils.attachMoneyMask(amount);

    function statOf(id) { return stats.filter(function (s) { return s.goal.id === id; })[0]; }

    /* Preview dampak: progress sebelum -> sesudah */
    function preview() {
      var s = statOf(goalSel.value), val = Utils.readMoneyInput(amount);
      var box = wrap.querySelector('#sPreview');
      if (!s || !val) { box.style.display = 'none'; return; }
      var after = s.saved + val;
      var pctAfter = s.target ? Utils.clamp((after / s.target) * 100, 0, 100) : 100;
      box.style.display = 'flex';
      box.innerHTML = '<div class="link-preview__thumb">' + Utils.escapeHtml(s.goal.icon || '🎯') + '</div>' +
        '<div class="link-preview__body" style="flex:1">' +
          '<strong>' + Math.round(s.progressRaw) + '% → ' + Math.round(s.target ? (after / s.target) * 100 : 100) + '%</strong>' +
          '<div class="bar bar--slim" style="margin:6px 0"><div class="bar__fill" data-width="' + pctAfter + '" style="width:' + pctAfter + '%"></div></div>' +
          '<span>' + Utils.money(after) + ' / ' + Utils.money(s.target) +
            (after >= s.target && s.target > 0 ? ' · target tercapai! 🎉' : ' · sisa ' + Utils.money(Math.max(0, s.target - after))) + '</span>' +
        '</div>';
    }

    amount.addEventListener('input', preview);
    goalSel.addEventListener('change', preview);

    wrap.addEventListener('click', function (e) {
      var b = e.target.closest('[data-quick]');
      if (!b) return;
      if (b.dataset.quick === 'rest') {
        var s = statOf(goalSel.value);
        amount.value = (s ? s.remaining : 0).toLocaleString('id-ID');
      } else {
        var cur = Utils.readMoneyInput(amount);
        amount.value = (cur + Number(b.dataset.quick)).toLocaleString('id-ID');
      }
      preview();
      b.style.transform = 'scale(.9)';
      setTimeout(function () { b.style.transform = ''; }, 130);
    });

    wrap.querySelector('#savingForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var val = Utils.readMoneyInput(amount);
      if (val <= 0) { amount.focus(); UI.toast('Masukkan jumlah uangnya dulu 🙂', '⚠️'); return; }
      App.saveMoney({
        goalId: goalSel.value,
        amount: val,
        date: wrap.querySelector('#sDate').value || Utils.today(),
        note: wrap.querySelector('#sNote').value.trim()
      });
    });
  }

  /* ============================================================
     2. GOAL FORM (buat / edit)
     ============================================================ */
  function goalForm(goalId) {
    var g = goalId ? Store.goal(goalId) : null;
    var isEdit = !!g;
    var saved = g ? Calc.goalStats(g, Store.get().transactions).saved : 0;

    var html = head(isEdit ? '✏️ Edit Target' : '🎯 Target Baru',
                    isEdit ? 'Ubah detail targetmu' : 'Kamu sedang menabung untuk apa?') +
      '<form id="goalForm" novalidate>' +
        '<div class="field"><label for="gName">Nama target</label>' +
          '<input class="input" id="gName" placeholder="mis. iPhone 17, Laptop, Sepatu" maxlength="60" value="' + Utils.escapeHtml(g ? g.name : '') + '" required></div>' +

        '<div class="field"><label>Icon target</label>' +
          '<div class="icon-picker" id="gIcons">' + ICONS.map(function (i) {
            return '<button type="button" data-icon="' + i + '" class="' + ((g ? g.icon : '🎯') === i ? 'is-active' : '') + '">' + i + '</button>';
          }).join('') + '</div></div>' +

        '<div class="field"><label for="gTarget">Target harga</label>' +
          '<div class="input-money"><span class="input-money__cur">' + Utils.currencySymbol() + '</span>' +
          '<input class="input" id="gTarget" inputmode="numeric" placeholder="0" value="' + (g && g.targetAmount ? g.targetAmount.toLocaleString('id-ID') : '') + '" required></div>' +
          '<span class="field__hint">Bisa diisi manual, atau tempel link produk di bawah.</span></div>' +

        '<div class="field__row">' +
          (isEdit
            ? '<div class="field"><label>Sudah ditabung</label><input class="input" value="' + Utils.money(saved) + '" disabled></div>'
            : '<div class="field"><label for="gInitial">Uang awal (opsional)</label>' +
              '<div class="input-money"><span class="input-money__cur">' + Utils.currencySymbol() + '</span>' +
              '<input class="input" id="gInitial" inputmode="numeric" placeholder="0"></div></div>') +
          '<div class="field"><label for="gDate">Target tanggal</label>' +
            '<input class="input" id="gDate" type="date" value="' + (g ? g.targetDate : Utils.addDays(Utils.today(), 90)) + '"></div>' +
        '</div>' +

        '<div class="field"><label for="gUrl">🔗 Paste product link (opsional)</label>' +
          '<div style="display:flex;gap:8px">' +
            '<input class="input" id="gUrl" type="url" placeholder="https://…" value="' + Utils.escapeHtml(g ? g.productUrl : '') + '">' +
            '<button type="button" class="btn btn--ghost btn--sm" id="gFetch">Cek</button>' +
          '</div>' +
          '<div id="gLinkBox" style="margin-top:10px"></div></div>' +

        '<div class="field"><label for="gImage">🖼️ Gambar produk (opsional)</label>' +
          '<input class="input" id="gImage" type="file" accept="image/*">' +
          '<div id="gImgPrev" style="margin-top:10px">' + (g && g.image
            ? '<div class="link-preview"><img src="' + Utils.escapeHtml(g.image) + '" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:12px">' +
              '<div class="link-preview__body"><strong>Gambar tersimpan</strong><span>Pilih file baru untuk mengganti</span></div>' +
              '<button type="button" class="icon-btn icon-btn--xs" data-action="clear-image" aria-label="Hapus gambar">✕</button></div>'
            : '') + '</div></div>' +

        '<div class="field"><label for="gNote">Catatan (opsional)</label>' +
          '<textarea class="textarea" id="gNote" placeholder="Kenapa target ini penting buat kamu?" maxlength="240">' + Utils.escapeHtml(g ? g.note : '') + '</textarea></div>' +

        '<div class="modal__foot">' +
          '<button type="button" class="btn btn--ghost" data-action="close-modal">Batal</button>' +
          '<button type="submit" class="btn btn--primary">' + (isEdit ? '💾 Simpan perubahan' : '🚀 Buat target') + '</button>' +
        '</div>' +
      '</form>';

    var wrap = open(html, { cls: 'modal--wide' });
    var pickedIcon = g ? (g.icon || '🎯') : '🎯';
    var imageData = g ? (g.image || '') : '';

    Utils.attachMoneyMask(wrap.querySelector('#gTarget'));
    if (wrap.querySelector('#gInitial')) Utils.attachMoneyMask(wrap.querySelector('#gInitial'));

    /* icon picker */
    wrap.querySelector('#gIcons').addEventListener('click', function (e) {
      var b = e.target.closest('[data-icon]'); if (!b) return;
      pickedIcon = b.dataset.icon;
      Utils.$$('#gIcons button', wrap).forEach(function (x) { x.classList.remove('is-active'); });
      b.classList.add('is-active');
    });

    /* upload gambar -> dataURL (disimpan di localStorage, jadi dikompres dulu) */
    wrap.querySelector('#gImage').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      compressImage(f, function (data) {
        imageData = data;
        wrap.querySelector('#gImgPrev').innerHTML = '<div class="link-preview">' +
          '<img src="' + data + '" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:12px">' +
          '<div class="link-preview__body"><strong>' + Utils.escapeHtml(f.name) + '</strong><span>Siap disimpan</span></div>' +
          '<button type="button" class="icon-btn icon-btn--xs" data-action="clear-image" aria-label="Hapus gambar">✕</button></div>';
      });
    });
    wrap.addEventListener('click', function (e) {
      if (e.target.closest('[data-action="clear-image"]')) {
        imageData = '';
        wrap.querySelector('#gImgPrev').innerHTML = '';
        wrap.querySelector('#gImage').value = '';
      }
    });

    /* product link */
    function checkLink() {
      var url = wrap.querySelector('#gUrl').value.trim();
      var box = wrap.querySelector('#gLinkBox');
      var info = ProductLink.parse(url);
      if (!info.ok) { box.innerHTML = info.message ? '<p class="field__hint">' + info.message + '</p>' : ''; return; }
      box.innerHTML = '<div class="link-preview">' +
          '<div class="link-preview__thumb">' + info.emoji + '</div>' +
          '<div class="link-preview__body"><strong>' + Utils.escapeHtml(info.title) + '</strong>' +
            '<span>' + Utils.escapeHtml(info.host) + '</span></div>' +
        '</div>' +
        '<p class="field__hint" style="margin-top:8px">⚠️ Couldn\'t automatically read product information (harga dilindungi oleh situs & butuh backend). ' +
          'Silakan isi nama dan harga produk secara manual — nama di atas sudah kami tebak dari link-nya.</p>' +
        '<button type="button" class="btn btn--ghost btn--sm" style="margin-top:8px" id="gUseTitle">Pakai nama tebakan</button>';
      var use = wrap.querySelector('#gUseTitle');
      if (use) use.addEventListener('click', function () {
        wrap.querySelector('#gName').value = info.title;
        wrap.querySelector('#gTarget').focus();
        UI.toast('Nama produk diisi, tinggal harga 🙂', '🔗');
      });
    }
    wrap.querySelector('#gFetch').addEventListener('click', checkLink);
    wrap.querySelector('#gUrl').addEventListener('change', checkLink);
    if (g && g.productUrl) checkLink();

    wrap.querySelector('#goalForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = wrap.querySelector('#gName').value.trim();
      var target = Utils.readMoneyInput(wrap.querySelector('#gTarget'));
      if (!name) { UI.toast('Nama target belum diisi 🙂', '⚠️'); return wrap.querySelector('#gName').focus(); }
      if (target <= 0) { UI.toast('Harga target harus lebih dari 0', '⚠️'); return wrap.querySelector('#gTarget').focus(); }
      var payload = {
        name: name, icon: pickedIcon, targetAmount: target,
        targetDate: wrap.querySelector('#gDate').value,
        productUrl: wrap.querySelector('#gUrl').value.trim(),
        image: imageData,
        note: wrap.querySelector('#gNote').value.trim()
      };
      if (!isEdit) payload.initialAmount = Utils.readMoneyInput(wrap.querySelector('#gInitial'));
      App.saveGoal(goalId, payload);
    });
  }

  /** Kompres gambar ke JPEG maks 640px supaya hemat localStorage. */
  function compressImage(file, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 640, scale = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        try { cb(c.toDataURL('image/jpeg', 0.78)); } catch (e) { cb(reader.result); }
      };
      img.onerror = function () { cb(reader.result); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  /* ============================================================
     3. PRODUCT LINK PARSER
     Kita TIDAK melakukan scraping (butuh backend & sering dilarang
     oleh Terms of Service situs). Yang dilakukan hanya membaca URL
     yang diberikan user: domain + slug produk untuk menebak nama.
     Kalau gagal, user tinggal isi manual — tanpa error.
     ============================================================ */
  var ProductLink = {
    parse: function (url) {
      if (!url) return { ok: false, message: '' };
      var u;
      try { u = new URL(url); } catch (e) {
        return { ok: false, message: 'Link belum valid. Contoh: https://tokopedia.com/…' };
      }
      if (!/^https?:$/.test(u.protocol)) return { ok: false, message: 'Gunakan link http/https ya.' };

      var host = u.hostname.replace(/^www\./, '');
      var segs = u.pathname.split('/').filter(Boolean);
      var slug = segs.length ? decodeURIComponent(segs[segs.length - 1]) : '';
      // buang ekstensi / id angka panjang di akhir slug
      slug = slug.replace(/\.(html?|php|aspx)$/i, '').replace(/[-_](i|p|dp|id)?\d{5,}.*$/i, '');
      var title = slug.replace(/[-_+]+/g, ' ').replace(/\s+/g, ' ').trim();
      title = title.split(' ').slice(0, 10).map(function (w) {
        return w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w;
      }).join(' ');
      if (!title || title.length < 3) title = host.split('.')[0].replace(/^./, function (c) { return c.toUpperCase(); }) + ' Product';

      var emoji = '🛍️';
      var t = (title + ' ' + host).toLowerCase();
      if (/iphone|samsung|xiaomi|phone|hp\b|redmi|oppo|vivo/.test(t)) emoji = '📱';
      else if (/laptop|macbook|notebook|thinkpad/.test(t)) emoji = '💻';
      else if (/shoe|sepatu|sneaker|nike|adidas/.test(t)) emoji = '👟';
      else if (/camera|kamera|canon|nikon|sony a\d/.test(t)) emoji = '📷';
      else if (/game|ps5|nintendo|xbox|switch/.test(t)) emoji = '🎮';
      else if (/headphone|earbud|tws|airpods|headset/.test(t)) emoji = '🎧';
      else if (/watch|jam/.test(t)) emoji = '⌚';

      return { ok: true, host: host, url: url, title: title, emoji: emoji, price: null };
    }
  };

  /* ============================================================
     4. CONFIRM
     ============================================================ */
  function confirm(opts) {
    var html = head(opts.title || 'Yakin?', opts.message || '') +
      '<div class="modal__foot">' +
        '<button type="button" class="btn btn--ghost" data-action="close-modal">Batal</button>' +
        '<button type="button" class="btn ' + (opts.danger ? 'btn--danger' : 'btn--primary') + '" id="confirmYes">' + (opts.ok || 'Ya, lanjut') + '</button>' +
      '</div>';
    var wrap = open(html, { noFocus: true });
    wrap.querySelector('#confirmYes').addEventListener('click', function () {
      close();
      if (opts.onOk) opts.onOk();
    });
  }

  /* ============================================================
     5. GOAL COMPLETED CELEBRATION
     ============================================================ */
  function celebrate(stat) {
    var g = stat.goal;
    var html =
      '<div style="font-size:62px;line-height:1;animation:bob 2.4s infinite">' + Utils.escapeHtml(g.icon || '🎉') + '</div>' +
      '<h2 style="font-size:26px;margin-top:10px" class="grad-text">GOAL COMPLETED! 🎉</h2>' +
      '<p class="muted" style="margin-top:6px">Kamu berhasil mencapai target <strong>' + Utils.escapeHtml(g.name) + '</strong></p>' +
      '<div class="plan-result" style="margin-top:18px">' +
        planCellLike('Total terkumpul', Utils.money(stat.saved)) +
        planCellLike('Target', Utils.money(stat.target)) +
        planCellLike('Tanggal tercapai', Utils.fmtDate(Utils.today())) +
        planCellLike('Lama menabung', Calc.humanDuration(stat.txCount ? Math.max(1, Utils.daysBetween(Utils.toISO(g.createdAt), Utils.today())) : 0)) +
      '</div>' +
      '<div class="badge is-unlocked" style="margin-top:18px">' +
        '<span class="badge__ico">👑</span><strong>Goal Complete</strong><span>Badge baru terbuka!</span></div>' +
      '<div class="modal__foot">' +
        '<button type="button" class="btn btn--ghost" data-action="close-modal">Nanti</button>' +
        '<button type="button" class="btn btn--primary" data-action="new-goal">🎯 Target baru</button>' +
      '</div>';
    open(html, { cls: 'modal--celebrate', sticky: true, noFocus: true });
    if (Store.settings().confetti) { Confetti.fire({ count: 180, duration: 1400 }); setTimeout(function () { Confetti.fire({ count: 90 }); }, 700); }
  }
  function planCellLike(label, value) {
    return '<div class="plan-cell"><div class="plan-cell__label">' + label + '</div><div class="plan-cell__value" style="font-size:16px">' + value + '</div></div>';
  }

  /* ============================================================
     6. ACHIEVEMENT UNLOCKED (antrean, tampil satu per satu)
     ============================================================ */
  function achievementPopup(list) {
    if (!list || !list.length) return;
    var a = list.shift();
    var html =
      '<div class="badge is-unlocked" style="border:0;background:transparent">' +
        '<span class="badge__ico" style="font-size:64px">' + a.icon + '</span></div>' +
      '<h2 style="font-size:21px;margin-top:4px">Achievement Unlocked!</h2>' +
      '<p style="font-weight:800;font-size:17px;margin-top:8px">' + Utils.escapeHtml(a.name) + '</p>' +
      '<p class="muted tiny">' + Utils.escapeHtml(a.desc) + '</p>' +
      '<div class="modal__foot"><button type="button" class="btn btn--primary" id="achNext">' + (list.length ? 'Berikutnya →' : 'Keren! 🎉') + '</button></div>';
    var wrap = open(html, { cls: 'modal--celebrate', sticky: true, noFocus: true });
    if (Store.settings().confetti) Confetti.fire({ count: 90, duration: 700 });
    wrap.querySelector('#achNext').addEventListener('click', function () {
      close();
      if (list.length) setTimeout(function () { achievementPopup(list); }, 220);
    });
  }

  /* ============================================================
     7. IMPORT DATA
     ============================================================ */
  function importData() {
    var html = head('⬆️ Restore data', 'Tempel isi file backup JSON kamu di bawah') +
      '<div class="field"><textarea class="textarea" id="impText" style="min-height:150px" placeholder=\'{"version":1,...}\'></textarea></div>' +
      '<div class="field"><label for="impFile">…atau pilih file backup</label><input class="input" id="impFile" type="file" accept="application/json,.json"></div>' +
      '<p class="field__hint">⚠️ Data yang ada sekarang akan ditimpa.</p>' +
      '<div class="modal__foot">' +
        '<button type="button" class="btn btn--ghost" data-action="close-modal">Batal</button>' +
        '<button type="button" class="btn btn--primary" id="impGo">Restore</button>' +
      '</div>';
    var wrap = open(html);
    wrap.querySelector('#impFile').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () { wrap.querySelector('#impText').value = String(r.result || ''); };
      r.readAsText(f);
    });
    wrap.querySelector('#impGo').addEventListener('click', function () {
      try {
        Store.importJSON(wrap.querySelector('#impText').value);
        close();
        App.applyTheme();
        App.rerender();
        UI.toast('Data berhasil dipulihkan 🎉');
      } catch (err) {
        UI.toast('File backup tidak valid 😕', '⚠️');
      }
    });
  }

  root.Modals = {
    open: open, close: close, head: head,
    addSaving: addSaving, goalForm: goalForm, confirm: confirm,
    celebrate: celebrate, achievementPopup: achievementPopup, importData: importData,
    ICONS: ICONS, QUICK: QUICK
  };
  root.ProductLink = ProductLink;
})(typeof window !== 'undefined' ? window : globalThis);
