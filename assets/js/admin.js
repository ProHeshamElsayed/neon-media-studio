/* ==========================================================================
   NÉON MEDIA — Admin Panel Runtime
   Login · Dashboard · CRUD · Settings · Security · Backup · Cloud
   يعمل بدون خادم: كل البيانات تُحفظ محليًا (localStorage) مع مزامنة اختيارية.
   ========================================================================== */
(function () {
  'use strict';

  var qs = function (selector, root) { return (root || document).querySelector(selector); };
  var qsa = function (selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); };

  var store = window.NeonStore;
  var UI = window.NeonUI || {
    escapeHTML: function (value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    },
    getPath: function (object, path) {
      return String(path || '').split('.').reduce(function (acc, key) {
        return acc == null ? undefined : acc[key];
      }, object);
    },
    setPath: function (object, path, value) {
      var keys = String(path || '').split('.');
      var last = keys.pop();
      var target = keys.reduce(function (acc, key) {
        if (!acc[key] || typeof acc[key] !== 'object') acc[key] = {};
        return acc[key];
      }, object);
      target[last] = value;
    },
    toast: function (message) { console.log('[Admin]', message); },
    debounce: function (fn, wait) {
      var timer;
      return function () {
        var context = this;
        var args = arguments;
        clearTimeout(timer);
        timer = setTimeout(function () { fn.apply(context, args); }, wait || 140);
      };
    },
    copyText: function () { return Promise.resolve(false); }
  };

  var SESSION_KEY = 'neonAdminSession';
  var SESSION_MODE_KEY = 'neonAdminSessionMode';
  var SESSION_TTL = 30 * 60 * 1000; // 30 دقيقة خمول
  var DATA_LIMIT = 5 * 1024 * 1024;

  var state = {
    view: 'dashboard',
    editing: null,
    confirmAction: null,
    search: {},
    filter: {},
    settingsRendered: false,
    idleStarted: false,
    lastTouch: 0,
    report: { tab: 'orders' },
    pointsCustomer: null,
    campaignFirstLink: ''
  };

  /* ------------------------------------------------------------------------
     Small helpers
     ------------------------------------------------------------------------ */
  function esc(value) { return UI.escapeHTML(value); }
  function escAttr(value) { return UI.escapeHTML(value); }

  function icon(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }

  function settings() {
    return store ? store.get().settings : {};
  }

  function money(value, currency) {
    if (store && store.formatPrice) return store.formatPrice(value, currency || settings().currency);
    return (Number(value) || 0).toLocaleString('en-US') + ' ' + (currency || 'ج.م');
  }

  function fmtDate(value, withTime) {
    if (store && store.formatDate) return store.formatDate(value, withTime);
    return value || '—';
  }

  function splitList(value) {
    return String(value == null ? '' : value)
      .split(/\r?\n/)
      .map(function (part) { return part.trim(); })
      .filter(Boolean);
  }

  function parseStats(text) {
    return String(text == null ? '' : text)
      .split(/\r?\n/)
      .map(function (line) {
        var parts = line.split('|').map(function (part) { return part.trim(); });
        if (!parts[0]) return null;
        if (parts.length >= 3) return { value: Number(parts[0]) || 0, suffix: parts[1] || '', label: parts[2] || '' };
        if (parts.length === 2) return { value: Number(parts[0]) || 0, suffix: '', label: parts[1] };
        return { value: Number(parts[0]) || 0, suffix: '', label: '' };
      })
      .filter(Boolean);
  }

  function statsToText(list) {
    if (!Array.isArray(list)) return '';
    return list.map(function (item) {
      return (item.value == null ? '' : item.value) + '|' + (item.suffix || '') + '|' + (item.label || '');
    }).join('\n');
  }

  function unique(list) {
    var seen = {};
    return (list || []).filter(function (value) {
      if (!value || seen[value]) return false;
      seen[value] = true;
      return true;
    });
  }

  function setText(selector, text) {
    var el = qs(selector);
    if (el) el.textContent = text;
  }

  function setHidden(el, hidden) {
    if (!el) return;
    if (hidden) el.setAttribute('hidden', '');
    else el.removeAttribute('hidden');
  }

  function debounce(fn, wait) { return UI.debounce(fn, wait); }

  /* ------------------------------------------------------------------------
     Modal helpers (Bootstrap + fallback)
     ------------------------------------------------------------------------ */
  function showModal(id) {
    var el = qs('#' + id);
    if (!el) return;
    if (window.bootstrap && window.bootstrap.Modal) {
      window.bootstrap.Modal.getOrCreateInstance(el).show();
      return;
    }
    el.classList.add('show');
    el.style.display = 'block';
    el.removeAttribute('aria-hidden');
    document.body.classList.add('modal-open');
    if (!qs('[data-fallback-backdrop="' + id + '"]')) {
      var backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop fade show';
      backdrop.setAttribute('data-fallback-backdrop', id);
      document.body.appendChild(backdrop);
    }
  }

  function hideModal(id) {
    var el = qs('#' + id);
    if (!el) return;
    if (window.bootstrap && window.bootstrap.Modal) {
      window.bootstrap.Modal.getOrCreateInstance(el).hide();
      return;
    }
    el.classList.remove('show');
    el.style.display = 'none';
    el.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    var backdrop = qs('[data-fallback-backdrop="' + id + '"]');
    if (backdrop) backdrop.remove();
  }

  function askConfirm(title, text, okLabel, action) {
    state.confirmAction = action;
    setText('#confirmTitle', title);
    setText('#confirmText', text);
    setText('#confirmOk', okLabel || 'نعم، متأكد');
    showModal('confirmModal');
  }

  /* ------------------------------------------------------------------------
     WhatsApp
     ------------------------------------------------------------------------ */
  function waLink(phone, text) {
    var digits = String(phone || '').replace(/\D/g, '');
    if (digits.indexOf('00') === 0) digits = digits.slice(2);
    else if (digits.charAt(0) === '0' && digits.length >= 10) digits = '20' + digits.slice(1);
    if (!digits) return '#';
    return 'https://wa.me/' + digits + (text ? '?text=' + encodeURIComponent(text) : '');
  }

  /* ------------------------------------------------------------------------
     Catalog constants
     ------------------------------------------------------------------------ */
  var SERVICE_CATEGORIES = ['تصميم', 'سوشيال ميديا', 'تصوير', 'ويب', 'تسويق', 'مطبوعات', 'أخرى'];

  var SERVICE_ICONS = [
    { value: 'palette', label: 'ألوان / تصميم' },
    { value: 'instagram', label: 'إنستجرام' },
    { value: 'camera', label: 'كاميرا' },
    { value: 'menu', label: 'منيو' },
    { value: 'barcode', label: 'باركود' },
    { value: 'map', label: 'خريطة' },
    { value: 'content', label: 'محتوى' },
    { value: 'social', label: 'سوشيال ميديا' },
    { value: 'ads', label: 'إعلانات' },
    { value: 'building', label: 'عقارات' },
    { value: 'camera-home', label: 'تصوير عقاري' },
    { value: 'food', label: 'طعام ومشروبات' },
    { value: 'invoice', label: 'فاتورة' },
    { value: 'invitation', label: 'دعوة' },
    { value: 'megaphone', label: 'دعاية' },
    { value: 'print', label: 'مطبوعات' }
  ];

  var PAYMENT_TYPES = [
    { value: 'instapay', label: 'إنستاباي' },
    { value: 'wallet', label: 'محفظة إلكترونية' },
    { value: 'bank', label: 'تحويل بنكي' },
    { value: 'paypal', label: 'PayPal' },
    { value: 'card', label: 'بطاقة / رابط دفع' },
    { value: 'cash', label: 'نقدًا' },
    { value: 'other', label: 'أخرى' }
  ];

  var ORDER_STATUSES = ['جديد', 'قيد التنفيذ', 'مكتمل', 'ملغي'];
  var PAYMENT_STATUSES = ['غير مدفوع', 'دفعة مقدمة', 'مدفوع'];
  var MESSAGE_STATUSES = ['جديد', 'مقروء', 'تم الرد'];

  var NOTIFICATION_TYPES = [
    { value: 'info', label: 'تنبيه عام' },
    { value: 'offer', label: 'عرض / خصم' },
    { value: 'alert', label: 'مهم / عاجل' },
    { value: 'success', label: 'خبر سار' }
  ];

  var PAGE_TARGETS = [
    { value: 'all', label: 'كل الصفحات' },
    { value: 'home', label: 'الصفحة الرئيسية فقط' },
    { value: 'contact', label: 'صفحة التواصل فقط' }
  ];

  var DEVICE_TARGETS = [
    { value: 'all', label: 'كل الأجهزة' },
    { value: 'mobile', label: 'الموبايل فقط' },
    { value: 'desktop', label: 'الكمبيوتر فقط' }
  ];

  var POPUP_TRIGGERS = [
    { value: 'delay', label: 'بعد مدة محددة' },
    { value: 'scroll', label: 'عند الوصول لنسبة تمرير' },
    { value: 'exit', label: 'عند محاولة مغادرة الصفحة (Exit Intent)' }
  ];

  var POPUP_FREQUENCIES = [
    { value: 'once', label: 'مرة واحدة لكل زائر' },
    { value: 'session', label: 'مرة في كل جلسة' },
    { value: 'day', label: 'مرة كل يوم' },
    { value: 'always', label: 'في كل زيارة' }
  ];

  var CLOUD_LABELS = {
    local: 'محلي',
    syncing: 'جارٍ المزامنة',
    saving: 'يحفظ',
    connected: 'متصل',
    error: 'خطأ في الاتصال',
    'auth-required': 'سجّل الدخول',
    'too-large': 'المحتوى كبير',
    forbidden: 'صلاحية مرفوضة'
  };

  var cloudWatchers = { orders: false, messages: false };
  var seenCloudRecords = { orders: null, messages: null };

  /* ------------------------------------------------------------------------
     حالة تنبيهات محفوظة — تسمح بمعرفة الجديد حتى لو كانت اللوحة مغلقة.
     لكل مجموعة علامة زمنية مستقلة حتى لا يبتلع فحصٌ فحصًا آخر.
     ------------------------------------------------------------------------ */
  var ALERT_STATE_KEY = 'neonAdminAlertsState_v1';
  var ALERT_SEEN_LIMIT = 600;

  function emptyAlertState() {
    return {
      seen: { orders: {}, messages: {}, clients: {} },
      lastCheck: { orders: 0, messages: 0, clients: 0 }
    };
  }

  function loadAlertState() {
    var base = emptyAlertState();
    try {
      var raw = localStorage.getItem(ALERT_STATE_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== 'object') return base;
      if (parsed.seen && typeof parsed.seen === 'object') {
        ['orders', 'messages', 'clients'].forEach(function (key) {
          if (parsed.seen[key] && typeof parsed.seen[key] === 'object') base.seen[key] = parsed.seen[key];
        });
      }
      if (parsed.lastCheck && typeof parsed.lastCheck === 'object') {
        ['orders', 'messages', 'clients'].forEach(function (key) {
          base.lastCheck[key] = Number(parsed.lastCheck[key]) || 0;
        });
      } else if (typeof parsed.lastCheck === 'number') {
        base.lastCheck.orders = base.lastCheck.messages = base.lastCheck.clients = parsed.lastCheck;
      }
      return base;
    } catch (error) {
      return base;
    }
  }

  var alertState = loadAlertState();

  function saveAlertState() {
    try { localStorage.setItem(ALERT_STATE_KEY, JSON.stringify(alertState)); } catch (error) { /* تجاهل */ }
  }

  function recordTimeOf(item) {
    if (!item || typeof item !== 'object') return 0;
    var raw = item.createdAt || item._cloudCreatedAt || item.ts || item.date || item.updatedAt;
    if (typeof raw === 'number') return raw > 0 && raw < 1e12 ? raw * 1000 : raw;
    var parsed = Date.parse(raw);
    return isFinite(parsed) ? parsed : 0;
  }

  function markAlertSeen(collection, cloudId) {
    if (!alertState.seen[collection]) alertState.seen[collection] = {};
    var seen = alertState.seen[collection];
    seen[cloudId] = Date.now();
    var keys = Object.keys(seen);
    if (keys.length > ALERT_SEEN_LIMIT) {
      keys.slice(0, keys.length - ALERT_SEEN_LIMIT).forEach(function (key) { delete seen[key]; });
    }
  }

  function isRecentEnough(collection, item) {
    var created = recordTimeOf(item);
    var last = Number(alertState.lastCheck[collection]) || 0;
    if (last > 0) return created > last;
    // أول تشغيل على الإطلاق: لا نغرق اللوحة بكل السجل القديم.
    return created >= Date.now() - 7 * 24 * 60 * 60 * 1000;
  }

  // إشعار جرس اللوحة عند وصول سجلات جديدة (مع التقاط ما وصل أثناء الإغلاق).
  function notifyNewCloudRecords(collection, records) {
    if (!alertState.seen[collection]) alertState.seen[collection] = {};
    if (!alertState.lastCheck[collection]) alertState.lastCheck[collection] = 0;
    var firstLoad = seenCloudRecords[collection] == null;
    var seen = alertState.seen[collection];
    var fresh = [];

    (records || []).forEach(function (item) {
      if (!item || !item._cloudId || seen[item._cloudId]) return;
      var created = recordTimeOf(item);
      if (firstLoad && !isRecentEnough(collection, item)) {
        markAlertSeen(collection, item._cloudId);
        return;
      }
      // في التحميل الأول نتجاهل السجلات التي لا تحمل وقتًا (غالبًا قديمة).
      if (firstLoad && !created) {
        markAlertSeen(collection, item._cloudId);
        return;
      }
      markAlertSeen(collection, item._cloudId);
      fresh.push(item);
    });

    seenCloudRecords[collection] = {};
    alertState.lastCheck[collection] = Date.now();
    saveAlertState();

    if (!fresh.length) return;
    try {
      window.dispatchEvent(new CustomEvent('neon:admin-record', {
        detail: { collection: collection, records: fresh }
      }));
    } catch (eventError) { /* تجاهل */ }
  }

  // واجهة مشتركة مع جرس التنبيهات (حالة واحدة تحفظ العملاء أيضًا).
  window.NeonAdminAlerts = {
    state: alertState,
    save: saveAlertState,
    timeOf: recordTimeOf,
    markSeen: markAlertSeen
  };

  // تحديث محلي فوري + رفع التغيير إلى مجموعة Firestore الخاصة.
  function pushRecordUpdate(collection, item, patch) {
    if (!item) return false;
    var changed = store.updateItem(collection, item.id, patch);
    if (changed && item._cloudId && window.NeonCloud && window.NeonCloud.updateRecord) {
      window.NeonCloud.updateRecord(collection, item._cloudId, patch).catch(function (error) {
        console.warn('[Admin] تعذر رفع تحديث ' + collection, error && error.code ? error.code : error);
        if (window.NeonUI) window.NeonUI.toast('تم التحديث محليًا، لكن تعذر رفعه للسحابة. تحقق من الاتصال.', 'error', 6000);
      });
    }
    return changed;
  }

  function startCloudWatchers(fetchNow) {
    var cloud = window.NeonCloud;
    if (!cloud || !cloud.isSignedIn || !cloud.isSignedIn()) return;
    ['orders', 'messages'].forEach(function (collection) {
      if (!cloudWatchers[collection] && cloud.watchRecords) {
        cloudWatchers[collection] = true;
        try {
          Promise.resolve(cloud.watchRecords(collection, function (records) {
            notifyNewCloudRecords(collection, records);
            if (store.mergeRemoteRecords) store.mergeRemoteRecords(collection, records);
            if (state.loggedIn && (state.view === collection || state.view === 'dashboard')) renderCurrentView();
            refreshChrome();
          }, 300)).catch(function (error) {
            cloudWatchers[collection] = false;
            console.warn('[Admin] تعذر بدء المتابعة اللحظية لـ ' + collection, error && error.code ? error.code : error);
          });
        } catch (error) {
          cloudWatchers[collection] = false;
        }
      }
      if (fetchNow && cloud.fetchRecords) {
        cloud.fetchRecords(collection, 300).then(function (records) {
          notifyNewCloudRecords(collection, records);
          if (store.mergeRemoteRecords) store.mergeRemoteRecords(collection, records);
          if (state.loggedIn && (state.view === collection || state.view === 'dashboard')) renderCurrentView();
          refreshChrome();
        }).catch(function (error) {
          console.warn('[Admin] تعذر جلب ' + collection, error && error.code ? error.code : error);
        });
      }
    });
  }

  /* ------------------------------------------------------------------------
     Collection definitions (fields drive the generic editor)
     ------------------------------------------------------------------------ */
  var COLLECTIONS = {
    services: {
      noun: 'الخدمة',
      title: 'الخدمات',
      editorHint: 'املأ بيانات الخدمة. السعر هنا هو «يبدأ من» ويظهر في الموقع.',
      searchKeys: ['title', 'category', 'short', 'description', 'badge'],
      filterKey: 'category',
      fields: [
        { key: 'title', label: 'عنوان الخدمة', type: 'text', required: true, full: true, placeholder: 'مثال: تصميم الجرافيك' },
        { key: 'category', label: 'التصنيف', type: 'select', options: SERVICE_CATEGORIES },
        { key: 'icon', label: 'الأيقونة', type: 'select', options: SERVICE_ICONS },
        { key: 'price', label: 'السعر (يبدأ من)', type: 'number', min: 0, step: 'any' },
        { key: 'priceNote', label: 'نص السعر', type: 'text', placeholder: 'يبدأ من' },
        { key: 'unit', label: 'الوحدة', type: 'text', placeholder: '/ شهر' },
        { key: 'duration', label: 'مدة التنفيذ', type: 'text', placeholder: '3 – 7 أيام' },
        { key: 'badge', label: 'شارة (اختياري)', type: 'text', placeholder: 'الأكثر طلبًا' },
        { key: 'short', label: 'وصف قصير', type: 'textarea', required: true, full: true, rows: 3 },
        { key: 'description', label: 'الوصف الكامل', type: 'textarea', full: true, rows: 5 },
        { key: 'features', label: 'المميزات', type: 'list', full: true, rows: 5, hint: 'سطر لكل ميزة (لا تستخدم فواصل داخل السطر).' },
        { key: 'image', label: 'صورة الخدمة (اختياري)', type: 'image', full: true },
        { key: 'paymentLink', label: 'رابط دفع مخصص (اختياري)', type: 'text', full: true, ltr: true, placeholder: 'https://...' },
        { key: 'active', label: 'نشطة وتظهر في الموقع', type: 'switch', default: true },
        { key: 'featured', label: 'خدمة مميزة', type: 'switch', default: false }
      ]
    },

    works: {
      noun: 'العمل',
      title: 'الأعمال',
      editorHint: 'أضف صورة غلاف واضحة ووصفًا مختصرًا يبرز نتيجة المشروع.',
      searchKeys: ['title', 'category', 'client', 'description'],
      filterKey: 'category',
      fields: [
        { key: 'title', label: 'عنوان العمل', type: 'text', required: true, full: true, placeholder: 'مثال: هوية بصرية — كافيه نون' },
        { key: 'category', label: 'التصنيف', type: 'text', placeholder: 'هوية بصرية / سوشيال ميديا / تصوير…' },
        { key: 'client', label: 'العميل', type: 'text', placeholder: 'اسم العميل' },
        { key: 'year', label: 'السنة', type: 'text', placeholder: '2026', ltr: true },
        { key: 'image', label: 'صورة الغلاف', type: 'image', full: true },
        { key: 'description', label: 'وصف العمل', type: 'textarea', full: true, rows: 4 },
        { key: 'tags', label: 'الوسوم', type: 'list', full: true, rows: 3, hint: 'مثال: شعار / هوية / تغليف — سطر لكل وسم.' },
        { key: 'featured', label: 'عمل مميز', type: 'switch', default: true },
        { key: 'active', label: 'يظهر في الموقع', type: 'switch', default: true }
      ]
    },

    testimonials: {
      noun: 'رأي العميل',
      title: 'آراء العملاء',
      editorHint: 'اكتب الرأي كما قاله العميل، وحدّد التقييم من 5 نجوم.',
      searchKeys: ['name', 'role', 'company', 'text'],
      fields: [
        { key: 'name', label: 'اسم العميل', type: 'text', required: true },
        { key: 'role', label: 'المسمى الوظيفي', type: 'text', placeholder: 'صاحب كافيه / مدير تسويق' },
        { key: 'company', label: 'الشركة أو المشروع', type: 'text' },
        { key: 'rating', label: 'التقييم', type: 'select', options: [
          { value: '5', label: '★★★★★ — ممتاز' },
          { value: '4', label: '★★★★ — جيد جدًا' },
          { value: '3', label: '★★★ — جيد' },
          { value: '2', label: '★★ — مقبول' },
          { value: '1', label: '★ — ضعيف' }
        ] },
        { key: 'avatar', label: 'صورة العميل (اختياري)', type: 'image', full: true },
        { key: 'text', label: 'نص الرأي', type: 'textarea', required: true, full: true, rows: 4 },
        { key: 'featured', label: 'رأي مميز', type: 'switch', default: true },
        { key: 'active', label: 'يظهر في الموقع', type: 'switch', default: true }
      ]
    },

    clients: {
      noun: 'العميل',
      title: 'عملاؤنا',
      editorHint: 'أضف اسم العميل وشعاره. الشعار اختياري — لو تركته فارغًا يظهر الاسم مع أيقونة.',
      searchKeys: ['name', 'url'],
      fields: [
        { key: 'name', label: 'اسم العميل', type: 'text', required: true, full: true, placeholder: 'مثال: كافيه نون' },
        { key: 'logo', label: 'شعار العميل (اختياري)', type: 'image', full: true, hint: 'يُفضل SVG أو PNG شفاف. الصور المرفوعة تُضغط تلقائيًا.' },
        { key: 'url', label: 'رابط موقع العميل (اختياري)', type: 'text', full: true, ltr: true, placeholder: 'https://...' },
        { key: 'active', label: 'يظهر في شريط العملاء', type: 'switch', default: true }
      ]
    },

    packages: {
      noun: 'الباقة',
      title: 'الباقات',
      editorHint: 'باقة واضحة = قرار أسهل. اكتب المميزات سطرًا لكل ميزة.',
      searchKeys: ['name', 'subtitle', 'badge'],
      fields: [
        { key: 'name', label: 'اسم الباقة', type: 'text', required: true },
        { key: 'subtitle', label: 'وصف مختصر', type: 'text' },
        { key: 'price', label: 'السعر', type: 'number', min: 0, step: 'any' },
        { key: 'period', label: 'مدة السعر', type: 'text', placeholder: '/ شهر' },
        { key: 'badge', label: 'شارة (اختياري)', type: 'text', placeholder: 'الأكثر طلبًا' },
        { key: 'features', label: 'مميزات الباقة', type: 'list', full: true, rows: 6, hint: 'سطر لكل ميزة.' },
        { key: 'highlighted', label: 'باقة مميزة (إطار نيون)', type: 'switch', default: false },
        { key: 'active', label: 'تظهر في الموقع', type: 'switch', default: true }
      ]
    },

    payments: {
      noun: 'طريقة الدفع',
      title: 'طرق الدفع',
      editorHint: 'أضف طريقة دفع واحدة لكل عنصر. الرابط اختياري ويُستخدم لأزرار الدفع المباشر.',
      searchKeys: ['name', 'value', 'type', 'instructions'],
      fields: [
        { key: 'name', label: 'اسم طريقة الدفع', type: 'text', required: true, placeholder: 'إنستاباي / فودافون كاش' },
        { key: 'type', label: 'النوع', type: 'select', options: PAYMENT_TYPES },
        { key: 'value', label: 'العنوان أو الرقم', type: 'text', full: true, placeholder: 'neonmedia@instapay' },
        { key: 'link', label: 'رابط الدفع (اختياري)', type: 'text', full: true, ltr: true, placeholder: 'https://paypal.me/...' },
        { key: 'instructions', label: 'تعليمات الدفع', type: 'textarea', full: true, rows: 3 },
        { key: 'active', label: 'متاحة للعملاء', type: 'switch', default: true }
      ]
    },

    faqs: {
      noun: 'السؤال',
      title: 'الأسئلة الشائعة',
      editorHint: 'اكتب سؤالًا واضحًا وإجابة مختصرة ومطمئنة.',
      searchKeys: ['question', 'answer'],
      fields: [
        { key: 'question', label: 'السؤال', type: 'text', required: true, full: true },
        { key: 'answer', label: 'الإجابة', type: 'textarea', required: true, full: true, rows: 5 },
        { key: 'active', label: 'يظهر في الموقع', type: 'switch', default: true }
      ]
    },

    customers: {
      noun: 'العميل',
      title: 'قاعدة العملاء',
      editorHint: 'بيانات العميل تُستخدم في الحملات وتقارير العملاء. النقاط قابلة للتعديل يدويًا.',
      searchKeys: ['name', 'phone', 'email', 'notes', 'tags', 'nextFollowUp'],
      fields: [
        { key: 'name', label: 'اسم العميل', type: 'text', required: true },
        { key: 'phone', label: 'رقم الهاتف / واتساب', type: 'text', required: true, ltr: true, placeholder: '01xxxxxxxxx' },
        { key: 'email', label: 'البريد الإلكتروني', type: 'text', ltr: true },
        { key: 'points', label: 'نقاط الولاء', type: 'number', min: 0, step: '1', hint: 'تُضاف تلقائيًا مع كل طلب حسب إعدادات نقاط الولاء.' },
        { key: 'tags', label: 'الوسوم', type: 'list', rows: 2, hint: 'مثال: عميل دائم، باقة سنوية — سطر لكل وسم.' },
        { key: 'consent', label: 'موافق على استلام الرسائل التسويقية', type: 'switch', default: true },
        { key: 'active', label: 'عميل نشط', type: 'switch', default: true },
        { key: 'notes', label: 'ملاحظات داخلية', type: 'textarea', full: true, rows: 3 },
        { key: 'nextFollowUp', label: 'موعد المتابعة القادمة', type: 'text', ltr: true, placeholder: '2026-02-01', hint: 'اختياري — يظهر في تقرير العملاء.' }
      ]
    },

    notifications: {
      noun: 'الإشعار',
      title: 'الإشعارات',
      editorHint: 'يظهر الإشعار داخل جرس الإشعارات في الموقع. اترك تاريخ البداية والنهاية فارغًا لعرضه دائمًا.',
      searchKeys: ['title', 'message', 'link', 'type'],
      filterKey: 'type',
      fields: [
        { key: 'title', label: 'عنوان الإشعار', type: 'text', required: true, full: true },
        { key: 'message', label: 'نص الإشعار', type: 'textarea', required: true, full: true, rows: 4 },
        { key: 'type', label: 'النوع', type: 'select', options: NOTIFICATION_TYPES },
        { key: 'link', label: 'الرابط (اختياري)', type: 'text', full: true, ltr: true, placeholder: '#packages' },
        { key: 'pinned', label: 'تثبيت الإشعار في الأعلى', type: 'switch', default: false },
        { key: 'startAt', label: 'تاريخ البداية (اختياري)', type: 'text', ltr: true, placeholder: '2026-02-01' },
        { key: 'endAt', label: 'تاريخ النهاية (اختياري)', type: 'text', ltr: true, placeholder: '2026-02-28' },
        { key: 'active', label: 'يظهر للزوار', type: 'switch', default: true }
      ]
    },

    templates: {
      noun: 'القالب',
      title: 'الرسائل الجاهزة',
      editorHint: 'استخدم {name} لاسم العميل و{brand} لاسم الموقع. تُستخدم القوالب في حملات واتساب.',
      searchKeys: ['title', 'text'],
      fields: [
        { key: 'title', label: 'اسم القالب', type: 'text', required: true, full: true },
        { key: 'text', label: 'نص الرسالة', type: 'textarea', required: true, full: true, rows: 6, hint: '{name} = اسم العميل، {brand} = اسم الموقع.' },
        { key: 'active', label: 'متاح في الحملات', type: 'switch', default: true }
      ]
    },

    banners: {
      noun: 'البانر',
      title: 'بانرات العروض',
      editorHint: 'يمكنك عرض أكثر من بانر في نفس الوقت. الأعلى في «الأولوية» يظهر أولًا. اترك تاريخي البداية والنهاية فارغين للعرض الدائم.',
      searchKeys: ['title', 'kicker', 'text', 'code', 'cta'],
      fields: [
        { key: 'title', label: 'عنوان البانر', type: 'text', required: true, full: true, placeholder: 'خصم 20% على باقة إدارة السوشيال ميديا' },
        { key: 'kicker', label: 'الكلمة العلوية', type: 'text', placeholder: 'عرض خاص' },
        { key: 'text', label: 'تفاصيل العرض', type: 'textarea', full: true, rows: 2 },
        { key: 'code', label: 'كود الخصم (اختياري)', type: 'text', ltr: true, placeholder: 'NEON20' },
        { key: 'cta', label: 'نص الزر', type: 'text', placeholder: 'احجز العرض' },
        { key: 'link', label: 'رابط الزر', type: 'text', ltr: true, placeholder: '#packages' },
        { key: 'image', label: 'صورة البانر (اختياري)', type: 'image', full: true },
        { key: 'startAt', label: 'تاريخ البداية', type: 'text', ltr: true, placeholder: '2026-02-01', hint: 'اتركه فارغًا للبدء فورًا. الصيغة: YYYY-MM-DD' },
        { key: 'endAt', label: 'تاريخ النهاية', type: 'text', ltr: true, placeholder: '2026-02-28', hint: 'اتركه فارغًا للعرض الدائم. الصيغة: YYYY-MM-DD' },
        { key: 'priority', label: 'الأولوية', type: 'number', min: 0, step: '1', default: 0, hint: 'الرقم الأعلى يظهر أولًا.' },
        { key: 'pages', label: 'الصفحات المستهدفة', type: 'select', options: PAGE_TARGETS },
        { key: 'devices', label: 'الأجهزة المستهدفة', type: 'select', options: DEVICE_TARGETS },
        { key: 'dismissible', label: 'السماح للزائر بإغلاق البانر', type: 'switch', default: true },
        { key: 'active', label: 'البانر نشط ويظهر في الموقع', type: 'switch', default: true }
      ]
    },

    popups: {
      noun: 'النافذة المنبثقة',
      title: 'النوافذ المنبثقة',
      editorHint: 'اختر طريقة الظهور: بعد مدة، عند تمرير نسبة من الصفحة، أو عند محاولة مغادرة الصفحة. تُعرض نافذة واحدة فقط حسب الأولوية.',
      searchKeys: ['title', 'text', 'cta', 'trigger'],
      fields: [
        { key: 'title', label: 'عنوان النافذة', type: 'text', required: true, full: true, placeholder: 'أهلًا بك في نِيون ميديا' },
        { key: 'text', label: 'نص النافذة', type: 'textarea', full: true, rows: 3 },
        { key: 'cta', label: 'نص الزر', type: 'text', placeholder: 'ابدأ مشروعك' },
        { key: 'link', label: 'رابط الزر', type: 'text', ltr: true, placeholder: '#contact' },
        { key: 'image', label: 'صورة النافذة (اختياري)', type: 'image', full: true },
        { key: 'trigger', label: 'طريقة الظهور', type: 'select', options: POPUP_TRIGGERS, default: 'delay' },
        { key: 'delay', label: 'التأخير (ثانية)', type: 'number', min: 0, step: '1', default: 2, hint: 'يُستخدم مع خيار «بعد مدة محددة». مثال: 20 تعني بعد 20 ثانية.' },
        { key: 'scrollDepth', label: 'نسبة التمرير (%)', type: 'number', min: 10, max: 100, step: '5', default: 50, hint: 'يُستخدم مع خيار التمرير. 50 تعني منتصف الصفحة.' },
        { key: 'frequency', label: 'تكرار الظهور', type: 'select', options: POPUP_FREQUENCIES, default: 'once' },
        { key: 'priority', label: 'الأولوية', type: 'number', min: 0, step: '1', default: 0, hint: 'الأعلى يظهر أولًا عند وجود أكثر من نافذة.' },
        { key: 'pages', label: 'الصفحات المستهدفة', type: 'select', options: PAGE_TARGETS },
        { key: 'devices', label: 'الأجهزة المستهدفة', type: 'select', options: DEVICE_TARGETS },
        { key: 'active', label: 'النافذة نشطة', type: 'switch', default: true }
      ]
    }
  };

  /* ------------------------------------------------------------------------
     Settings groups (field paths map to settings object)
     ------------------------------------------------------------------------ */
  var SETTINGS_GROUPS = [
    {
      id: 'brand',
      title: 'الهوية والعلامة',
      desc: 'اسم الاستوديو، الشعار، والشريط الإعلاني.',
      icon: 'star',
      fields: [
        { key: 'siteName', label: 'اسم الموقع', type: 'text', required: true },
        { key: 'brandLatin', label: 'الاسم اللاتيني', type: 'text', ltr: true },
        { key: 'tagline', label: 'الوصف المختصر', type: 'text', full: true },
        { key: 'logo', label: 'شعار الموقع', type: 'image', full: true, hint: 'يُفضل SVG أو PNG شفاف. الصور المرفوعة تُضغط تلقائيًا.' },
        { key: 'favicon', label: 'أيقونة المتصفح', type: 'image', full: true },
        { key: 'announcementEnabled', label: 'إظهار الشريط الإعلاني أعلى الموقع', type: 'switch', default: true },
        { key: 'announcement', label: 'نص الشريط الإعلاني', type: 'text', full: true },
        { key: 'announcementLink', label: 'رابط الشريط', type: 'text', full: true, ltr: true, placeholder: '#packages' }
      ]
    },
    {
      id: 'owner',
      title: 'الملف الشخصي والاستوديو',
      desc: 'بيانات صاحب الاستوديو، النبذة، الخبرات، والجمهور المستهدف.',
      icon: 'home',
      wide: true,
      fields: [
        { key: 'ownerName', label: 'اسم صاحب الاستوديو', type: 'text', required: true },
        { key: 'ownerTitle', label: 'المسمى المهني', type: 'text' },
        { key: 'ownerPhoto', label: 'الصورة الشخصية', type: 'image', full: true },
        { key: 'heroKicker', label: 'سطر الهيرو العلوي', type: 'text' },
        { key: 'heroTitle1', label: 'عنوان الهيرو — الجزء الأول', type: 'text' },
        { key: 'heroTitleAccent', label: 'عنوان الهيرو — الجزء الملوّن', type: 'text' },
        { key: 'heroText', label: 'نص الهيرو', type: 'textarea', full: true, rows: 3 },
        { key: 'heroRoles', label: 'المسميات المتحركة', type: 'list', full: true, rows: 3, hint: 'سطر لكل مسمى.' },
        { key: 'cvShort', label: 'نبذة السيرة المختصرة', type: 'textarea', full: true, rows: 3 },
        { key: 'skills', label: 'المهارات', type: 'list', full: true, rows: 3, hint: 'سطر لكل مهارة.' },
        { key: 'stats', label: 'الأرقام والإنجازات', type: 'stats', full: true, rows: 4, hint: 'كل سطر: القيمة|اللاحقة|الوصف — مثال: 120|+|مشروع منجز' },
        { key: 'audiences', label: 'الجمهور المستهدف', type: 'list', full: true, rows: 4, hint: 'كافيهات، مطاعم، شركات… سطر لكل جمهور.' },
        { key: 'aboutKicker', label: 'كلمة «نبذة عنا»', type: 'text' },
        { key: 'aboutBadge', label: 'شارة صورة النبذة', type: 'text' },
        { key: 'aboutYears', label: 'رقم سنوات الخبرة', type: 'text', ltr: true, placeholder: '8+' },
        { key: 'aboutTitle', label: 'عنوان النبذة', type: 'text' },
        { key: 'aboutText', label: 'نص النبذة', type: 'textarea', full: true, rows: 6 },
        { key: 'aboutHighlights', label: 'مميزات النبذة', type: 'list', full: true, rows: 4 },
        { key: 'aboutImage', label: 'صورة قسم النبذة', type: 'image', full: true },
        { key: 'mission', label: 'رسالتنا', type: 'textarea', rows: 3 },
        { key: 'vision', label: 'رؤيتنا', type: 'textarea', rows: 3 },
        { key: 'footerNote', label: 'عبارة التذييل', type: 'text', full: true }
      ]
    },
    {
      id: 'availability',
      title: 'حالة التوفر',
      desc: 'الشارة النيون العائمة فوق صورتك الشخصية في الموقع — تقدر تطفّيها أو توقفها أو تغيّر نصوصها من هنا.',
      icon: 'check',
      fields: [
        { key: 'availableNow', label: 'أنا متاح حاليًا', type: 'switch', default: true, hint: 'لما تطفّي المفتاح، الشارة هتتحول لأحمر «غير متاح» تلقائيًا — العميل هيعرف فورًا إنك مش مستقبل شغل دلوقتي.' },
        { key: 'availableNowTitle', label: 'العنوان الرئيسي', type: 'text', placeholder: 'متاح للعمل الآن', hint: 'سطر قصير واضح — مثال: «متاح للعمل الآن» أو «غير متاح حاليًا».' },
        { key: 'availableNowSub', label: 'السطر الفرعي', type: 'text', placeholder: 'نستقبل مشاريع جديدة', hint: 'سطر يوضح نوع الشغل أو حالة الاستقبال — مثال: «نستقبل مشاريع جديدة» أو «برجع لاستقبال الطلبات يوم الأحد».' }
      ]
    },
    {
      id: 'video',
      title: 'الفيديو الترويجي',
      desc: 'فيديو presentation يظهر تحت الهيرو — YouTube أو Vimeo أو رابط مباشر (MP4).',
      icon: 'image',
      fields: [
        { key: 'videoEnabled', label: 'إظهار قسم الفيديو', type: 'switch', default: true },
        { key: 'videoUrl', label: 'رابط الفيديو', type: 'text', full: true, ltr: true, placeholder: 'https://www.youtube.com/embed/VIDEO_ID', hint: 'YouTube: استخدم رابط embed (youtube.com/embed/ID). Vimeo: vimeo.com/ID. أو رابط MP4 مباشر.' },
        { key: 'videoKicker', label: 'الكلمة العلوية', type: 'text', placeholder: 'عرض مرئي' },
        { key: 'videoTitle', label: 'العنوان — الجزء الأول', type: 'text', placeholder: 'شاهد' },
        { key: 'videoTitleAccent', label: 'العنوان — الجزء الملوّن', type: 'text', placeholder: 'أعمالنا في 60 ثانية' },
        { key: 'videoText', label: 'الوصف', type: 'textarea', full: true, rows: 2 }
      ]
    },
    {
      id: 'vectors',
      title: 'الشخصيات والفيكتور (PNG مفرّغ)',
      desc: 'صور الشخصيات الشابة في كل قسم. «PNG مفرّغ» يعني خلفية شفافة. تقدر ترفع صورة من جهازك أو تحط رابط، و«مسح» بيرجع للصورة الافتراضية المدمجة.',
      icon: 'image',
      wide: true,
      fields: [
        { key: 'vectors.banner', label: 'البانر الكبير في الصفحة (بعد قسم الفريق)', type: 'image', full: true, hint: 'الصورة الافتراضية: مشهد المصمم أمام لوحة المشاريع. PNG مفرّغ مفضل.' },
        { key: 'vectors.designer', label: '«المصمم» — سكشن الفريق', type: 'image', full: true, hint: 'PNG مفرّغ أو رابط. لو فضيت الحقل هترجع الصورة الافتراضية.' },
        { key: 'vectors.photographer', label: '«المصوّر» — سكشن الفريق', type: 'image', full: true, hint: 'يفضل PNG مفرّغ بخلفية شفافة.' },
        { key: 'vectors.marketer', label: '«المسوّق» — سكشن الفريق', type: 'image', full: true, hint: 'يفضل PNG مفرّغ بخلفية شفافة.' },
        { key: 'vectors.about', label: 'شخصية قسم «النبذة»', type: 'image', full: true, hint: 'يفضل PNG مفرّغ بخلفية شفافة.' },
        { key: 'vectors.services', label: 'شخصية قسم «الخدمات»', type: 'image', full: true, hint: 'يفضل PNG مفرّغ بخلفية شفافة.' },
        { key: 'vectors.works', label: 'شخصية قسم «الأعمال»', type: 'image', full: true, hint: 'يفضل PNG مفرّغ بخلفية شفافة.' },
        { key: 'vectors.contact', label: '«فريق الدعم» — قسم الاتصال', type: 'image', full: true, hint: 'يفضل PNG مفرّغ بخلفية شفافة.' }
      ]
    },
    {
      id: 'contact',
      title: 'التواصل والسوشيال',
      desc: 'أرقامك، بريدك، عنوانك، وروابط حساباتك.',
      icon: 'mail',
      fields: [
        { key: 'phone', label: 'رقم الهاتف (دولي)', type: 'text', ltr: true, placeholder: '+201017908893' },
        { key: 'phoneDisplay', label: 'رقم الهاتف للعرض', type: 'text', ltr: true },
        { key: 'whatsapp', label: 'رقم واتساب (بدون +)', type: 'text', ltr: true, placeholder: '201017908893' },
        { key: 'email', label: 'البريد الإلكتروني', type: 'text', ltr: true },
        { key: 'address', label: 'العنوان', type: 'text', full: true },
        { key: 'workingHours', label: 'ساعات العمل', type: 'text', full: true },
        { key: 'mapUrl', label: 'رابط الخريطة', type: 'text', full: true, ltr: true },
        { key: 'socials.instagram', label: 'إنستجرام', type: 'text', ltr: true },
        { key: 'socials.tiktok', label: 'تيك توك', type: 'text', ltr: true },
        { key: 'socials.facebook', label: 'فيسبوك', type: 'text', ltr: true },
        { key: 'socials.snapchat', label: 'سناب شات', type: 'text', ltr: true },
        { key: 'socials.youtube', label: 'يوتيوب', type: 'text', ltr: true },
        { key: 'socials.linkedin', label: 'لينكدإن', type: 'text', ltr: true },
        { key: 'socials.behance', label: 'بيهانس', type: 'text', ltr: true }
      ]
    },
    {
      id: 'site',
      title: 'الموقع والدفع',
      desc: 'العملة، الألوان، استقبال الطلبات، ومعلومات SEO.',
      icon: 'settings',
      fields: [
        { key: 'currency', label: 'العملة', type: 'text', placeholder: 'ج.م' },
        { key: 'defaultTheme', label: 'الوضع الافتراضي', type: 'select', options: [
          { value: 'dark', label: 'داكن' },
          { value: 'light', label: 'فاتح' }
        ] },
        { key: 'ordersEnabled', label: 'استقبال الطلبات', type: 'switch', default: true },
        { key: 'onlinePaymentEnabled', label: 'إظهار الدفع الإلكتروني', type: 'switch', default: true },
        { key: 'paymentNote', label: 'ملاحظة الدفع', type: 'textarea', full: true, rows: 3 }
      ]
    },
    {
      id: 'design',
      title: 'التصميم والألوان النيون',
      desc: 'اختر لونًا من 5 ألوان نيون جاهزة، أو فعّل «استخدام ألوان مخصصة» وأدخل رمز Hex (مثل Photoshop #22e7ff) للون أساسي + لون ثانوي.',
      icon: 'palette',
      fields: [
        { key: 'useCustomColors', label: 'استخدام ألوان مخصصة (Hex)', type: 'switch', default: false, hint: 'عند التفعيل: يُستخدم اللون الأساسي + الثانوي (Hex) أعلاه. عند التعطيل: يُستخدم one من 5 ألوان جاهزة.' },
        { key: 'accent', label: 'اللون الأساسي (5 ألوان جاهزة)', type: 'select', options: [
          { value: 'cyan', label: 'سماوي نيون' },
          { value: 'magenta', label: 'وردي نيون' },
          { value: 'violet', label: 'بنفسجي نيون' },
          { value: 'lime', label: 'ليموني نيون' },
          { value: 'beige', label: 'بيج أنيق (ألوان المخبوزات والقهوة)' }
        ], hint: 'يُستخدم فقط when «استخدام ألوان مخصصة» معطّل.' },
        { key: 'accentColor', label: 'لون أساسي مخصص (Hex)', type: 'color', hint: 'يُستخدم فقط when «استخدام ألوان مخصصة» مفعّل.' },
        { key: 'accentSecondary', label: 'لون ثانوي مخصص (Hex)', type: 'color', hint: 'يُستخدم فقط when «استخدام ألوان مخصصة» مفعّل.' }
      ]
    },
    {
      id: 'seo',
      title: 'SEO — تحسين محركات البحث',
      desc: 'بيانات تفصيلية لتحسين ظهور الموقع في Google وBing وشبكات التواصل.',
      icon: 'search',
      wide: true,
      fields: [
        { key: 'seoTitle', label: 'عنوان SEO', type: 'text', full: true, hint: 'يظهر في تبويب المتصفح ونتائج البحث (50–60 حرفًا).' },
        { key: 'seoDescription', label: 'وصف SEO', type: 'textarea', full: true, rows: 3, hint: 'وصف مختصر (150–160 حرفًا) يظهر في نتائج البحث.' },
        { key: 'seoKeywords', label: 'الكلمات المفتاحية', type: 'text', full: true, hint: 'افصل بفواصل، مثال: تصميم جرافيك، تسويق رقمي، هوية بصرية' },
        { key: 'seoAuthor', label: 'المؤلف / اسم العلامة', type: 'text' },
        { key: 'seoRobots', label: 'Robots', type: 'select', options: [
          { value: 'index, follow', label: 'index, follow (افتراضي)' },
          { value: 'noindex, follow', label: 'noindex, follow' },
          { value: 'index, nofollow', label: 'index, nofollow' },
          { value: 'noindex, nofollow', label: 'noindex, nofollow' }
        ] },
        { key: 'seoCanonical', label: 'رابط Canonical', type: 'text', full: true, ltr: true, placeholder: 'https://example.com/' },
        { key: 'seoOgTitle', label: 'عنوان Open Graph', type: 'text', full: true, hint: 'عنوان عند المشاركة في Facebook/WhatsApp/LinkedIn.' },
        { key: 'seoOgDescription', label: 'وصف Open Graph', type: 'textarea', full: true, rows: 2 },
        { key: 'seoOgImage', label: 'صورة Open Graph', type: 'image', full: true, hint: '1200×630 px موصى به.' },
        { key: 'seoTwitterCard', label: 'نوع Twitter Card', type: 'select', options: [
          { value: 'summary_large_image', label: 'summary_large_image' },
          { value: 'summary', label: 'summary' }
        ] }
      ]
    },
    {
      id: 'orders',
      title: 'الطلبات والفواتير',
      desc: 'ترقيم الطلبات، الإيصال الإلكتروني، وبيانات الضريبة التي تظهر فقط عند تفعيلها.',
      icon: 'bag',
      wide: true,
      fields: [
        { key: 'orderNumberPrefix', label: 'بادئة رقم الطلب', type: 'text', ltr: true, placeholder: 'HE-', hint: 'تظهر قبل الرقم المتسلسل، مثال: HE-1001.' },
        { key: 'orderStartNumber', label: 'أول رقم طلب', type: 'number', min: 1, step: '1', hint: 'الأرقام تزيد تلقائيًا بعد ذلك ولا تتكرر.' },
        { key: 'orderNumberPadding', label: 'عدد خانات الرقم', type: 'number', min: 1, step: '1', hint: '4 تعني HE-1001 وHE-0042.' },
        { key: 'vatEnabled', label: 'تفعيل ضريبة القيمة المضافة', type: 'switch', default: false, hint: 'عند التفعيل تُحسب الضريبة داخل الإجمالي، وتظهر بياناتها فقط في الإيصال دون ذكر «السعر قبل الضريبة».' },
        { key: 'vatRate', label: 'نسبة الضريبة (%)', type: 'number', min: 0, step: 'any', hint: 'النسبة الشائعة في مصر 14%.' },
        { key: 'taxNumber', label: 'الرقم الضريبي (يظهر في الإيصال)', type: 'text', ltr: true, placeholder: '300000000000003' },
        { key: 'invoiceNote', label: 'تذييل الفاتورة', type: 'textarea', full: true, rows: 3, hint: 'يمكن استخدام {siteName} و{orderNo} و{total} وسيتم استبدالها تلقائيًا.' }
      ]
    },
    {
      id: 'marketing',
      title: 'الإشعارات والتسويق',
      desc: 'رسائل جرس الإشعارات تُدار من قسم «الإشعارات»، والبانرات من «بانرات العروض»، والنوافذ المنبثقة من «النوافذ المنبثقة».',
      icon: 'megaphone',
      wide: true,
      fields: [
        { key: 'notificationsEnabled', label: 'تفعيل جرس الإشعارات في الموقع', type: 'switch', default: true }
      ]
    },
    {
      id: 'phonepush',
      title: 'إشعارات الجوال (زي واتساب)',
      desc: 'إشعار نظام فوري يصل جوالك عند وصول أي طلب أو رسالة جديدة — حتى والتطبيق مقفول. الخطوات: ثبّت تطبيق ntfy من متجر التطبيقات → من داخله اشترك (Subscribe) بنفس اسم الموضوع السري اللي هتكتبه هنا → فعّل وحفظ → جرّب زر الإرسال التجريبي.',
      icon: 'bell',
      fields: [
        { key: 'pushEnabled', label: 'تفعيل إشعارات الجوال', type: 'switch', default: false, hint: 'عند التفعيل يصل جوالك إشعار بنكهة «طلب جديد HE-1001» لحظة إرساله.' },
        { key: 'pushTopic', label: 'اسم الموضوع السري', type: 'text', ltr: true, placeholder: 'neon-hesham-9271', hint: 'حروف إنجليزية وأرقام وشرطات فقط، مثل neon-hesham-9271. نفس الاسم بالضبط ستكتبه في تطبيق ntfy عند الاشتراك — ولا تشاركه مع أحد فهو مثل كلمة السر.' }
      ]
    },
    {
      id: 'loyalty',
      title: 'نقاط الولاء',
      desc: 'اكسب عملاءك نقاطًا مع كل طلب، واستبدلها عند الشراء التالي.',
      icon: 'card',
      fields: [
        { key: 'loyaltyEnabled', label: 'تفعيل نظام النقاط', type: 'switch', default: true },
        { key: 'loyaltyLabel', label: 'اسم النقاط', type: 'text', placeholder: 'نقاط نيون' },
        { key: 'loyaltyPointsPerCurrency', label: 'نقاط لكل وحدة عملة', type: 'number', min: 0, step: 'any', hint: 'مثال: 0.1 تعني نقطة لكل 10 من العملة.' },
        { key: 'loyaltyPointValue', label: 'قيمة النقطة عند الاستبدال', type: 'number', min: 0, step: 'any', hint: 'كم تساوي النقطة الواحدة من العملة.' },
        { key: 'loyaltyMinRedeem', label: 'أقل عدد نقاط للاستبدال', type: 'number', min: 0, step: '1' },
        { key: 'loyaltyWelcomePoints', label: 'نقاط ترحيبية للعميل الجديد', type: 'number', min: 0, step: '1' }
      ]
    },
    {
      id: 'sectionsA',
      title: 'نصوص: الخدمات والباقات',
      desc: 'عدّل الكلمة العلوية والعنوان والجزء الملوّن والوصف لكل قسم.',
      icon: 'layers',
      fields: [
        { key: 'servicesKicker', label: 'الخدمات — الكلمة العلوية', type: 'text' },
        { key: 'servicesTitle', label: 'الخدمات — العنوان', type: 'text' },
        { key: 'servicesTitleAccent', label: 'الخدمات — الجزء الملوّن', type: 'text' },
        { key: 'servicesText', label: 'الخدمات — الوصف', type: 'textarea', full: true, rows: 2 },
        { key: 'packagesKicker', label: 'الباقات — الكلمة العلوية', type: 'text' },
        { key: 'packagesTitle', label: 'الباقات — العنوان', type: 'text' },
        { key: 'packagesTitleAccent', label: 'الباقات — الجزء الملوّن', type: 'text' },
        { key: 'packagesText', label: 'الباقات — الوصف', type: 'textarea', full: true, rows: 2 }
      ]
    },
    {
      id: 'sectionsB',
      title: 'نصوص: الأعمال وطريقة العمل',
      desc: 'نصوص قسمي معرض الأعمال وخطوات العمل.',
      icon: 'image',
      fields: [
        { key: 'worksKicker', label: 'الأعمال — الكلمة العلوية', type: 'text' },
        { key: 'worksTitle', label: 'الأعمال — العنوان', type: 'text' },
        { key: 'worksTitleAccent', label: 'الأعمال — الجزء الملوّن', type: 'text' },
        { key: 'worksText', label: 'الأعمال — الوصف', type: 'textarea', full: true, rows: 2 },
        { key: 'processKicker', label: 'طريقة العمل — الكلمة العلوية', type: 'text' },
        { key: 'processTitle', label: 'طريقة العمل — العنوان', type: 'text' },
        { key: 'processTitleAccent', label: 'طريقة العمل — الجزء الملوّن', type: 'text' },
        { key: 'processText', label: 'طريقة العمل — الوصف', type: 'textarea', full: true, rows: 2 }
      ]
    },
    {
      id: 'sectionsC',
      title: 'نصوص: العملاء والدفع',
      desc: 'نصوص قسم العملاء وقسم الدفع الإلكتروني.',
      icon: 'star',
      fields: [
        { key: 'clientsKicker', label: 'العملاء — الكلمة العلوية', type: 'text' },
        { key: 'clientsTitle', label: 'العملاء — العنوان', type: 'text' },
        { key: 'clientsTitleAccent', label: 'العملاء — الجزء الملوّن', type: 'text' },
        { key: 'clientsText', label: 'العملاء — الوصف', type: 'textarea', full: true, rows: 2 },
        { key: 'paymentKicker', label: 'الدفع — الكلمة العلوية', type: 'text' },
        { key: 'paymentTitle', label: 'الدفع — العنوان', type: 'text' },
        { key: 'paymentTitleAccent', label: 'الدفع — الجزء الملوّن', type: 'text' },
        { key: 'paymentText', label: 'الدفع — الوصف', type: 'textarea', full: true, rows: 2 }
      ]
    },
    {
      id: 'sectionsD',
      title: 'نصوص: الأسئلة والاتصال',
      desc: 'نصوص قسم الأسئلة الشائعة وقسم التواصل في الصفحة الرئيسية.',
      icon: 'help',
      fields: [
        { key: 'faqKicker', label: 'الأسئلة — الكلمة العلوية', type: 'text' },
        { key: 'faqTitle', label: 'الأسئلة — العنوان', type: 'text' },
        { key: 'faqTitleAccent', label: 'الأسئلة — الجزء الملوّن', type: 'text' },
        { key: 'faqText', label: 'الأسئلة — الوصف', type: 'textarea', full: true, rows: 2 },
        { key: 'contactKicker', label: 'الاتصال — الكلمة العلوية', type: 'text' },
        { key: 'contactTitle', label: 'الاتصال — العنوان', type: 'text' },
        { key: 'contactTitleAccent', label: 'الاتصال — الجزء الملوّن', type: 'text' },
        { key: 'contactText', label: 'الاتصال — الوصف', type: 'textarea', full: true, rows: 2 }
      ]
    },
    {
      id: 'sectionsE',
      title: 'نصوص: أقسام وصفحات أخرى',
      desc: 'قسم «لمن نُصمّم» وصفحة الاتصال والمساعدة.',
      icon: 'home',
      fields: [
        { key: 'audienceTitle', label: 'قسم الجمهور — العنوان', type: 'text' },
        { key: 'audienceText', label: 'قسم الجمهور — الوصف', type: 'text', full: true },
        { key: 'contactPageKicker', label: 'صفحة الاتصال — الكلمة العلوية', type: 'text' },
        { key: 'contactPageTitle', label: 'صفحة الاتصال — العنوان', type: 'text' },
        { key: 'contactPageTitleAccent', label: 'صفحة الاتصال — الجزء الملوّن', type: 'text' },
        { key: 'contactPageText', label: 'صفحة الاتصال — الوصف', type: 'textarea', full: true, rows: 2 },
        { key: 'contactChannelsTitle', label: 'صفحة الاتصال — عنوان قنوات التواصل', type: 'text' },
        { key: 'contactHoursTitle', label: 'صفحة الاتصال — عنوان ساعات العمل', type: 'text' },
        { key: 'contactFormTitle', label: 'صفحة الاتصال — عنوان النموذج', type: 'text', full: true },
        { key: 'quickFaqTitle', label: 'الأسئلة السريعة — العنوان', type: 'text' },
        { key: 'quickFaqTitleAccent', label: 'الأسئلة السريعة — الجزء الملوّن', type: 'text' }
      ]
    },
    {
      id: 'quran',
      title: 'القرآن والتلاوة',
      desc: 'الآية الترحيبية والتلاوة التي تعمل عند أول زيارة.',
      icon: 'cloud',
      fields: [
        { key: 'quranEnabled', label: 'تفعيل التلاوة والترحيب', type: 'switch', default: true },
        { key: 'quranAutoplay', label: 'محاولة التشغيل التلقائي', type: 'switch', default: true },
        { key: 'quranTitle', label: 'عنوان التلاوة', type: 'text', full: true },
        { key: 'quranUrl', label: 'رابط التلاوة', type: 'text', full: true, ltr: true },
        { key: 'quranLocalUrl', label: 'رابط احتياطي محلي', type: 'text', full: true, ltr: true, hint: 'ضع ملفًا في assets/audio/quran.mp3 ليعمل بدون إنترنت.' },
        { key: 'quranMode', label: 'متى تظهر البوابة للعملاء', type: 'select', options: [
          { value: 'first-visit', label: 'أول زيارة فقط (افتراضي)' },
          { value: 'every-visit', label: 'مرة كل زيارة للصفحة' },
          { value: 'every-session', label: 'مرة كل جلسة جديدة' },
          { value: 'never', label: 'أبداً — الدخول مباشرة بدون بوابة' }
        ], default: 'first-visit', hint: 'يتحكم في الوقت اللي بيظهر فيه زر «تشغيل التلاوة». زر الصوت في الهيدر يفضل دايمًا شغال.' },
        { key: 'quranPages', label: 'الصفحات اللي تظهر فيها البوابة', type: 'select', options: [
          { value: 'all', label: 'كل الصفحات' },
          { value: 'home', label: 'الرئيسية فقط' },
          { value: 'not-home', label: 'كل الصفحات ماعدا الرئيسية' }
        ], default: 'all' },
        { key: 'quranVolume', label: 'مستوى الصوت (0–100)', type: 'number', min: 0, max: 100, step: 1, default: 55, hint: '0 صامت … 55 القيمة الافتراضية.' },
        { key: 'quranBismillah', label: 'النص العلوي (البسملة)', type: 'text', full: true, hint: 'الافتراضية: بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ' },
        { key: 'quranGateText', label: 'نص البوابة الترحيبي', type: 'textarea', full: true, rows: 2, hint: 'السطر فوق عنوان التلاوة. لو سيبته فاضي هتظهر التلاوة بس بدون سطر إضافي.' },
        { key: 'quranWelcomeTitle', label: 'عنوان البوابة', type: 'text', full: true, hint: 'العنوان الكبير — الافتراضي: أهلًا بك في نِيون ميديا.' }
      ]
    }
  ];

  /* ------------------------------------------------------------------------
     Generic field builder
     ------------------------------------------------------------------------ */
  var fieldSeq = 0;

  function fieldValue(field, value) {
    if (field.type === 'list') return Array.isArray(value) ? value.join('\n') : String(value == null ? '' : value);
    if (field.type === 'stats') return statsToText(value);
    if (value === undefined || value === null) return '';
    return String(value);
  }

  function optionValue(option) {
    return typeof option === 'string' ? option : option.value;
  }

  function optionLabel(option) {
    return typeof option === 'string' ? option : option.label;
  }

  function buildField(field, value, mode) {
    var attr = mode === 'setting' ? 'data-setting' : 'data-field';
    var fid = 'fld-' + (++fieldSeq);
    var wrapperClass = 'field' + (field.full ? ' full' : '') + (field.type === 'switch' ? ' field--switch' : '');
    var text = fieldValue(field, value);
    var control = '';
    var extra = '';

    if (field.type === 'switch') {
      var isChecked = value === undefined ? field.default === true : value !== false;
      control = '<label class="switch">' +
        '<input type="checkbox" id="' + fid + '" ' + attr + '="' + escAttr(field.key) + '"' + (isChecked ? ' checked' : '') + '>' +
        '<span class="switch__track"></span>' +
        '<span>' + esc(field.label) + '</span>' +
        '</label>';
      return '<div class="' + wrapperClass + '">' + control + '</div>';
    }

    if (field.type === 'image') {
      var preview = value
        ? '<img src="' + escAttr(value) + '" alt="معاينة" loading="lazy">'
        : icon('image');
      control = '<div class="img-field">' +
        '<div class="img-field__preview" data-img-preview>' + preview + '</div>' +
        '<div class="img-field__controls">' +
          '<input type="text" class="form-control" id="' + fid + '" ' + attr + '="' + escAttr(field.key) + '" data-img-url value="' + escAttr(value || '') + '" placeholder="رابط الصورة أو ارفع ملفًا" dir="ltr" style="text-align:left">' +
          '<div class="img-field__buttons">' +
            '<button type="button" class="btn btn-soft" data-img-upload>' + icon('upload') + ' رفع صورة</button>' +
            '<button type="button" class="btn btn-ghost" data-img-clear>' + icon('x') + ' مسح</button>' +
          '</div>' +
          '<input type="file" accept="image/*" data-img-file hidden>' +
        '</div>' +
      '</div>';
      extra = '<div class="field-hint">' + esc(field.hint || 'يمكنك لصق رابط صورة أو رفع صورة من جهازك.') + '</div>';
      return '<div class="' + wrapperClass + '">' +
        '<label class="form-label" for="' + fid + '">' + esc(field.label) + '</label>' +
        control + extra + '</div>';
    }

    var required = field.required ? ' required' : '';
    var ltr = field.ltr ? ' dir="ltr" style="text-align:left"' : '';

    if (field.type === 'color') {
      var colorVal = text || '#22e7ff';
      if (!/^#[0-9a-fA-F]{3,8}$/.test(colorVal)) colorVal = '#22e7ff';
      control = '<div class="color-field">' +
        '<input type="color" class="color-field__swatch" id="picker-' + fid + '" value="' + escAttr(colorVal) + '" aria-label="اختيار لون">' +
        '<input type="text" class="form-control color-field__hex" id="' + fid + '" ' + attr + '="' + escAttr(field.key) + '" value="' + escAttr(colorVal) + '" placeholder="#RRGGBB" dir="ltr" style="text-align:left" maxlength="9">' +
        '</div>';
      extra = '<div class="field-hint">' + esc(field.hint || 'اختر لونًا أو أدخل رمز Hex (مثل #22e7ff).') + '</div>';
      return '<div class="' + wrapperClass + '">' +
        '<label class="form-label" for="' + fid + '">' + esc(field.label) + (field.required ? ' <span class="req">*</span>' : '') + '</label>' +
        control + extra + '</div>';
    }

    if (field.type === 'textarea' || field.type === 'list' || field.type === 'stats') {
      control = '<textarea class="form-control" id="' + fid + '" ' + attr + '="' + escAttr(field.key) + '" rows="' + (field.rows || 3) + '" placeholder="' + escAttr(field.placeholder || '') + '"' + required + ltr + '>' + esc(text) + '</textarea>';
    } else if (field.type === 'select') {
      var options = (field.options || []).map(function (option) {
        var optValue = optionValue(option);
        var selected = String(value == null ? '' : value) === String(optValue) ? ' selected' : '';
        return '<option value="' + escAttr(optValue) + '"' + selected + '>' + esc(optionLabel(option)) + '</option>';
      }).join('');
      control = '<select class="form-select" id="' + fid + '" ' + attr + '="' + escAttr(field.key) + '"' + required + '>' + options + '</select>';
    } else {
      var type = field.type === 'number' ? 'number' : 'text';
      control = '<input type="' + type + '" class="form-control" id="' + fid + '" ' + attr + '="' + escAttr(field.key) + '" value="' + escAttr(text) + '" placeholder="' + escAttr(field.placeholder || '') + '"' + required + ltr +
        (field.min != null ? ' min="' + field.min + '"' : '') +
        (field.step ? ' step="' + escAttr(field.step) + '"' : '') + '>';
    }

    var hint = field.hint || (field.type === 'list' ? 'سطر لكل عنصر، أو افصل بفاصلة.' : '');
    return '<div class="' + wrapperClass + '">' +
      '<label class="form-label" for="' + fid + '">' + esc(field.label) + (field.required ? ' <span class="req">*</span>' : '') + '</label>' +
      control +
      (hint ? '<div class="field-hint">' + esc(hint) + '</div>' : '') +
      '</div>';
  }

  function readFieldValue(field, el) {
    if (field.type === 'switch') return el.checked;
    if (field.type === 'number') return el.value === '' ? 0 : Number(el.value);
    if (field.type === 'list') return splitList(el.value);
    if (field.type === 'stats') return parseStats(el.value);
    return String(el.value || '').trim();
  }

  /* ------------------------------------------------------------------------
     Image upload / compression
     ------------------------------------------------------------------------ */
  function updateImagePreview(input) {
    var wrap = input.closest('.img-field');
    if (!wrap) return;
    var preview = wrap.querySelector('[data-img-preview]');
    if (!preview) return;
    var url = String(input.value || '').trim();
    preview.innerHTML = url
      ? '<img src="' + escAttr(url) + '" alt="معاينة" loading="lazy">'
      : icon('image');
  }

  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('ملف غير صالح')); return; }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('تعذر قراءة الملف')); };
      reader.onload = function () {
        if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
          if (String(reader.result).length > 400000) {
            reject(new Error('حجم الملف كبير جدًا. استخدم صورة أصغر من 300 كيلوبايت.'));
            return;
          }
          resolve(reader.result);
          return;
        }
        var image = new Image();
        image.onerror = function () { reject(new Error('تعذر تحميل الصورة')); };
        image.onload = function () {
          var MAX_CHARS = 380000; // ≈380KB داخل قاعدة البيانات (الحد لكل السجل 1MB)
          var maxDim = 1400;
          var ratio = Math.min(1, maxDim / Math.max(image.width || 1, image.height || 1));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round((image.width || 1) * ratio));
          canvas.height = Math.max(1, Math.round((image.height || 1) * ratio));
          var ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas غير مدعوم')); return; }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          var isPng = file.type === 'image/png';
          var paint = function () {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (!isPng) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          };
          paint();
          var output = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.8);
          var guard = 0;
          while (output.length > MAX_CHARS && guard < 4) {
            guard += 1;
            canvas.width = Math.max(1, Math.round(canvas.width * 0.75));
            canvas.height = Math.max(1, Math.round(canvas.height * 0.75));
            paint();
            output = canvas.toDataURL('image/jpeg', 0.75);
          }
          if (output.length > MAX_CHARS) {
            reject(new Error('الصورة كبيرة جدًا حتى بعد الضغط. اختر صورة أصغر.'));
            return;
          }
          resolve(output);
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function handleImageFile(fileInput) {
    var file = fileInput.files && fileInput.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      UI.toast('اختر ملف صورة صالحًا (JPG / PNG / SVG / WebP).', 'error');
      fileInput.value = '';
      return;
    }
    var wrap = fileInput.closest('.img-field');
    var urlInput = wrap ? wrap.querySelector('[data-img-url]') : null;
    var preview = wrap ? wrap.querySelector('[data-img-preview]') : null;
    if (!urlInput) return;
    var previous = preview ? preview.innerHTML : '';
    if (preview) preview.innerHTML = '<span style="font-size:.6rem;color:var(--muted)">جارٍ المعالجة…</span>';

    compressImage(file).then(function (dataUrl) {
      if (window.NeonCloud && window.NeonCloud.isConfigured && window.NeonCloud.isConfigured() &&
          window.NeonCloud.uploadImage && window.NeonCloud.config && window.NeonCloud.config.useStorage) {
        return window.NeonCloud.uploadImage(dataUrl, 'admin').catch(function () { return dataUrl; });
      }
      return dataUrl;
    }).then(function (url) {
      urlInput.value = url;
      updateImagePreview(urlInput);
      UI.toast('تم تجهيز الصورة. لا تنسَ حفظ التغييرات.', 'success');
    }).catch(function (error) {
      console.error('[Admin] image', error);
      if (preview) preview.innerHTML = previous;
      UI.toast((error && error.message) ? error.message : 'تعذر معالجة الصورة. جرّب صورة أصغر.', 'error', 6500);
    }).then(function () {
      fileInput.value = '';
    });
  }

  function initImageTools() {
    document.addEventListener('input', function (event) {
      if (event.target && event.target.matches && event.target.matches('[data-img-url]')) {
        updateImagePreview(event.target);
      }
    });
    document.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      var upload = target.closest('[data-img-upload]');
      if (upload) {
        event.preventDefault();
        var wrap = upload.closest('.img-field');
        var file = wrap ? wrap.querySelector('[data-img-file]') : null;
        if (file) file.click();
        return;
      }
      var clear = target.closest('[data-img-clear]');
      if (clear) {
        event.preventDefault();
        var imageWrap = clear.closest('.img-field');
        var input = imageWrap ? imageWrap.querySelector('[data-img-url]') : null;
        if (input) {
          input.value = '';
          updateImagePreview(input);
          UI.toast('تم مسح الصورة. لا تنسَ حفظ التغييرات.', 'info');
        }
      }
    });
    document.addEventListener('change', function (event) {
      if (event.target && event.target.matches && event.target.matches('[data-img-file]')) {
        handleImageFile(event.target);
      }
    });
  }

  /* ------------------------------------------------------------------------
     Settings
     ------------------------------------------------------------------------ */
  function syncBrand() {
    var s = settings();
    qsa('[data-admin-site]').forEach(function (el) { el.textContent = s.siteName || 'نِيون ميديا'; });
    qsa('[data-admin-latin]').forEach(function (el) { el.textContent = s.brandLatin || 'NEON MEDIA'; });
    qsa('[data-admin-logo]').forEach(function (el) {
      if (s.logo) el.setAttribute('src', s.logo);
    });
    var loaderLogo = qs('#loaderLogo');
    if (loaderLogo && s.logo) loaderLogo.setAttribute('src', s.logo);
    var favicon = qs('link[rel="icon"]');
    if (favicon && (s.favicon || s.logo)) favicon.setAttribute('href', s.favicon || s.logo);
  }

  function renderSettings() {
    var grid = qs('#settingsGrid');
    if (!grid || !store) return;
    var s = settings();
    fieldSeq = 0;
    grid.innerHTML = SETTINGS_GROUPS.map(function (group) {
      var fields = group.fields.map(function (field) {
        return buildField(field, UI.getPath(s, field.key), 'setting');
      }).join('');
      return '<form class="settings-card' + (group.wide ? ' settings-card--wide' : '') + '" data-settings-group="' + group.id + '" novalidate>' +
        '<div class="settings-card__head">' +
          '<span class="settings-card__icon">' + icon(group.icon) + '</span>' +
          '<div><h2>' + esc(group.title) + '</h2><p>' + esc(group.desc) + '</p></div>' +
        '</div>' +
        '<div class="settings-card__body"><div class="field-grid">' + fields + '</div></div>' +
        '<div class="settings-card__foot">' +
          '<span>تُحفظ التغييرات فورًا في هذا المتصفح.</span>' +
          '<button type="submit" class="btn-neon btn-sm">' + icon('check') + ' حفظ</button>' +
        '</div>' +
      '</form>';
    }).join('');

    qsa('form[data-settings-group]').forEach(function (form) {
      form.addEventListener('submit', onSettingsSubmit);
    });

    // زر الإشعار التجريبي — يتحقق أن ntfy وصّل الإشعار لجوال المالك فعلًا.
    var pushForm = qs('form[data-settings-group="phonepush"]');
    if (pushForm && store && store.sendPhonePush) {
      var foot = pushForm.querySelector('.settings-card__foot');
      if (foot) {
        var testBtn = document.createElement('button');
        testBtn.type = 'button';
        testBtn.className = 'btn-neon btn-sm';
        testBtn.setAttribute('data-push-test', '');
        testBtn.innerHTML = icon('bell') + ' إرسال إشعار تجربة';
        testBtn.addEventListener('click', function () {
          var s = settings();
          if (!s.pushEnabled) { UI.toast('فعّل «إشعارات الجوال» واحفظ أولًا.', 'error', 5000); return; }
          if (!s.pushTopic) { UI.toast('اكتب اسم الموضوع السري واحفظ أولًا.', 'error', 5000); return; }
          testBtn.disabled = true;
          UI.toast('جاري الإرسال…', 'info', 3000);
          store.sendPhonePush('🔔 تجربة إشعارات نِيون ميديا', 'لو ده وصل لجوالك يبقى الإشعارات شغالة 100% — مبروك! 🎉').then(function (ok) {
            testBtn.disabled = false;
            if (ok) UI.toast('تم الإرسال — افتح جوالك وشوف الإشعار 📱', 'success', 7000);
            else UI.toast('لم يتم الإرسال. تأكد من صحة اسم الموضوع (حروف إنجليزية وأرقام فقط) ومن اتصال الإنترنت.', 'error', 7000);
          });
        });
        foot.appendChild(testBtn);
      }
    }
    // أزرار التحديث السريع لحالة التوفر — تضبط كل القيم تلقائيًا ثم تحفظ بنفس طلب الحفظ العادي.
    var availabilityForm = qs('form[data-settings-group="availability"]');
    if (availabilityForm) {
      var grid = availabilityForm.querySelector('.field-grid');
      if (grid) {
        var quick = document.createElement('div');
        quick.className = 'field full';
        quick.style.cssText = 'display:flex;gap:.55rem;flex-wrap:wrap;grid-column:1/-1;margin-top:.15rem;padding:.75rem;border:1px dashed rgba(53,245,160,.3);border-radius:14px;background:rgba(53,245,160,.04)';
        quick.innerHTML =
          '<button type="button" class="btn-neon btn-sm" data-avail-preset="on">🟢 متاح للعمل الآن</button>' +
          '<button type="button" class="btn-ghost btn-sm" data-avail-preset="off" style="border-color:rgba(255,110,110,.4);color:#ff9b9b">🔴 غير متاح حاليًا</button>' +
          '<div class="field-hint" style="width:100%;margin:0">زرار واحد: يضبط المفتاح + العنوان + السطر الفرعي ويحفظ فورًا — مفيش داعي تحرر يدوي.</div>';
        grid.appendChild(quick);
        quick.addEventListener('click', function (event) {
          var btn = event.target.closest('[data-avail-preset]');
          if (!btn) return;
          var on = btn.getAttribute('data-avail-preset') === 'on';
          var toggle = availabilityForm.querySelector('[data-setting="availableNow"]');
          var title = availabilityForm.querySelector('[data-setting="availableNowTitle"]');
          var sub = availabilityForm.querySelector('[data-setting="availableNowSub"]');
          if (toggle) toggle.checked = on;
          if (title) title.value = on ? 'متاح للعمل الآن' : 'غير متاح حاليًا';
          if (sub) sub.value = on ? 'نستقبل مشاريع جديدة' : 'بأعود لاستقبال الطلبات قريبًا';
          if (window.NeonUI) window.NeonUI.toast(on ? 'تم الضبط على «متاح للعمل الآن» — جاري الحفظ…' : 'تم الضبط على «غير متاح حاليًا» — جاري الحفظ…', 'info', 3000);
          if (availabilityForm.requestSubmit) availabilityForm.requestSubmit();
          else availabilityForm.dispatchEvent(new Event('submit', { cancelable: true }));
        });
      }
    }
    // مزامنة منتقي اللون (color picker) مع حقل Hex — مثل Photoshop #.
    qsa('.color-field').forEach(function (wrap) {
      var picker = wrap.querySelector('.color-field__swatch');
      var hex = wrap.querySelector('.color-field__hex');
      if (!picker || !hex) return;
      picker.addEventListener('input', function () { hex.value = picker.value; });
      hex.addEventListener('input', function () {
        var v = String(hex.value || '').trim();
        if (/^#[0-9a-fA-F]{3,8}$/.test(v)) picker.value = v;
      });
      hex.addEventListener('blur', function () {
        var v = String(hex.value || '').trim();
        if (!/^#[0-9a-fA-F]{3,8}$/.test(v)) hex.value = picker.value;
      });
    });

    state.settingsRendered = true;
  }

  function onSettingsSubmit(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var groupId = form.getAttribute('data-settings-group');
    var group = SETTINGS_GROUPS.filter(function (item) { return item.id === groupId; })[0];
    if (!group) return;

    form.classList.add('was-validated');
    if (!form.checkValidity()) {
      var invalid = form.querySelector(':invalid');
      if (invalid) invalid.focus();
      return;
    }

    var values = {};
    group.fields.forEach(function (field) {
      var el = form.querySelector('[data-setting="' + field.key + '"]');
      if (!el) return;
      values[field.key] = readFieldValue(field, el);
    });

    store.update(function (data) {
      Object.keys(values).forEach(function (path) {
        UI.setPath(data.settings, path, values[path]);
      });
    }, { source: 'settings' });

    syncBrand();
    UI.toast('تم حفظ «' + group.title + '» بنجاح.', 'success');
  }

  function renderSettingsIfNeeded(force) {
    if (!store) return;
    if (force || !state.settingsRendered) {
      renderSettings();
    }
  }

  /* ------------------------------------------------------------------------
     Editor
     ------------------------------------------------------------------------ */
  function openEditor(collection, id) {
    var cfg = COLLECTIONS[collection];
    if (!cfg || !store) return;
    var item = id ? store.getItem(collection, id) : {};
    if (!item) item = {};
    state.editing = { collection: collection, id: id || null };
    fieldSeq = 0;

    setText('#editorTitle', (id ? 'تعديل ' : 'إضافة ') + cfg.noun);
    setText('#editorSubtitle', cfg.editorHint || 'املأ الحقول ثم احفظ.');
    qs('#editorFields').innerHTML = cfg.fields.map(function (field) {
      return buildField(field, item[field.key], 'editor');
    }).join('');
    var form = qs('#editorForm');
    form.classList.remove('was-validated');
    showModal('editorModal');
    setTimeout(function () {
      var first = qs('#editorFields input, #editorFields textarea, #editorFields select');
      if (first) first.focus();
    }, 380);
  }

  function onEditorSubmit(event) {
    event.preventDefault();
    var editing = state.editing;
    if (!editing || !store) return;
    var cfg = COLLECTIONS[editing.collection];
    if (!cfg) return;
    var form = qs('#editorForm');
    form.classList.add('was-validated');
    if (!form.checkValidity()) {
      var invalid = form.querySelector(':invalid');
      if (invalid) invalid.focus();
      return;
    }

    var values = {};
    cfg.fields.forEach(function (field) {
      var el = form.querySelector('[data-field="' + field.key + '"]');
      if (!el) return;
      values[field.key] = readFieldValue(field, el);
    });

    if (editing.id) {
      store.updateItem(editing.collection, editing.id, values);
      UI.toast('تم تحديث ' + cfg.noun + ' بنجاح.', 'success');
    } else {
      var list = store.get()[editing.collection] || [];
      values.order = list.length + 1;
      store.addItem(editing.collection, values);
      UI.toast('تمت إضافة ' + cfg.noun + ' بنجاح.', 'success');
      showView(editing.collection);
    }
    hideModal('editorModal');
    state.editing = null;
  }

  /* ------------------------------------------------------------------------
     Collection renderers
     ------------------------------------------------------------------------ */
  var VIEW_TITLES = {
    dashboard: 'نظرة عامة',
    services: 'الخدمات',
    works: 'الأعمال',
    testimonials: 'آراء العملاء',
    clients: 'عملاؤنا',
    packages: 'الباقات',
    video: 'الفيديو الترويجي',
    payments: 'طرق الدفع',
    faqs: 'الأسئلة الشائعة',
    orders: 'الطلبات',
    messages: 'الرسائل',
    customers: 'قاعدة العملاء',
    notifications: 'الإشعارات',
    banners: 'بانرات العروض',
    popups: 'النوافذ المنبثقة',
    templates: 'الرسائل الجاهزة',
    reports: 'التقارير',
    settings: 'إعدادات الموقع',
    design: 'التصميم والألوان',
    seo: 'SEO — تحسين البحث',
    security: 'الأمان',
    backup: 'النسخ الاحتياطي',
    cloud: 'المزامنة السحابية'
  };

  function shortText(value, max) {
    var text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    if (text.length <= max) return text;
    return text.slice(0, Math.max(1, max - 1)).trim() + '…';
  }

  function multiline(value) {
    return esc(value).replace(/\r?\n/g, '<br>');
  }

  function chipHtml(text, variant, iconName) {
    if (text === undefined || text === null || text === '') return '';
    return '<span class="chip ' + (variant || '') + '">' +
      (iconName ? icon(iconName) : '') + esc(text) + '</span>';
  }

  function notificationTypeLabel(type) {
    var found = NOTIFICATION_TYPES.filter(function (item) { return item.value === type; })[0];
    return found ? found.label : 'تنبيه عام';
  }

  function notificationTypeClass(type) {
    return 'notif-type' + (type && type !== 'info' ? ' notif-type--' + type : '');
  }

  function serviceIcon(name) {
    var map = {
      palette: 'star',
      instagram: 'image',
      camera: 'image',
      menu: 'clipboard',
      barcode: 'clipboard',
      map: 'home',
      content: 'clipboard',
      social: 'layers',
      ads: 'layers',
      building: 'home',
      'camera-home': 'image',
      food: 'help',
      invoice: 'clipboard',
      invitation: 'mail',
      megaphone: 'layers',
      print: 'clipboard'
    };
    return map[name] || 'layers';
  }

  function paymentIcon(type) {
    var map = {
      instapay: 'card',
      wallet: 'card',
      bank: 'database',
      paypal: 'card',
      card: 'card',
      cash: 'bag',
      other: 'card'
    };
    return map[type] || 'card';
  }

  function paymentTypeLabel(type) {
    var found = PAYMENT_TYPES.filter(function (item) { return item.value === type; })[0];
    return found ? found.label : (type || 'أخرى');
  }

  function campaignStatsOf(id) {
    return (store.get().campaignStats || {})[id] || {};
  }

  function campaignCtr(stats) {
    var impressions = Number(stats.impressions) || 0;
    var clicks = Number(stats.clicks) || 0;
    return impressions ? Math.round((clicks / impressions) * 1000) / 10 : 0;
  }

  function campaignStatChips(id) {
    var stats = campaignStatsOf(id);
    var impressions = Number(stats.impressions) || 0;
    var clicks = Number(stats.clicks) || 0;
    var dismissals = Number(stats.dismissals) || 0;
    var ctr = campaignCtr(stats);
    return chipHtml(impressions + ' ظهور') +
      chipHtml(clicks + ' نقرة', 'chip--accent') +
      chipHtml('CTR ' + ctr + '%', ctr > 0 ? 'chip--green' : 'chip--muted') +
      (dismissals ? chipHtml(dismissals + ' إغلاق', 'chip--muted') : '');
  }

  function targetChips(item) {
    var pages = { all: 'كل الصفحات', home: 'الرئيسية', contact: 'التواصل' }[item.pages || 'all'] || 'كل الصفحات';
    var devices = { all: 'كل الأجهزة', mobile: 'موبايل', desktop: 'كمبيوتر' }[item.devices || 'all'] || 'كل الأجهزة';
    return chipHtml(pages, 'chip--accent') + chipHtml(devices);
  }

  function scheduleChip(item) {
    if (!item.startAt && !item.endAt) return chipHtml('دائم', 'chip--green');
    return chipHtml((item.startAt || '…') + ' → ' + (item.endAt || '…'));
  }

  function popupTriggerLabel(item) {
    var trigger = item.trigger || 'delay';
    if (trigger === 'scroll') return 'تمرير ' + (Number(item.scrollDepth) || 50) + '%';
    if (trigger === 'exit') return 'مغادرة الصفحة';
    return 'بعد ' + (Number(item.delay) || 0) + ' ثانية';
  }

  function popupFrequencyLabel(value) {
    var found = POPUP_FREQUENCIES.filter(function (item) { return item.value === value; })[0];
    return found ? found.label : 'مرة واحدة لكل زائر';
  }

  function clearCampaignStats(collection) {
    var cleared = false;
    store.update(function (data) {
      (data[collection] || []).forEach(function (item) {
        if (data.campaignStats && data.campaignStats[item.id]) {
          delete data.campaignStats[item.id];
          cleared = true;
        }
      });
    }, { source: 'campaign-stats' });
    return cleared;
  }

  function itemLabel(collection, item) {
    if (!item) return '';
    if (collection === 'orders') return item.id || '';
    if (collection === 'messages') return item.name || item.id || '';
    if (collection === 'faqs') return item.question || '';
    if (collection === 'testimonials') return item.name || '';
    return item.title || item.name || item.id || '';
  }

  function statusChip(status, value) {
    var map = {
      'جديد': 'chip--amber',
      'قيد التنفيذ': 'chip--accent',
      'مكتمل': 'chip--green',
      'ملغي': 'chip--muted',
      'مقروء': 'chip--accent',
      'تم الرد': 'chip--green'
    };
    return chipHtml(value || status || '—', map[status] || '');
  }

  function emptyState(message, iconName) {
    return '<div class="empty-state">' + icon(iconName || 'layers') + '<div>' + esc(message) + '</div></div>';
  }

  function activeSwitch(collection, item) {
    return '<label class="switch" title="إظهار / إخفاء في الموقع">' +
      '<input type="checkbox" data-toggle-active="' + escAttr(item.id) + '" data-collection="' + escAttr(collection) + '"' +
      (item.active !== false ? ' checked' : '') + '>' +
      '<span class="switch__track"></span>' +
      '</label>';
  }

  function actionButton(action, label, iconName, collection, id, dir, extraClass) {
    var attrs = ' data-action="' + escAttr(action) + '"' +
      ' data-collection="' + escAttr(collection) + '"' +
      ' data-id="' + escAttr(id) + '"';
    if (dir) attrs += ' data-dir="' + escAttr(dir) + '"';
    return '<button type="button" class="row-btn' + (extraClass ? ' ' + extraClass : '') + '"' + attrs +
      ' aria-label="' + escAttr(label) + '" title="' + escAttr(label) + '">' + icon(iconName) + '</button>';
  }

  function standardActions(collection, item) {
    var reset = collection === 'banners' || collection === 'popups'
      ? actionButton('reset-stats', 'تصفير إحصائيات الحملة', 'refresh', collection, item.id)
      : '';
    return activeSwitch(collection, item) +
      reset +
      actionButton('move', 'تحريك لأعلى', 'up', collection, item.id, 'up') +
      actionButton('move', 'تحريك لأسفل', 'down', collection, item.id, 'down') +
      actionButton('edit', 'تعديل', 'edit', collection, item.id) +
      actionButton('delete', 'حذف', 'trash', collection, item.id, '', 'row-btn--danger');
  }

  function collectionRow(collection, item) {
    var thumb = '';
    var body = '';
    var actions = standardActions(collection, item);

    if (collection === 'services') {
      var serviceImage = item.image
        ? '<img src="' + escAttr(item.image) + '" alt="" loading="lazy">'
        : icon(serviceIcon(item.icon));
      thumb = '<div class="data-thumb">' + serviceImage + '</div>';
      var servicePrice = money(item.price);
      var serviceMeta = (item.priceNote ? item.priceNote + ' ' : '') + servicePrice + (item.unit ? ' ' + item.unit : '');
      body = '<h3>' + esc(item.title || 'بدون عنوان') + (item.badge ? chipHtml(item.badge, 'chip--pink') : '') +
        (item.featured ? chipHtml('مميزة', 'chip--accent') : '') + '</h3>' +
        '<p>' + esc(shortText(item.short || item.description || 'لا يوجد وصف.', 150)) + '</p>' +
        '<div class="data-chips">' +
          (item.category ? chipHtml(item.category, 'chip--accent') : '') +
          chipHtml(serviceMeta) +
          (item.duration ? chipHtml(item.duration) : '') +
          (Array.isArray(item.features) && item.features.length ? chipHtml(item.features.length + ' ميزة') : '') +
          (item.active === false ? chipHtml('مخفية', 'chip--muted') : '') +
        '</div>';
    } else if (collection === 'works') {
      var workImage = item.image
        ? '<img src="' + escAttr(item.image) + '" alt="" loading="lazy">'
        : icon('image');
      thumb = '<div class="data-thumb data-thumb--wide">' + workImage + '</div>';
      body = '<h3>' + esc(item.title || 'بدون عنوان') + (item.featured ? chipHtml('مميز', 'chip--pink') : '') + '</h3>' +
        '<p>' + esc(shortText(item.description || 'لا يوجد وصف.', 150)) + '</p>' +
        '<div class="data-chips">' +
          (item.category ? chipHtml(item.category, 'chip--accent') : '') +
          (item.client ? chipHtml(item.client) : '') +
          (item.year ? chipHtml(item.year) : '') +
          (Array.isArray(item.tags) ? item.tags.slice(0, 3).map(function (tag) { return chipHtml(tag); }).join('') : '') +
          (item.active === false ? chipHtml('مخفي', 'chip--muted') : '') +
        '</div>';
    } else if (collection === 'testimonials') {
      var avatar = item.avatar
        ? '<img src="' + escAttr(item.avatar) + '" alt="" loading="lazy">'
        : '<span class="data-thumb__letter">' + esc((item.name || '؟').trim().charAt(0)) + '</span>';
      thumb = '<div class="data-thumb data-thumb--round">' + avatar + '</div>';
      var rating = Math.max(1, Math.min(5, Number(item.rating) || 5));
      body = '<h3>' + esc(item.name || 'بدون اسم') + chipHtml('★'.repeat(rating), 'chip--amber') + '</h3>' +
        '<p>' + esc(shortText(item.text || 'لا يوجد نص.', 150)) + '</p>' +
        '<div class="data-chips">' +
          (item.role ? chipHtml(item.role) : '') +
          (item.company ? chipHtml(item.company, 'chip--accent') : '') +
          (item.featured ? chipHtml('مميز', 'chip--pink') : '') +
          (item.active === false ? chipHtml('مخفي', 'chip--muted') : '') +
        '</div>';
    } else if (collection === 'clients') {
      var clientLogo = item.logo
        ? '<img src="' + escAttr(item.logo) + '" alt="" loading="lazy">'
        : '<span class="data-thumb__letter">' + esc((item.name || '؟').trim().charAt(0)) + '</span>';
      thumb = '<div class="data-thumb data-thumb--round">' + clientLogo + '</div>';
      body = '<h3>' + esc(item.name || 'بدون اسم') + (item.active === false ? chipHtml('مخفي', 'chip--muted') : '') + '</h3>' +
        '<div class="data-chips">' +
          (item.logo ? chipHtml('شعار مرفوع', 'chip--green') : chipHtml('بالاسم فقط')) +
          (item.url ? chipHtml('رابط موقع', 'chip--accent') : '') +
        '</div>';
    } else if (collection === 'packages') {
      thumb = '<div class="data-thumb">' + icon('box') + '</div>';
      body = '<h3>' + esc(item.name || 'بدون اسم') + (item.badge ? chipHtml(item.badge, 'chip--pink') : '') +
        (item.highlighted ? chipHtml('مميزة', 'chip--accent') : '') + '</h3>' +
        '<p>' + esc(shortText(item.subtitle || 'لا يوجد وصف.', 150)) + '</p>' +
        '<div class="data-chips">' +
          chipHtml(money(item.price) + (item.period ? ' ' + item.period : ''), 'chip--green') +
          (Array.isArray(item.features) && item.features.length ? chipHtml(item.features.length + ' ميزة') : '') +
          (item.active === false ? chipHtml('مخفية', 'chip--muted') : '') +
        '</div>';
    } else if (collection === 'payments') {
      thumb = '<div class="data-thumb">' + icon(paymentIcon(item.type)) + '</div>';
      body = '<h3>' + esc(item.name || 'بدون اسم') + '</h3>' +
        '<p>' + esc(shortText(item.instructions || item.value || 'لا توجد تعليمات.', 150)) + '</p>' +
        '<div class="data-chips">' +
          chipHtml(paymentTypeLabel(item.type), 'chip--accent') +
          (item.value ? chipHtml(shortText(item.value, 34)) : '') +
          (item.link ? chipHtml('رابط دفع', 'chip--green') : '') +
          (item.active === false ? chipHtml('متوقفة', 'chip--muted') : '') +
        '</div>';
    } else if (collection === 'faqs') {
      thumb = '<div class="data-thumb">' + icon('help') + '</div>';
      body = '<h3>' + esc(item.question || 'بدون سؤال') + '</h3>' +
        '<p>' + esc(shortText(item.answer || 'لا توجد إجابة.', 170)) + '</p>' +
        '<div class="data-chips">' +
          chipHtml(item.active === false ? 'مخفي' : 'ظاهر', item.active === false ? 'chip--muted' : 'chip--green') +
        '</div>';
    } else if (collection === 'notifications') {
      thumb = '<div class="data-thumb">' + icon(item.type === 'offer' ? 'star' : item.type === 'alert' ? 'alert' : 'mail') + '</div>';
      body = '<h3>' + esc(item.title || 'بدون عنوان') +
          '<span class="' + notificationTypeClass(item.type) + '">' + esc(notificationTypeLabel(item.type)) + '</span>' +
          (item.pinned ? chipHtml('مثبت', 'chip--amber') : '') +
        '</h3>' +
        '<p>' + esc(shortText(item.message || 'لا يوجد نص.', 170)) + '</p>' +
        '<div class="data-chips">' +
          (item.link ? chipHtml(shortText(item.link, 30), 'chip--accent') : '') +
          (item.startAt || item.endAt ? chipHtml((item.startAt || '…') + ' → ' + (item.endAt || '…')) : chipHtml('دائم', 'chip--green')) +
          chipHtml(fmtDate(item.createdAt)) +
          (item.active === false ? chipHtml('مخفي', 'chip--muted') : '') +
        '</div>';
    } else if (collection === 'banners') {
      var bannerImage = item.image
        ? '<img src="' + escAttr(item.image) + '" alt="" loading="lazy">'
        : icon('layers');
      thumb = '<div class="data-thumb">' + bannerImage + '</div>';
      body = '<h3>' + esc(item.title || 'بدون عنوان') +
          (Number(item.priority) ? chipHtml('أولوية ' + Number(item.priority), 'chip--amber') : '') +
          (item.active === false ? chipHtml('متوقف', 'chip--muted') : '') +
        '</h3>' +
        '<p>' + esc(shortText(item.text || 'لا يوجد نص إضافي.', 160)) + '</p>' +
        '<div class="data-chips">' +
          (item.kicker ? chipHtml(item.kicker, 'chip--accent') : '') +
          (item.code ? chipHtml('كود ' + item.code) : '') +
          targetChips(item) +
          scheduleChip(item) +
          (item.dismissible === false ? chipHtml('بدون زر إغلاق', 'chip--muted') : '') +
          campaignStatChips(item.id) +
        '</div>';
    } else if (collection === 'popups') {
      thumb = '<div class="data-thumb">' + icon(item.trigger === 'exit' ? 'logout' : item.trigger === 'scroll' ? 'down' : 'star') + '</div>';
      body = '<h3>' + esc(item.title || 'بدون عنوان') +
          (Number(item.priority) ? chipHtml('أولوية ' + Number(item.priority), 'chip--amber') : '') +
          (item.active === false ? chipHtml('متوقفة', 'chip--muted') : '') +
        '</h3>' +
        '<p>' + esc(shortText(item.text || 'لا يوجد نص إضافي.', 160)) + '</p>' +
        '<div class="data-chips">' +
          chipHtml(popupTriggerLabel(item), 'chip--accent') +
          chipHtml(popupFrequencyLabel(item.frequency)) +
          targetChips(item) +
          campaignStatChips(item.id) +
        '</div>';
    } else if (collection === 'templates') {
      thumb = '<div class="data-thumb">' + icon('clipboard') + '</div>';
      body = '<h3>' + esc(item.title || 'بدون اسم') + '</h3>' +
        '<p>' + esc(shortText(item.text || 'لا يوجد نص.', 180)) + '</p>' +
        '<div class="data-chips">' +
          chipHtml(item.active === false ? 'غير متاح' : 'متاح في الحملات', item.active === false ? 'chip--muted' : 'chip--green') +
        '</div>';
    }

    return '<article class="data-row' + (collection === 'notifications' ? ' notif-row' : '') + (item.active === false ? ' is-inactive' : '') + '">' +
      thumb +
      '<div class="data-body">' + body + '</div>' +
      '<div class="row-actions">' + actions + '</div>' +
      '</article>';
  }

  function refreshFilterOptions(collection) {
    var cfg = COLLECTIONS[collection];
    var select = qs('#filter-' + collection);
    if (!cfg || !cfg.filterKey || !select) return;
    var list = store.get()[collection] || [];
    var categories = unique(list.map(function (item) { return item[cfg.filterKey]; }).filter(Boolean));
    var signature = categories.join('|');
    if (select.dataset.signature === signature) return;
    select.dataset.signature = signature;
    var current = select.value;
    select.innerHTML = '<option value="">كل التصنيفات</option>' + categories.map(function (category) {
      return '<option value="' + escAttr(category) + '">' + esc(category) + '</option>';
    }).join('');
    if (categories.indexOf(current) !== -1) {
      select.value = current;
    } else {
      select.value = '';
      state.filter[collection] = '';
    }
  }

  function collectionMatches(collection, item) {
    var cfg = COLLECTIONS[collection];
    if (!cfg) return true;
    var search = String(state.search[collection] || '').toLowerCase().trim();
    var filter = state.filter[collection] || '';
    if (filter && String(item[cfg.filterKey] || '') !== filter) return false;
    if (!search) return true;
    var keys = cfg.searchKeys || Object.keys(item);
    var haystack = keys.map(function (key) {
      var value = UI.getPath(item, key);
      return Array.isArray(value) ? value.join(' ') : (value == null ? '' : value);
    }).join(' ');
    return haystack.toLowerCase().indexOf(search) !== -1;
  }

  function renderCampaignKpis(collection) {
    var el = qs(collection === 'banners' ? '#bannerKpis' : '#popupKpis');
    if (!el) return;
    var list = store.get()[collection] || [];
    var active = list.filter(function (item) { return item.active !== false; }).length;
    var impressions = 0;
    var clicks = 0;
    var dismissals = 0;
    list.forEach(function (item) {
      var stats = campaignStatsOf(item.id);
      impressions += Number(stats.impressions) || 0;
      clicks += Number(stats.clicks) || 0;
      dismissals += Number(stats.dismissals) || 0;
    });
    var ctr = impressions ? Math.round((clicks / impressions) * 1000) / 10 : 0;
    el.innerHTML = [
      statCard('layers', collection === 'banners' ? 'إجمالي البانرات' : 'إجمالي النوافذ', list.length, 'عنصر', active + ' نشط', 'violet', list.length === 0),
      statCard('eye', 'مرات الظهور', impressions, '', 'محفوظة محليًا في هذا المتصفح', '', impressions === 0),
      statCard('plus', 'النقرات', clicks, '', 'نقرات أزرار الحملات', 'green', clicks === 0),
      statCard('star', 'نسبة النقر CTR', ctr + '%', '', dismissals + ' إغلاق', 'pink', impressions === 0)
    ].join('');
  }

  function renderCollection(collection) {
    if (collection === 'customers') { renderCustomers(); return; }
    if (collection === 'banners' || collection === 'popups') renderCampaignKpis(collection);
    var listEl = qs('#list-' + collection);
    var countEl = qs('#count-' + collection);
    if (!listEl) return;
    var list = store.get()[collection] || [];
    refreshFilterOptions(collection);
    var filtered = list.filter(function (item) { return collectionMatches(collection, item); });
    listEl.innerHTML = filtered.length
      ? filtered.map(function (item) { return collectionRow(collection, item); }).join('')
      : emptyState('لا توجد عناصر مطابقة. أضف عنصرًا جديدًا أو غيّر البحث.', 'plus');
    if (countEl) {
      countEl.textContent = filtered.length === list.length
        ? list.length + ' عنصر'
        : filtered.length + ' من ' + list.length;
    }
  }

  /* ------------------------------------------------------------------------
     Customers / loyalty
     ------------------------------------------------------------------------ */
  var DAY_MS = 86400000;

  function daysSince(value) {
    if (!value) return Infinity;
    var time = new Date(value).getTime();
    if (isNaN(time)) return Infinity;
    return Math.floor((Date.now() - time) / DAY_MS);
  }

  function customerMatches(customer) {
    var search = String(state.search.customers || '').toLowerCase().trim();
    var filter = state.filter.customers || '';
    var stats = store.customerStats(customer);
    if (filter === 'repeat' && stats.orders < 2) return false;
    if (filter === 'points' && Number(customer.points || 0) <= 0) return false;
    if (filter === 'new' && daysSince(customer.createdAt) > 30) return false;
    if (filter === 'inactive') {
      if (!stats.lastOrderAt || daysSince(stats.lastOrderAt) <= 30) return false;
    }
    if (!search) return true;
    return [customer.name, customer.phone, customer.email, customer.notes, (customer.tags || []).join(' ')]
      .join(' ').toLowerCase().indexOf(search) !== -1;
  }

  function pointsChip(points) {
    return '<span class="customer-points' + (Number(points) > 0 ? '' : ' customer-points--zero') + '">' +
      icon('star') + (Number(points) || 0) + '</span>';
  }

  function renderCustomerKpis(list) {
    var el = qs('#customerKpis');
    if (!el) return;
    var totalPoints = 0;
    var repeat = 0;
    var spent = 0;
    list.forEach(function (customer) {
      totalPoints += Number(customer.points || 0);
      var stats = store.customerStats(customer);
      spent += stats.spent;
      if (stats.orders > 1) repeat += 1;
    });
    el.innerHTML = [
      statCard('users', 'إجمالي العملاء', list.length, 'عميل', 'محفوظون في قاعدة البيانات', 'violet', list.length === 0),
      statCard('bag', 'عملاء متكررون', repeat, 'عميل', 'أكثر من طلب واحد', '', repeat === 0),
      statCard('star', 'نقاط الولاء المستحقة', totalPoints, 'نقطة', 'قابلة للاستبدال عند الشراء', '', totalPoints === 0),
      statCard('card', 'إجمالي قيمة العملاء', money(spent), '', 'من الطلبات غير الملغاة', 'green')
    ].join('');
  }

  function renderCustomers() {
    var body = qs('#customersTableBody');
    var countEl = qs('#count-customers');
    if (!body) return;
    var all = store.get().customers || [];
    renderCustomerKpis(all);
    var list = all.filter(customerMatches);
    if (!list.length) {
      body.innerHTML = '<tr><td colspan="6">' + emptyState('لا يوجد عملاء مطابقون. يظهر العميل تلقائيًا عند أول طلب أو رسالة.', 'users') + '</td></tr>';
    } else {
      body.innerHTML = list.map(function (customer) {
        var stats = store.customerStats(customer);
        var points = Number(customer.points || 0);
        var wa = waLink(customer.phone, 'مرحبًا ' + (customer.name || '') + ' 👋');
        return '<tr>' +
          '<td><div class="cell-strong">' + esc(customer.name || 'بدون اسم') +
            (customer.consent === false ? ' ' + chipHtml('لا يرغب بالرسائل', 'chip--muted') : '') + '</div>' +
            '<div class="cell-muted" dir="ltr">' + esc(customer.phone || '—') + '</div></td>' +
          '<td><strong>' + stats.orders + '</strong></td>' +
          '<td class="cell-amount">' + esc(money(stats.spent)) + '</td>' +
          '<td>' + pointsChip(points) + '</td>' +
          '<td><div class="cell-muted">' + (stats.lastOrderAt ? esc(fmtDate(stats.lastOrderAt)) : 'لا يوجد شراء') + '</div>' +
            (customer.nextFollowUp ? '<div class="cell-muted">متابعة: ' + esc(customer.nextFollowUp) + '</div>' : '') + '</td>' +
          '<td class="cell-actions"><div class="row-actions" style="justify-content:flex-end">' +
            actionButton('detail', 'ملف العميل', 'eye', 'customers', customer.id) +
            '<button type="button" class="row-btn" data-use-points="' + escAttr(customer.id) + '" aria-label="استخدام نقاط" title="استخدام نقاط الولاء">' + icon('star') + '</button>' +
            (wa !== '#' ? '<a class="row-btn row-btn--wa" href="' + escAttr(wa) + '" target="_blank" rel="noopener noreferrer" aria-label="واتساب" title="واتساب">' + icon('whatsapp') + '</a>' : '') +
            actionButton('edit', 'تعديل', 'edit', 'customers', customer.id) +
            actionButton('delete', 'حذف العميل', 'trash', 'customers', customer.id, '', 'row-btn--danger') +
          '</div></td>' +
        '</tr>';
      }).join('');
    }
    if (countEl) countEl.textContent = list.length === all.length ? all.length + ' عميل' : list.length + ' من ' + all.length;
  }

  function openCustomerDetail(id) {
    var customer = store.getItem('customers', id);
    if (!customer) return;
    var stats = store.customerStats(customer);
    setText('#detailTitle', 'ملف العميل');
    setText('#detailSubtitle', (customer.name || '') + ' · ' + fmtDate(customer.createdAt));
    qs('#detailBody').innerHTML = '<div class="security-list">' +
      detailItem('الاسم', customer.name, 'star') +
      detailItem('الهاتف', customer.phone, 'whatsapp') +
      detailItem('البريد', customer.email || 'غير مسجل', 'mail') +
      detailItem('عدد الطلبات', String(stats.orders), 'bag') +
      detailItem('إجمالي الشراء', money(stats.spent), 'card') +
      detailItem('آخر طلب', stats.lastOrderAt ? fmtDate(stats.lastOrderAt, true) : 'لا يوجد', 'help') +
      detailItem('نقاط الولاء', String(Number(customer.points || 0)), 'star') +
      detailItem('موعد المتابعة', customer.nextFollowUp || 'غير محدد', 'clipboard') +
      (Array.isArray(customer.tags) && customer.tags.length ? detailItem('الوسوم', customer.tags.join('، '), 'layers') : '') +
      (customer.notes ? detailItem('ملاحظات', customer.notes, 'clipboard') : '') +
      detailItem('الموافقة على الرسائل', customer.consent === false ? 'غير موافق' : 'موافق', 'check') +
    '</div>';
    var btn = qs('#detailWaBtn');
    if (btn) {
      var href = waLink(customer.phone, 'مرحبًا ' + (customer.name || '') + ' 👋');
      if (href === '#') setHidden(btn, true);
      else { btn.href = href; setHidden(btn, false); }
    }
    showModal('detailModal');
  }

  function openPoints(customerId) {
    var customer = store.getItem('customers', customerId);
    if (!customer) return;
    state.pointsCustomer = customerId;
    setText('#pointsInfo', (customer.name || 'العميل') + ' — رصيده ' + Number(customer.points || 0) + ' نقطة.');
    var input = qs('#pointsAmount');
    var balance = Number(customer.points || 0);
    if (input) {
      input.value = Math.min(100, balance) || 1;
      input.max = String(balance || 1);
    }
    showModal('pointsModal');
  }

  function savePoints() {
    var id = state.pointsCustomer;
    var input = qs('#pointsAmount');
    if (!id || !input) return;
    var amount = Math.max(1, Math.floor(Number(input.value) || 0));
    if (!store.usePoints(id, amount)) {
      if (window.NeonUI) window.NeonUI.toast('لا توجد نقاط كافية للخصم.', 'error');
      return;
    }
    if (window.NeonUI) window.NeonUI.toast('تم خصم ' + amount + ' نقطة بنجاح.', 'success');
    state.pointsCustomer = null;
    hideModal('pointsModal');
    renderCustomers();
    refreshChrome();
  }

  function syncOldCustomers() {
    var before = (store.get().customers || []).length;
    store.update(function (data) {
      var seen = {};
      (data.customers || []).forEach(function (customer) {
        seen[store.normalizePhone(customer.phone)] = true;
      });
      function add(info) {
        var key = store.normalizePhone(info.phone);
        if (!key || seen[key]) return;
        seen[key] = true;
        (data.customers = data.customers || []).push({
          id: store.uid('cus'),
          name: String(info.name || '').trim(),
          phone: String(info.phone || '').trim(),
          email: String(info.email || '').trim(),
          tags: [],
          points: 0,
          totalPointsEarned: 0,
          totalPointsRedeemed: 0,
          notes: '',
          consent: true,
          nextFollowUp: '',
          active: true,
          createdAt: info.createdAt || new Date().toISOString()
        });
      }
      (data.orders || []).forEach(add);
      (data.messages || []).forEach(add);
    }, { source: 'customers' });
    var added = (store.get().customers || []).length - before;
    if (window.NeonUI) {
      window.NeonUI.toast(added > 0 ? 'تمت إضافة ' + added + ' عميل من الطلبات والرسائل.' : 'كل العملاء القدامى موجودون بالفعل.', added > 0 ? 'success' : 'info');
    }
    renderCustomers();
    refreshChrome();
  }

  /* ------------------------------------------------------------------------
     Reports
     ------------------------------------------------------------------------ */
  function toISODate(date) {
    var d = new Date(date);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function reportBounds() {
    var fromEl = qs('#reportFrom');
    var toEl = qs('#reportTo');
    var from = fromEl && fromEl.value ? new Date(fromEl.value + 'T00:00:00').getTime() : null;
    var to = toEl && toEl.value ? new Date(toEl.value + 'T23:59:59').getTime() : null;
    if (from !== null && to !== null && from > to) {
      var swap = from;
      from = to;
      to = swap;
    }
    return { from: from, to: to, fromText: fromEl ? fromEl.value : '', toText: toEl ? toEl.value : '' };
  }

  function inReportRange(value, bounds) {
    if (!value) return bounds.from === null && bounds.to === null;
    var time = new Date(value).getTime();
    if (isNaN(time)) return false;
    if (bounds.from !== null && time < bounds.from) return false;
    if (bounds.to !== null && time > bounds.to) return false;
    return true;
  }

  function reportOrders() {
    var bounds = reportBounds();
    return (store.get().orders || []).filter(function (order) {
      return inReportRange(order.createdAt, bounds);
    });
  }

  function updateReportRangeText() {
    var bounds = reportBounds();
    var text = bounds.from === null && bounds.to === null
      ? 'كل الفترات'
      : (bounds.fromText ? 'من ' + bounds.fromText : 'من البداية') + ' · ' + (bounds.toText ? 'إلى ' + bounds.toText : 'حتى اليوم');
    setText('#reportRangeText', text);
  }

  function setReportRange(mode) {
    var from = qs('#reportFrom');
    var to = qs('#reportTo');
    var today = new Date();
    if (mode === 'all') {
      if (from) from.value = '';
      if (to) to.value = '';
    } else if (mode === 'year') {
      if (from) from.value = today.getFullYear() + '-01-01';
      if (to) to.value = toISODate(today);
    } else {
      var days = Math.max(1, Number(mode) || 30);
      var start = new Date(today.getTime() - (days - 1) * DAY_MS);
      if (from) from.value = toISODate(start);
      if (to) to.value = toISODate(today);
    }
    qsa('[data-range]').forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-range') === mode);
    });
    renderReports();
  }

  function barRows(rows, emptyText) {
    if (!rows.length) return '<p class="cell-muted" style="margin:0">' + esc(emptyText || 'لا توجد بيانات في هذه الفترة.') + '</p>';
    var max = rows.reduce(function (maxValue, row) { return Math.max(maxValue, Number(row.value) || 0); }, 0) || 1;
    return '<div class="bar-chart">' + rows.map(function (row) {
      var percent = Math.max(2, Math.round((Number(row.value) || 0) / max * 100));
      return '<div class="bar-row">' +
        '<span class="bar-row__label" title="' + escAttr(row.label) + '">' + esc(row.label) + '</span>' +
        '<span class="bar-row__track"><span class="bar-row__fill" style="width:' + percent + '%"></span></span>' +
        '<span class="bar-row__value">' + esc(row.display != null ? row.display : row.value) + '</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  function groupBy(list, keyFn) {
    var map = {};
    list.forEach(function (item) {
      var key = keyFn(item) || 'غير محدد';
      if (!map[key]) map[key] = { label: key, count: 0, value: 0 };
      map[key].count += 1;
      map[key].value += Number(item.amount || 0);
    });
    return Object.keys(map).map(function (key) { return map[key]; });
  }

  function reportCard(title, desc, content) {
    return '<div class="report-card"><h3>' + esc(title) + '</h3><p>' + esc(desc) + '</p>' + content + '</div>';
  }

  function orderTrend() {
    var counts = {};
    (store.get().orders || []).forEach(function (order) {
      if (!order.createdAt) return;
      var key = String(order.createdAt).slice(0, 10);
      counts[key] = (counts[key] || 0) + 1;
    });
    var series = [];
    for (var i = 29; i >= 0; i--) {
      var key = toISODate(new Date(Date.now() - i * DAY_MS));
      series.push({ key: key, value: counts[key] || 0 });
    }
    var max = series.reduce(function (maxValue, day) { return Math.max(maxValue, day.value); }, 0) || 1;
    var bars = series.map(function (day) {
      var height = Math.max(2, Math.round(day.value / max * 100));
      return '<span class="trend-bar" style="height:' + height + '%" title="' + escAttr(day.key + ': ' + day.value + ' طلب') + '"></span>';
    }).join('');
    return '<div class="trend-chart">' + bars + '</div>' +
      '<div class="trend-labels"><span>' + esc(series[0].key.slice(5)) + '</span><span>اليوم</span></div>';
  }

  function renderOrdersReport(body) {
    var orders = reportOrders();
    var status = {};
    ORDER_STATUSES.forEach(function (value) { status[value] = 0; });
    orders.forEach(function (order) {
      var key = order.status || 'جديد';
      status[key] = (status[key] || 0) + 1;
    });
    var services = groupBy(orders, function (order) { return order.serviceTitle || order.service || 'غير محدد'; })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, 8)
      .map(function (group) { return { label: group.label, value: group.count, display: group.count + ' طلب' }; });
    body.innerHTML = '<div class="stat-grid">' +
      statCard('bag', 'إجمالي الطلبات', orders.length, 'طلب', 'داخل الفترة المحددة', 'violet', orders.length === 0) +
      statCard('plus', 'طلبات جديدة', status['جديد'] || 0, 'طلب', 'تحتاج متابعة', '', (status['جديد'] || 0) === 0) +
      statCard('check', 'طلبات مكتملة', status['مكتمل'] || 0, 'طلب', 'تم تسليمها', 'green', (status['مكتمل'] || 0) === 0) +
      statCard('x', 'طلبات ملغاة', status['ملغي'] || 0, 'طلب', 'خارج حساب الإيرادات', 'pink', (status['ملغي'] || 0) === 0) +
    '</div>' +
    '<div class="report-grid">' +
      reportCard('توزيع الطلبات حسب الحالة', 'نظرة سريعة على مراحل الطلبات.', barRows(ORDER_STATUSES.map(function (value) {
        return { label: value, value: status[value] || 0, display: (status[value] || 0) + ' طلب' };
      }))) +
      reportCard('أكثر الخدمات طلبًا', 'أعلى 8 خدمات داخل الفترة المحددة.', barRows(services, 'لا توجد طلبات في هذه الفترة.')) +
      reportCard('حركة الطلبات — آخر 30 يومًا', 'عدد الطلبات اليومية لكل الفترات.', orderTrend()) +
    '</div>';
  }

  function renderSalesReport(body) {
    var orders = reportOrders();
    var valid = orders.filter(function (order) { return order.status !== 'ملغي' && order.status !== 'مرفوض'; });
    var revenue = valid.reduce(function (sum, order) { return sum + Number(order.amount || 0); }, 0);
    var completed = valid.filter(function (order) { return order.status === 'مكتمل'; });
    var completedRevenue = completed.reduce(function (sum, order) { return sum + Number(order.amount || 0); }, 0);
    var average = valid.length ? revenue / valid.length : 0;

    var months = {};
    valid.forEach(function (order) {
      var key = String(order.createdAt || '').slice(0, 7) || 'غير محدد';
      months[key] = (months[key] || 0) + Number(order.amount || 0);
    });
    var monthRows = Object.keys(months).sort().slice(-8).map(function (key) {
      return { label: key, value: months[key], display: money(months[key]) };
    });

    var methods = groupBy(valid, function (order) { return order.paymentMethod || 'سيتم الاتفاق'; })
      .sort(function (a, b) { return b.value - a.value; })
      .slice(0, 8)
      .map(function (group) { return { label: group.label, value: group.value, display: money(group.value) }; });

    var customers = {};
    valid.forEach(function (order) {
      var key = store.normalizePhone(order.phone);
      if (!key) return;
      if (!customers[key]) customers[key] = { label: order.name || key, value: 0, count: 0 };
      customers[key].value += Number(order.amount || 0);
      customers[key].count += 1;
    });
    var topCustomers = Object.keys(customers).map(function (key) { return customers[key]; })
      .sort(function (a, b) { return b.value - a.value; })
      .slice(0, 8)
      .map(function (item) { return { label: item.label, value: item.value, display: money(item.value) }; });

    body.innerHTML = '<div class="stat-grid">' +
      statCard('card', 'إجمالي المبيعات', money(revenue), '', 'بدون الطلبات الملغاة', 'green', revenue === 0) +
      statCard('bag', 'طلبات محتسبة', valid.length, 'طلب', 'من إجمالي ' + orders.length, 'violet', valid.length === 0) +
      statCard('plus', 'متوسط قيمة الطلب', money(Math.round(average)), '', 'لكل طلب محتسب', '', valid.length === 0) +
      statCard('check', 'مبيعات مكتملة', money(completedRevenue), '', 'من الطلبات المكتملة', 'pink', completedRevenue === 0) +
    '</div>' +
    '<div class="report-grid">' +
      reportCard('المبيعات حسب الشهر', 'آخر 8 أشهر بها مبيعات داخل الفترة.', barRows(monthRows, 'لا توجد مبيعات في هذه الفترة.')) +
      reportCard('المبيعات حسب طريقة الدفع', 'أعلى طرق الدفع قيمة.', barRows(methods, 'لا توجد بيانات دفع.')) +
      reportCard('أفضل العملاء شراءً', 'أعلى 8 عملاء من حيث قيمة الطلبات.', barRows(topCustomers, 'لا يوجد عملاء بعد.')) +
    '</div>';
  }

  function renderCustomersReport(body) {
    var bounds = reportBounds();
    var all = store.get().customers || [];
    var inRange = all.filter(function (customer) { return inReportRange(customer.createdAt, bounds); });
    var repeat = 0;
    var points = 0;
    var spendRows = [];
    var inactive = [];
    all.forEach(function (customer) {
      var stats = store.customerStats(customer);
      points += Number(customer.points || 0);
      if (stats.orders > 1) repeat += 1;
      spendRows.push({ label: customer.name || customer.phone || 'بدون اسم', value: stats.spent, display: money(stats.spent) });
      if (stats.orders > 0 && (!stats.lastOrderAt || daysSince(stats.lastOrderAt) > 30)) {
        inactive.push({ label: customer.name || customer.phone || 'بدون اسم', value: daysSince(stats.lastOrderAt), display: stats.lastOrderAt ? 'منذ ' + daysSince(stats.lastOrderAt) + ' يوم' : 'لم يشترِ' });
        inactive[inactive.length - 1].last = stats.lastOrderAt;
      }
    });
    spendRows.sort(function (a, b) { return b.value - a.value; });
    inactive.sort(function (a, b) { return b.value - a.value; });
    var pointsRows = all.filter(function (customer) { return Number(customer.points || 0) > 0; })
      .map(function (customer) { return { label: customer.name || customer.phone || 'بدون اسم', value: Number(customer.points || 0), display: Number(customer.points || 0) + ' نقطة' }; })
      .sort(function (a, b) { return b.value - a.value; })
      .slice(0, 8);

    var followUps = all.filter(function (customer) { return Boolean(customer.nextFollowUp); })
      .sort(function (a, b) { return String(a.nextFollowUp).localeCompare(String(b.nextFollowUp)); })
      .slice(0, 8);
    var followHtml = followUps.length
      ? '<div class="mini-list">' + followUps.map(function (customer) {
          return '<div class="mini-item">' +
            '<div class="mini-item__icon">' + icon('clipboard') + '</div>' +
            '<div class="mini-item__body"><strong>' + esc(customer.name || 'بدون اسم') + '</strong>' +
              '<span dir="ltr">' + esc(customer.phone || '') + '</span></div>' +
            '<div class="mini-item__meta">' + chipHtml(customer.nextFollowUp, 'chip--amber') + '</div>' +
          '</div>';
        }).join('') + '</div>'
      : '<p class="cell-muted" style="margin:0">لا توجد متابعات مجدولة. أضف موعد متابعة من ملف العميل.</p>';

    body.innerHTML = '<div class="stat-grid">' +
      statCard('users', 'إجمالي العملاء', all.length, 'عميل', 'داخل قاعدة البيانات', 'violet', all.length === 0) +
      statCard('plus', 'عملاء جدد بالفترة', inRange.length, 'عميل', bounds.from === null && bounds.to === null ? 'كل الفترات' : 'حسب التاريخ المحدد', '', inRange.length === 0) +
      statCard('bag', 'عملاء متكررون', repeat, 'عميل', 'أكثر من طلب واحد', 'green', repeat === 0) +
      statCard('star', 'نقاط ولاء مستحقة', points, 'نقطة', 'التزاماتك تجاه العملاء', 'pink', points === 0) +
    '</div>' +
    '<div class="report-grid">' +
      reportCard('أفضل العملاء شراءً', 'أعلى 8 عملاء من حيث قيمة الطلبات.', barRows(spendRows.slice(0, 8), 'لا يوجد عملاء بعد.')) +
      reportCard('أرصدة نقاط الولاء', 'أعلى 8 أرصدة نقاط مستحقة.', barRows(pointsRows, 'لا توجد نقاط مستحقة.')) +
      reportCard('عملاء يحتاجون تنشيطًا', 'لم يشتروا منذ أكثر من 30 يومًا.', barRows(inactive.slice(0, 8), 'كل العملاء نشطون خلال 30 يومًا.')) +
      reportCard('متابعات قادمة', 'مواعيد المتابعة المسجلة في ملفات العملاء.', followHtml) +
    '</div>';
  }

  function campaignReportRows() {
    var rows = [];
    [
      { key: 'banners', type: 'بانر' },
      { key: 'popups', type: 'نافذة منبثقة' }
    ].forEach(function (group) {
      (store.get()[group.key] || []).forEach(function (item) {
        var stats = campaignStatsOf(item.id);
        rows.push({
          id: item.id,
          title: item.title || 'بدون عنوان',
          type: group.type,
          active: item.active !== false,
          impressions: Number(stats.impressions) || 0,
          clicks: Number(stats.clicks) || 0,
          dismissals: Number(stats.dismissals) || 0,
          ctr: campaignCtr(stats)
        });
      });
    });
    return rows;
  }

  function renderCampaignsReport(body) {
    var rows = campaignReportRows();
    var impressions = rows.reduce(function (sum, row) { return sum + row.impressions; }, 0);
    var clicks = rows.reduce(function (sum, row) { return sum + row.clicks; }, 0);
    var dismissals = rows.reduce(function (sum, row) { return sum + row.dismissals; }, 0);
    var ctr = impressions ? Math.round((clicks / impressions) * 1000) / 10 : 0;
    var table = '<div class="table-wrap"><table class="admin-table">' +
      '<thead><tr><th>الحملة</th><th>النوع</th><th>الحالة</th><th>الظهور</th><th>النقرات</th><th>الإغلاقات</th><th>CTR</th></tr></thead>' +
      '<tbody>' + (rows.length ? rows.map(function (row) {
        return '<tr>' +
          '<td><div class="cell-strong">' + esc(row.title) + '</div><div class="cell-muted" dir="ltr">' + esc(row.id) + '</div></td>' +
          '<td>' + chipHtml(row.type, 'chip--accent') + '</td>' +
          '<td>' + (row.active ? chipHtml('نشطة', 'chip--green') : chipHtml('متوقفة', 'chip--muted')) + '</td>' +
          '<td><strong>' + row.impressions + '</strong></td>' +
          '<td><strong>' + row.clicks + '</strong></td>' +
          '<td>' + row.dismissals + '</td>' +
          '<td>' + chipHtml(row.ctr + '%', row.ctr > 0 ? 'chip--green' : 'chip--muted') + '</td>' +
        '</tr>';
      }).join('') : '<tr><td colspan="7">' + emptyState('لا توجد حملات بعد. أضف بانرًا أو نافذة منبثقة من القائمة الجانبية.', 'layers') + '</td></tr>') +
      '</tbody></table></div>';

    body.innerHTML = '<div class="stat-grid">' +
      statCard('eye', 'مرات الظهور', impressions, '', 'إجمالي البانرات والنوافذ', 'violet', impressions === 0) +
      statCard('plus', 'النقرات', clicks, '', 'نقرات أزرار الحملات', 'green', clicks === 0) +
      statCard('star', 'نسبة النقر CTR', ctr + '%', '', 'النقرات ÷ مرات الظهور', '', impressions === 0) +
      statCard('x', 'الإغلاقات', dismissals, '', 'إغلاق يدوي من الزائر', 'pink', dismissals === 0) +
    '</div>' +
    '<div class="report-grid">' +
      reportCard('أداء الحملات', 'أرقام محفوظة محليًا في هذا المتصفح. لا يخضع هذا التقرير لفلتر التاريخ.', table) +
    '</div>';
  }

  function renderReports() {
    var body = qs('#reportBody');
    if (!body || !store) return;
    qsa('[data-report-tab]').forEach(function (button) {
      var active = button.getAttribute('data-report-tab') === state.report.tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    updateReportRangeText();
    if (state.report.tab === 'sales') renderSalesReport(body);
    else if (state.report.tab === 'customers') renderCustomersReport(body);
    else if (state.report.tab === 'campaigns') renderCampaignsReport(body);
    else renderOrdersReport(body);
  }

  function exportCustomersCsv() {
    var rows = [['الاسم', 'الهاتف', 'البريد', 'الطلبات', 'إجمالي الشراء', 'النقاط', 'آخر طلب', 'تاريخ الإضافة', 'المتابعة', 'الموافقة على الرسائل']];
    (store.get().customers || []).forEach(function (customer) {
      var stats = store.customerStats(customer);
      rows.push([customer.name, customer.phone, customer.email, stats.orders, stats.spent, customer.points || 0,
        stats.lastOrderAt || '', customer.createdAt || '', customer.nextFollowUp || '', customer.consent === false ? 'لا' : 'نعم']);
    });
    var csv = '\uFEFF' + rows.map(function (row) { return row.map(csvCell).join(','); }).join('\r\n');
    downloadFile('neon-customers-' + new Date().toISOString().slice(0, 10) + '.csv', csv, 'text/csv;charset=utf-8');
    if (window.NeonUI) window.NeonUI.toast('تم تصدير ' + (rows.length - 1) + ' عميل إلى CSV.', 'success');
  }

  function exportReportCsv() {
    var bounds = reportBounds();
    var rows = [];
    if (state.report.tab === 'campaigns') {
      rows.push(['الحملة', 'المعرّف', 'النوع', 'الحالة', 'مرات الظهور', 'النقرات', 'الإغلاقات', 'نسبة النقر %', 'آخر نشاط']);
      campaignReportRows().forEach(function (row) {
        var stats = campaignStatsOf(row.id);
        rows.push([row.title, row.id, row.type, row.active ? 'نشطة' : 'متوقفة', row.impressions, row.clicks, row.dismissals, row.ctr, stats.lastAt || '']);
      });
    } else if (state.report.tab === 'customers') {
      rows.push(['الاسم', 'الهاتف', 'البريد', 'الطلبات', 'إجمالي الشراء', 'النقاط', 'آخر طلب', 'تاريخ الإضافة', 'المتابعة', 'الموافقة']);
      (store.get().customers || []).filter(function (customer) { return inReportRange(customer.createdAt, bounds); })
        .forEach(function (customer) {
          var stats = store.customerStats(customer);
          rows.push([customer.name, customer.phone, customer.email, stats.orders, stats.spent, customer.points || 0,
            stats.lastOrderAt || '', customer.createdAt || '', customer.nextFollowUp || '', customer.consent === false ? 'لا' : 'نعم']);
        });
    } else {
      rows.push(['رقم الطلب', 'التاريخ', 'العميل', 'الهاتف', 'البريد', 'الخدمة', 'المبلغ', 'الحالة', 'طريقة الدفع', 'الملاحظات']);
      reportOrders().forEach(function (order) {
        rows.push([order.id, order.createdAt, order.name, order.phone, order.email, order.serviceTitle,
          order.amount, order.status, order.paymentMethod, order.notes]);
      });
    }
    var csv = '\uFEFF' + rows.map(function (row) { return row.map(csvCell).join(','); }).join('\r\n');
    downloadFile('neon-report-' + state.report.tab + '-' + new Date().toISOString().slice(0, 10) + '.csv', csv, 'text/csv;charset=utf-8');
    if (window.NeonUI) window.NeonUI.toast('تم تصدير التقرير إلى CSV.', 'success');
  }

  /* ------------------------------------------------------------------------
     WhatsApp campaigns
     ------------------------------------------------------------------------ */
  function campaignTemplateList() {
    return (store.get().templates || []).filter(function (template) { return template.active !== false; });
  }

  function campaignMessage(customer, text) {
    var brand = settings().siteName || 'نِيون ميديا';
    return String(text || '')
      .replace(/\{name\}/g, customer.name || 'عميلنا العزيز')
      .replace(/\{brand\}/g, brand);
  }

  function campaignAudienceList(audience) {
    var list = (store.get().customers || []).filter(function (customer) {
      return customer.active !== false && customer.consent !== false;
    });
    return list.filter(function (customer) {
      var stats = store.customerStats(customer);
      if (audience === 'repeat') return stats.orders > 1;
      if (audience === 'points') return Number(customer.points || 0) > 0;
      if (audience === 'new') return daysSince(customer.createdAt) <= 30;
      if (audience === 'inactive') return stats.orders > 0 && (!stats.lastOrderAt || daysSince(stats.lastOrderAt) > 30);
      return true;
    });
  }

  function renderCampaignList() {
    var listEl = qs('#campaignList');
    if (!listEl) return;
    var audienceEl = qs('#campaignAudience');
    var textEl = qs('#campaignText');
    var audience = audienceEl ? audienceEl.value : 'all';
    var text = textEl ? textEl.value : '';
    var customers = campaignAudienceList(audience);
    setText('#campaignCount', customers.length + ' عميل');
    state.campaignFirstLink = customers.length ? waLink(customers[0].phone, campaignMessage(customers[0], text)) : '';
    var first = qs('#campaignSendFirst');
    if (first) first.disabled = !state.campaignFirstLink || state.campaignFirstLink === '#';

    if (!customers.length) {
      listEl.innerHTML = '<div class="campaign-empty">لا يوجد عملاء في هذا الجمهور. جرّب جمهورًا آخر أو أضف عملاء.</div>';
      return;
    }
    listEl.innerHTML = customers.slice(0, 100).map(function (customer) {
      var href = waLink(customer.phone, campaignMessage(customer, text));
      return '<div class="campaign-item">' +
        '<div class="campaign-item__body"><strong>' + esc(customer.name || 'بدون اسم') + '</strong><span>' + esc(customer.phone || '') + '</span></div>' +
        (Number(customer.points || 0) ? pointsChip(customer.points) : '') +
        (href !== '#'
          ? '<a class="row-btn row-btn--wa" href="' + escAttr(href) + '" target="_blank" rel="noopener noreferrer" aria-label="إرسال واتساب" title="إرسال واتساب">' + icon('whatsapp') + '</a>'
          : '<span class="cell-muted">رقم غير صالح</span>') +
      '</div>';
    }).join('');
  }

  function openCampaign() {
    var templates = campaignTemplateList();
    var select = qs('#campaignTemplate');
    if (select) {
      select.innerHTML = templates.length
        ? templates.map(function (template) { return '<option value="' + escAttr(template.id) + '">' + esc(template.title || 'قالب') + '</option>'; }).join('')
        : '<option value="">لا توجد قوالب جاهزة — أضف قالبًا أولًا</option>';
    }
    var text = qs('#campaignText');
    if (text) text.value = templates[0] ? templates[0].text : '';
    showModal('campaignModal');
    renderCampaignList();
  }

  /* ------------------------------------------------------------------------
     Orders
     ------------------------------------------------------------------------ */
  function orderDisplayNo(order) {
    if (store && store.orderNoLabel) return store.orderNoLabel(order);
    var no = (order && (order.orderNo || order.id)) || '';
    return no.charAt(0) === '#' ? no : '#' + no;
  }

  function orderItemsText(order) {
    var items = (order && Array.isArray(order.items)) ? order.items : [];
    return items.map(function (item) {
      return (item.title || '') + ' ×' + (item.qty || 1);
    }).join(' · ');
  }

  function orderMatches(order) {
    var search = String(state.search.orders || '').toLowerCase().trim();
    var filter = state.filter.orders || '';
    if (filter && String(order.status || '') !== filter) return false;
    if (!search) return true;
    return [order.id, order.orderNo, order.number, order.name, order.phone, order.email, order.serviceTitle, orderItemsText(order), order.paymentMethod, order.status, order.notes]
      .join(' ').toLowerCase().indexOf(search) !== -1;
  }

  function filteredOrders() {
    return (store.get().orders || []).filter(orderMatches);
  }

  function orderWaText(order) {
    if (store && store.buildInvoice) {
      return store.buildInvoice(order, { recipient: 'customer' });
    }
    return [
      'مرحبًا ' + (order.name || '') + ' 👋',
      'معك ' + (settings().ownerName || settings().siteName || 'فريق نِيون ميديا') + '.',
      'بخصوص طلبك رقم ' + orderDisplayNo(order) + ': ' + (order.serviceTitle || ''),
      'المبلغ: ' + money(order.total != null ? order.total : order.amount, order.currency),
      'طريقة الدفع: ' + (order.paymentMethod || 'سيتم الاتفاق'),
      order.phone ? 'هاتفك: ' + order.phone : '',
      order.notes ? 'ملاحظاتك: ' + order.notes : '',
      'يسعدنا خدمتك ومساعدتك في إتمام الطلب.'
    ].filter(Boolean).join('\n');
  }

  function messageWaText(message) {
    return [
      'مرحبًا ' + (message.name || '') + ' 👋',
      'معك ' + (settings().ownerName || settings().siteName || 'فريق نِيون ميديا') + '.',
      'وصلتنا رسالتك' + (message.service ? ' بخصوص: ' + message.service : '') + '.',
      message.message ? 'نص الرسالة: ' + message.message : '',
      'رقم الرسالة: ' + (message.id || ''),
      'كيف يمكننا مساعدتك؟'
    ].filter(Boolean).join('\n');
  }

  function renderOrders() {
    var body = qs('#ordersTableBody');
    var countEl = qs('#count-orders');
    if (!body) return;
    var all = store.get().orders || [];
    var list = filteredOrders();
    if (!list.length) {
      body.innerHTML = '<tr><td colspan="6">' + emptyState('لا توجد طلبات مطابقة حتى الآن.', 'bag') + '</td></tr>';
    } else {
      body.innerHTML = list.map(function (order) {
        var wa = waLink(order.phone, orderWaText(order));
        return '<tr>' +
          '<td><div class="cell-strong" dir="ltr" style="text-align:start">' + esc(orderDisplayNo(order)) + '</div><div class="cell-muted">' + esc(fmtDate(order.createdAt, true)) + '</div></td>' +
          '<td><div class="cell-strong">' + esc(order.name || '—') + '</div><div class="cell-muted" dir="ltr">' + esc(order.phone || '—') + '</div></td>' +
          '<td><div>' + esc(order.serviceTitle || orderItemsText(order) || '—') + '</div><div class="cell-muted">' + esc(order.paymentMethod || 'سيتم الاتفاق') + '</div></td>' +
          '<td class="cell-amount">' + esc(money(order.total != null ? order.total : order.amount, order.currency)) + '<div class="cell-muted">' + esc(order.paymentStatus || 'غير مدفوع') + '</div></td>' +
          '<td><select class="form-select table-status-select" data-order-status="' + escAttr(order.id) + '" aria-label="حالة الطلب">' +
            ORDER_STATUSES.map(function (status) {
              return '<option value="' + escAttr(status) + '"' + (order.status === status ? ' selected' : '') + '>' + esc(status) + '</option>';
            }).join('') +
          '</select></td>' +
          '<td class="cell-actions"><div class="row-actions" style="justify-content:flex-end">' +
            actionButton('detail', 'عرض التفاصيل', 'eye', 'orders', order.id) +
            (wa !== '#' ? '<a class="row-btn row-btn--wa" href="' + escAttr(wa) + '" target="_blank" rel="noopener noreferrer" aria-label="واتساب" title="واتساب">' + icon('whatsapp') + '</a>' : '') +
            actionButton('delete', 'حذف الطلب', 'trash', 'orders', order.id, '', 'row-btn--danger') +
          '</div></td>' +
        '</tr>';
      }).join('');
    }
    if (countEl) countEl.textContent = list.length === all.length ? all.length + ' طلب' : list.length + ' من ' + all.length;
  }

  /* ------------------------------------------------------------------------
     Messages
     ------------------------------------------------------------------------ */
  function messageMatches(message) {
    var search = String(state.search.messages || '').toLowerCase().trim();
    var filter = state.filter.messages || '';
    if (filter && String(message.status || '') !== filter) return false;
    if (!search) return true;
    return [message.id, message.name, message.phone, message.email, message.service, message.message, message.status]
      .join(' ').toLowerCase().indexOf(search) !== -1;
  }

  function renderMessages() {
    var listEl = qs('#list-messages');
    var countEl = qs('#count-messages');
    if (!listEl) return;
    var all = store.get().messages || [];
    var list = all.filter(messageMatches);
    listEl.innerHTML = list.length ? list.map(function (message) {
      var wa = waLink(message.phone, messageWaText(message));
      var isNew = message.status === 'جديد';
      return '<article class="data-row' + (isNew ? ' is-unread' : '') + '">' +
        '<div class="data-thumb">' + icon('mail') + '</div>' +
        '<div class="data-body">' +
          '<h3>' + esc(message.name || 'بدون اسم') +
            (message.service ? chipHtml(message.service, 'chip--accent') : '') +
            (isNew ? chipHtml('جديدة', 'chip--amber') : '') +
          '</h3>' +
          '<p>' + esc(shortText(message.message || 'بدون نص.', 170)) + '</p>' +
          '<div class="data-chips">' +
            (message.phone ? chipHtml(message.phone, '', 'whatsapp') : '') +
            (message.email ? chipHtml(shortText(message.email, 34), '', 'mail') : '') +
            chipHtml(fmtDate(message.createdAt, true)) +
          '</div>' +
          '<select class="form-select table-status-select" data-message-status="' + escAttr(message.id) + '" aria-label="حالة الرسالة" style="margin-top:.5rem">' +
            MESSAGE_STATUSES.map(function (status) {
              return '<option value="' + escAttr(status) + '"' + (message.status === status ? ' selected' : '') + '>' + esc(status) + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="row-actions">' +
          actionButton('detail', 'عرض الرسالة', 'eye', 'messages', message.id) +
          (wa !== '#' ? '<a class="row-btn row-btn--wa" href="' + escAttr(wa) + '" target="_blank" rel="noopener noreferrer" aria-label="واتساب" title="واتساب">' + icon('whatsapp') + '</a>' : '') +
          actionButton('delete', 'حذف الرسالة', 'trash', 'messages', message.id, '', 'row-btn--danger') +
        '</div>' +
      '</article>';
    }).join('') : emptyState('لا توجد رسائل مطابقة. عندما يرسل عميل نموذج الاتصال ستظهر رسالته هنا.', 'mail');
    if (countEl) countEl.textContent = list.length === all.length ? all.length + ' رسالة' : list.length + ' من ' + all.length;
  }

  /* ------------------------------------------------------------------------
     Detail modals
     ------------------------------------------------------------------------ */
  function detailItem(label, value, iconName) {
    return '<div class="security-item">' + icon(iconName || 'check') +
      '<div><strong>' + esc(label) + ':</strong> ' + multiline(value || '—') + '</div></div>';
  }

  function openOrderDetail(id) {
    var order = store.getItem('orders', id);
    if (!order) return;
    var totals = store.orderTotals ? store.orderTotals(order) : null;
    var itemLines = ((totals && totals.items) || []).map(function (item) {
      return '• ' + (item.title || '—') + ' — ' + item.qty + ' × ' + money(item.price, order.currency) + ' = ' + money(item.total, order.currency);
    }).join('\n');
    var invoice = store.buildInvoice ? store.buildInvoice(order) : '';
    var finalTotal = totals ? totals.total : (order.total != null ? order.total : order.amount);
    setText('#detailTitle', 'تفاصيل الطلب ' + orderDisplayNo(order));
    setText('#detailSubtitle', (order.name || '') + ' · ' + fmtDate(order.createdAt, true));
    var selectedPayment = order.paymentStatus || 'غير مدفوع';
    var workflow = '' +
      '<div class="order-workflow">' +
        '<div class="order-workflow__head">' + icon('check') + '<strong>التنفيذ والدفع</strong></div>' +
        '<div class="order-workflow__grid">' +
          '<label class="order-workflow__field"><span>حالة الطلب</span><select class="form-select table-status-select" data-order-status="' + escAttr(order.id) + '">' +
            ORDER_STATUSES.map(function (status) {
              return '<option value="' + escAttr(status) + '"' + (order.status === status ? ' selected' : '') + '>' + esc(status) + '</option>';
            }).join('') +
          '</select></label>' +
          '<label class="order-workflow__field"><span>حالة الدفع</span><select class="form-select table-status-select" data-payment-status="' + escAttr(order.id) + '">' +
            PAYMENT_STATUSES.map(function (status) {
              return '<option value="' + escAttr(status) + '"' + (selectedPayment === status ? ' selected' : '') + '>' + esc(status) + '</option>';
            }).join('') +
          '</select></label>' +
        '</div>' +
        (order.executedAt ? '<p class="order-workflow__meta">تم التنفيذ: ' + esc(fmtDate(order.executedAt, true)) + (order.paidAt ? ' · تم الدفع: ' + esc(fmtDate(order.paidAt, true)) : '') + '</p>' : '') +
        '<div class="order-workflow__actions">' +
          '<button type="button" class="btn-neon order-workflow__btn" data-issue-advance-receipt="' + escAttr(order.id) + '">' + icon('clipboard') + ' فاتورة استلام مقدم</button>' +
          '<button type="button" class="btn-ghost order-workflow__btn" data-record-advance="' + escAttr(order.id) + '">' + icon('plus') + ' تسجيل دفعة مقدم</button>' +
          '<button type="button" class="btn-neon order-workflow__btn" data-issue-advance-receipt-wa="' + escAttr(order.id) + '">' + icon('whatsapp') + ' إرسالها واتساب</button>' +
          '<button type="button" class="btn-ghost order-workflow__btn" data-issue-tax-invoice="' + escAttr(order.id) + '">' + icon('clipboard') + ' طباعة الضريبي (نهائي)</button>' +
        '</div>' +
        '<p class="order-workflow__hint">الإيصال يُصدر بعد تحديد «مكتمل» و«مدفوع» ليكون جاهزًا لإقرارك الضريبي الشهري.</p>' +
      '</div>';
    qs('#detailBody').innerHTML = '<div class="security-list">' +
      detailItem('رقم الطلب', orderDisplayNo(order), 'bag') +
      detailItem('العميل', order.name, 'star') +
      detailItem('الهاتف', order.phone, 'mail') +
      detailItem('نوع الطلب', order.orderType || 'خدمة', 'layers') +
      detailItem('الخدمات', itemLines || order.serviceTitle, 'layers') +
      (totals && totals.vatEnabled ? detailItem('ضريبة القيمة المضافة (' + totals.vatRate + '%)', money(totals.vatAmount, order.currency), 'card') : '') +
      detailItem('الإجمالي', money(finalTotal, order.currency), 'card') +
      detailItem('طريقة الدفع', order.paymentMethod || 'سيتم الاتفاق', 'card') +
      detailItem('حالة الدفع', store.orderPaymentStatus ? store.orderPaymentStatus(order) : '—', 'check') +
      detailItem('الحالة', order.status || 'جديد', 'check') +
      detailItem('التاريخ', fmtDate(order.createdAt, true), 'help') +
      (order.executedAt ? detailItem('تم التنفيذ', fmtDate(order.executedAt, true), 'check') : '') +
      (order.source ? detailItem('المصدر', order.source, 'external') : '') +
      (order.notes ? detailItem('ملاحظات', order.notes, 'clipboard') : '') +
    '</div>' +
    workflow +
    (invoice ? '<div class="invoice-preview"><div class="invoice-preview__head">' + icon('clipboard') + '<strong>معاينة الفاتورة الإلكترونية</strong></div><pre>' + esc(invoice) + '</pre></div>' : '');
    var btn = qs('#detailWaBtn');
    if (btn) {
      var href = waLink(order.phone || settings().phone, orderWaText(order));
      if (href === '#') setHidden(btn, true);
      else { btn.href = href; setHidden(btn, false); }
    }
    var copyInvoice = qs('#detailCopyInvoiceBtn');
    if (copyInvoice) {
      copyInvoice.hidden = !invoice;
      copyInvoice.setAttribute('data-order-id', order.id);
    }
    showModal('detailModal');
  }

  // يتحقق من اكتمال التنفيذ والدفع قبل إصدار أي إيصال ضريبي.
  function taxReceiptOrder(orderId) {
    var order = store.getItem('orders', orderId);
    if (!order) return null;
    if (order.status !== 'مكتمل') {
      if (window.NeonUI) window.NeonUI.toast('حدّد حالة الطلب «مكتمل» أولًا بعد تنفيذ الخدمة.', 'info', 5500);
      return null;
    }
    if (order.paymentStatus !== 'مدفوع') {
      if (window.NeonUI) window.NeonUI.toast('حدّد حالة الدفع «مدفوع» أولًا لإصدار الإيصال الضريبي.', 'info', 5500);
      return null;
    }
    return order;
  }

  function sendTaxReceiptWhatsApp(orderId) {
    var order = taxReceiptOrder(orderId);
    if (!order || !store.buildTaxReceipt) return;
    var text = store.buildTaxReceipt(order);
    var href = waLink(order.phone || settings().phone, text);
    if (href === '#') {
      if (window.NeonUI) window.NeonUI.toast('لا يوجد رقم واتساب صالح للعميل.', 'error', 5000);
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { /* نسخ اختياري */ });
    }
    window.open(href, '_blank', 'noopener');
  }

  function printTaxReceipt(orderId) {
    var order = taxReceiptOrder(orderId);
    if (!order) return;
    var s = settings();
    var totals = store.orderTotals(order);
    var currency = order.currency || s.currency || 'ج.م';
    var esc2 = esc;
    var itemRows = (totals.items || []).map(function (item) {
      return '<tr><td>' + esc2(item.title || '—') + '</td><td>' + esc2(String(item.qty)) + '</td><td>' + esc2(money(item.price, currency)) + '</td><td>' + esc2(money(item.total, currency)) + '</td></tr>';
    }).join('');
    var vatRows = totals.vatEnabled
      ? '<div class="row"><span>ضريبة القيمة المضافة (' + esc2(String(totals.vatRate)) + '%)</span><strong>' + esc2(money(totals.vatAmount, currency)) + '</strong></div>'
      : '';
    var html = '<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">' +
      '<title>إيصال ضريبي ' + esc2(orderDisplayNo(order)) + '</title>' +
      '<style>' +
        '@page{margin:16mm}*{box-sizing:border-box}body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;color:#132;background:#fff;margin:0;padding:24px}' +
        '.wrap{max-width:760px;margin:0 auto;border:1px solid #dfe6ef;border-radius:14px;padding:28px}' +
        'header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:2px solid #0f7a5a;padding-bottom:16px;margin-bottom:18px}' +
        'h1{font-size:22px;margin:0 0 6px;color:#0f7a5a}p{margin:2px 0;font-size:12px;color:#4a5a6a}' +
        '.badge{display:inline-block;padding:6px 12px;border-radius:999px;background:#e8faf3;color:#0f7a5a;font-size:12px;font-weight:700;border:1px solid #b7eeda}' +
        '.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 22px;margin:16px 0;font-size:12.5px}' +
        '.meta div{display:flex;justify-content:space-between;border-bottom:1px dashed #e4ebf3;padding-bottom:6px}' +
        'table{width:100%;border-collapse:collapse;margin:14px 0;font-size:12.5px}' +
        'th{background:#f4f8fc;color:#2c4358;text-align:right;padding:9px;border-bottom:1px solid #dfe6ef}' +
        'td{padding:9px;border-bottom:1px solid #eef3f8}' +
        '.totals{margin-top:12px;margin-inline-start:auto;width:60%;font-size:13px}' +
        '.totals .row{display:flex;justify-content:space-between;padding:7px 0}' +
        '.totals .grand{border-top:2px solid #0f7a5a;margin-top:6px;padding-top:10px;font-size:16px;color:#0f7a5a;font-weight:800}' +
        '.stamp{margin-top:26px;display:flex;justify-content:space-between;align-items:flex-end;gap:20px}' +
        '.stamp-box{border:2px solid #0f7a5a;color:#0f7a5a;border-radius:10px;padding:10px 18px;font-weight:800;transform:rotate(-4deg)}' +
        '.signatures{margin-top:30px;display:grid;grid-template-columns:1fr 1fr;gap:24px}' +
        '.sig{border-top:1px dashed #9aa9b8;padding-top:10px;font-size:11.5px;color:#4a5a6a;text-align:center}' +
        '.sig strong{display:block;color:#132;font-size:12.5px;margin-bottom:2px}' +
        '.watermark{position:fixed;inset:0;display:grid;place-items:center;pointer-events:none;opacity:.06;font-size:96px;font-weight:900;color:#0f7a5a;transform:rotate(-28deg)}' +
        '.foot{font-size:11px;color:#7a8a99;margin-top:18px;border-top:1px solid #e4ebf3;padding-top:10px;line-height:1.7}' +
        '@media print{body{padding:0}.wrap{border:none;border-radius:0;padding:0}}' +
      '</style></head><body><div class="wrap">' +
        '<header><div><h1>إيصال ضريبي معتمد</h1><p>' + esc2(s.siteName || 'نِيون ميديا') + '</p>' +
          (s.taxNumber ? '<p>الرقم الضريبي: ' + esc2(s.taxNumber) + '</p>' : '') +
          (s.phone ? '<p>هاتف: ' + esc2(s.phone) + '</p>' : '') +
        '</div><span class="badge">تم التنفيذ والدفع</span></header>' +
        '<div class="meta">' +
          '<div><span>رقم الإيصال</span><strong dir="ltr">' + esc2(orderDisplayNo(order)) + '</strong></div>' +
          '<div><span>تاريخ الإصدار</span><strong>' + esc2(fmtDate(new Date().toISOString(), true)) + '</strong></div>' +
          '<div><span>تاريخ الطلب</span><strong>' + esc2(fmtDate(order.createdAt, true)) + '</strong></div>' +
          '<div><span>تاريخ التنفيذ</span><strong>' + esc2(order.executedAt ? fmtDate(order.executedAt, true) : '—') + '</strong></div>' +
          '<div><span>حالة الطلب</span><strong>' + esc2(order.status || '—') + '</strong></div>' +
          '<div><span>حالة الدفع</span><strong>' + esc2(store.orderPaymentStatus(order)) + '</strong></div>' +
          '<div><span>طريقة الدفع</span><strong>' + esc2(order.paymentMethod || '—') + '</strong></div>' +
          '<div><span>العميل</span><strong>' + esc2(order.name || '—') + '</strong></div>' +
          '<div><span>الهاتف</span><strong dir="ltr">' + esc2(order.phone || '—') + '</strong></div>' +
          (order.email ? '<div><span>البريد</span><strong dir="ltr">' + esc2(order.email) + '</strong></div>' : '') +
          (s.taxNumber ? '<div><span>الرقم الضريبي</span><strong dir="ltr">' + esc2(s.taxNumber) + '</strong></div>' : '') +
          '<div><span>رمز التحقق</span><strong dir="ltr">' + esc2('VR-' + String(order.id || '').slice(-6).toUpperCase()) + '</strong></div>' +
        '</div>' +
        '<table><thead><tr><th>الخدمة</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>' + (itemRows || '<tr><td colspan="4">—</td></tr>') + '</tbody></table>' +
        '<div class="totals">' + vatRows +
          '<div class="row grand"><span>' + (totals.vatEnabled ? 'الإجمالي (شامل الضريبة)' : 'الإجمالي') + '</span><strong>' + esc2(money(totals.total, currency)) + '</strong></div>' +
        '</div>' +
        '<div class="watermark">' + esc2(s.siteName || 'نِيون ميديا') + '</div>' +
        '<div class="stamp"><div class="stamp-box">تم التنفيذ بنجاح</div><div class="stamp-box" style="transform:rotate(3deg)">تم الدفع</div></div>' +
        '<div class="signatures">' +
        '  <div class="sig"><strong>توقيع العميل</strong>' + esc2(order.name || '—') + '<br>____________________</div>' +
        '  <div class="sig"><strong>ختم / توقيع ' + esc2(s.siteName || 'نِيون ميديا') + '</strong><br>____________________</div>' +
        '</div>' +
        '<div class="foot">هذا الإيصال صادر إلكترونيًا من موقع ' + esc2(s.siteName || 'نِيون ميديا') + ' بعد تنفيذ الخدمة واستلام العميل. يمكن استخدامه ضمن الإقرار الضريبي الشهري. ' +
          esc2(String(s.invoiceNote || '').replace(/\{siteName\}/g, s.siteName || 'نِيون ميديا').replace(/\{orderNo\}/g, orderDisplayNo(order)).replace(/\{total\}/g, money(totals.total, currency))) +
        '</div>' +
      '</div></body></html>';
    var win = window.open('', '_blank', 'width=860,height=1000');
    if (!win) {
      if (window.NeonUI) window.NeonUI.toast('اسمح بالنوافذ المنبثقة لطباعة الإيصال، أو استخدم «نسخ الإيصال».', 'error', 6500);
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(function () {
      try { win.print(); } catch (error) { /* المستخدم يطبع يدويًا */ }
    }, 350);
  }

  // إيصال استلام مقدم (احتياطي PDF قبل الإيصال الضريبي النهائي) — يُصدر لكل طلب
  function printAdvanceReceipt(orderId) {
    var order = store.getItem('orders', orderId);
    if (!order) { if (window.NeonUI) window.NeonUI.toast('لم نجد الطلب.', 'error'); return; }
    var s = settings();
    var totals = store.orderTotals(order);
    var currency = order.currency || s.currency || 'ج.م';
    var esc2 = esc;
    var itemRows = (totals.items || []).map(function (item) {
      return '<tr><td>' + esc2(item.title || '—') + '</td><td>' + esc2(String(item.qty)) + '</td><td>' + esc2(money(item.price, currency)) + '</td><td>' + esc2(money(item.total, currency)) + '</td></tr>';
    }).join('');
    var paidNow = store.orderPaid ? store.orderPaid(order) : 0;
    var balance = store.orderBalance ? store.orderBalance(order) : totals.total;
    var payments = (store.orderPaymentsOf ? store.orderPaymentsOf(order) : (order.payments || []));
    var payRows = payments.length
      ? payments.map(function (p, i) {
          return '<tr><td>' + esc2(String(i + 1)) + '</td><td>' + esc2(fmtDate(p.paidAt || p.paidAt || p.createdAt, true)) + '</td><td>' + esc2(p.method || '—') + '</td><td>' + esc2(money(p.amount, currency)) + '</td></tr>';
        }).join('')
      : '<tr><td colspan="4">لا توجد دفعات مسجلة بعد</td></tr>';
    var html = '<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">' +
      '<title>إيصال استلام مقدم ' + esc2(orderDisplayNo(order)) + '</title>' +
      '<style>' +
        '@page{margin:14mm}*{box-sizing:border-box}body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;color:#132;background:#fff;margin:0;padding:22px}' +
        '.wrap{max-width:760px;margin:0 auto;border:1px solid #dfe6ef;border-radius:14px;padding:26px}' +
        'header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:2px solid #0f7a5a;padding-bottom:16px;margin-bottom:18px}' +
        'h1{font-size:22px;margin:0 0 6px;color:#0f7a5a}p{margin:2px 0;font-size:12px;color:#4a5a6a}' +
        '.badge{display:inline-block;padding:6px 12px;border-radius:999px;background:#fff7e0;color:#8a5a00;font-size:12px;font-weight:700;border:1px solid #f2d68a}' +
        '.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 22px;margin:16px 0;font-size:12.5px}' +
        '.meta div{display:flex;justify-content:space-between;border-bottom:1px dashed #e4ebf3;padding-bottom:6px}' +
        'table{width:100%;border-collapse:collapse;margin:14px 0;font-size:12.5px}' +
        'th{background:#f4f8fc;color:#2c4358;text-align:right;padding:8px;border-bottom:1px solid #dfe6ef}' +
        'td{padding:8px;border-bottom:1px solid #eef3f8}' +
        '.totals{margin-top:12px;margin-inline-start:auto;width:64%;font-size:13.5px}' +
        '.totals .row{display:flex;justify-content:space-between;padding:7px 0}' +
        '.totals .grand{border-top:2px solid #0f7a5a;margin-top:6px;padding-top:10px;font-size:16px;color:#0f7a5a;font-weight:800}' +
        '.foot{font-size:11px;color:#7a8a99;margin-top:18px;border-top:1px solid #e4ebf3;padding-top:10px;line-height:1.7}' +
        '.note{margin-top:14px;padding:10px 14px;border-right:4px solid #0f7a5a;background:#f3fbf6;border-radius:10px;font-size:11.5px;color:#2c4358}' +
        '@media print{body{padding:0}.wrap{border:none;border-radius:0;padding:0}}' +
      '</style></head><body><div class="wrap">' +
        '<header><div><h1>إيصال استلام مقدم</h1><p>' + esc2(s.siteName || 'نِيون ميديا') + '</p>' +
          (s.taxNumber ? '<p>الرقم الضريبي: ' + esc2(s.taxNumber) + '</p>' : '') +
          (s.phone ? '<p>هاتف: ' + esc2(s.phone) + '</p>' : '') +
        '</div><span class="badge">مقدم على دفعات</span></header>' +
        '<div class="meta">' +
          '<div><span>رقم الإيصال</span><strong dir="ltr">' + esc2(orderDisplayNo(order)) + '</strong></div>' +
          '<div><span>تاريخ الإصدار</span><strong>' + esc2(fmtDate(new Date().toISOString(), true)) + '</strong></div>' +
          '<div><span>تاريخ الطلب</span><strong>' + esc2(fmtDate(order.createdAt, true)) + '</strong></div>' +
          '<div><span>رقم الطلب</span><strong dir="ltr">' + esc2(orderDisplayNo(order)) + '</strong></div>' +
          '<div><span>العميل</span><strong>' + esc2(order.name || '—') + '</strong></div>' +
          '<div><span>الهاتف</span><strong dir="ltr">' + esc2(order.phone || '—') + '</strong></div>' +
          '<div><span>طريقة الدفع</span><strong>' + esc2(order.paymentMethod || '—') + '</strong></div>' +
          '<div><span>نوع الطلب</span><strong>' + esc2(order.orderType || order.serviceTitle || '—') + '</strong></div>' +
        '</div>' +
        '<table><thead><tr><th>الخدمة</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>' + (itemRows || '<tr><td colspan="4">—</td></tr>') + '</tbody></table>' +
        '<table><thead><tr><th>#</th><th>التاريخ</th><th>طريقة</th><th>المبلغ</th></tr></thead><tbody>' + payRows + '</tbody></table>' +
        '<div class="totals">' + (totals.vatEnabled ? '<div class="row"><span>ضريبة القيمة المضافة</span><strong>' + esc2(money(totals.vatAmount, currency)) + '</strong></div>' : '') +
          '<div class="row"><span>الإجمالي (قبل المقدم)</span><strong>' + esc2(money(totals.total, currency)) + '</strong></div>' +
          '<div class="row"><span>المدفوع</span><strong>' + esc2(money(paidNow, currency)) + '</strong></div>' +
          '<div class="row grand"><span>باقي الدفعة</span><strong>' + esc2(money(balance, currency)) + '</strong></div>' +
        '</div>' +
        '<div class="note">هذا الإيصال غير ملزم ضريبيًا لحين إصدار «إيصال ضريبي نهائي» عند تنفيذ الطلب واستلام العميل له. المبلغ المتبقي يُدفع عند الإغلاق.</div>' +
        '<div class="foot">إيصال استلام مقدم — «' + esc2(s.siteName || 'نِيون ميديا') + '» — صادر ' + esc2(fmtDate(new Date().toISOString(), true)) + ' رقم ' + esc2(orderDisplayNo(order)) + '</div>' +
      '</div></body></html>';
    var win = window.open('', '_blank', 'width=860,height=1000');
    if (!win) { if (window.NeonUI) window.NeonUI.toast('اسمح بالنوافذ المنبثقة لطباعة الإيصال.', 'error', 6500); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(function () {
      try { win.print(); } catch (error) { /* يُطبع يدويًا */ }
    }, 350);
  }

  // إرسال واتساب برابط إيصال استلام مقدم
  function sendAdvanceReceiptWhatsApp(orderId) {
    var order = store.getItem('orders', orderId);
    if (!order) { if (window.NeonUI) window.NeonUI.toast('لم نجد الطلب.', 'error'); return; }
    var text = store.buildAdvanceReceipt(order);
    var phone = waLink(order.phone || settings().phone);
    if (phone === '#') return;
    var link = phone + (phone.indexOf('?') > -1 ? '&' : '?') + 'text=' + encodeURIComponent(text);
    window.open(link, '_blank', 'noopener');
  }

  // تسجيل دفعة مقدم لهذا الطلب
  function recordAdvancePayment(orderId) {
    var order = store.getItem('orders', orderId);
    if (!order) { if (window.NeonUI) window.NeonUI.toast('لم نجد الطلب.', 'error'); return; }
    var amount = window.prompt('أدخل مبلغ الدفعة (بالعمله ' + (order.currency || settings().currency || 'ج.م') + '):');
    if (amount == null) return;
    var num = Number(amount);
    if (!isFinite(num) || num <= 0) {
      if (window.NeonUI) window.NeonUI.toast('أدخل مبلغًا صحيحًا أكبر من صفر.', 'error');
      return;
    }
    var method = window.prompt('طريقة الدفع:', 'تحويل بنكي');
    if (method == null) return;
    var result = store.addOrderPayment(orderId, { amount: num, method: String(method || 'تحويل بنكي').trim() });
    if (result) {
      if (window.NeonUI) window.NeonUI.toast('تم تسجيل دفعة بـ ' + money(num, order.currency || settings().currency) + '. باقي: ' + money(result.balance, order.currency || settings().currency), 'success', 6000);
      openOrderDetail(orderId);
    } else {
      if (window.NeonUI) window.NeonUI.toast('تعذر تسجيل الدفعة.', 'error');
    }
  }

  function openMessageDetail(id) {
    var message = store.getItem('messages', id);
    if (!message) return;
    setText('#detailTitle', 'تفاصيل الرسالة');
    setText('#detailSubtitle', (message.name || '') + ' · ' + fmtDate(message.createdAt, true));
    qs('#detailBody').innerHTML = '<div class="security-list">' +
      detailItem('رقم الرسالة', message.id, 'mail') +
      detailItem('الاسم', message.name, 'star') +
      detailItem('الهاتف', message.phone, 'whatsapp') +
      detailItem('البريد', message.email, 'mail') +
      detailItem('الخدمة', message.service || 'غير محددة', 'layers') +
      detailItem('الحالة', message.status || 'جديد', 'check') +
      detailItem('التاريخ', fmtDate(message.createdAt, true), 'help') +
      detailItem('الرسالة', message.message, 'clipboard') +
    '</div>';
    var btn = qs('#detailWaBtn');
    if (btn) {
      var href = waLink(message.phone || settings().phone, messageWaText(message));
      if (href === '#') setHidden(btn, true);
      else { btn.href = href; setHidden(btn, false); }
    }
    var copyInvoice = qs('#detailCopyInvoiceBtn');
    if (copyInvoice) { copyInvoice.hidden = true; copyInvoice.removeAttribute('data-order-id'); }
    if (message.status === 'جديد') pushRecordUpdate('messages', message, { status: 'مقروء' });
    showModal('detailModal');
  }

  /* ------------------------------------------------------------------------
     Dashboard
     ------------------------------------------------------------------------ */
  function statCard(iconName, label, value, small, foot, variant, empty) {
    return '<article class="stat-card' + (variant ? ' stat-card--' + variant : '') + '">' +
      '<div class="stat-card__top"><span class="stat-card__label">' + esc(label) + '</span>' +
        '<span class="stat-card__icon">' + icon(iconName) + '</span></div>' +
      '<div class="stat-card__value">' + esc(value) + (small ? ' <small>' + esc(small) + '</small>' : '') + '</div>' +
      '<div class="stat-card__foot">' + (empty ? icon('alert') : icon('arrow-right')) + esc(foot) + '</div>' +
    '</article>';
  }

  function miniStatus(iconName, label, description, value, variant) {
    return '<div class="mini-item">' +
      '<div class="mini-item__icon">' + icon(iconName) + '</div>' +
      '<div class="mini-item__body"><strong>' + esc(label) + '</strong><span>' + esc(description) + '</span></div>' +
      '<div class="mini-item__meta">' + chipHtml(value, variant || '') + '</div>' +
    '</div>';
  }

  function renderDashboard() {
    if (!store) return;
    var data = store.get();
    var stats = store.getStats();
    var greeting = new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير';
    setText('#dashGreeting', greeting + (data.settings.ownerName ? ' ' + data.settings.ownerName : '') + ' — هذه حالة موقعك اليوم.');

    var statGrid = qs('#statGrid');
    if (statGrid) {
      statGrid.innerHTML = [
        statCard('bag', 'طلبات جديدة', stats.newOrders, stats.orders ? 'من ' + stats.orders : '', 'إجمالي الطلبات: ' + stats.orders, '', stats.newOrders === 0),
        statCard('mail', 'رسائل جديدة', stats.newMessages, stats.messages ? 'من ' + stats.messages : '', 'إجمالي الرسائل: ' + stats.messages, 'pink', stats.newMessages === 0),
        statCard('layers', 'خدمات نشطة', stats.services, 'خدمة', 'أعمال منشورة: ' + stats.works, 'violet'),
        statCard('database', 'الإيرادات', money(stats.revenue), '', 'من الطلبات غير الملغاة', 'green')
      ].join('');
    }

    var recentOrders = qs('#recentOrders');
    if (recentOrders) {
      var orders = (data.orders || []).slice(0, 5);
      recentOrders.innerHTML = orders.length ? orders.map(function (order) {
        return '<div class="mini-item" data-order-view="' + escAttr(order.id) + '" role="button" tabindex="0">' +
          '<div class="mini-item__icon">' + icon('bag') + '</div>' +
          '<div class="mini-item__body"><strong dir="ltr" style="text-align:start">' + esc(orderDisplayNo(order)) + ' — ' + esc(order.name || 'بدون اسم') + '</strong>' +
            '<span>' + esc(order.serviceTitle || '') + ' · ' + esc(fmtDate(order.createdAt)) + '</span></div>' +
          '<div class="mini-item__meta"><strong>' + esc(money(order.total != null ? order.total : order.amount, order.currency)) + '</strong>' + statusChip(order.status) + '</div>' +
        '</div>';
      }).join('') : emptyState('لا توجد طلبات بعد. ستظهر هنا فور وصول أول طلب.', 'bag');
    }

    var recentMessages = qs('#recentMessages');
    if (recentMessages) {
      var messages = (data.messages || []).slice(0, 5);
      recentMessages.innerHTML = messages.length ? messages.map(function (message) {
        return '<div class="mini-item" data-message-view="' + escAttr(message.id) + '" role="button" tabindex="0">' +
          '<div class="mini-item__icon">' + icon('mail') + '</div>' +
          '<div class="mini-item__body"><strong>' + esc(message.name || 'بدون اسم') + '</strong>' +
            '<span>' + esc(shortText(message.message || '', 70)) + '</span></div>' +
          '<div class="mini-item__meta"><strong>' + esc(fmtDate(message.createdAt)) + '</strong>' + statusChip(message.status) + '</div>' +
        '</div>';
      }).join('') : emptyState('لا توجد رسائل بعد. رسائل نموذج الاتصال ستظهر هنا.', 'mail');
    }

    var siteStatus = qs('#siteStatusList');
    if (siteStatus) {
      var s = data.settings;
      var cloudOn = store.isCloudEnabled();
      var cloudStatus = store.getCloudStatus();
      siteStatus.innerHTML = [
        miniStatus('check', 'الموقع يعمل', 'الصفحات متاحة والبيانات محفوظة محليًا.', 'نشط', 'chip--green'),
        miniStatus('bag', 'استقبال الطلبات', s.ordersEnabled === false ? 'نموذج الطلب متوقف مؤقتًا.' : 'نموذج الطلب يرسل الطلبات إلى واتساب.', s.ordersEnabled === false ? 'متوقف' : 'مفعل', s.ordersEnabled === false ? 'chip--muted' : 'chip--green'),
        miniStatus('card', 'الدفع الإلكتروني', s.onlinePaymentEnabled === false ? 'خيارات الدفع الإلكتروني مخفية.' : 'طرق الدفع تظهر داخل نموذج الطلب.', s.onlinePaymentEnabled === false ? 'متوقف' : 'مفعل', s.onlinePaymentEnabled === false ? 'chip--muted' : 'chip--green'),
    miniStatus('card', 'ضريبة القيمة المضافة', s.vatEnabled ? 'تُضاف الضريبة تلقائيًا للطلبات والفواتير الجديدة.' : 'غير مفعّلة — الفواتير تصدر بدون ضريبة حتى تسجّل.', s.vatEnabled ? 'مفعلة ' + (Number(s.vatRate) || 0) + '%' : 'غير مفعلة', s.vatEnabled ? 'chip--green' : 'chip--muted'),
        miniStatus('cloud', 'المزامنة السحابية', cloudOn ? 'Firebase Firestore متصل بمشروعك.' : 'البيانات محفوظة في هذا المتصفح فقط.', CLOUD_LABELS[cloudStatus] || 'محلي', cloudStatus === 'connected' ? 'chip--green' : ((cloudStatus === 'error' || cloudStatus === 'forbidden') ? 'chip--pink' : 'chip--accent')),
        miniStatus('help', 'الأسئلة الشائعة', 'المحتوى التعريفي جاهز للعرض للزوار.', (data.faqs || []).length + ' سؤال', 'chip--accent'),
        miniStatus('users', 'قاعدة العملاء', 'عملاء محفوظون لإرسال العروض والحملات.', (data.customers || []).length + ' عميل', 'chip--accent')
      ].join('');
    }
  }

  /* ------------------------------------------------------------------------
     Chrome: badges, storage meter, cloud status
     ------------------------------------------------------------------------ */
  function setBadge(selector, count) {
    var el = qs(selector);
    if (!el) return;
    el.textContent = String(count || 0);
    setHidden(el, !count);
  }

  function refreshChrome() {
    if (!store) return;
    var data = store.get();
    var stats = store.getStats();
    var bytes = store.dataSize();
    var percent = Math.min(100, Math.round((bytes / DATA_LIMIT) * 100));
    var sizeText = store.sizeLabel(bytes);

    setText('#sideUsageText', sizeText);
    setText('#dataSizeText', sizeText);
    setText('#lastUpdatedText', 'آخر تحديث: ' + fmtDate(data.updatedAt, true));
    var sideBar = qs('#sideUsageBar');
    if (sideBar) sideBar.style.width = percent + '%';
    var meterBar = qs('#dataMeterBar');
    if (meterBar) meterBar.style.width = percent + '%';

    setBadge('#badgeOrders', stats.newOrders);
    setBadge('#badgeMessages', stats.newMessages);
    try {
      var customersBaseline = Number(localStorage.getItem('neonAdminCustomersBaseline_v1') || 0);
      var customersTotal = (data.customers || []).length;
      setBadge('#badgeCustomers', Math.max(0, customersTotal - customersBaseline));
    } catch (e) {
      setBadge('#badgeCustomers', 0);
    }

    refreshCloud();
    if (state.loggedIn && state.view === 'dashboard') renderDashboard();
  }

  function refreshCloud() {
    if (!store) return;
    var status = store.getCloudStatus ? store.getCloudStatus() : 'local';
    var enabled = store.isCloudEnabled ? store.isCloudEnabled() : false;
    var label = CLOUD_LABELS[status] || 'محلي';
    var config = (window.NeonCloud && window.NeonCloud.config) || window.NEON_FIREBASE_CONFIG || {};
    var data = store.get();

    ['#topCloud', '#sideCloud'].forEach(function (selector) {
      var el = qs(selector);
      if (!el) return;
      el.textContent = label;
      el.setAttribute('data-status', status);
    });

    var title = qs('#cloudStatusTitle');
    var text = qs('#cloudStatusText');
    if (title) {
      title.textContent = status === 'connected' ? 'متصل بالسحابة'
        : status === 'syncing' ? 'جارٍ الاتصال بالسحابة'
        : status === 'error' ? 'خطأ في الاتصال'
        : status === 'forbidden' ? 'صلاحية الكتابة مرفوضة'
        : status === 'too-large' ? 'حجم المحتوى كبير'
        : status === 'auth-required' ? 'بانتظار تسجيل الدخول'
        : status === 'saving' ? 'جارٍ حفظ التغييرات'
        : 'التخزين المحلي';
    }
    if (text) {
      text.textContent = status === 'connected' ? 'Firebase Firestore متصل — التعديلات تُزامن تلقائيًا بين الأجهزة.'
        : status === 'syncing' ? 'جارٍ الاتصال بـ Firebase وتحميل أحدث نسخة من بياناتك…'
        : status === 'error' ? 'تعذر الاتصال بالسحابة مؤقتًا. بياناتك محفوظة محليًا ولن تضيع.'
        : status === 'forbidden' ? 'الحساب المسجّل لا يملك إذن الكتابة. تأكد أن UID الظاهر في بطاقة الدخول مطابق للـ UID داخل firestore.rules ثم أعد نشر القواعد.'
        : status === 'too-large' ? 'المحتوى اقترب من 1 ميجابايت. صغّر الصور المرفوعة أو استخدم روابط صور خارجية.'
        : status === 'auth-required' ? 'سجّل الدخول من بطاقة "دخول المشرف" ليتم رفع تعديلاتك إلى السحابة.'
        : status === 'saving' ? 'يتم رفع أحدث تعديلاتك إلى Firestore الآن…'
        : 'Firebase غير مفعّل — كل البيانات محفوظة في هذا المتصفح.';
    }

    var hint = qs('#cloudHint');
    if (hint) hint.textContent = enabled
      ? 'المزامنة تعمل. جميع التغييرات تُرفع تلقائيًا إلى مشروعك.'
      : 'فعّل Firebase من الملف assets/js/firebase-config.js ثم أعد تحميل الصفحة.';

    var details = qs('#cloudDetails');
    if (details) {
      details.innerHTML = [
        miniStatus('database', 'قاعدة البيانات', enabled ? 'Firebase Firestore' : 'التخزين المحلي (localStorage)', enabled ? 'سحابي' : 'محلي', enabled ? 'chip--green' : 'chip--accent'),
        miniStatus('cloud', 'مشروع Firebase', config.projectId && config.projectId !== 'YOUR_PROJECT' ? config.projectId : 'لم يتم إعداد المشروع بعد', enabled ? 'معد' : 'غير معد', enabled ? 'chip--green' : 'chip--muted'),
        miniStatus('layers', 'المستند', (config.collection || 'sites') + ' / ' + (config.docId || 'neon-media'), 'Firestore', 'chip--accent'),
        miniStatus('image', 'رفع الصور', config.useStorage ? 'Firebase Storage' : 'صور محلية / روابط', config.useStorage ? 'مفعل' : 'محلي', config.useStorage ? 'chip--green' : 'chip--muted'),
        miniStatus('refresh', 'آخر تحديث', fmtDate(data.updatedAt, true), store.sizeLabel(store.dataSize()), 'chip--accent')
      ].join('');
    }
    refreshCloudAuth();
  }

  function refreshCloudAuth() {
    var card = qs('#cloudAuthCard');
    if (!card) return;
    var cloud = window.NeonCloud;
    var configured = Boolean(cloud && cloud.isConfigured && cloud.isConfigured());
    setHidden(card, !configured);
    if (!configured) return;

    var authOn = Boolean(cloud.isAuthEnabled && cloud.isAuthEnabled());
    var user = cloud.getUser ? cloud.getUser() : null;
    var title = qs('#cloudAuthTitle');
    var text = qs('#cloudAuthText');
    var form = qs('#cloudAuthForm');
    var outBtn = qs('#cloudAuthOutBtn');

    if (!authOn) {
      if (title) title.textContent = 'تسجيل الدخول غير مفعّل';
      if (text) text.textContent = 'فعّل auth في firebase-config.js لحماية الكتابة بحساب المشرف.';
      if (form) setHidden(form, true);
      if (outBtn) setHidden(outBtn, true);
      return;
    }

    if (user) {
      if (title) title.textContent = 'مسجّل الدخول: ' + (user.email || 'مشرف');
      if (text) text.textContent = 'كل تعديل تحفظه يُرفع إلى Firestore ويظهر للزوار خلال ثانية · UID: ' + (user.uid || '—');
      if (form) setHidden(form, true);
      if (outBtn) setHidden(outBtn, false);
    } else {
      if (title) title.textContent = 'غير مسجّل';
      if (text) text.textContent = 'التعديلات الآن محلية فقط. سجّل الدخول لرفعها إلى السحابة.';
      if (form) setHidden(form, false);
      if (outBtn) setHidden(outBtn, true);
    }
  }

  function authErrorMessage(error) {
    var code = (error && error.code) || '';
    var map = {
      'auth/invalid-credential': 'الإيميل أو كلمة المرور غير صحيحة.',
      'auth/invalid-login-credentials': 'الإيميل أو كلمة المرور غير صحيحة.',
      'auth/wrong-password': 'كلمة المرور غير صحيحة.',
      'auth/user-not-found': 'لا يوجد مستخدم بهذا الإيميل.',
      'auth/invalid-email': 'صيغة الإيميل غير صحيحة.',
      'auth/too-many-requests': 'محاولات كثيرة — انتظر دقيقة ثم جرّب.',
      'auth/network-request-failed': 'تعذر الاتصال بالشبكة. تحقق من الإنترنت.',
      'auth/operation-not-allowed': 'طريقة Email/Password غير مفعّلة في Firebase Console.',
      'auth/unauthorized-domain': 'هذا النطاق غير مصرّح به في Firebase ← Authentication ← Settings ← Authorized domains.'
    };
    return map[code] || (error && error.message) || 'تعذر تسجيل الدخول.';
  }

  function cloudSignIn(event) {
    if (event) event.preventDefault();
    var cloud = window.NeonCloud;
    if (!cloud || !cloud.signIn) {
      if (window.NeonUI) window.NeonUI.toast('جسر Firebase غير محمّل.', 'error');
      return;
    }
    var emailEl = qs('#cloudAuthEmail');
    var passEl = qs('#cloudAuthPassword');
    var btn = qs('#cloudAuthBtn');
    var email = emailEl ? emailEl.value.trim() : '';
    var password = passEl ? passEl.value : '';
    if (!email || !password) {
      if (window.NeonUI) window.NeonUI.toast('أدخل الإيميل وكلمة المرور.', 'error');
      return;
    }
    if (btn) { btn.disabled = true; btn.textContent = 'جارٍ الدخول…'; }
    cloud.signIn(email, password).then(function (user) {
      if (passEl) passEl.value = '';
      if (window.NeonUI) window.NeonUI.toast('تم تسجيل الدخول: ' + ((user && user.email) || email), 'success', 5000);
      refreshCloud();
      startCloudWatchers(true);
      if (window.NeonDevices && window.NeonDevices.start) window.NeonDevices.start();
    }).catch(function (error) {
      if (window.NeonUI) window.NeonUI.toast(authErrorMessage(error), 'error', 7000);
    }).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = 'تسجيل الدخول'; }
    });
  }

  function cloudSignOut() {
    var cloud = window.NeonCloud;
    if (!cloud || !cloud.signOut) return;
    cloud.signOut().then(function () {
      if (window.NeonUI) window.NeonUI.toast('تم تسجيل الخروج من حساب المشرف.', 'info', 4000);
      refreshCloud();
    }).catch(function (error) {
      if (window.NeonUI) window.NeonUI.toast('تعذر تسجيل الخروج: ' + ((error && error.message) || ''), 'error');
    });
  }

  /* ------------------------------------------------------------------------
     View switching / navigation
     ------------------------------------------------------------------------ */
  function renderCurrentView() {
    if (!store || !state.loggedIn) return;
    var view = state.view;
    if (view === 'dashboard') renderDashboard();
    else if (COLLECTIONS[view]) renderCollection(view);
    else if (view === 'orders') renderOrders();
    else if (view === 'messages') renderMessages();
    else if (view === 'reports') renderReports();
    else if (view === 'settings') renderSettingsIfNeeded();
    else if (view === 'backup' || view === 'cloud') refreshChrome();
  }

  // «التصميم» و «SEO» يُعرضان داخل صفحة الإعدادات (تُفلتر لعرض المجموعة المطلوبة).
  var VIEW_ALIASES = { design: 'settings', seo: 'settings', video: 'settings' };
  function showView(view) {
    var originalView = view;
    if (VIEW_ALIASES[view]) view = VIEW_ALIASES[view];
    if (!VIEW_TITLES[originalView] && !VIEW_TITLES[view]) view = 'dashboard';
    state.view = originalView;
    qsa('.admin-view[data-view]').forEach(function (section) {
      setHidden(section, section.getAttribute('data-view') !== view);
    });
    if (view === 'customers') {
      try {
        var totalNow = (store.get().customers || []).length;
        localStorage.setItem('neonAdminCustomersBaseline_v1', String(totalNow));
        setBadge('#badgeCustomers', 0);
      } catch (e) { /* ignore */ }
    }
    qsa('[data-view-btn]').forEach(function (button) {
      var active = button.getAttribute('data-view-btn') === originalView;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    setText('#viewTitle', VIEW_TITLES[originalView] || VIEW_TITLES[view]);
    var siteName = settings().siteName || 'نِيون ميديا';
    document.title = VIEW_TITLES[view] + ' | ' + siteName;

    if (view === 'settings') {
      renderSettingsIfNeeded();
      if (originalView === 'design' || originalView === 'seo') {
        setTimeout(function () {
          var form = qs('form[data-settings-group="' + originalView + '"]');
          if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      }
    }
    else if (view === 'security') updatePasswordStrength();
    else if (view === 'dashboard') renderDashboard();
    else if (COLLECTIONS[view]) renderCollection(view);
    else if (view === 'orders') renderOrders();
    else if (view === 'messages') renderMessages();
    else if (view === 'reports') renderReports();
    else if (view === 'backup') refreshChrome();
    else if (view === 'cloud') refreshCloud();

    if (location.hash !== '#' + view) {
      try { history.replaceState(null, '', '#' + view); } catch (error) { /* ignore */ }
    }
    closeSidebar();
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (error) { window.scrollTo(0, 0); }
  }

  /* ------------------------------------------------------------------------
     Sidebar
     ------------------------------------------------------------------------ */
  function openSidebar() {
    var sidebar = qs('#adminSidebar');
    var overlay = qs('#adminOverlay');
    var button = qs('#adminMenuBtn');
    if (sidebar) sidebar.classList.add('is-open');
    setHidden(overlay, false);
    if (button) button.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    var sidebar = qs('#adminSidebar');
    var overlay = qs('#adminOverlay');
    var button = qs('#adminMenuBtn');
    if (sidebar) sidebar.classList.remove('is-open');
    setHidden(overlay, true);
    if (button) button.setAttribute('aria-expanded', 'false');
  }

  /* ------------------------------------------------------------------------
     Session / authentication / idle
     ------------------------------------------------------------------------ */
  function readSessionRaw() {
    try {
      var persistent = localStorage.getItem(SESSION_KEY);
      if (persistent) {
        var parsed = JSON.parse(persistent);
        if (parsed && (Number(parsed.exp) === -1 || Number(parsed.exp) > Date.now())) return parsed;
      }
    } catch (error) { /* تجاهل */ }
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return state.sessionExp ? { exp: state.sessionExp } : null;
    }
  }

  function getSessionMode() {
    try { return localStorage.getItem(SESSION_MODE_KEY) || 'idle30'; } catch (error) { return 'idle30'; }
  }

  function sessionValid() {
    var session = readSessionRaw();
    if (!session) return false;
    if (Number(session.exp) === -1) return true;
    return Number(session.exp) > Date.now();
  }

  function writeSession() {
    var mode = getSessionMode();
    if (mode === 'idle30') {
      state.sessionExp = Date.now() + SESSION_TTL;
    } else if (mode === 'never') {
      state.sessionExp = -1;
    } else {
      /* المدد الثابتة: تنتهي مطلقًا من لحظة الدخول ولا تمدد بالحركة */
      var hours = mode === 'h1' ? 1 : mode === 'h8' ? 8 : mode === 'h24' ? 24 : 1;
      if (!state.sessionExp || state.sessionExp === -1 || state.sessionExp <= Date.now()) {
        state.sessionExp = Date.now() + hours * 60 * 60 * 1000;
      }
    }
    var payload = JSON.stringify({ exp: state.sessionExp, mode: mode });
    try { sessionStorage.setItem(SESSION_KEY, payload); } catch (error) { /* تجاهل */ }
    try {
      if (mode !== 'idle30') {
        /* المدد الطويلة تُحفظ في localStorage — تفضل قائمة حتى بعد إغلاق المتصفح/التطبيق */
        localStorage.setItem(SESSION_KEY, payload);
      }
    } catch (error) { /* تجاهل */ }
  }

  function clearSession() {
    state.sessionExp = 0;
    try { sessionStorage.removeItem(SESSION_KEY); } catch (error) { /* تجاهل */ }
    try { localStorage.removeItem(SESSION_KEY); } catch (error) { /* تجاهل */ }
  }

  function touchSession() {
    if (!state.loggedIn) return;
    if (getSessionMode() !== 'idle30') return; /* المدد الثابتة/الدائمة لا تُمدد بالحركة */
    var now = Date.now();
    if (now - state.lastTouch < 15000) return;
    state.lastTouch = now;
    writeSession();
  }

  function startIdle() {
    stopIdle();
    state.idleTimer = window.setInterval(function () {
      if (!state.loggedIn) return;
      if (!sessionValid()) {
        var mode = getSessionMode();
        logout(mode === 'idle30' ? 'انتهت الجلسة بعد 30 دقيقة خمول. سجّل الدخول مرة أخرى.' : 'انتهت مدة الجلسة المحددة. سجّل الدخول مرة أخرى.');
      }
    }, 30000);
  }

  function stopIdle() {
    if (state.idleTimer) {
      clearInterval(state.idleTimer);
      state.idleTimer = null;
    }
  }

  function beginSession() {
    state.loggedIn = true;
    state.lastTouch = Date.now();
    writeSession();
    startIdle();
  }

  function showLoginError(message) {
    var error = qs('#loginError');
    if (error) {
      error.textContent = message;
      setHidden(error, false);
    }
    var input = qs('#loginPassword');
    if (input) {
      input.focus();
      input.select();
    }
  }

  function showLogin() {
    stopIdle();
    state.loggedIn = false;
    clearSession();
    setHidden(qs('#adminLogin'), false);
    setHidden(qs('#adminShell'), true);
    hideModal('editorModal');
    hideModal('detailModal');
    hideModal('confirmModal');
    setHidden(qs('#loginError'), true);
    var input = qs('#loginPassword');
    if (input) input.value = '';
    setTimeout(function () {
      var focus = qs('#loginPassword');
      if (focus) focus.focus();
    }, 220);
  }

  function showApp() {
    setHidden(qs('#adminLogin'), true);
    setHidden(qs('#adminShell'), false);
    beginSession();
    syncBrand();
    refreshChrome();
    startCloudWatchers(true);
    if (window.NeonDevices && window.NeonDevices.start) window.NeonDevices.start();
    // إعادة محاولة بعد استعادة جلسة Firebase (قد تتأخر عن لحظة فتح اللوحة).
    setTimeout(function () { if (state.loggedIn) startCloudWatchers(true); }, 1200);
    setTimeout(function () { if (state.loggedIn) startCloudWatchers(true); }, 4000);
    var hash = String(location.hash || '').replace('#', '');
    var allowedHashes = Object.keys(VIEW_TITLES).concat(['design', 'seo']);
    showView(allowedHashes.indexOf(hash) !== -1 ? hash : 'dashboard');
    if (window.NeonUI && window.NeonUI.refreshMotion) {
      setTimeout(function () { window.NeonUI.refreshMotion(); }, 160);
    }
  }

  /* طرد هذا الجهاز (عند الفصل من جهاز آخر): امسح الجلسة واخرج لشاشة الدخول */
  function initForceLogoutListener() {
    window.addEventListener('neon:force-logout', function (event) {
      var message = (event && event.detail && event.detail.message) || 'تم فصل هذا الجهاز من جهاز آخر.';
      clearSession();
      logout(message);
    });
  }

  function logout(message) {
    if (window.NeonDevices && window.NeonDevices.disconnectLocal) window.NeonDevices.disconnectLocal();
    showLogin();
    if (message && window.NeonUI && window.NeonUI.toast) {
      window.NeonUI.toast(message, 'info', 5500);
    }
  }

  function onLoginSubmit(event) {
    event.preventDefault();
    var input = qs('#loginPassword');
    var button = qs('#loginBtn');
    if (!input || !store) return;
    var password = input.value;
    setHidden(qs('#loginError'), true);
    if (button) button.disabled = true;

    function finish() {
      if (button) button.disabled = false;
    }

    var attempt = function () {
      if (!store.checkPassword(password)) {
        showLoginError('كلمة المرور غير صحيحة. تحقق منها وحاول مرة أخرى.');
        setHidden(qs('#loginError'), false);
        if (window.NeonUI && window.NeonUI.shake) window.NeonUI.shake(button);
        return Promise.resolve();
      }
      var s = (store.get() && store.get().settings) || {};
      if (s.adminTotpEnabled) {
        var code = qs('#loginTotp') ? qs('#loginTotp').value.trim() : '';
        if (!code) {
          showLoginError('أدخل الرمز من Google Authenticator.');
          setHidden(qs('#loginError'), false);
          return Promise.resolve();
        }
        var verify = window.NeonTotp ? window.NeonTotp.verify(s.adminTotpSecret, code) : Promise.resolve(false);
        return verify.then(function (valid) {
          if (valid) {
            input.value = '';
            if (qs('#loginTotp')) qs('#loginTotp').value = '';
            showApp();
            if (window.NeonUI && window.NeonUI.toast) {
              window.NeonUI.toast('أهلًا بعودتك. تسجيل دخول بخطوتين ناجح ✅', 'success');
            }
          } else {
            showLoginError('رمز Authenticator غير صحيح — تأكد من الوقت على هاتفك وجرب بأقرب 30 ثانية.');
            setHidden(qs('#loginError'), false);
          }
        });
      }
      input.value = '';
      showApp();
      if (window.NeonUI && window.NeonUI.toast) {
        window.NeonUI.toast('أهلًا بعودتك. تم تسجيل الدخول بنجاح.', 'success');
      }
      return Promise.resolve();
    };

    store.ready.then(attempt).catch(function () {
      showLoginError('تعذر تحميل بيانات اللوحة. أعد تحميل الصفحة.');
      setHidden(qs('#loginError'), false);
    }).then(finish, finish);
  }

  /* ------------------------------------------------------------------------
     Password / security
     ------------------------------------------------------------------------ */
  function passwordScore(value) {
    if (!value) return 0;
    var score = 0;
    if (value.length >= 8) score++;
    if (value.length >= 12) score++;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
    if (/\d/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;
    return Math.min(5, score);
  }

  function updatePasswordStrength() {
    var input = qs('#newPassword');
    var bar = qs('#passwordStrengthBar');
    var label = qs('#passwordStrengthText');
    if (!input || !bar || !label) return;
    var score = passwordScore(input.value);
    var labels = ['—', 'ضعيفة جدًا', 'ضعيفة', 'متوسطة', 'قوية', 'قوية جدًا'];
    var colors = ['#ff6b8b', '#ff6b8b', '#ffb84d', '#22e7ff', '#35f5a0', '#35f5a0'];
    bar.style.width = score === 0 ? '0%' : (score * 20) + '%';
    bar.style.background = colors[score];
    label.textContent = labels[score];
  }

  function onPasswordSubmit(event) {
    event.preventDefault();
    var form = qs('#passwordForm');
    var errorEl = qs('#passwordError');
    var current = qs('#currentPassword');
    var next = qs('#newPassword');
    var confirm = qs('#confirmPassword');
    if (!form || !current || !next || !confirm || !store) return;

    setHidden(errorEl, true);
    form.classList.add('was-validated');
    if (!form.checkValidity()) {
      var invalid = form.querySelector(':invalid');
      if (invalid) invalid.focus();
      return;
    }
    if (!store.checkPassword(current.value)) {
      errorEl.textContent = 'كلمة المرور الحالية غير صحيحة.';
      setHidden(errorEl, false);
      current.focus();
      return;
    }
    if (next.value.length < 8) {
      errorEl.textContent = 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.';
      setHidden(errorEl, false);
      next.focus();
      return;
    }
    if (next.value !== confirm.value) {
      errorEl.textContent = 'كلمتا المرور غير متطابقتين.';
      setHidden(errorEl, false);
      confirm.focus();
      return;
    }
    if (next.value === current.value) {
      errorEl.textContent = 'اختر كلمة مرور مختلفة عن الحالية.';
      setHidden(errorEl, false);
      next.focus();
      return;
    }

    store.setPassword(next.value);
    form.reset();
    form.classList.remove('was-validated');
    updatePasswordStrength();
    if (window.NeonUI) window.NeonUI.toast('تم تحديث كلمة المرور بنجاح.', 'success');
  }

  /* ------------------------------------------------------------------------
     Session mode settings + PWA install (لوحة التحكم كتطبيق)
     ------------------------------------------------------------------------ */
  var MODE_LABELS = {
    idle30: '30 دقيقة خمول (الافتراضي — الأكثر أمانًا)',
    h1: 'ساعة كاملة من تسجيل الدخول',
    h8: '8 ساعات (يوم العمل)',
    h24: '24 ساعة (يوم كامل)',
    never: 'بدون قفل — حتى أسجّل الخروج بنفسي'
  };

  function renderSessionStatus() {
    var status = qs('#sessionStatus');
    var select = qs('#sessionMode');
    if (!status || !select) return;
    var mode = getSessionMode();
    select.value = mode;
    var session = readSessionRaw();
    var loggedIn = Boolean(session && (Number(session.exp) === -1 || Number(session.exp) > Date.now()));
    var extra = '';
    if (loggedIn && Number(session.exp) > 0) {
      var mins = Math.max(1, Math.round((Number(session.exp) - Date.now()) / 60000));
      extra = ' — متصل الآن (متبقٍ ' + (mins >= 60 ? Math.round(mins / 60) + ' ساعة' : mins + ' دقيقة') + ')';
    } else if (loggedIn) {
      extra = ' — متصل الآن حتى تسجيل الخروج';
    }
    status.textContent = 'الإعداد الحالي: ' + (MODE_LABELS[mode] || MODE_LABELS.idle30) + extra;
  }

  function initSessionModeUI() {
    var form = qs('#sessionModeForm');
    if (!form) return;
    renderSessionStatus();
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var select = qs('#sessionMode');
      if (!select) return;
      var mode = select.value || 'idle30';
      try { localStorage.setItem(SESSION_MODE_KEY, mode); } catch (error) { /* تجاهل */ }
      /* إذا كنت مسجلًا الآن: طبّق المدة الجديدة فورًا */
      if (state.loggedIn) {
        state.sessionExp = 0;
        writeSession();
      }
      renderSessionStatus();
      if (window.NeonUI) window.NeonUI.toast('تم حفظ مدة الجلسة: ' + (MODE_LABELS[mode] || ''), 'success');
    });
  }

  /* ------------------------------------------------------------------------
     التحقق بخطوتين (TOTP) — تفعيل/إلغاء محلي على هذا الجهاز فقط
     ---------------------------------------------------------------------- */
  var totpSetupSecret = null;

  function refreshTotpCard() {
    var status = qs('#totpStatus');
    var idleBox = qs('#totpIdleBox');
    var setupBox = qs('#totpSetupBox');
    var enabledBox = qs('#totpEnabledBox');
    if (!status || !idleBox || !setupBox || !enabledBox || !store) return;
    var s = (store.get() && store.get().settings) || {};
    var enabled = !!s.adminTotpEnabled;
    setHidden(setupBox, true);
    setHidden(idleBox, enabled);
    setHidden(enabledBox, !enabled);
    status.textContent = enabled
      ? 'الحالة: مفعّل على هذا الجهاز — ستحتاج الرمز مع كلمة المرور في كل تسجيل دخول.'
      : 'الحالة: غير مفعّل — اللوحة تحميها كلمة المرور فقط.';
  }

  function initTotpUI() {
    var setupBtn = qs('#totpSetupBtn');
    var setupBox = qs('#totpSetupBox');
    var idleBox = qs('#totpIdleBox');
    var enabledBox = qs('#totpEnabledBox');
    if (!setupBtn || !window.NeonTotp) return;

    setupBtn.addEventListener('click', function () {
      totpSetupSecret = window.NeonTotp.generateSecret();
      var secretInput = qs('#totpSecretText');
      if (secretInput) secretInput.value = totpSetupSecret.match(/.{1,4}/g).join(' ');
      var otpauth = qs('#totpOtpauth');
      if (otpauth) otpauth.setAttribute('href', window.NeonTotp.otpauthUrl(totpSetupSecret, 'NEON MEDIA Admin', 'NEON MEDIA'));
      var codeInput = qs('#totpSetupCode');
      if (codeInput) codeInput.value = '';
      setHidden(idleBox, true);
      setHidden(enabledBox, true);
      setHidden(setupBox, false);
      if (codeInput) codeInput.focus();
    });

    var cancelBtn = qs('#totpSetupCancelBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        totpSetupSecret = null;
        setHidden(setupBox, true);
        setHidden(idleBox, false);
      });
    }

    var confirmBtn = qs('#totpEnableConfirmBtn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', function () {
        var code = (qs('#totpSetupCode') ? qs('#totpSetupCode').value.trim() : '');
        if (!totpSetupSecret) { refreshTotpCard(); return; }
        confirmBtn.disabled = true;
        window.NeonTotp.verify(totpSetupSecret, code).then(function (valid) {
          confirmBtn.disabled = false;
          if (!valid) {
            if (window.NeonUI) window.NeonUI.toast('الرمز غير صحيح — تأكد أن الوقت على الهاتف صحيح وجرب بأقرب 30 ثانية.', 'error', 6500);
            return;
          }
          var secret = totpSetupSecret;
          store.update(function (data) {
            data.settings.adminTotpEnabled = true;
            data.settings.adminTotpSecret = secret;
          });
          totpSetupSecret = null;
          refreshTotpCard();
          if (window.NeonUI) window.NeonUI.toast('تم تفعيل التحقق بخطوتين على هذا الجهاز ✅ — جرب تسجيل الدخول مرة تانية بعد ما تخرج.', 'success', 8000);
        });
      });
    }

    var disableBtn = qs('#totpDisableBtn');
    if (disableBtn) {
      disableBtn.addEventListener('click', function () {
        // طلب الرمز الحالي قبل فتح باب الإلغاء
        var code = window.prompt('اكتب الرمز الحالي من Google Authenticator لإلغاء التحقق:');
        if (code === null) return;
        var s = (store.get() && store.get().settings) || {};
        window.NeonTotp.verify(s.adminTotpSecret, String(code).trim()).then(function (valid) {
          if (!valid) {
            if (window.NeonUI) window.NeonUI.toast('الرمز غير صحيح — لم يتم إلغاء أي شيء.', 'error', 6000);
            return;
          }
          store.update(function (data) {
            data.settings.adminTotpEnabled = false;
            data.settings.adminTotpSecret = '';
          });
          refreshTotpCard();
          if (window.NeonUI) window.NeonUI.toast('تم إلغاء التحقق بخطوتين على هذا الجهاز.', 'info', 6000);
        });
      });
    }

    store.ready.then(refreshTotpCard).catch(function () { /* تجاهل */ });
    window.NeonStore && window.NeonStore.subscribe && window.NeonStore.subscribe(refreshTotpCard);
  }

  var deferredInstallPrompt = null;

  function initPwaInstall() {
    var button = qs('#installAppBtn');
    if (!button) return;
    window.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      deferredInstallPrompt = event;
      setHidden(button, false);
    });
    button.addEventListener('click', function () {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then(function (choice) {
        if (window.NeonUI && window.NeonUI.toast) {
          window.NeonUI.toast(choice && choice.outcome === 'accepted' ? 'تم تثبيت التطبيق 🎉' : 'يمكنك التثبيت لاحقًا في أي وقت.', choice && choice.outcome === 'accepted' ? 'success' : 'info');
        }
        deferredInstallPrompt = null;
        setHidden(button, true);
      }).catch(function () { /* تجاهل */ });
    });
    /* iOS لا يطلق beforeinstallprompt — أخفِ الزر تلقائيًا (التثبيت من قائمة المشاركة) */
    var isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    if (isIOS) button.setAttribute('title', 'على الآيفون: زر المشاركة ← إضافة إلى الشاشة الرئيسية');
  }

  function registerAdminSw() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
    try {
      navigator.serviceWorker.register('admin-sw.js').catch(function () { /* تجاهل */ });
    } catch (error) { /* تجاهل */ }
  }

  function initPasswordToggles() {
    qsa('[data-password-toggle]').forEach(function (button) {
      button.addEventListener('click', function () {
        var wrap = button.closest('.password-wrap') || button.parentNode;
        var input = wrap ? wrap.querySelector('input') : null;
        if (!input) return;
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        button.setAttribute('aria-pressed', show ? 'true' : 'false');
        button.setAttribute('aria-label', show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
        var open = button.querySelector('.eye-open');
        var closed = button.querySelector('.eye-closed');
        setHidden(open, show);
        setHidden(closed, !show);
      });
    });
  }

  /* ------------------------------------------------------------------------
     Backup / CSV / cloud actions
     ------------------------------------------------------------------------ */
  function downloadFile(filename, content, type) {
    var blob = new Blob([content], { type: type || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(function () {
      link.remove();
      URL.revokeObjectURL(url);
    }, 800);
  }

  function exportBackup() {
    if (!store) return;
    var date = new Date().toISOString().slice(0, 10);
    downloadFile('neon-media-backup-' + date + '.json', store.exportJSON(), 'application/json;charset=utf-8');
    if (window.NeonUI) window.NeonUI.toast('تم تنزيل نسخة احتياطية كاملة.', 'success');
  }

  function csvCell(value) {
    return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
  }

  function exportOrdersCsv() {
    var list = filteredOrders();
    if (!list.length) {
      if (window.NeonUI) window.NeonUI.toast('لا توجد طلبات لتصديرها.', 'info');
      return;
    }
    var rows = [
      ['رقم الطلب', 'التاريخ', 'العميل', 'الهاتف', 'الخدمة', 'المبلغ', 'العملة', 'طريقة الدفع', 'الحالة', 'ملاحظات']
    ].concat(list.map(function (order) {
      return [
        order.id, fmtDate(order.createdAt, true), order.name, order.phone, order.serviceTitle,
        order.amount, order.currency || settings().currency, order.paymentMethod, order.status, order.notes
      ];
    }));
    var csv = '\uFEFF' + rows.map(function (row) { return row.map(csvCell).join(','); }).join('\r\n');
    downloadFile('neon-orders-' + new Date().toISOString().slice(0, 10) + '.csv', csv, 'text/csv;charset=utf-8');
    if (window.NeonUI) window.NeonUI.toast('تم تصدير ' + list.length + ' طلب إلى CSV.', 'success');
  }

  function onImportFile(event) {
    var input = event.target;
    var file = input.files && input.files[0];
    if (!file) return;
    if (file.size > DATA_LIMIT * 3) {
      if (window.NeonUI) window.NeonUI.toast('الملف كبير جدًا. الحد الأقصى حوالي 15 ميجابايت.', 'error', 6000);
      input.value = '';
      return;
    }
    var reader = new FileReader();
    reader.onerror = function () {
      input.value = '';
      if (window.NeonUI) window.NeonUI.toast('تعذر قراءة الملف.', 'error');
    };
    reader.onload = function () {
      var text = String(reader.result || '');
      input.value = '';
      askConfirm(
        'استيراد نسخة احتياطية',
        'سيتم استبدال كل البيانات الحالية بمحتوى الملف «' + file.name + '». قد تتغير كلمة المرور إلى كلمة النسخة. هل تريد المتابعة؟',
        'نعم، استورد',
        function () {
          try {
            store.importJSON(text);
            state.settingsRendered = false;
            syncBrand();
            renderSettingsIfNeeded(true);
            refreshChrome();
            showView('dashboard');
            if (window.NeonUI) window.NeonUI.toast('تم استيراد النسخة الاحتياطية بنجاح.', 'success', 6000);
          } catch (error) {
            console.error('[Admin] import', error);
            if (window.NeonUI) window.NeonUI.toast('ملف غير صالح. تأكد أنه ملف JSON صادر من هذه اللوحة.', 'error', 7000);
          }
        }
      );
    };
    reader.readAsText(file, 'utf-8');
  }

  function resetAllData() {
    askConfirm(
      'استعادة البيانات الافتراضية',
      'سيتم مسح كل المحتوى والطلبات والرسائل وكلمة المرور المخصصة واستعادة بيانات العرض الافتراضية. لا يمكن التراجع.',
      'نعم، امسح الكل',
      function () {
        if (!store) return;
        store.reset();
        state.settingsRendered = false;
        syncBrand();
        logout('تمت استعادة البيانات الافتراضية. كلمة المرور عادت إلى Admin@2026.');
      }
    );
  }

  function testCloud() {
    var button = qs('#cloudTestBtn');
    if (!window.NeonCloud) {
      if (window.NeonUI) window.NeonUI.toast('جسر Firebase غير محمّل.', 'error');
      return;
    }
    if (button) button.disabled = true;
    window.NeonCloud.testConnection().then(function (result) {
      if (window.NeonUI) window.NeonUI.toast(result.message, result.ok ? 'success' : 'error', 6500);
      refreshCloud();
    }).catch(function (error) {
      if (window.NeonUI) window.NeonUI.toast('تعذر اختبار الاتصال: ' + (error.message || ''), 'error', 6500);
      refreshCloud();
    }).then(function () {
      if (button) button.disabled = false;
    });
  }

  function syncCloudNow() {
    var button = qs('#cloudSyncBtn');
    if (!window.NeonCloud || !window.NeonCloud.isConfigured || !window.NeonCloud.isConfigured()) {
      if (window.NeonUI) window.NeonUI.toast('Firebase غير مفعّل. راجع خطوات التفعيل أولًا.', 'error', 6000);
      return;
    }
    if (button) button.disabled = true;
    if (window.NeonUI) window.NeonUI.toast('جارٍ رفع بياناتك إلى Firestore…', 'info');
    window.NeonCloud.save(store.getCloudData ? store.getCloudData() : store.get()).then(function () {
      if (window.NeonUI) window.NeonUI.toast('تمت مزامنة البيانات مع Firebase بنجاح.', 'success', 6000);
      refreshCloud();
    }).catch(function (error) {
      if (window.NeonUI) window.NeonUI.toast('تعذرت المزامنة: ' + (error.message || 'خطأ غير معروف'), 'error', 6500);
      refreshCloud();
    }).then(function () {
      if (button) button.disabled = false;
    });
  }

  /* ------------------------------------------------------------------------
     Delegated actions
     ------------------------------------------------------------------------ */
  function performAction(button) {
    if (!button || !store) return;
    var action = button.getAttribute('data-action');
    var collection = button.getAttribute('data-collection');
    var id = button.getAttribute('data-id');
    var item = collection && id ? store.getItem(collection, id) : null;

    if (action === 'reset-stats') {
      if (!item) return;
      askConfirm(
        'تصفير إحصائيات الحملة',
        'سيتم حذف مرات الظهور والنقرات والإغلاقات المسجلة لهذه الحملة. لن تتأثر بيانات الحملة نفسها.',
        'نعم، صفّر',
        function () {
          if (store.resetCampaignStats(id)) {
            if (window.NeonUI) window.NeonUI.toast('تم تصفير إحصائيات الحملة.', 'success');
            renderCurrentView();
          } else {
            if (window.NeonUI) window.NeonUI.toast('لا توجد إحصائيات مسجلة لهذه الحملة.', 'info');
          }
        }
      );
      return;
    }

    if (action === 'edit') {
      if (item && COLLECTIONS[collection]) openEditor(collection, id);
      return;
    }

    if (action === 'detail') {
      if (collection === 'orders') openOrderDetail(id);
      else if (collection === 'messages') openMessageDetail(id);
      else if (collection === 'customers') openCustomerDetail(id);
      else if (item && COLLECTIONS[collection]) openEditor(collection, id);
      return;
    }

    if (action === 'move') {
      var dir = button.getAttribute('data-dir') || 'up';
      if (store.moveItem(collection, id, dir)) {
        if (state.view === collection) renderCollection(collection);
        else refreshChrome();
      }
      return;
    }

    if (action === 'wa') {
      var phone = item ? (item.phone || item.email || settings().whatsapp || settings().phone) : '';
      var text = collection === 'orders' ? orderWaText(item || {}) : messageWaText(item || {});
      var url = waLink(phone, text);
      if (url === '#') {
        if (window.NeonUI) window.NeonUI.toast('لا يوجد رقم هاتف صالح لهذا العنصر.', 'error');
        return;
      }
      window.open(url, '_blank', 'noopener');
      return;
    }

    if (action === 'delete') {
      if (!item) return;
      var noun = COLLECTIONS[collection] ? COLLECTIONS[collection].noun : collection === 'orders' ? 'الطلب' : 'الرسالة';
      var label = itemLabel(collection, item);
      askConfirm(
        'حذف ' + noun,
        'سيتم حذف «' + label + '» نهائيًا. لا يمكن التراجع عن هذه الخطوة.',
        'نعم، احذف',
        function () {
          var cloudId = item._cloudId;
          if (store.removeItem(collection, id)) {
            if (cloudId && window.NeonCloud && window.NeonCloud.deleteRecord) {
              window.NeonCloud.deleteRecord(collection, cloudId).catch(function (error) {
                console.warn('[Admin] تعذر حذف ' + collection + ' من السحابة', error && error.code ? error.code : error);
              });
            }
            if (window.NeonUI) window.NeonUI.toast('تم حذف ' + noun + ' بنجاح.', 'success');
            refreshChrome();
            renderCurrentView();
          }
        }
      );
    }
  }

  function onDelegateClick(event) {
    var target = event.target;
    if (!target || !target.closest) return;

    var viewButton = target.closest('[data-view-btn]');
    if (viewButton) {
      event.preventDefault();
      showView(viewButton.getAttribute('data-view-btn'));
      return;
    }

    var addButton = target.closest('[data-add]');
    if (addButton) {
      event.preventDefault();
      var addCollection = addButton.getAttribute('data-add');
      if (COLLECTIONS[addCollection]) openEditor(addCollection);
      return;
    }

    var gotoButton = target.closest('[data-goto]');
    if (gotoButton) {
      event.preventDefault();
      showView(gotoButton.getAttribute('data-goto'));
      return;
    }

    var orderView = target.closest('[data-order-view]');
    if (orderView) {
      event.preventDefault();
      openOrderDetail(orderView.getAttribute('data-order-view'));
      return;
    }

    var messageView = target.closest('[data-message-view]');
    if (messageView) {
      event.preventDefault();
      openMessageDetail(messageView.getAttribute('data-message-view'));
      return;
    }

    var copyInvoiceBtn = target.closest('[data-copy-invoice], [data-order-id][data-copy-invoice]');
    if (copyInvoiceBtn) {
      event.preventDefault();
      var invoiceOrderId = copyInvoiceBtn.getAttribute('data-order-id');
      var invoiceOrder = invoiceOrderId ? store.getItem('orders', invoiceOrderId) : null;
      if (invoiceOrder && store.buildInvoice) {
        window.NeonUI.copyText(store.buildInvoice(invoiceOrder));
        window.NeonUI.toast('تم نسخ الفاتورة الإلكترونية كاملة.', 'success');
      }
      return;
    }

    var actionButtonEl = target.closest('[data-action]');
    if (actionButtonEl && actionButtonEl.getAttribute('data-action')) {
      event.preventDefault();
      performAction(actionButtonEl);
      return;
    }

    var taxInvoiceBtn = target.closest('[data-issue-tax-invoice]');
    if (taxInvoiceBtn) {
      event.preventDefault();
      printTaxReceipt(taxInvoiceBtn.getAttribute('data-issue-tax-invoice'));
      return;
    }

    var taxWaBtn = target.closest('[data-tax-receipt-wa]');
    if (taxWaBtn) {
      event.preventDefault();
      sendTaxReceiptWhatsApp(taxWaBtn.getAttribute('data-tax-receipt-wa'));
      return;
    }

    var advanceBtn = target.closest('[data-issue-advance-receipt]');
    if (advanceBtn) {
      event.preventDefault();
      printAdvanceReceipt(advanceBtn.getAttribute('data-issue-advance-receipt'));
      return;
    }

    var advanceWa = target.closest('[data-issue-advance-receipt-wa]');
    if (advanceWa) {
      event.preventDefault();
      sendAdvanceReceiptWhatsApp(advanceWa.getAttribute('data-issue-advance-receipt-wa'));
      return;
    }

    var advanceRecordBtn = target.closest('[data-record-advance]');
    if (advanceRecordBtn) {
      event.preventDefault();
      recordAdvancePayment(advanceRecordBtn.getAttribute('data-record-advance'));
      return;
    }

    var pointsButton = target.closest('[data-use-points]');
    if (pointsButton) {
      event.preventDefault();
      openPoints(pointsButton.getAttribute('data-use-points'));
    }
  }

  function onDelegateChange(event) {
    var target = event.target;
    if (!target || typeof target.matches !== 'function') return;

    if (target.matches('[data-toggle-active]')) {
      var collection = target.getAttribute('data-collection');
      var id = target.getAttribute('data-toggle-active');
      store.updateItem(collection, id, { active: target.checked });
      if (window.NeonUI) window.NeonUI.toast(target.checked ? 'تم إظهار العنصر في الموقع.' : 'تم إخفاء العنصر من الموقع.', 'success');
      renderCollection(collection);
      refreshChrome();
      return;
    }

    if (target.matches('[data-order-status]')) {
      var orderId = target.getAttribute('data-order-status');
      var orderItem = store.getItem('orders', orderId);
      var orderPatch = { status: target.value };
      if (target.value === 'مكتمل' && orderItem && !orderItem.executedAt) orderPatch.executedAt = new Date().toISOString();
      pushRecordUpdate('orders', orderItem, orderPatch);
      if (window.NeonUI) window.NeonUI.toast('تم تحديث حالة الطلب إلى «' + target.value + '».', 'success');
      refreshChrome();
      renderOrders();
      if (qs('#detailModal') && qs('#detailModal').classList.contains('show')) openOrderDetail(orderId);
      return;
    }

    if (target.matches('[data-payment-status]')) {
      var payId = target.getAttribute('data-payment-status');
      var payItem = store.getItem('orders', payId);
      var payPatch = { paymentStatus: target.value };
      if (target.value === 'مدفوع' && payItem && !payItem.paidAt) payPatch.paidAt = new Date().toISOString();
      pushRecordUpdate('orders', payItem, payPatch);
      if (window.NeonUI) window.NeonUI.toast('تم تحديث حالة الدفع إلى «' + target.value + '».', 'success');
      refreshChrome();
      renderOrders();
      if (qs('#detailModal') && qs('#detailModal').classList.contains('show')) openOrderDetail(payId);
      return;
    }

    if (target.matches('[data-message-status]')) {
      var messageId = target.getAttribute('data-message-status');
      pushRecordUpdate('messages', store.getItem('messages', messageId), { status: target.value });
      if (window.NeonUI) window.NeonUI.toast('تم تحديث حالة الرسالة إلى «' + target.value + '».', 'success');
      refreshChrome();
      renderMessages();
    }
  }

  function onDelegateKeydown(event) {
    touchSession();
    if (event.key === 'Escape') {
      closeSidebar();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      var target = event.target;
      if (!target || !target.closest) return;
      var card = target.closest('[data-order-view], [data-message-view]');
      if (card && target === card) {
        event.preventDefault();
        card.click();
      }
    }
  }

  /* ------------------------------------------------------------------------
     Bind events
     ------------------------------------------------------------------------ */
  function bindSearchAndFilter(key) {
    var search = qs('#search-' + key);
    if (search) {
      search.addEventListener('input', debounce(function () {
        state.search[key] = search.value.trim();
        if (state.view === key) renderCurrentView();
      }, 120));
    }
    var filter = qs('#filter-' + key);
    if (filter) {
      filter.addEventListener('change', function () {
        state.filter[key] = filter.value;
        if (state.view === key) renderCurrentView();
      });
    }
  }

  function initEvents() {
    if (state.eventsBound) return;
    state.eventsBound = true;

    initImageTools();
    initPasswordToggles();

    var loginForm = qs('#loginForm');
    if (loginForm) loginForm.addEventListener('submit', onLoginSubmit);

    var loginPassword = qs('#loginPassword');
    if (loginPassword) {
      loginPassword.addEventListener('input', function () { setHidden(qs('#loginError'), true); });
    }

    var editorForm = qs('#editorForm');
    if (editorForm) editorForm.addEventListener('submit', onEditorSubmit);

    var passwordForm = qs('#passwordForm');
    if (passwordForm) passwordForm.addEventListener('submit', onPasswordSubmit);
    var newPassword = qs('#newPassword');
    if (newPassword) newPassword.addEventListener('input', updatePasswordStrength);

    initSessionModeUI();
  initTotpUI();
  initForceLogoutListener();
    initPwaInstall();
    registerAdminSw();

    var logoutBtn = qs('#logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        askConfirm('تسجيل الخروج', 'هل تريد الخروج من لوحة التحكم الآن؟', 'نعم، خروج', function () {
          logout();
          if (window.NeonUI) window.NeonUI.toast('تم تسجيل الخروج.', 'info');
        });
      });
    }

    var menuBtn = qs('#adminMenuBtn');
    if (menuBtn) {
      menuBtn.addEventListener('click', function () {
        var sidebar = qs('#adminSidebar');
        if (sidebar && sidebar.classList.contains('is-open')) closeSidebar();
        else openSidebar();
      });
    }
    var overlay = qs('#adminOverlay');
    if (overlay) overlay.addEventListener('click', closeSidebar);

    var confirmOk = qs('#confirmOk');
    if (confirmOk) {
      confirmOk.addEventListener('click', function () {
        var action = state.confirmAction;
        state.confirmAction = null;
        hideModal('confirmModal');
        if (typeof action === 'function') {
          try { action(); } catch (error) { console.error('[Admin] confirm action', error); }
        }
      });
    }

    var exportBtn = qs('#exportBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportBackup);
    var copyJsonBtn = qs('#copyJsonBtn');
    if (copyJsonBtn) {
      copyJsonBtn.addEventListener('click', function () {
        if (window.NeonUI) window.NeonUI.copyText(store.exportJSON());
      });
    }
    var importBtn = qs('#importBtn');
    if (importBtn) {
      importBtn.addEventListener('click', function () {
        var file = qs('#importFile');
        if (file) file.click();
      });
    }
    var importFile = qs('#importFile');
    if (importFile) importFile.addEventListener('change', onImportFile);
    var resetBtn = qs('#resetDataBtn');
    if (resetBtn) resetBtn.addEventListener('click', resetAllData);

    var exportOrders = qs('#exportOrdersBtn');
    if (exportOrders) exportOrders.addEventListener('click', exportOrdersCsv);

    var markAllRead = qs('#markAllReadBtn');
    if (markAllRead) {
      markAllRead.addEventListener('click', function () {
        var messages = store.get().messages || [];
        var unread = messages.filter(function (message) { return message.status === 'جديد'; });
        if (!unread.length) {
          if (window.NeonUI) window.NeonUI.toast('كل الرسائل مقروءة بالفعل.', 'info');
          return;
        }
        store.update(function (data) {
          (data.messages || []).forEach(function (message) {
            if (message.status === 'جديد') message.status = 'مقروء';
          });
        }, { source: 'messages' });
        if (window.NeonUI) window.NeonUI.toast('تم تعليم ' + unread.length + ' رسالة كمقروءة.', 'success');
      });
    }

    var cloudTest = qs('#cloudTestBtn');
    if (cloudTest) cloudTest.addEventListener('click', testCloud);
    var cloudSync = qs('#cloudSyncBtn');
    if (cloudSync) cloudSync.addEventListener('click', syncCloudNow);
    var cloudAuthForm = qs('#cloudAuthForm');
    if (cloudAuthForm) cloudAuthForm.addEventListener('submit', cloudSignIn);
    var cloudAuthOut = qs('#cloudAuthOutBtn');
    if (cloudAuthOut) cloudAuthOut.addEventListener('click', cloudSignOut);

    Object.keys(COLLECTIONS).forEach(bindSearchAndFilter);
    bindSearchAndFilter('orders');
    bindSearchAndFilter('messages');

    var exportCustomers = qs('#exportCustomersBtn');
    if (exportCustomers) exportCustomers.addEventListener('click', exportCustomersCsv);
    var backfillCustomers = qs('#backfillCustomersBtn');
    if (backfillCustomers) backfillCustomers.addEventListener('click', syncOldCustomers);
    var campaignBtn = qs('#campaignBtn');
    if (campaignBtn) campaignBtn.addEventListener('click', openCampaign);
    var campaignTemplate = qs('#campaignTemplate');
    if (campaignTemplate) {
      campaignTemplate.addEventListener('change', function () {
        var template = store.getItem('templates', campaignTemplate.value);
        var textEl = qs('#campaignText');
        if (template && textEl) textEl.value = template.text || '';
        renderCampaignList();
      });
    }
    var campaignAudience = qs('#campaignAudience');
    if (campaignAudience) campaignAudience.addEventListener('change', renderCampaignList);
    var campaignText = qs('#campaignText');
    if (campaignText) campaignText.addEventListener('input', debounce(renderCampaignList, 220));
    var campaignFirst = qs('#campaignSendFirst');
    if (campaignFirst) {
      campaignFirst.addEventListener('click', function () {
        if (state.campaignFirstLink && state.campaignFirstLink !== '#') {
          window.open(state.campaignFirstLink, '_blank', 'noopener');
        }
      });
    }
    var pointsSave = qs('#pointsSaveBtn');
    if (pointsSave) pointsSave.addEventListener('click', savePoints);
    [
      { selector: '#resetBannerStatsBtn', collection: 'banners', label: 'البانرات' },
      { selector: '#resetPopupStatsBtn', collection: 'popups', label: 'النوافذ المنبثقة' }
    ].forEach(function (config) {
      var button = qs(config.selector);
      if (!button) return;
      button.addEventListener('click', function () {
        askConfirm(
          'تصفير إحصائيات ' + config.label,
          'سيتم حذف كل مرات الظهور والنقرات والإغلاقات المسجلة لـ' + config.label + '. لن تتأثر بيانات الحملات نفسها.',
          'نعم، صفّر',
          function () {
            if (clearCampaignStats(config.collection)) {
              if (window.NeonUI) window.NeonUI.toast('تم تصفير إحصائيات ' + config.label + '.', 'success');
            } else {
              if (window.NeonUI) window.NeonUI.toast('لا توجد إحصائيات مسجلة.', 'info');
            }
            renderCurrentView();
          }
        );
      });
    });
    var reportExport = qs('#reportExportBtn');
    if (reportExport) reportExport.addEventListener('click', exportReportCsv);
    qsa('[data-report-tab]').forEach(function (tabButton) {
      tabButton.addEventListener('click', function () {
        state.report.tab = tabButton.getAttribute('data-report-tab');
        renderReports();
      });
    });
    qsa('[data-range]').forEach(function (rangeButton) {
      rangeButton.addEventListener('click', function () {
        setReportRange(rangeButton.getAttribute('data-range'));
      });
    });
    ['#reportFrom', '#reportTo'].forEach(function (selector) {
      var input = qs(selector);
      if (input) input.addEventListener('change', function () {
        qsa('[data-range]').forEach(function (rangeButton) { rangeButton.classList.remove('is-active'); });
        renderReports();
      });
    });

    document.addEventListener('click', onDelegateClick);
    document.addEventListener('change', onDelegateChange);
    document.addEventListener('keydown', onDelegateKeydown);
    document.addEventListener('pointerdown', touchSession, { passive: true });
    document.addEventListener('touchstart', touchSession, { passive: true });

    window.addEventListener('neon:cloudstatus', function (event) {
      refreshCloud();
      refreshCloudAuth();
      var status = event && event.detail && event.detail.status;
      if (status === 'auth-in' || status === 'connected' || status === 'syncing') {
        // استئناف المتابعة بعد استعادة جلسة Firebase أو العودة للاتصال.
        startCloudWatchers(false);
        setTimeout(function () { startCloudWatchers(true); }, 700);
        setTimeout(function () { startCloudWatchers(true); }, 3500);
      }
    });
    window.addEventListener('neon:admin-check', function () {
      startCloudWatchers(true);
    });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && state.loggedIn) startCloudWatchers(true);
    });
    setInterval(function () {
      if (state.loggedIn && !document.hidden) startCloudWatchers(true);
    }, 5 * 60 * 1000);
    window.addEventListener('resize', function () {
      if (window.innerWidth > 991) closeSidebar();
    });

    if (store) {
      store.subscribe(function (data, source) {
        refreshChrome();
        if (!state.loggedIn) return;
        var external = source === 'cloud' || source === 'cloud-load' || source === 'storage' || source === 'import' || source === 'reset';
        if (external) {
          state.settingsRendered = false;
          syncBrand();
          if (state.view === 'settings') {
            var active = document.activeElement;
            var grid = qs('#settingsGrid');
            if (!grid || !active || !grid.contains(active)) renderSettingsIfNeeded(true);
          } else {
            renderCurrentView();
          }
          return;
        }
        if (source === 'settings') return;
        if (state.view && state.view !== 'settings' && state.view !== 'security') renderCurrentView();
      });
    }
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */
  function boot() {
    if (state.booted) return;
    state.booted = true;
    syncBrand();
    initEvents();
    refreshChrome();
    updatePasswordStrength();

    var start = function () {
      syncBrand();
      refreshChrome();
      if (sessionValid()) showApp();
      else showLogin();
    };

    if (!store) {
      showLogin();
      showLoginError('تعذر تحميل طبقة البيانات. تأكد من تحميل assets/js/store.js.');
      return;
    }

    if (store.ready && typeof store.ready.then === 'function') {
      store.ready.then(start).catch(function () { start(); });
    } else {
      start();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
