/* ==========================================================================
   NÉON MEDIA — Admin alert bell
   جرس تنبيهات اللوحة: طلبات/رسائل/حسابات جديدة + تنبيهات النظام،
   مع صوت، إشعارات متصفح،和控制 كامل من داخل اللوحة.
   ========================================================================== */
(function () {
  'use strict';

  var LOG_KEY = 'neonAdminAlertsLog_v1';
  var CFG_KEY = 'neonAdminAlertsCfg_v1';
  var MAX_LOG = 80;

  var DEFAULT_CFG = {
    enabled: true,
    sound: true,
    browser: false,
    toast: true,
    orders: true,
    messages: true,
    clients: true,
    system: true,
    volume: 0.6
  };

  function safeGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function safeSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* تجاهل */ }
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  var cfg = Object.assign({}, DEFAULT_CFG, safeGet(CFG_KEY, {}));
  var log = safeGet(LOG_KEY, []);
  if (!Array.isArray(log)) log = [];

  var wrap = document.getElementById('adminBell');
  var btn = document.getElementById('adminBellBtn');
  var badge = document.getElementById('adminBellBadge');
  if (!wrap || !btn) return;

  var panel = null;
  var settingsOpen = false;
  var audioCtx = null;
  var baseTitle = document.title;
  var clientPrimed = false;
  var clientWatcherStarted = false;
  var lastCloudStatus = 'local';
  var checking = false;
  var lastSystemAlert = {};

  function saveCfg() { safeSet(CFG_KEY, cfg); }
  function saveLog() {
    if (log.length > MAX_LOG) log = log.slice(0, MAX_LOG);
    safeSet(LOG_KEY, log);
  }

  function alertsApi() {
    return window.NeonAdminAlerts || null;
  }

  function lastCheckOf() {
    var api = alertsApi();
    var stamps = api && api.state && api.state.lastCheck;
    if (!stamps || typeof stamps !== 'object') return 0;
    return Math.max(Number(stamps.orders) || 0, Number(stamps.messages) || 0, Number(stamps.clients) || 0);
  }

  function cloudLabel() {
    var labels = {
      local: 'محلي (بدون سحابة)',
      syncing: 'جارٍ المزامنة',
      connected: 'متصل بالسحابة',
      saving: 'جارٍ الحفظ',
      error: 'تعذر الاتصال',
      'auth-required': 'بانتظار تسجيل الدخول',
      forbidden: 'صلاحية مرفوضة',
      'too-large': 'المحتوى كبير'
    };
    return labels[lastCloudStatus] || lastCloudStatus || 'محلي';
  }

  function liveStatus() {
    var last = lastCheckOf();
    return '<div class="bell-status" role="status">' +
      '<span><i class="bell-status__dot' + (lastCloudStatus === 'connected' ? ' is-live' : '') + '"></i>' + esc(cloudLabel()) + '</span>' +
      '<span>آخر فحص: ' + (last ? esc(relTime(last)) : 'لم يتم بعد') + '</span>' +
      '</div>';
  }

  function unread() {
    return log.filter(function (item) { return !item.read; }).length;
  }

  function relTime(ts) {
    var diff = Math.max(0, Date.now() - Number(ts || 0));
    var min = Math.floor(diff / 60000);
    if (min < 1) return 'الآن';
    if (min < 60) return 'منذ ' + min + ' دقيقة';
    var hours = Math.floor(min / 60);
    if (hours < 24) return 'منذ ' + hours + ' ساعة';
    var days = Math.floor(hours / 24);
    if (days < 7) return 'منذ ' + days + ' يوم';
    try {
      return new Date(ts).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
    } catch (error) {
      return '';
    }
  }

  function iconFor(type) {
    return type === 'message' ? '#i-mail'
      : type === 'client' ? '#i-users'
      : type === 'system' ? '#i-warn'
      : '#i-bag';
  }

  var VIEW_FOR_TYPE = { order: 'orders', message: 'messages', client: 'customers' };

  function addAlert(type, title, body, view, dedupe) {
    var categoryOn = type === 'order' ? cfg.orders
      : type === 'message' ? cfg.messages
      : type === 'client' ? cfg.clients
      : cfg.system;
    if (!categoryOn) return;

    if (dedupe && log.some(function (item) { return item.dedupe === dedupe; })) return;

    var alert = {
      id: 'a-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      type: type,
      title: title,
      body: body,
      view: view || VIEW_FOR_TYPE[type] || '',
      ts: Date.now(),
      read: false,
      dedupe: dedupe || ''
    };
    log.unshift(alert);
    saveLog();
    renderChrome();
    if (panel && !panel.hidden) renderPanel();

    if (!cfg.enabled) return;

    btn.classList.remove('is-ringing');
    void btn.offsetWidth;
    btn.classList.add('is-ringing');
    setTimeout(function () { btn.classList.remove('is-ringing'); }, 1000);

    playChime();
    if (cfg.toast && window.NeonUI && window.NeonUI.toast) {
      window.NeonUI.toast(title + ' — ' + body, 'info', 6500);
    }
    showBrowserNotification(title, body, dedupe || alert.id);
  }

  /* ------------------------------- Sound --------------------------------- */
  function getAudio() {
    if (audioCtx) return audioCtx;
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try { audioCtx = new Ctor(); } catch (error) { audioCtx = null; }
    return audioCtx;
  }

  function playChime() {
    if (!cfg.sound) return;
    var ctx = getAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(function () { /* ينتظر تفاعل المستخدم */ });
    }
    var now = ctx.currentTime;
    var volume = Math.max(0, Math.min(1, Number(cfg.volume) || 0.6));
    [880, 1174.66].forEach(function (freq, index) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      var start = now + index * 0.12;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18 * volume, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.6);
    });
  }

  function showBrowserNotification(title, body, tag) {
    if (!cfg.browser || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (!document.hidden) return;
    try {
      new Notification(title, {
        body: body,
        icon: 'assets/img/logo.svg',
        badge: 'assets/img/logo.svg',
        tag: tag,
        dir: 'rtl',
        lang: 'ar'
      });
    } catch (error) { /* تجاهل */ }
  }

  /* ------------------------------ Panel UI -------------------------------- */
  function buildPanel() {
    panel = document.createElement('div');
    panel.className = 'admin-bell__panel';
    panel.id = 'adminBellPanel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'تنبيهات لوحة التحكم');
    wrap.appendChild(panel);
  }

  function renderChrome() {
    var count = unread();
    if (badge) {
      badge.hidden = count === 0;
      badge.textContent = count > 99 ? '99+' : String(count);
    }
    btn.classList.toggle('has-unread', count > 0 && cfg.enabled);
    if (cfg.enabled) {
      document.title = count > 0 ? '(' + count + ') ' + baseTitle : baseTitle;
    } else {
      document.title = baseTitle;
    }
  }

  function alertRow(item) {
    return '<div class="admin-alert admin-alert--' + esc(item.type) + (item.read ? '' : ' is-unread') + '" data-alert-id="' + esc(item.id) + '" role="button" tabindex="0">' +
      '<span class="admin-alert__icon"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="' + iconFor(item.type) + '"/></svg></span>' +
      '<div class="admin-alert__body">' +
        '<strong>' + esc(item.title) + '</strong>' +
        '<p>' + esc(item.body) + '</p>' +
        '<span class="admin-alert__time">' + (item.read ? '' : '<span class="admin-alert__dot"></span>') + esc(relTime(item.ts)) + '</span>' +
      '</div>' +
    '</div>';
  }

  function switchRow(key, label, hint) {
    return '<div class="bell-switch"><span>' + label + (hint ? '<small>' + hint + '</small>' : '') + '</span>' +
      '<button type="button" class="bell-toggle" data-cfg="' + key + '" aria-pressed="' + (cfg[key] ? 'true' : 'false') + '" aria-label="' + esc(label) + '"></button></div>';
  }

  function renderPanel() {
    if (!panel) return;
    var count = unread();
    var listHtml = log.length
      ? log.map(alertRow).join('')
      : '<div class="admin-bell__empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg><br>لا توجد تنبيهات بعد.<br>أول ما يوصل طلب أو رسالة هتلاقيها هنا فورًا.</div>';

    var settingsHtml = '';
    if (settingsOpen) {
      var permission = ('Notification' in window) ? Notification.permission : 'unsupported';
      settingsHtml = '<div class="admin-bell__settings">' +
        '<h4>إعدادات التنبيهات</h4>' +
        switchRow('enabled', 'تشغيل الجرس', 'إيقافه يوقف الصوت والمنبثقات فقط') +
        switchRow('sound', 'صوت التنبيه', 'نغمة قصيرة عند كل حدث') +
        switchRow('toast', 'رسالة منبثقة داخل اللوحة', '') +
        switchRow('browser', 'إشعارات المتصفح', permission === 'granted' ? 'مسموح' : (permission === 'denied' ? 'مرفوض من المتصفح' : 'يحتاج إذن')) +
        '<div class="bell-switch"><span>مستوى الصوت</span></div>' +
        '<input type="range" class="bell-range" id="bellVolume" min="0" max="1" step="0.05" value="' + Number(cfg.volume) + '">' +
        '<h4 style="margin-top:.6rem">أنواع التنبيهات</h4>' +
        switchRow('orders', 'الطلبات الجديدة', '') +
        switchRow('messages', 'الرسائل الجديدة', '') +
        switchRow('clients', 'حسابات العملاء الجديدة', '') +
        switchRow('system', 'تنبيهات الاتصال والنظام', '') +
        '<button type="button" class="btn-mini" data-bell="permission" style="margin-top:.5rem">السماح بإشعارات المتصفح</button> ' +
        '<button type="button" class="btn-mini" data-bell="test">تجربة التنبيه</button>' +
        '<p class="bell-note">الإشعارات تُحفظ في هذا المتصفح فقط. الصوت يعمل بعد أول تفاعل مع الصفحة (سياسة المتصفحات).</p>' +
      '</div>';
    }

    panel.innerHTML =
      '<div class="admin-bell__head">' +
        '<h3>التنبيهات' + (count > 0 ? '<span class="admin-bell__count">' + count + ' جديد</span>' : '') + '</h3>' +
        '<button type="button" class="admin-bell__iconbtn' + (settingsOpen ? ' is-on' : '') + '" data-bell="settings" aria-label="إعدادات التنبيهات" title="إعدادات التنبيهات">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.11a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.11A1.7 1.7 0 0 0 4.67 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6h.01A1.7 1.7 0 0 0 10 3.04V3a2 2 0 1 1 4 0v.11a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.01a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 1 1 0 4h-.11A1.7 1.7 0 0 0 19.4 15Z"/></svg>' +
        '</button>' +
        '<button type="button" class="admin-bell__iconbtn" data-bell="close" aria-label="إغلاق" title="إغلاق">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>' +
        '</button>' +
      '</div>' +
      liveStatus() +
      '<div class="admin-bell__body">' + listHtml + '</div>' +
      settingsHtml +
      '<div class="admin-bell__foot">' +
        '<button type="button" class="btn-mini" data-bell="read"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg> تعليم الكل كمقروء</button>' +
        '<button type="button" class="btn-mini" data-bell="check">' + (checking ? 'جارٍ الفحص…' : 'فحص الآن') + '</button>' +
        '<button type="button" class="btn-mini" data-bell="clear">مسح الكل</button>' +
        '<span class="spacer"></span>' +
        '<button type="button" class="btn-mini" data-bell="settings">الإعدادات</button>' +
      '</div>';
  }

  function openPanel() {
    if (!panel) return;
    placePanel();
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    settingsOpen = false;
    renderPanel();
  }

  /* نقل اللوحة لـ body على الموبايل — لأن backdrop-filter في الهيدر بيخلي
     position: fixed يرسو على الهيدر بدل الشاشة فتطلع البطاقة بره الشاشة */
  function placePanel() {
    if (!panel) return;
    var mobile = window.matchMedia('(max-width: 575.98px)').matches;
    var target = mobile ? document.body : wrap;
    if (panel.parentElement !== target) target.appendChild(panel);
  }
  window.addEventListener('resize', function () { placePanel(); });

  function closePanel() {
    if (!panel) return;
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  }

  function togglePanel() {
    if (!panel) return;
    if (panel.hidden) openPanel();
    else closePanel();
  }

  function markAllRead() {
    log.forEach(function (item) { item.read = true; });
    saveLog();
    renderChrome();
    renderPanel();
  }

  /* ----------------------------- Event wiring ----------------------------- */
  btn.addEventListener('click', function (event) {
    event.stopPropagation();
    // أول تفاعل: نجهّز الصوت
    getAudio();
    togglePanel();
  });

  document.addEventListener('click', function (event) {
    if (!panel || panel.hidden) return;
    if (wrap.contains(event.target) || panel.contains(event.target)) return;
    closePanel();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && panel && !panel.hidden) closePanel();
  });

  document.addEventListener('pointerdown', function () { getAudio(); }, { once: true, passive: true });

  panel = null;
  buildPanel();

  panel.addEventListener('click', function (event) {
    var actionBtn = event.target.closest('[data-bell]');
    if (actionBtn) {
      var action = actionBtn.getAttribute('data-bell');
      if (action === 'close') closePanel();
      else if (action === 'read') markAllRead();
      else if (action === 'clear') {
        log = [];
        saveLog();
        renderChrome();
        renderPanel();
      } else if (action === 'settings') {
        settingsOpen = !settingsOpen;
        renderPanel();
      } else if (action === 'check') {
        manualCheck();
      } else if (action === 'test') {
        addAlert('system', 'تنبيه تجريبي', 'الجرس شغال تمام — كده هيتنبّهك على كل جديد.', '', 'test-' + Date.now());
      } else if (action === 'permission') {
        if (!('Notification' in window)) {
          if (window.NeonUI) window.NeonUI.toast('المتصفح لا يدعم إشعارات النظام.', 'error');
          return;
        }
        Notification.requestPermission().then(function (permission) {
          if (permission === 'granted') {
            cfg.browser = true;
            saveCfg();
            if (window.NeonUI) window.NeonUI.toast('تم السماح بإشعارات المتصفح.', 'success');
            renderPanel();
          } else {
            if (window.NeonUI) window.NeonUI.toast('لم يتم السماح بإشعارات المتصفح.', 'info');
          }
        });
      }
      event.stopPropagation();
      return;
    }

    var toggle = event.target.closest('[data-cfg]');
    if (toggle) {
      var key = toggle.getAttribute('data-cfg');
      cfg[key] = !cfg[key];
      toggle.setAttribute('aria-pressed', cfg[key] ? 'true' : 'false');
      saveCfg();
      renderChrome();
      if (key === 'enabled' && cfg.enabled) playChime();
      if (key === 'clients' && cfg.clients) watchClients();
      if (key === 'browser' && cfg.browser) {
        if (!('Notification' in window)) {
          cfg.browser = false;
          saveCfg();
          if (window.NeonUI) window.NeonUI.toast('المتصفح لا يدعم إشعارات النظام.', 'error');
        } else if (Notification.permission === 'default') {
          Notification.requestPermission().then(function (permission) {
            if (permission !== 'granted') {
              cfg.browser = false;
              saveCfg();
              if (window.NeonUI) window.NeonUI.toast('لم يتم السماح بإشعارات المتصفح.', 'info');
            }
            renderPanel();
          });
        } else if (Notification.permission === 'denied') {
          cfg.browser = false;
          saveCfg();
          if (window.NeonUI) window.NeonUI.toast('الإشعارات مرفوضة من إعدادات المتصفح. فعّلها من أيقونة القفل بجانب العنوان.', 'info', 6000);
        }
      }
      event.stopPropagation();
      return;
    }

    var row = event.target.closest('[data-alert-id]');
    if (row) {
      var id = row.getAttribute('data-alert-id');
      var item = log.filter(function (entry) { return entry.id === id; })[0];
      if (!item) return;
      item.read = true;
      saveLog();
      renderChrome();
      renderPanel();
      if (item.view) {
        var navBtn = document.querySelector('[data-view-btn="' + item.view + '"]');
        if (navBtn) navBtn.click();
      }
      closePanel();
    }
  });

  panel.addEventListener('input', function (event) {
    if (event.target && event.target.id === 'bellVolume') {
      cfg.volume = Math.max(0, Math.min(1, Number(event.target.value) || 0));
      saveCfg();
      playChime();
    }
  });

  /* ------------------------------ Event feed ------------------------------ */
  function orderBody(item) {
    var parts = [];
    if (item.name) parts.push(item.name);
    if (item.serviceTitle) parts.push(item.serviceTitle);
    var amount = Number(item.total);
    if (isFinite(amount) && amount > 0) {
      parts.push(amount.toLocaleString('ar-EG') + ' ' + (item.currency || 'ج.م'));
    }
    return parts.join(' · ') || 'طلب جديد من الموقع';
  }

  window.addEventListener('neon:admin-record', function (event) {
    var detail = event && event.detail;
    if (!detail || !detail.records) return;
    detail.records.forEach(function (item) {
      if (detail.collection === 'orders') {
        addAlert('order', 'طلب جديد ' + (item.orderNo || item.number ? '#' + (item.orderNo || item.number) : ''), orderBody(item), 'orders', 'order:' + (item._cloudId || item.id));
      } else if (detail.collection === 'messages') {
        var excerpt = String(item.message || '').replace(/\s+/g, ' ').slice(0, 110);
        addAlert('message', 'رسالة جديدة' + (item.name ? ' من ' + item.name : ''), excerpt || 'رسالة من صفحة التواصل', 'messages', 'message:' + (item._cloudId || item.id));
      }
    });
  });

  window.addEventListener('neon:cloudstatus', function (event) {
    var status = event && event.detail && event.detail.status;
    if (status !== 'error' && status !== 'forbidden' && status !== 'auth-required') return;
    var now = Date.now();
    if (lastSystemAlert[status] && now - lastSystemAlert[status] < 5 * 60 * 1000) return;
    lastSystemAlert[status] = now;
    var text = status === 'auth-required' ? 'سجّل الدخول لمتابعة استلام الطلبات والرسائل لحظيًا.'
      : status === 'forbidden' ? 'الحساب الحالي لا يملك صلاحية الكتابة في قاعدة البيانات.'
      : 'تعذر الاتصال بالسحابة مؤقتًا — سنعيد المحاولة تلقائيًا.';
    addAlert('system', 'تنبيه اتصال', text, '', 'system:' + status);
  });

  function processClients(records, first) {
    var api = alertsApi();
    if (!api || !api.state) return;
    var state = api.state;
    if (!state.seen.clients) state.seen.clients = {};
    if (!state.lastCheck || typeof state.lastCheck !== 'object') state.lastCheck = { orders: 0, messages: 0, clients: 0 };
    var seen = state.seen.clients;
    var last = Number(state.lastCheck.clients) || 0;
    var now = Date.now();

    (records || []).forEach(function (item) {
      if (!item || !item._cloudId || seen[item._cloudId]) return;
      var created = api.timeOf ? api.timeOf(item) : 0;
      if (first) {
        var recent = last > 0 ? created > last : (created && created >= now - 7 * 24 * 60 * 60 * 1000);
        if (!recent) { api.markSeen('clients', item._cloudId); return; }
      }
      api.markSeen('clients', item._cloudId);
      addAlert('client', 'حساب عميل جديد', (item.name || 'عميل') + (item.email ? ' · ' + item.email : (item.phone ? ' · ' + item.phone : '')), 'customers', 'client:' + item._cloudId);
    });

    state.lastCheck.clients = now;
    api.save();
  }

  function watchClients() {
    var cloud = window.NeonCloud;
    if (clientWatcherStarted || !cloud || !cloud.watchRecords || !cloud.isSignedIn || !cloud.isSignedIn()) return;
    if (!cfg.clients) return;
    clientWatcherStarted = true;
    try {
      Promise.resolve(cloud.watchRecords('clients', function (records) {
        processClients(records, !clientPrimed);
        clientPrimed = true;
      }, 150)).catch(function (error) {
        clientWatcherStarted = false;
        console.warn('[AdminBell] تعذر متابعة العملاء', error && error.code ? error.code : error);
      });
    } catch (error) {
      clientWatcherStarted = false;
    }
  }

  function manualCheck() {
    if (checking) return;
    var cloud = window.NeonCloud;
    if (!cloud || !cloud.fetchRecords) {
      if (window.NeonUI) window.NeonUI.toast('السحابة غير مفعّلة على هذا الجهاز، فلا يوجد ما يُفحص.', 'info');
      return;
    }
    checking = true;
    renderPanel();

    var jobs = [];
    if (cfg.clients && cloud.fetchRecords) {
      jobs.push(cloud.fetchRecords('clients', 120).then(function (records) {
        processClients(records, !clientPrimed);
        clientPrimed = true;
      }).catch(function () { /* تجاهل */ }));
    }
    try { window.dispatchEvent(new CustomEvent('neon:admin-check')); } catch (error) { /* تجاهل */ }

    Promise.all(jobs).then(function () {
      setTimeout(function () {
        checking = false;
        renderPanel();
        if (window.NeonUI) window.NeonUI.toast('تم فحص الطلبات والرسائل والحسابات — أي جديد ظهر في القائمة.', 'success', 4500);
      }, 900);
    });
  }

  window.addEventListener('neon:cloudstatus', function (event) {
    var status = event && event.detail && event.detail.status;
    lastCloudStatus = status || 'local';
    if (status === 'auth-out') clientWatcherStarted = false;
    if (status === 'auth-in' || status === 'connected' || status === 'syncing') {
      watchClients();
      setTimeout(watchClients, 1500);
      setTimeout(watchClients, 5000);
    }
    if (panel && !panel.hidden) renderPanel();
  });

  window.addEventListener('neon:admin-check', function () {
    setTimeout(function () {
      if (panel && !panel.hidden) renderPanel();
    }, 1200);
  });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && cfg.clients) watchClients();
  });

  setTimeout(watchClients, 1500);
  setTimeout(watchClients, 5000);
  setTimeout(watchClients, 12000);
  setInterval(function () {
    if (!document.hidden && cfg.clients) watchClients();
  }, 5 * 60 * 1000);

  renderChrome();
  renderPanel();
})();
