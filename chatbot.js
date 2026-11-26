/* ==========================================================================
   NÉON MEDIA — مساعد المحادثة (Chatbot)
   مساعد محلي سريع يجيب من محتوى الموقع نفسه (خدمات، باقات، دفع، أسئلة شائعة)
   ويساعد الزائر على الطلب أو التواصل. لا يرسل البيانات لأي خدمة خارجية.
   المالك: هشام السيد — Hesham Elsayed
   ========================================================================== */
(function () {
  'use strict';

  var store = window.NeonStore;
  if (!store) return;
  var UI = window.NeonUI;
  var data = null;
  var state = { open: false, greeted: false, pending: '', lastUser: '', lastChips: [] };
  var root, panel, log, input, form, sendBtn;

  var QUICK = [
    'الخدمات والأسعار',
    'الباقات الشهرية',
    'طرق الدفع',
    'حالة طلبي',
    'العروض',
    'تحدث معنا'
  ];

  var WELCOME_BY_TIME = {
    morning: ['صباح الفل ☀️', 'صباح النور 🌤️', 'صباح الخير يا فندم 🌞'],
    evening: ['مساء النور 🌙', 'مساء الفل ✨', 'مساء الخير 🌆'],
    night: ['سهران معانا؟ 🌙', 'نوّرت بالليل ✨', 'أهلًا بيك في أي وقت 🌌']
  };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function norm(value) {
    return String(value == null ? '' : value)
      .toLowerCase()
      .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[^\w\u0600-\u06FF\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function has(q, words) {
    for (var i = 0; i < words.length; i += 1) {
      if (q.indexOf(norm(words[i])) !== -1) return true;
    }
    return false;
  }

  function settings() { return (data && data.settings) || {}; }

  function brand() {
    var s = settings();
    return s.siteName || s.ownerName || 'هشام السيد';
  }

  function fullBrand() {
    var s = settings();
    var name = s.siteName || 'هشام السيد';
    return name + ' — نِيون ميديا';
  }

  function list(name) {
    return (data && Array.isArray(data[name]) ? data[name] : []).filter(function (item) {
      return item && item.active !== false;
    });
  }

  function money(value, currency) {
    if (store && store.formatPrice) return store.formatPrice(value, currency);
    return Number(value || 0).toLocaleString('en-US') + ' ' + (settings().currency || 'ج.م');
  }

  function waNumber() {
    var raw = String(settings().whatsapp || settings().phone || '').replace(/[^\d]/g, '');
    return raw.replace(/^0+/, '');
  }

  function openWhatsApp(text) {
    var number = waNumber();
    var url = 'https://wa.me/' + number + '?text=' + encodeURIComponent(text || 'مرحبًا، أريد الاستفسار عن خدماتكم.');
    window.open(url, '_blank', 'noopener');
  }

  function socialLinks() {
    var socials = settings().socials || {};
    var items = [];
    if (socials.instagram) items.push({ name: 'إنستجرام 📸', url: socials.instagram });
    if (socials.facebook) items.push({ name: 'فيسبوك 👍', url: socials.facebook });
    if (socials.tiktok) items.push({ name: 'تيك توك 🎵', url: socials.tiktok });
    if (socials.behance) items.push({ name: 'بيهانس 🎨', url: socials.behance });
    return items;
  }

  var NINO_SVG = '<svg class="nino-fig" viewBox="0 0 48 48" fill="none" aria-hidden="true">'
    + '<circle cx="24" cy="24" r="22.6" fill="#0b1220" stroke="#22e7ff" stroke-opacity=".78" stroke-width="1.8"/>'
    + '<path d="M10 44 C11.5 36.5 15.5 32.6 24 32.6 C32.5 32.6 36.5 36.5 38 44 Z" fill="#17203a"/>'
    + '<path d="M24 14 C30.5 14 33 18.5 33 24.4 C33 29.6 29.4 32.4 24 32.4 C18.6 32.4 15 29.6 15 24.4 C15 18.5 17.5 14 24 14 Z" fill="#f0c3a4"/>'
    + '<path d="M15 24.2 C14.5 15 19 11.5 24 11.5 C29 11.5 33.5 15 33 24.2 C29.3 17.6 26.5 16.2 24 16.2 C21.5 16.2 18.7 17.6 15 24.2 Z" fill="#191f2e"/>'
    + '<rect x="9.3" y="22.4" width="4.9" height="9" rx="2.45" fill="#0f1520"/><rect x="33.8" y="22.4" width="4.9" height="9" rx="2.45" fill="#0f1520"/>'
    + '<path d="M14 22.8 C15.2 14.7 19.1 12 24 12 C28.9 12 32.8 14.7 34 22.8" stroke="#0f1520" stroke-width="3" stroke-linecap="round" fill="none"/>'
    + '<path d="M17.8 24.2 L21.7 23.9 M26.3 23.9 L30.2 24.2" stroke="#20283a" stroke-width="2" stroke-linecap="round"/>'
    + '<circle cx="19.5" cy="26.4" r="1.6" fill="#141a27"/><circle cx="28.5" cy="26.4" r="1.6" fill="#141a27"/>'
    + '<path d="M21.4 30 Q24 32 26.6 30" stroke="#b3765e" stroke-width="1.5" stroke-linecap="round" fill="none"/>'
    + '<circle cx="38.6" cy="33.6" r="2.7" fill="#35f5a0"/>'
    + '</svg>';

  /* ---------------------------------------------------------------------- */
  /* Rendering                                                              */
  /* ---------------------------------------------------------------------- */
  function build() {
    root = document.createElement('div');
    root.className = 'chatbot';
    root.innerHTML = '' +
      '<div class="chatbot-panel" id="chatbotPanel" role="dialog" aria-label="تحدث مع نِينو" aria-modal="false">' +
        '<div class="chatbot-head">' +
          '<span class="chatbot-avatar chatbot-avatar--nino" aria-hidden="true">' + NINO_SVG + '</span>' +
          '<div class="chatbot-head__text"><strong id="chatbotTitle">تحدث مع نِينو</strong><span>نِينو · مساعد نِيون · ردّ فوري من محتوى الموقع · متاح 24/7</span></div>' +
          '<button type="button" class="chatbot-close" data-chat-action="close" aria-label="إغلاق المحادثة">×</button>' +
        '</div>' +
        '<div class="chatbot-log" id="chatbotLog" role="log" aria-live="polite"></div>' +
        '<div class="chatbot-suggest" id="chatbotSuggest"></div>' +
        '<form class="chatbot-form" id="chatbotForm">' +
          '<input type="text" id="chatbotInput" autocomplete="off" placeholder="اسأل نِينو… مثلاً: عايز أعرف الأسعار" aria-label="اكتب رسالتك">' +
          '<button type="submit" aria-label="إرسال">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12 16-8-6 16-2-6-8-2Z"/></svg>' +
          '</button>' +
        '</form>' +
      '</div>' +
      '<button type="button" class="chatbot-fab" data-chat-action="toggle" aria-label="تحدث مع نِينو" title="تحدث مع نِينو">' +
        NINO_SVG +
        '<span class="chatbot-fab__label" aria-hidden="true">تحدث مع <strong>نِينو</strong></span>' +
        '<span class="chatbot-fab__dot" aria-hidden="true"></span>' +
      '</button>';
    document.body.appendChild(root);
    panel = root.querySelector('#chatbotPanel');
    log = root.querySelector('#chatbotLog');
    input = root.querySelector('#chatbotInput');
    form = root.querySelector('#chatbotForm');
    sendBtn = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      send(input.value);
    });
    root.addEventListener('click', onClick);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && state.open) closePanel();
    });
  }

  function suggest(chips) {
    var box = root.querySelector('#chatbotSuggest');
    if (!box) return;
    state.lastChips = chips || [];
    box.innerHTML = (chips || []).map(function (chip) {
      return '<button type="button" class="chatbot-chip" data-chat-send="' + esc(chip) + '">' + esc(chip) + '</button>';
    }).join('');
  }

  function bubble(role, html) {
    var el = document.createElement('div');
    el.className = 'chatbot-msg chatbot-msg--' + role;
    el.innerHTML = '<div class="chatbot-bubble">' + html + '</div>';
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function typing() {
    var el = document.createElement('div');
    el.className = 'chatbot-msg chatbot-msg--bot chatbot-typing';
    el.innerHTML = '<div class="chatbot-bubble"><span></span><span></span><span></span></div>';
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function botReply(html, chips) {
    var t = typing();
    var delay = Math.min(900, 260 + Math.floor(String(html || '').length / 3));
    setTimeout(function () {
      if (t && t.parentNode) t.parentNode.removeChild(t);
      bubble('bot', html);
      if (chips) suggest(chips);
      if (log) log.scrollTop = log.scrollHeight;
    }, delay);
  }

  function actionRow(actions) {
    return '<div class="chatbot-actions">' + actions.map(function (action) {
      return '<button type="button" class="chatbot-action' + (action.primary ? ' is-primary' : '') + '" data-chat-action="' + esc(action.action) + '"' + (action.value ? ' data-chat-value="' + esc(action.value) + '"' : '') + '>' + esc(action.label) + '</button>';
    }).join('') + '</div>';
  }

  /* ---------------------------------------------------------------------- */
  /* Answers                                                                */
  /* ---------------------------------------------------------------------- */
  function servicesText() {
    var services = list('services');
    if (!services.length) return 'الخدمات هتظهر هنا قريبًا. ✨';
    return '<strong>الخدمات المتاحة 🛠️</strong><div class="chatbot-list">' + services.slice(0, 10).map(function (service) {
      return '<div class="chatbot-list__row"><span data-no-i18n="">' + esc(service.title) + '</span><b data-no-i18n="">' + esc(money(service.price)) + (service.unit ? ' ' + esc(service.unit) : '') + '</b></div>';
    }).join('') + '</div><span class="chatbot-note">الأسعار تقديرية — التفاصيل النهائية تُتفق عليها في الطلب. عندنا ' + services.length + ' خدمة تقدر تختار منها 👌</span>' +
      actionRow([{ label: 'اطلب الآن 🛒', action: 'order', primary: true }, { label: 'الباقات الشهرية 📦', action: 'packages' }]);
  }

  function serviceDetail(service) {
    if (!service) return servicesText();
    var features = Array.isArray(service.features) ? service.features.filter(Boolean) : [];
    return '<strong data-no-i18n="">' + esc(service.title) + ' ✨</strong>' +
      '<p class="chatbot-answer" data-no-i18n="">' + esc(service.short || service.description || '') + '</p>' +
      '<div class="chatbot-list">' +
        '<div class="chatbot-list__row"><span data-i18n-ui>السعر</span><b data-no-i18n="">' + esc(money(service.price)) + (service.unit ? ' ' + esc(service.unit) : '') + '</b></div>' +
        (service.duration ? '<div class="chatbot-list__row"><span data-i18n-ui>مدة التنفيذ</span><b data-no-i18n="">' + esc(service.duration) + '</b></div>' : '') +
      '</div>' +
      (features.length ? '<div class="chatbot-note" data-no-i18n="">تشمل: ' + features.slice(0, 5).map(esc).join(' · ') + '</div>' : '') +
      actionRow([
        { label: 'اطلب الخدمة 🛒', action: 'order', primary: true },
        { label: 'كل الخدمات 🛠️', action: 'services' },
        { label: 'كلمني واتساب 💬', action: 'whatsapp', value: 'مرحبًا، أريد الاستفسار عن خدمة ' + service.title }
      ]);
  }

  function packagesText() {
    var packages = list('packages');
    if (!packages.length) return 'الباقات الشهرية هتظهر هنا قريبًا. 📦';
    return '<strong>الباقات الشهرية 📦</strong><div class="chatbot-list">' + packages.map(function (pkg) {
      return '<div class="chatbot-list__row"><span data-no-i18n="">' + esc(pkg.name) + (pkg.badge ? ' · ' + esc(pkg.badge) : '') + '</span><b data-no-i18n="">' + esc(money(pkg.price)) + (pkg.period ? ' ' + esc(pkg.period) : '') + '</b></div>';
    }).join('') + '</div><span class="chatbot-note">كل باقة قابلة للتخصيص حسب حجم مشروعك، وتقدر تبدأ بأصغر باقة وتطوّرها في أي وقت 📈</span>' +
      actionRow([{ label: 'اطلب باقة 🛒', action: 'order', primary: true }, { label: 'الخدمات المفردة 🛠️', action: 'services' }]);
  }

  function paymentsText() {
    var payments = list('payments');
    if (!payments.length) return 'الدفع حاليًا يتم بالاتفاق عبر واتساب. 💳';
    return '<strong>طرق الدفع المتاحة 💳</strong><div class="chatbot-list">' + payments.map(function (payment) {
      return '<div class="chatbot-list__row"><span data-no-i18n="">' + esc(payment.name) + '</span><b dir="ltr" data-no-i18n="">' + esc(payment.value || '—') + '</b></div>';
    }).join('') + '</div><span class="chatbot-note">🔒 لا نطلب بيانات بطاقة داخل الموقع نهائيًا. الدفع الإلكتروني متاح (إنستاباي، فودافون كاش، تحويل بنكي أو رابط دفع آمن)، والإيصال متاح بعد اكتمال الطلب.</span>' +
      actionRow([{ label: 'اطلب الآن 🛒', action: 'order', primary: true }, { label: 'الفاتورة الضريبية 🧾', action: 'send', value: 'الفاتورة الضريبية' }]);
  }

  function worksText() {
    var works = list('works');
    if (!works.length) return 'الأعمال هتظهر هنا قريبًا. 🎨';
    return '<strong>مختارات من أعمالنا 🎨</strong><div class="chatbot-list">' + works.slice(0, 6).map(function (work) {
      return '<div class="chatbot-list__row"><span data-no-i18n="">' + esc(work.title) + (work.client ? ' — ' + esc(work.client) : '') + '</span><b data-no-i18n="">' + esc(work.year || '') + '</b></div>';
    }).join('') + '</div><span class="chatbot-note">تقدر تشوف كل الأعمال والتفاصيل من قسم «أعمالنا» في الصفحة الرئيسية 👀</span>' +
      actionRow([{ label: 'شوف الأعمال 👀', action: 'works', primary: true }, { label: 'اطلب مشروعك 🚀', action: 'order' }]);
  }

  function offersText() {
    var s = settings();
    var banners = list('banners');
    var lines = [];
    if (s.announcementEnabled && s.announcement) lines.push('📣 ' + s.announcement);
    if (s.promoEnabled && s.promoTitle) lines.push('🎁 ' + s.promoTitle + (s.promoText ? ' — ' + s.promoText : '') + (s.promoCode ? ' · كود: ' + s.promoCode : ''));
    banners.forEach(function (banner) {
      if (banner.title) lines.push('✨ ' + banner.title + (banner.code ? ' · كود: ' + banner.code : ''));
    });
    if (!lines.length) return 'مفيش عروض منشورة حاليًا، لكن عندنا أسعار مرنة وباقات تناسب كل مشروع 💡 ابعتلنا تفاصيل مشروعك ونعملك عرض مخصص.';
    return '<strong data-i18n-ui>العروض الحالية 🎁</strong><div class="chatbot-lines" data-no-i18n="">' + lines.map(esc).join('<br>') + '</div>' +
      actionRow([{ label: 'احجز العرض 🎟️', action: 'order', primary: true }, { label: 'الباقات 📦', action: 'packages' }]);
  }

  function faqList(limit) {
    var faqs = list('faqs');
    if (!faqs.length) return '';
    return '<strong>أسئلة شائعة ❓</strong><div class="chatbot-faq">' + faqs.slice(0, limit || 4).map(function (faq) {
      return '<details><summary data-no-i18n="">' + esc(faq.question) + '</summary><p data-no-i18n="">' + esc(faq.answer) + '</p></details>';
    }).join('') + '</div>';
  }

  function contactText() {
    var s = settings();
    var parts = [];
    if (s.phone) parts.push('📞 هاتف: <span dir="ltr">' + esc(s.phone) + '</span>');
    if (s.whatsapp) parts.push('💬 واتساب: <span dir="ltr">+' + esc(String(s.whatsapp).replace(/[^\d]/g, '').replace(/^0+/, '')) + '</span>');
    if (s.email) parts.push('📧 إيميل: ' + esc(s.email));
    if (s.address) parts.push('📍 العنوان: ' + esc(s.address));
    if (s.workingHours) parts.push('🕒 المواعيد: ' + esc(s.workingHours));
    var socials = socialLinks();
    if (socials.length) {
      parts.push('🌐 السوشيال: ' + socials.map(function (item) {
        return '<a href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer">' + esc(item.name) + '</a>';
      }).join(' · '));
    }
    return '<strong data-i18n-ui>تواصل معنا 📬</strong><div class="chatbot-lines" data-no-i18n="">' + parts.join('<br>') + '</div>' +
      actionRow([
        { label: 'واتساب فوري 💬', action: 'whatsapp', primary: true },
        { label: 'صفحة التواصل 📄', action: 'contact' }
      ]);
  }

  function aboutText() {
    var s = settings();
    var highlights = Array.isArray(s.aboutHighlights) ? s.aboutHighlights.filter(Boolean) : [];
    return '<strong data-i18n-ui>مين إحنا؟ 👋</strong>' +
      '<p class="chatbot-answer" data-no-i18n="">' + esc(s.aboutText ? String(s.aboutText).split('\n')[0] : 'استوديو متكامل للتسويق الرقمي والتصميم والتصوير.') + '</p>' +
      '<div class="chatbot-lines" data-no-i18n="">' +
        '👤 المؤسس: <strong>' + esc(s.ownerName || 'م. هشام السيد') + '</strong>' +
        (s.ownerTitle ? '<br>💼 ' + esc(s.ownerTitle) : '') +
        (s.aboutYears ? '<br>⭐ خبرة ' + esc(s.aboutYears) + ' سنوات' : '') +
        (highlights.length ? '<br>✅ ' + highlights.slice(0, 4).map(esc).join(' · ') : '') +
      '</div>' +
      actionRow([{ label: 'شوف الأعمال 🎨', action: 'works', primary: true }, { label: 'تحدث معنا 💬', action: 'whatsapp' }]);
  }

  function orderStatusReply(query) {
    var clean = String(query || '').replace(/#/g, '').trim();
    var digits = String(query || '').replace(/\D/g, '');
    var orders = (store.get() && store.get().orders) || [];
    var found = orders.find(function (order) {
      var no = String(order.orderNo || order.id || '').toLowerCase();
      var phone = String(order.phone || '').replace(/\D/g, '');
      return (clean && no.indexOf(clean.toLowerCase()) !== -1) ||
        (digits.length >= 6 && phone.indexOf(digits) !== -1) ||
        (clean && String(order.id || '').toLowerCase() === clean.toLowerCase());
    });
    if (!found) {
      return 'ما لقيتش طلب بالرقم ده على المتصفح الحالي 🔎<br>لو الطلب اتعمل من جهاز تاني أو من حسابك، تقدر تشوفه من صفحة <strong>«حسابي»</strong>، أو ابعت رقم الطلب على واتساب وهنتأكد لك فورًا 💬' +
        actionRow([
          { label: 'افتح حسابي 👤', action: 'account', primary: true },
          { label: 'أرسل رقم الطلب واتساب 💬', action: 'whatsapp', value: 'مرحبًا، أريد الاستفسار عن حالة الطلب رقم ' + String(query || '') }
        ]);
    }
    var status = found.status || 'جديد';
    var statusEmoji = status === 'مكتمل' ? '✅' : status === 'قيد التنفيذ' ? '⚙️' : status === 'ملغي' ? '❌' : '🆕';
    return '<strong>تفاصيل الطلب ' + esc(found.orderNo || found.id) + ' ' + statusEmoji + '</strong>' +
      '<div class="chatbot-list">' +
        '<div class="chatbot-list__row"><span data-i18n-ui>الحالة</span><b data-no-i18n="">' + esc(status) + '</b></div>' +
        '<div class="chatbot-list__row"><span data-i18n-ui>الدفع</span><b data-no-i18n="">' + esc(store.orderPaymentStatus ? store.orderPaymentStatus(found) : (found.paymentStatus || '—')) + '</b></div>' +
        '<div class="chatbot-list__row"><span data-i18n-ui>الإجمالي</span><b data-no-i18n="">' + esc(money(found.total != null ? found.total : found.amount, found.currency)) + '</b></div>' +
      '</div>' +
      (status === 'مكتمل' ? '<span class="chatbot-note">تم تنفيذ الطلب بنجاح 🎉 تقدر تطلب الإيصال الضريبي المعتمد من صفحة «حسابي» أو واتساب 🧾</span>' : '<span class="chatbot-note">هنحدّث الحالة أول ما يبدأ التنفيذ أو يكتمل، وتقدر تتابعها من «حسابي» 👤</span>') +
      actionRow([{ label: 'افتح حسابي 👤', action: 'account', primary: true }, { label: 'كل الخدمات 🛠️', action: 'services' }]);
  }

  function invoiceText() {
    return '<strong>الإيصال الضريبي 🧾</strong>' +
      '<div class="chatbot-lines">' +
        '✅ بعد اكتمال الطلب واستلام الخدمة، نقدر نصدر لك <strong>إيصالًا ضريبيًا معتمدًا</strong> من الموقع.' +
        '<br>🔢 رقم الإيصال تسلسلي بصيغة <span dir="ltr">#HE-1001</span>.' +
        '<br>📅 التاريخ والوقت مكتوبان بالعربية.' +
        '<br>💳 حالة الدفع وطريقة الدفع موضحتان.' +
        '<br>🧮 ضريبة القيمة المضافة تظهر فقط عند تفعيلها مع رقم التسجيل الضريبي.' +
        '<br>🏦 الدفع الإلكتروني متاح (إنستاباي، فودافون كاش، تحويل بنكي أو رابط دفع آمن)، ولا نطلب بيانات بطاقة داخل الموقع.' +
      '</div>' +
      '<span class="chatbot-note">اطلب الإيصال من صفحة «حسابي» أو على واتساب بعد اكتمال الطلب 📬</span>' +
      actionRow([{ label: 'افتح حسابي 👤', action: 'account', primary: true }, { label: 'تحدث معنا 💬', action: 'whatsapp', value: 'مرحبًا، أريد إيصالًا ضريبيًا لطلبي.' }]);
  }

  function accountText() {
    return '<strong>حسابك في ' + esc(brand()) + ' 👤</strong>' +
      '<div class="chatbot-lines">' +
        '📝 تقدر تنشئ حسابًا مجانيًا بالاسم ورقم الموبايل والإيميل.' +
        '<br>🔐 كلمة مرور قوية لحماية حسابك.' +
        '<br>📦 كل طلب تعمله وأنت مسجّل الدخول يظهر تلقائيًا في «حسابي».' +
        '<br>🚚 تتابع حالة التنفيذ والدفع خطوة بخطوة.' +
        '<br>🧾 وتطلب الإيصال الضريبي بعد اكتمال الخدمة.' +
      '</div>' +
      actionRow([{ label: 'إنشاء حساب / دخول 👤', action: 'account', primary: true }, { label: 'اطلب كزائر 🛒', action: 'order' }]);
  }

  function securityText() {
    return '<strong>أمان حسابك 🔐</strong>' +
      '<div class="chatbot-lines">' +
        '🛡️ كلمات المرور تُدار عبر Firebase Auth ولا تُخزَّن داخل الموقع.' +
        '🔒 كل عميل يرى طلباته وبياناته فقط، والمشرف فقط يرى لوحة الإدارة.' +
        '📧 يمكنك تأكيد بريدك الإلكتروني وإعادة تعيين كلمة المرور في أي وقت.' +
        '🚫 لا نطلب بيانات بطاقة أو أي معلومات حساسة داخل المحادثة.' +
      '</div>' +
      actionRow([{ label: 'افتح حسابي 👤', action: 'account', primary: true }, { label: 'سياسة الخصوصية 📄', action: 'send', value: 'سياسة الخصوصية' }]);
  }

  function privacyText() {
    return '<strong>سياسة الخصوصية 📄</strong>' +
      '<div class="chatbot-lines">' +
        '📌 بياناتك (الاسم، الموبايل، الإيميل، بيانات النشاط) تُستخدم فقط لتنفيذ طلباتك والتواصل معك.' +
        '<br>📦 طلباتك مرتبطة بحسابك ولا تظهر لعملاء آخرين.' +
        '<br>🔐 لا نبيع بياناتك ولا نشاركها مع أي طرف ثالث لأغراض تسويقية.' +
        '<br>🗑️ تقدر تطلب حذف بياناتك بالتواصل معنا على واتساب.' +
      '</div>' +
      actionRow([{ label: 'حسابي 👤', action: 'account', primary: true }, { label: 'تحدث معنا 💬', action: 'whatsapp' }]);
  }

  function helpText() {
    return '<strong>أقدر أساعدك في إيه؟ ⚡</strong>' +
      '<div class="chatbot-lines">' +
        '🛠️ الخدمات والأسعار • 📦 الباقات الشهرية • 💳 طرق الدفع' +
        '<br>📋 حالة الطلب • 🧾 الإيصال الضريبي • 🎁 العروض' +
        '<br>🎨 الأعمال • 👤 الحساب والتسجيل • 🔐 الأمان والخصوصية' +
        '<br>📍 العنوان والمواعيد • 💬 التواصل مع الفريق' +
      '</div>' +
      '<span class="chatbot-note">اكتب سؤالك بالعامية أو بالفصحى، وأنا هفهمك 👌</span>';
  }

  function searchFaqs(query) {
    var words = norm(query).split(' ').filter(function (word) { return word.length > 2; });
    if (!words.length) return null;
    var best = null;
    var bestScore = 0;
    list('faqs').forEach(function (faq) {
      var haystack = norm((faq.question || '') + ' ' + (faq.answer || ''));
      var score = words.reduce(function (sum, word) { return sum + (haystack.indexOf(word) !== -1 ? 1 : 0); }, 0);
      if (score > bestScore) { bestScore = score; best = faq; }
    });
    return bestScore >= 1 ? best : null;
  }

  function findService(query) {
    var q = norm(query);
    if (!q) return null;
    var services = list('services');
    var best = null;
    var bestScore = 0;
    services.forEach(function (service) {
      var haystack = norm([service.title, service.category, service.short, service.description].join(' '));
      var words = q.split(' ').filter(function (word) { return word.length > 2; });
      var score = words.reduce(function (sum, word) { return sum + (haystack.indexOf(word) !== -1 ? 1 : 0); }, 0);
      if (service.title && q.indexOf(norm(service.title)) !== -1) score += 5;
      if (score > bestScore) { bestScore = score; best = service; }
    });
    return bestScore >= 2 ? best : null;
  }

  function timeGreeting() {
    var hour = new Date().getHours();
    var pool = hour < 12 ? WELCOME_BY_TIME.morning : hour < 18 ? WELCOME_BY_TIME.evening : WELCOME_BY_TIME.night;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function welcomeMessage() {
    var messages = [
      timeGreeting() + ' 👋<br>أنا <strong>نِينو</strong>، مساعد نِيون ⚡<br>أقدر أقولك أسعار الخدمات، الباقات، طرق الدفع، حالة طلبك، أو أوصلك بالفريق مباشرة.<br>تحب نبدأ بإيه؟ 😊',
      'أهلًا وسهلًا بيك ✨<br>معاك <strong>نِينو</strong>، مساعد نِيون —<br>أنا هنا عشان أسهّل عليك: خدمات وأسعار 🛠️، باقات 📦، دفع 💳، متابعة طلب 📋، أو تواصل مباشر 💬.<br>اسألني أي حاجة!',
      'نوّرت الاستوديو 🌟<br>أنا <strong>نِينو</strong>، مساعد نِيون.<br>عايز تعرف الأسعار؟ الباقات؟ طرق الدفع؟ أو حالة طلبك؟ اختار من الأزرار أو اكتب سؤالك 👇',
      'أهلًا بيك يا فندم 🌹<br>معاك <strong>نِينو</strong>، مساعد نِيون.<br>أقدر أساعدك تختار الخدمة المناسبة، تعرف التكلفة، تتابع طلبك، أو تتواصل معنا على واتساب 💬<br>إزاي أقدر أساعدك النهاردة؟ 😊'
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  function answer(raw) {
    var q = norm(raw);
    state.lastUser = raw;
    if (!q) return;

    if (state.pending === 'status') {
      state.pending = '';
      botReply(orderStatusReply(raw), QUICK);
      return;
    }

    if (has(q, ['سلام', 'السلام عليكم', 'هاي', 'هلا', 'اهلا', 'مرحبا', 'صباح', 'مساء', 'hello', 'hi'])) {
      botReply(welcomeMessage(), QUICK);
      return;
    }

    if (has(q, ['اخبارك', 'عامل ايه', 'ازيك', 'كيف حالك', 'how are you'])) {
      botReply('أنا تمام وبخدمتك 😄✨<br>المهم إنت عامل إيه؟ قولي مشروعك في إيه وأنا أرشحلك الأنسب 🚀', QUICK);
      return;
    }

    if (has(q, ['شكرا', 'شكرًا', 'تسلم', 'مشكور', 'thanks', 'thank'])) {
      botReply('العفو! دايمًا في خدمتك 🌟<br>لو احتجت أي حاجة تانية أنا هنا، ويسعدني أشوف مشروعك يكبر 🚀', ['الخدمات والأسعار', 'تحدث معنا']);
      return;
    }

    if (has(q, ['سلام عليكم', 'باي', 'مع السلامة', 'goodbye', 'bye'])) {
      botReply('مع السلامة 👋✨<br>يومك سعيد، ولما تحب تبدأ مشروعك أنا في انتظارك 🌟', QUICK);
      return;
    }

    if (has(q, ['مين انت', 'من انت', 'اسمك', 'who are you', 'انت مين'])) {
      botReply('أنا <strong>نِينو</strong>، مساعد نِيون ⚡<br>مساعد ذكي بيجاوب من محتوى الموقع نفسه: خدمات، باقات، دفع، أسئلة شائعة، ومتابعة الطلبات.<br>مش بشر، لكن بفهم عليك 😄', QUICK);
      return;
    }

    if (has(q, ['مين صاحب', 'صاحب الموقع', 'المؤسس', 'مين هشام', 'عن الموقع', 'من نحن', 'about', 'owner'])) {
      botReply(aboutText(), ['الأعمال', 'الخدمات والأسعار', 'تحدث معنا']);
      return;
    }

    if (has(q, ['اعمال', 'أعمال', 'بورتفوليو', 'portfolio', 'works', 'شغل'])) {
      botReply(worksText(), ['الخدمات والأسعار', 'اطلب الآن', 'تحدث معنا']);
      return;
    }

    if (has(q, ['عروض', 'عرض', 'خصم', 'خصومات', 'كوبون', 'كود', 'offer', 'discount', 'promo'])) {
      botReply(offersText(), ['الباقات', 'اطلب الآن', 'تحدث معنا']);
      return;
    }

    if (has(q, ['ضريبه', 'ضريبة', 'فاتوره', 'فاتورة', 'ايصال', 'إيصال', 'tax', 'invoice'])) {
      botReply(invoiceText(), ['حالة طلبي', 'حسابي', 'تحدث معنا']);
      return;
    }

    if (has(q, ['ضمان', 'استرداد', 'استرجاع', 'مبلغ', 'فلوسي', 'refund', 'guarantee'])) {
      botReply('<strong>الضمان والاسترداد 🛡️</strong><div class="chatbot-lines">' +
        '✅ بنشتغل بالتعديلات حتى الرضا على التصميم قبل التسليم النهائي.' +
        '<br>📄 شروط الاسترداد بتتفق قبل بدء التنفيذ وتتكتب في عرض السعر.' +
        '<br>💳 المبالغ المدفوعة مقابل شغل اتنفذ فعليًا غير قابلة للاسترداد.' +
        '<br>📞 لو فيه أي مشكلة، كلمنا فورًا وهنحلها معاك.' +
        '</div>' + actionRow([{ label: 'تحدث معنا 💬', action: 'whatsapp', primary: true }, { label: 'الأسئلة الشائعة ❓', action: 'send', value: 'الأسئلة الشائعة' }]), ['الخدمات والأسعار', 'تحدث معنا']);
      return;
    }

    if (has(q, ['تعديل', 'تعديلات', 'مراجعه', 'مراجعة', 'revision', 'تغيير'])) {
      botReply('<strong>التعديلات ✏️</strong><div class="chatbot-lines">' +
        '🔁 كل خدمة فيها عدد تعديلات متفق عليه قبل البدء.' +
        '<br>📝 بنستقبل ملاحظاتك مرة واحدة مجمّعة عشان ننجز أسرع.' +
        '<br>⏱️ التعديلات الإضافية بعد التسليم بتتكلف حسب حجم التغيير.' +
        '</div>' + actionRow([{ label: 'اطلب الآن 🛒', action: 'order', primary: true }, { label: 'تحدث معنا 💬', action: 'whatsapp' }]), ['الخدمات والأسعار', 'الباقات']);
      return;
    }

    if (has(q, ['مده', 'مدة', 'وقت التنفيذ', 'امتى', 'تسليم', 'delivery', 'time'])) {
      botReply('<strong>مدة التنفيذ ⏱️</strong><div class="chatbot-lines">' +
        '⚡ التصاميم البسيطة: من 24–48 ساعة.' +
        '<br>🎨 الهوية الكاملة: من 3–7 أيام.' +
        '<br>📸 التصوير: من 2–5 أيام حسب الجلسة.' +
        '<br>📦 إدارة السوشيال: خدمة شهرية مستمرة.' +
        '<br>📅 المدة النهائية بتتحدد في عرض السعر حسب حجم المشروع.' +
        '</div>' + actionRow([{ label: 'اطلب الآن 🛒', action: 'order', primary: true }, { label: 'الخدمات والأسعار 🛠️', action: 'services' }]), ['الخدمات والأسعار', 'الباقات', 'تحدث معنا']);
      return;
    }

    if (has(q, ['حساب', 'تسجيل', 'تسجيل الدخول', 'انشاء حساب', 'إنشاء حساب', 'register', 'login', 'account'])) {
      botReply(accountText(), ['حالة طلبي', 'الأمان', 'الخدمات والأسعار']);
      return;
    }

    if (has(q, ['امان', 'أمان', 'امن', 'خصوصيه', 'خصوصية', 'security', 'privacy', 'بياناتي'])) {
      botReply(securityText(), ['سياسة الخصوصية', 'حسابي', 'تحدث معنا']);
      return;
    }

    if (has(q, ['سياسه الخصوصيه', 'سياسة الخصوصية', 'privacy policy'])) {
      botReply(privacyText(), ['الأمان', 'حسابي', 'تحدث معنا']);
      return;
    }

    if (has(q, ['الغاء', 'إلغاء', 'الغي', 'cancel', 'تعديل الطلب', 'اعدل الطلب'])) {
      botReply('<strong>تعديل أو إلغاء الطلب 🔄</strong><div class="chatbot-lines">' +
        '📞 تواصل معنا على واتساب بأسرع وقت ورقم الطلب.' +
        '<br>⏳ لو التنفيذ لسه ما بدأش، الإلغاء أو التعديل أسهل.' +
        '<br>💳 لو بدأ التنفيذ، بيتحدد حسب المرحلة المنجزة.' +
        '</div>' + actionRow([{ label: 'أرسل رقم الطلب 💬', action: 'whatsapp', primary: true, value: 'مرحبًا، أريد تعديل أو إلغاء طلبي.' }, { label: 'حالة طلبي 📋', action: 'send', value: 'حالة طلبي' }]), ['حالة طلبي', 'حسابي', 'تحدث معنا']);
      return;
    }

    if (has(q, ['شكوى', 'مشكله', 'مشكلة', 'زعلان', 'complaint', 'problem'])) {
      botReply('أنا آسف جدًا إن حصل أي تقصير 🙏<br>رضاك أهم حاجة عندنا. ابعتلنا تفاصيل المشكلة على واتساب وهنراجعها فورًا ونحلها معاك 💬' +
        actionRow([{ label: 'تحدث معنا الآن 💬', action: 'whatsapp', primary: true }, { label: 'سياسة الضمان 🛡️', action: 'send', value: 'الضمان والاسترداد' }]), ['الخدمات والأسعار', 'تحدث معنا']);
      return;
    }

    if (has(q, ['وظيفه', 'وظيفة', 'شغل معاكم', 'توظيف', 'job', 'career'])) {
      botReply('يسعدنا اهتمامك بالانضمام لفريقنا 🌟<br>ابعتلنا سيرتك الذاتية وأعمالك على واتساب أو الإيميل، وهنراجعها بكل اهتمام 📩' +
        actionRow([{ label: 'أرسل على واتساب 💬', action: 'whatsapp', primary: true, value: 'مرحبًا، أريد التقديم لوظيفة.' }, { label: 'تحدث معنا 📄', action: 'contact' }]), ['تحدث معنا', 'عن الموقع']);
      return;
    }

    if (has(q, ['شراكه', 'شراكة', 'تعاون', 'partner', 'collab'])) {
      botReply('عندنا انفتاح كبير للتعاون مع العلامات والوكالات والمبدعين 🤝✨<br>ابعتلنا فكرتك أو مقترح الشراكة على واتساب وهنرجعلك بسرعة.' +
        actionRow([{ label: 'اقترح شراكة 💬', action: 'whatsapp', primary: true, value: 'مرحبًا، عندي مقترح شراكة.' }, { label: 'عن الموقع 👤', action: 'send', value: 'عن الموقع' }]), ['تحدث معنا', 'الأعمال']);
      return;
    }

    if (has(q, ['حاله', 'حالة', 'طلبي', 'طلبى', 'رقم الطلب', 'order status', 'track'])) {
      state.pending = 'status';
      botReply('اكتب رقم الطلب (مثال: <span dir="ltr">HE-1001</span>) أو رقم الموبايل اللي طلبت بيه، وأنا أقولك الحالة 📋', []);
      return;
    }

    if (has(q, ['سعر', 'اسعار', 'أسعار', 'بكام', 'تكلفه', 'تكلفة', 'خدمات', 'خدمه', 'خدمة', 'price', 'service'])) {
      botReply(servicesText(), ['الباقات', 'اطلب الآن', 'طرق الدفع', 'الأسئلة الشائعة']);
      return;
    }

    if (has(q, ['باقه', 'باقة', 'باقات', 'اشتراك', 'شهري', 'package'])) {
      botReply(packagesText(), ['الخدمات والأسعار', 'اطلب الآن', 'تحدث معنا']);
      return;
    }

    if (has(q, ['دفع', 'فيزا', 'فودافون', 'انستا', 'تحويل', 'بنك', 'كاش', 'بايبال', 'paypal', 'payment', 'wallet'])) {
      botReply(paymentsText(), ['الخدمات والأسعار', 'اطلب الآن']);
      return;
    }

    if (has(q, ['تواصل', 'واتس', 'واتساب', 'رقم', 'تليفون', 'هاتف', 'ايميل', 'إيميل', 'عنوان', 'مواعيد', 'شغل', 'وقت', 'contact', 'phone', 'email', 'address', 'location', 'مكان'])) {
      botReply(contactText() + (faqList(2) ? '<div class="chatbot-divider"></div>' + faqList(2) : ''), ['اطلب الآن', 'الخدمات والأسعار', 'حسابي']);
      return;
    }

    if (has(q, ['اطلب', 'طلب', 'سله', 'سلة', 'اشتري', 'اشترى', 'order', 'buy', 'cart'])) {
      botReply('تمام! 🛒 تقدر تجمع أكثر من خدمة في سلة واحدة وتأكد الطلب في خطوة واحدة.<br>اضغط «اطلب الآن» وهنفتح لك السلة، وبعدها تبعت التفاصيل على واتساب للتأكيد ✅',
        ['اطلب الآن', 'الخدمات والأسعار', 'طرق الدفع']);
      return;
    }

    if (has(q, ['اسئله', 'أسئلة', 'سؤال', 'faq', 'help', 'مساعده', 'مساعدة', 'بتساعد في ايه'])) {
      var faqHtml = faqList(5);
      botReply(faqHtml || helpText(), ['الخدمات والأسعار', 'تحدث معنا', 'حسابي']);
      return;
    }

    var service = findService(raw);
    if (service) {
      botReply(serviceDetail(service), ['الخدمات والأسعار', 'الباقات', 'اطلب الآن', 'تحدث معنا']);
      return;
    }

    var faq = searchFaqs(raw);
    if (faq) {
      botReply('<strong>' + esc(faq.question) + ' ❓</strong><p class="chatbot-answer">' + esc(faq.answer) + '</p>',
        ['الخدمات والأسعار', 'الباقات', 'تحدث معنا']);
      return;
    }

    botReply('معلش، مش متأكد إني فهمت سؤالك صح 🤔<br>بس أقدر أساعدك في:<br>🛠️ الخدمات والأسعار<br>📦 الباقات الشهرية<br>💳 طرق الدفع<br>📋 حالة الطلب<br>🧾 الإيصال الضريبي<br>👤 الحساب والتسجيل<br>💬 التواصل مع الفريق',
      ['الخدمات والأسعار', 'الباقات', 'طرق الدفع', 'حالة طلبي', 'تحدث معنا']);
  }

  /* ---------------------------------------------------------------------- */
  /* Interaction                                                            */
  /* ---------------------------------------------------------------------- */
  function send(value) {
    var text = String(value == null ? '' : value).trim();
    if (!text) return;
    bubble('user', esc(text));
    if (input) input.value = '';
    answer(text);
  }

  function openPanel() {
    state.open = true;
    root.classList.add('is-open');
    if (!state.greeted) {
      state.greeted = true;
      bubble('bot', welcomeMessage());
      suggest(QUICK);
    }
    setTimeout(function () { if (input) input.focus(); }, 240);
  }

  function closePanel() {
    state.open = false;
    root.classList.remove('is-open');
  }

  function onClick(event) {
    var target = event.target;
    if (!target || !target.closest) return;

    var sendChip = target.closest('[data-chat-send]');
    if (sendChip) {
      event.preventDefault();
      send(sendChip.getAttribute('data-chat-send'));
      return;
    }

    var action = target.closest('[data-chat-action]');
    if (action) {
      event.preventDefault();
      var name = action.getAttribute('data-chat-action');
      var value = action.getAttribute('data-chat-value') || '';
      if (name === 'toggle') { state.open ? closePanel() : openPanel(); return; }
      if (name === 'close') { closePanel(); return; }
      if (name === 'whatsapp') { openWhatsApp(value || 'مرحبًا، أريد الاستفسار عن خدماتكم.'); return; }
      if (name === 'contact') { window.location.href = 'contact.html'; return; }
      if (name === 'account') { window.location.href = 'account.html'; return; }
      if (name === 'works') { window.location.href = 'index.html#works'; return; }
      if (name === 'services') { window.location.href = 'index.html#services'; return; }
      if (name === 'packages') { window.location.href = 'index.html#packages'; return; }
      if (name === 'send') { send(value); return; }
      if (name === 'order') {
        closePanel();
        var fab = document.getElementById('cartFab');
        if (fab) { fab.click(); return; }
        var orderLink = document.querySelector('[data-open-order]');
        if (orderLink) { orderLink.click(); return; }
        window.location.href = 'index.html#services';
        return;
      }
      if (name === 'faq') {
        send('الأسئلة الشائعة');
        return;
      }
    }
  }

  function boot() {
    if (!store) return;
    data = store.get();
    build();
    window.addEventListener('neon:datachange', function () {
      data = store.get();
      // الهوية الثابتة للمساعد: نِينو — لا تُستبدل باسم الموقع
    });
  }

  if (store.ready && typeof store.ready.then === 'function') {
    store.ready.then(boot).catch(boot);
  } else {
    boot();
  }
})();
