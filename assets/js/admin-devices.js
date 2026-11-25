/* ==========================================================================
   NÉON MEDIA — الأجهزة المتصلة باللوحة
   مجموعة Firestore مستقلة 'adminSessions': كل جهاز سجّل دخول ينشئ سجلًا
   يحمل بصمته (نظام/متصفح) ووقت التسجيل والآخر، ويمكن فصل أي جهاز من هنا،
   وللجهاز المفصول يُنتظر ≤ 4 دقائق ثم يخرج وحده.
   ========================================================================== */
(function () {
  'use strict';

  var COLLECTION = 'adminSessions';
  var HEARTBEAT_MS = 3 * 60 * 1000;   /* كل 3 دقائق — الجلسة تُعتبر نشطة إن كان آخر heartbeat خلال 6 دقائق */
  var STALE_MS = 6 * 60 * 1000;
  var LS_OWN_ID = 'neonSessionId';
  var LS_OWN_CLOUD = 'neonSessionCloudId';
  var LS_BLOCKED = 'neonSessionBlocked';
  var heartbeatTimer = null;
  var watcher = null;
  var started = false;
  var sawSelf = false;  /* لا نسجل خروج هذا الجهاز إلا بعد أن رأيناه فعلًا في السحابة */

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function qs(sel) { return document.querySelector(sel); }
  function setHidden(el, hidden) {
    if (!el) return;
    if (hidden) el.setAttribute('hidden', '');
    else el.removeAttribute('hidden');
  }
  function create(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  }

  function ownId() {
    var id = localStorage.getItem(LS_OWN_ID);
    if (!id) {
      id = 'sess-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
      try { localStorage.setItem(LS_OWN_ID, id); } catch (e) { /* تجاهل */ }
    }
    return id;
  }

  function deviceLabel() {
    var ua = navigator.userAgent || '';
    var os = /Windows/i.test(ua) ? 'Windows' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iOS/i.test(ua) ? 'iOS' : /Mac OS X|Mac OS/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'جهاز غير معروف';
    var browser = /Edg\//i.test(ua) ? 'Edge' : /OPR\//i.test(ua) ? 'Opera' : /Chrome\//i.test(ua) ? 'Chrome' : /Firefox\//i.test(ua) ? 'Firefox' : /Safari\//i.test(ua) ? 'Safari' : 'متصفح غير معروف';
    return os + ' · ' + browser;
  }

  /* إشعار فوري لصاحب اللوحة عبر ntfy — يُرسل من الجهاز الجديد نفسه */
  function notifyNewDevice(label) {
    try {
      if (window.NeonStore && typeof window.NeonStore.sendPhonePush === 'function') {
        window.NeonStore.sendPhonePush(
          '⚠️ جهاز جديد سجّل الدخول للوحة التحكم',
          (label || 'جهاز غير معروف') + ' — لو ده مش إنت افتح اللوحة ← الأجهزة المتصلة وافصله فورًا.',
          { tags: ['warning'] }
        );
      }
    } catch (e) { /* تجاهل */ }
  }

  function relativeTime(ms) {
    var diff = Date.now() - Number(ms || 0);
    if (diff < 60000) return 'الآن';
    var mins = Math.floor(diff / 60000);
    if (mins < 60) return 'منذ ' + mins + ' دقيقة';
    var hours = Math.floor(mins / 60);
    if (hours < 24) return 'منذ ' + hours + ' ساعة';
    var days = Math.floor(hours / 24);
    return 'منذ ' + days + ' يوم';
  }

  function signedIn() {
    return !!(window.NeonCloud && typeof window.NeonCloud.isSignedIn === 'function' && window.NeonCloud.isSignedIn() && window.NeonCloud.createRecord && window.NeonCloud.fetchRecords);
  }

  /* الجهاز المفصول من جهاز آخر — يبقى محظورًا على نفسه حتى إعادة تفعيل إرادية */
  function isBlocked() {
    try { return localStorage.getItem(LS_BLOCKED) === '1'; } catch (e) { return false; }
  }
  function setBlocked(on) {
    try {
      if (on) localStorage.setItem(LS_BLOCKED, '1');
      else localStorage.removeItem(LS_BLOCKED);
    } catch (e) { /* تجاهل */ }
  }

  /* ----------------------------------------------------------------------
     تسجيل هذا الجهاز (عند كل دخول ناجح)
     ------------------------------------------------------------------- */
  function register() {
    if (!signedIn()) return Promise.resolve(false);
    var id = ownId();
    var cloudId = '';
    try { cloudId = localStorage.getItem(LS_OWN_CLOUD) || ''; } catch (e) { /* تجاهل */ }
    var payload = {
      id: id,
      label: deviceLabel(),
      userAgent: (navigator.userAgent || '').substring(0, 300),
      email: '',
      primary: false,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      createdAt: new Date().toISOString()
    };
    if (window.NeonCloud.getUserEmail) {
      try { payload.email = String(window.NeonCloud.getUserEmail() || ''); } catch (e) { /* تجاهل */ }
    }
    if (cloudId) {
      return window.NeonCloud.updateRecord(COLLECTION, cloudId, { lastSeen: Date.now(), label: payload.label, userAgent: payload.userAgent })
        .then(function () { return true; })
        .catch(function () { return false; });
    }
    return window.NeonCloud.createRecord(COLLECTION, payload).then(function (refId) {
      if (refId) {
        try { localStorage.setItem(LS_OWN_CLOUD, refId); } catch (e) { /* تجاهل */ }
        /* جهاز جديد دخل — إشعار فوري لصاحب اللوحة */
        notifyNewDevice(payload.label);
      }
      return !!refId;
    }).catch(function () { return false; });
  }

  function heartbeat() {
    if (!signedIn()) return Promise.resolve(false);
    var cloudId = '';
    try { cloudId = localStorage.getItem(LS_OWN_CLOUD) || ''; } catch (e) { /* تجاهل */ }
    if (cloudId) {
      return window.NeonCloud.updateRecord(COLLECTION, cloudId, { lastSeen: Date.now() }).then(function () { return true; }).catch(function () { return false; });
    }
    return register();
  }

  /* ----------------------------------------------------------------------
     إيقاف هذا الجهاز (إنهاء جلسته)
     ------------------------------------------------------------------- */
  function disconnectLocal() {
    /* مسح سجل هذا الجهاز من السحابة أيضًا (أفضل جهد — بدون انتظار) */
    try {
      var cloudId = localStorage.getItem(LS_OWN_CLOUD);
      if (cloudId && signedIn()) {
        window.NeonCloud.deleteRecord(COLLECTION, cloudId).catch(function () { /* تجاهل */ });
      }
    } catch (e) { /* تجاهل */ }
    try { localStorage.removeItem(LS_OWN_CLOUD); } catch (e) { /* تجاهل */ }
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    if (watcher) { try { watcher(); } catch (e) { /* تجاهل */ } watcher = null; }
    started = false;
    startAttempts = 0;
    sawSelf = false;
  }

  function revoke(docId, isCurrentDevice, done) {
    if (!signedIn()) return;
    window.NeonCloud.deleteRecord(COLLECTION, docId).then(function () {
      if (isCurrentDevice) disconnectLocal();
      if (typeof done === 'function') done(true);
      refreshList();
    }).catch(function (error) {
      console.warn('[Devices] تعذر الفصل:', error && error.code ? error.code : error);
      if (typeof done === 'function') done(false);
    });
  }

  /* جعل جهاز ما أساسيًا — يُزيل العلامة من أي جهاز آخر */
  function setPrimary(target, done) {
    if (!signedIn()) { if (done) done(false); return; }
    window.NeonCloud.fetchRecords(COLLECTION, 50).then(function (records) {
      var list = Array.isArray(records) ? records : [];
      var tasks = list.map(function (item) {
        var want = item._cloudId === target._cloudId;
        if (Boolean(item.primary) === want) return Promise.resolve(true);
        return window.NeonCloud.updateRecord(COLLECTION, item._cloudId, { primary: want }).catch(function () { return false; });
      });
      return Promise.all(tasks);
    }).then(function () {
      if (done) done(true);
      refreshList();
    }).catch(function (error) {
      console.warn('[Devices] تعذر تعيين الأساسي:', error && error.code ? error.code : error);
      if (done) done(false);
    });
  }

  /* ----------------------------------------------------------------------
     عرض القائمة داخل بطاقة «الأجهزة المتصلة»
     ------------------------------------------------------------------- */
  function render(records) {
    var list = qs('#connectedDevicesList');
    var status = qs('#connectedDevicesStatus');
    var countEl = qs('#connectedDevicesCount');
    if (!list) return;
    list.innerHTML = '';
    var items = Array.isArray(records) ? records.slice() : [];
    items.sort(function (a, b) {
      var ap = a.primary ? 1 : 0, bp = b.primary ? 1 : 0;
      if (ap !== bp) return bp - ap; /* الأساسي أولًا */
      return Number(b.lastSeen || 0) - Number(a.lastSeen || 0);
    });
    var own = ownId();
    if (countEl) countEl.textContent = String(items.length);
    if (status) {
      status.textContent = items.length
        ? 'آخر مزامنة: ' + new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) + ' — تُحدَّث القائمة تلقائيًا.'
        : 'لا توجد أجهزة مسجلة بعد.';
    }
    if (!items.length) {
      var empty = create('div', 'empty-state', 'لا توجد أجهزة متصلة بعد — أي جهاز يسجل دخولًا لللوحة هيظهر هنا تلقائيًا.');
      empty.style.cssText = 'padding:.9rem;font-size:.8rem;text-align:center;opacity:.75';
      list.appendChild(empty);
      return;
    }
    items.forEach(function (item) {
      var isCurrent = item.id === own;
      var stale = Date.now() - Number(item.lastSeen || 0) > STALE_MS;
      var row = create('div', 'device-row' + (isCurrent ? ' device-row--current' : '') + (stale ? ' device-row--stale' : ''));
      row.style.cssText = 'display:flex;align-items:center;gap:.6rem;padding:.55rem .6rem;border:1px solid var(--line);border-radius:12px;margin-bottom:.4rem;background:var(--surface-2, rgba(255,255,255,.03))';

      var badge = create('span', 'device-dot');
      badge.style.cssText = 'width:10px;height:10px;flex:0 0 auto;border-radius:50%;background:' + (stale ? '#ff8b8b' : '#35f5a0') + ';box-shadow:0 0 10px ' + (stale ? 'rgba(255,110,110,.6)' : 'rgba(53,245,160,.6)');
      row.appendChild(badge);

      var meta = create('div');
      meta.style.cssText = 'flex:1;min-width:0';
      var titleRow = create('div');
      titleRow.style.cssText = 'display:flex;align-items:center;gap:.4rem';
      var title = create('strong', null, item.label || 'جهاز غير معروف');
      title.style.cssText = 'display:block;font-size:.8rem';
      titleRow.appendChild(title);
      if (item.primary) {
        var crown = create('span', null, '👑 أساسي');
        crown.style.cssText = 'flex:0 0 auto;font-size:.62rem;font-weight:800;color:#ffd76a;border:1px solid rgba(255,215,106,.45);background:rgba(255,215,106,.12);border-radius:99px;padding:.1rem .45rem;white-space:nowrap';
        titleRow.appendChild(crown);
      }
      var sub = create('span', null, (isCurrent ? 'هذا الجهاز · ' : '') + 'آخر نشاط: ' + relativeTime(item.lastSeen) + ' · أول اتصال: ' + relativeTime(item.firstSeen));
      sub.style.cssText = 'display:block;font-size:.68rem;opacity:.72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      meta.appendChild(titleRow);
      meta.appendChild(sub);
      row.appendChild(meta);

      if (!item.primary) {
        var star = create('button', 'btn-soft btn-sm', 'جعله أساسيًا');
        star.type = 'button';
        star.style.cssText = 'flex:0 0 auto;font-size:.7rem;padding:.4rem .55rem;color:#ffd76a;border-color:rgba(255,215,106,.35)';
        star.addEventListener('click', function () {
          if (!signedIn()) return;
          star.disabled = true;
          setPrimary(item, function (ok) {
            if (!ok) star.disabled = false;
            if (window.NeonUI) window.NeonUI.toast(ok ? 'تم اعتبار هذا الجهاز أساسيًا 👑' : 'تعذر التعيين — تحقق من الصلاحيات.', ok ? 'success' : 'error', 5000);
          });
        });
        row.appendChild(star);
      }

      var btn = create('button', 'btn-ghost btn-sm', isCurrent ? 'فصل هذا الجهاز' : 'فصل');
      btn.type = 'button';
      btn.style.cssText = 'flex:0 0 auto;font-size:.72rem;padding:.4rem .6rem';
      btn.addEventListener('click', function () {
        var msg = isCurrent
          ? 'فصل هذا الجهاز سيُسجل خروجه فورًا — متأكد؟'
          : 'فصل «' + (item.label || 'هذا الجهاز') + '» من اللوحة؟ (يسري خلال دقائق)';
        if (!window.confirm(msg)) return;
        btn.disabled = true;
        revoke(item._cloudId, isCurrent, function (ok) {
          if (!ok) btn.disabled = false;
        });
      });
      row.appendChild(btn);
      list.appendChild(row);
    });
  }

  function refreshList() {
    if (isBlocked()) {
      var blockedStatus = qs('#connectedDevicesStatus');
      if (blockedStatus) blockedStatus.textContent = 'هذا الجهاز فُصل من جهاز آخر — لن يُسجَّل في الأجهزة حتى تضغط «إعادة تفعيل».';
      var blockedList = qs('#connectedDevicesList');
      if (blockedList) blockedList.innerHTML = '';
      var blockedCount = qs('#connectedDevicesCount');
      if (blockedCount) blockedCount.textContent = '0';
      var blockedBox = qs('#connectedDevicesReenableBox');
      if (blockedBox) setHidden(blockedBox, false);
      return Promise.resolve([]);
    }
    var blockedBoxHidden = qs('#connectedDevicesReenableBox');
    if (blockedBoxHidden) setHidden(blockedBoxHidden, true);
    if (!signedIn()) {
      var status = qs('#connectedDevicesStatus');
      if (status) status.textContent = 'سجّل الدخول لحساب Firebase (قسم «النشر السحابي» آخر اللوحة) لتفعيل هذه الميزة — فقط بعدها تظهر الأجهزة.';
      var list = qs('#connectedDevicesList');
      if (list) list.innerHTML = '';
      var countEl = qs('#connectedDevicesCount');
      if (countEl) countEl.textContent = '0';
      return Promise.resolve([]);
    }
    return window.NeonCloud.fetchRecords(COLLECTION, 50).then(function (records) {
      render(records || []);
      return records || [];
    }).catch(function (error) {
      console.warn('[Devices] تعذر جلب الأجهزة:', error && error.code ? error.code : error);
      var status = qs('#connectedDevicesStatus');
      if (status) status.textContent = 'تعذر جلب الأجهزة — تحقق من صلاحيات القراءة لمجموعة adminSessions في Firebase.';
      return [];
    });
  }

  var startAttempts = 0;

  /* ----------------------------------------------------------------------
     التشغيل: تسجيل الدخول → سجل + نبضة قلب كل 3 دقائق + مراقبة الحالة
     لو Firebase لسه مش مسجل — أعِد المحاولة كل 2.5 ثانية بصبر (نفس نمط startCloudWatchers)
     ------------------------------------------------------------------- */
  function start() {
    var wantsFirebase = !!(window.NeonCloud && window.NeonCloud.isSignedIn && window.NeonCloud.isSignedIn());
    var blockedBoxRef = qs('#connectedDevicesReenableBox');
    if (isBlocked()) {
      if (blockedBoxRef) setHidden(blockedBoxRef, false);
      refreshList();
      return;
    }
    if (blockedBoxRef) setHidden(blockedBoxRef, true);
    if (!wantsFirebase) {
      refreshList(); /* تعرض إرشاد تسجيل الدخول في البطاقة */
      startAttempts++;
      if (startAttempts <= 8) setTimeout(start, 2500);
      return;
    }
    if (started) return;
    started = true;
    startAttempts = 0;
    sawSelf = false;
    register().then(function () {
      refreshList();
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(function () {
        heartbeat().then(function (ok) {
          if (!ok) {
            /* السجل غير موجود (sandbox disconnect/Local storage cleared) — حاول التسجيل من جديد */
            register();
          }
        });
      }, HEARTBEAT_MS);
      startWatch();
    });
  }

  function startWatch() {
    if (watcher || !window.NeonCloud.watchRecords) return;
    try {
      var own = ownId();
      Promise.resolve(window.NeonCloud.watchRecords(COLLECTION, function (records) {
        render(records || []);
        /* إن اختفت جلستنا من السحابة بعد أن كانت موجودة → سجل خروج هذا الجهاز */
        var mine = (records || []).find(function (r) { return r.id === own; });
        if (mine) sawSelf = true;
        else if (sawSelf && started) {
          sawSelf = false;
          setBlocked(true); /* أوقف هذا الجهاز عن التسجيل من تلقاء نفسه حتى إعادة التفعيل */
          try {
            window.dispatchEvent(new CustomEvent('neon:force-logout', {
              detail: { message: 'تم فصل هذا الجهاز من جهاز آخر — التسجيل فيه توقف لحين إعادة التفعيل.' }
            }));
          } catch (e) { /* تجاهل */ }
        }
      }, 50)).then(function (un) { watcher = un; }).catch(function () { /* تجاهل */ });
    } catch (e) { /* تجاهل */ }
  }

  function bootCheck() {
    var list = qs('#connectedDevicesList');
    if (!list) return;
    var form = qs('#connectedDevicesRefreshBtn');
    if (form) form.addEventListener('click', function () {
      refreshList().then(function () {
        if (window.NeonUI) window.NeonUI.toast('تم تحديث الأجهزة المتصلة.', 'info', 3500);
      });
    });
    var reenableBtn = qs('#connectedDevicesReenableBtn');
    if (reenableBtn) reenableBtn.addEventListener('click', function () { reenable(); });
    refreshList();
  }

  /* إعادة تفعيل هذا الجهاز — يقوم بتسجيله من جديد في القائمة */
  function reenable() {
    setBlocked(false);
    started = false;
    startAttempts = 0;
    var blockedBox = qs('#connectedDevicesReenableBox');
    if (blockedBox) setHidden(blockedBox, true);
    start();
    if (window.NeonUI) window.NeonUI.toast('تم إعادة التفعيل — ده الجهاز هيظهر في القائمة تاني.', 'success', 6000);
  }

  window.NeonDevices = {
    start: start,
    refresh: refreshList,
    disconnectLocal: disconnectLocal,
    reenable: reenable,
    collection: COLLECTION
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootCheck);
  } else {
    bootCheck();
  }
})();
