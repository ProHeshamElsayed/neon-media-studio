/* ==========================================================================
   NÉON MEDIA — مساعد المحادثة (Chatbot)
   مساعد محلي سريع يجيب من محتوى الموقع نفسه (خدمات، باقات، دفع، أسئلة شائعة)
   ويساعد الزائر على الطلب أو التواصل. لا يرسل البيانات لأي خدمة خارجية.
   ========================================================================== */
(function () {
  'use strict';

  var store = window.NeonStore;
  if (!store) return;
  var UI = window.NeonUI;
  var data = null;
  var state = { open: false, greeted: false, pending: '', lastUser: '' };
  var root, panel, log, input, form, sendBtn;

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

  function settings() { return (data && data.settings) || {}; }

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

  /* ---------------------------------------------------------------------- */
  /* Rendering                                                              */
  /* ---------------------------------------------------------------------- */
  function build() {
    root = document.createElement('div');
    root.className = 'chatbot';
    root.innerHTML = '' +
      '<div class="chatbot-panel" id="chatbotPanel" role="dialog" aria-label="مساعد نِيون ميديا" aria-modal="false">' +
        '<div class="chatbot-head">' +
          '<span class="chatbot-avatar" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="12" rx="5"/><path d="M12 7V4M8 12h.01M16 12h.01M9 16h6"/></svg>' +
          '</span>' +
          '<div class="chatbot-head__text"><strong id="chatbotTitle">مساعد نِيون</strong><span>ردّ فوري من محتوى الموقع</span></div>' +
          '<button type="button" class="chatbot-close" data-chat-action="close" aria-label="إغلاق المحادثة">×</button>' +
        '</div>' +
        '<div class="chatbot-log" id="chatbotLog" role="log" aria-live="polite"></div>' +
        '<div class="chatbot-suggest" id="chatbotSuggest"></div>' +
        '<form class="chatbot-form" id="chatbotForm">' +
          '<input type="text" id="chatbotInput" autocomplete="off" placeholder="اكتب سؤالك…" aria-label="اكتب رسالتك">' +
          '<button type="submit" aria-label="إرسال">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12 16-8-6 16-2-6-8-2Z"/></svg>' +
          '</button>' +
        '</form>' +
      '</div>' +
      '<button type="button" class="chatbot-fab" data-chat-action="toggle" aria-label="افتح المساعد الذكي" title="مساعد نِيون">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H8l-4 3v-4.4A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></svg>' +
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
    setTimeout(function () {
      if (t && t.parentNode) t.parentNode.removeChild(t);
      bubble('bot', html);
      if (chips) suggest(chips);
    }, 320);
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
    if (!services.length) return 'الخدمات هتظهر هنا فور إضافتها من لوحة التحكم.';
    return '<strong>الخدمات المتاحة</strong><div class="chatbot-list">' + services.slice(0, 8).map(function (service) {
      return '<div class="chatbot-list__row"><span>' + esc(service.title) + '</span><b>' + esc(money(service.price)) + (service.unit ? ' ' + esc(service.unit) : '') + '</b></div>';
    }).join('') + '</div><span class="chatbot-note">الأسعار تقديرية — التفاصيل النهائية تُتفق عليها في الطلب.</span>';
  }

  function packagesText() {
    var packages = list('packages');
    if (!packages.length) return 'الباقات الشهرية هتظهر هنا فور إضافتها من لوحة التحكم.';
    return '<strong>الباقات</strong><div class="chatbot-list">' + packages.slice(0, 6).map(function (pkg) {
      return '<div class="chatbot-list__row"><span>' + esc(pkg.name) + '</span><b>' + esc(money(pkg.price)) + (pkg.period ? ' / ' + esc(pkg.period) : '') + '</b></div>';
    }).join('') + '</div>';
  }

  function paymentsText() {
    var payments = list('payments');
    if (!payments.length) return 'الدفع حاليًا يتم بالاتفاق عبر واتساب. لا يوجد دفع إلكتروني داخل الموقع.';
    return '<strong>طرق الدفع المتاحة</strong><div class="chatbot-list">' + payments.map(function (payment) {
      return '<div class="chatbot-list__row"><span>' + esc(payment.name) + '</span><b dir="ltr">' + esc(payment.value || '—') + '</b></div>';
    }).join('') + '</div><span class="chatbot-note">لا نطلب بيانات بطاقة داخل الموقع نهائيًا. الدفع عند الاستلام أو بتحويل بنكي موثّق.</span>';
  }

  function faqList() {
    var faqs = list('faqs');
    if (!faqs.length) return '';
    return '<strong>أسئلة شائعة</strong><div class="chatbot-faq">' + faqs.slice(0, 4).map(function (faq) {
      return '<details><summary>' + esc(faq.question) + '</summary><p>' + esc(faq.answer) + '</p></details>';
    }).join('') + '</div>';
  }

  function contactText() {
    var s = settings();
    var parts = [];
    if (s.phone) parts.push('هاتف: <span dir="ltr">' + esc(s.phone) + '</span>');
    if (s.whatsapp) parts.push('واتساب: <span dir="ltr">+' + esc(String(s.whatsapp).replace(/[^\d]/g, '').replace(/^0+/, '')) + '</span>');
    if (s.email) parts.push('إيميل: ' + esc(s.email));
    if (s.address) parts.push('العنوان: ' + esc(s.address));
    if (s.workingHours) parts.push('المواعيد: ' + esc(s.workingHours));
    return '<strong>تواصل معنا</strong><div class="chatbot-lines">' + parts.join('<br>') + '</div>' +
      actionRow([
        { label: 'واتساب فوري', action: 'whatsapp', primary: true },
        { label: 'صفحة التواصل', action: 'contact' }
      ]);
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
      return 'ما لقيتش طلب بالرقم ده على المتصفح الحالي. لو الطلب اتعمل من جهاز تاني، ابعت رقم الطلب على واتساب وهنتأكد لك فورًا.' +
        actionRow([{ label: 'أرسل رقم الطلب واتساب', action: 'whatsapp', primary: true, value: 'مرحبًا، أريد الاستفسار عن حالة الطلب رقم ' + esc(query) }]);
    }
    return '<strong>تفاصيل الطلب ' + esc(found.orderNo || found.id) + '</strong>' +
      '<div class="chatbot-list">' +
        '<div class="chatbot-list__row"><span>الحالة</span><b>' + esc(found.status || 'جديد') + '</b></div>' +
        '<div class="chatbot-list__row"><span>الدفع</span><b>' + esc(store.orderPaymentStatus ? store.orderPaymentStatus(found) : (found.paymentStatus || '—')) + '</b></div>' +
        '<div class="chatbot-list__row"><span>الإجمالي</span><b>' + esc(money(found.total != null ? found.total : found.amount, found.currency)) + '</b></div>' +
      '</div>' +
      (found.status === 'مكتمل' ? '<span class="chatbot-note">تم تنفيذ الطلب بنجاح. تقدر تطلب مننا الإيصال الضريبي المعتمد على واتساب.</span>' : '<span class="chatbot-note">هنحدّث الحالة أول ما يبدأ التنفيذ أو يكتمل.</span>');
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
    return bestScore >= 2 ? best : null;
  }

  function answer(raw) {
    var q = norm(raw);
    state.lastUser = raw;
    if (!q) return;

    if (state.pending === 'status') {
      state.pending = '';
      botReply(orderStatusReply(raw), ['الخدمات والأسعار', 'طرق الدفع', 'تحدث معنا']);
      return;
    }

    if (/^(سلام|السلام عليكم|هاي|هلا|اهلا|مرحبا|صباح|مساء|hello|hi)/.test(q)) {
      botReply('أهلًا وسهلًا بيك في <strong>' + esc(settings().siteName || 'نِيون ميديا') + '</strong> 👋<br>أقدر أساعدك في الخدمات والأسعار، الباقات، طرق الدفع، أو حالة طلبك. تحب نبدأ بإيه؟',
        ['الخدمات والأسعار', 'الباقات', 'طرق الدفع', 'حالة طلبي']);
      return;
    }

    if (/(شكرا|شكرًا|تسلم|مشكور|thanks|thank)/.test(q)) {
      botReply('العفو! دايمًا في خدمتك 🌟 لو احتجت أي حاجة تانية أنا هنا.', ['الخدمات والأسعار', 'تحدث معنا']);
      return;
    }

    if (/(حاله|حالة|طلبي|طلبى|رقم الطلب|order status|track)/.test(q) && /(طلب|order)/.test(q)) {
      state.pending = 'status';
      botReply('اكتب رقم الطلب (مثال: <span dir="ltr">HE-1001</span>) أو رقم الموبايل اللي طلبت بيه، وأنا أقولك الحالة.', []);
      return;
    }

    if (/(ضريبه|ضريبة|فاتوره|فاتورة|ايصال|إيصال|tax|invoice)/.test(q)) {
      botReply('بعد تنفيذ الطلب واستلام الخدمة، بنقدر نصدر لك <strong>إيصال ضريبي معتمد</strong> من الموقع يحتوي رقم الإيصال والتاريخ وبيانات الضريبة — مناسب لإقرارك الضريبي. اطلبه مننا على واتساب بعد اكتمال الطلب.',
        ['حالة طلبي', 'تحدث معنا']);
      return;
    }

    if (/(سعر|اسعار|أسعار|بكام|تكلفه|تكلفة|خدمات|خدمه|خدمة|price|service)/.test(q)) {
      botReply(servicesText(), ['الباقات', 'اطلب الآن', 'طرق الدفع', 'الأسئلة الشائعة']);
      return;
    }

    if (/(باقه|باقة|باقات|اشتراك|شهري|package)/.test(q)) {
      botReply(packagesText(), ['الخدمات والأسعار', 'اطلب الآن', 'تحدث معنا']);
      return;
    }

    if (/(دفع|فيزا|فودافون|انستا|تحويل|بنك|كاش|بايبال|paypal|payment|wallet)/.test(q)) {
      botReply(paymentsText(), ['الخدمات والأسعار', 'اطلب الآن']);
      return;
    }

    if (/(تواصل|واتس|واتساب|رقم|تليفون|هاتف|ايميل|إيميل|عنوان|مواعيد|شغل|وقت|contact|phone|email|address)/.test(q)) {
      botReply(contactText() + (faqList() ? '<div class="chatbot-divider"></div>' + faqList() : ''), ['اطلب الآن', 'الخدمات والأسعار']);
      return;
    }

    if (/(اطلب|طلب|سله|سلة|اشتري|اشترى|order|buy|cart)/.test(q)) {
      botReply('تمام! تقدر تجمع أكثر من خدمة في سلة واحدة وتأكد الطلب في خطوة واحدة. اضغط «اطلب الآن» وهنفتح لك السلة.',
        ['اطلب الآن', 'الخدمات والأسعار', 'طرق الدفع']);
      return;
    }

    if (/(اسئله|أسئلة|سؤال|faq|help|مساعده|مساعدة)/.test(q)) {
      var faqHtml = faqList();
      botReply(faqHtml || 'مفيش أسئلة شائعة منشورة حاليًا. اسألني عن أي خدمة أو تواصل معنا مباشرة.', ['الخدمات والأسعار', 'تحدث معنا']);
      return;
    }

    var faq = searchFaqs(raw);
    if (faq) {
      botReply('<strong>' + esc(faq.question) + '</strong><p class="chatbot-answer">' + esc(faq.answer) + '</p>', ['الخدمات والأسعار', 'الباقات', 'تحدث معنا']);
      return;
    }

    botReply('معلش، مش متأكد إني فهمت سؤالك صح. أقدر أساعدك في:<br>• الخدمات والأسعار<br>• الباقات الشهرية<br>• طرق الدفع<br>• حالة الطلب<br>• التواصل مع الفريق',
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
      var name = settings().siteName || 'نِيون ميديا';
      bubble('bot', 'أهلًا بيك في <strong>' + esc(name) + '</strong> 👋<br>أنا مساعدك السريع. اختار من الأزرار أو اكتب سؤالك، وأنا أرد عليك فورًا من محتوى الموقع.');
      suggest(['الخدمات والأسعار', 'الباقات', 'طرق الدفع', 'حالة طلبي', 'تحدث معنا']);
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
      var title = document.getElementById('chatbotTitle');
      if (title) title.textContent = 'مساعد ' + (settings().siteName ? String(settings().siteName).split(' ')[0] : 'نِيون');
    });
  }

  if (store.ready && typeof store.ready.then === 'function') {
    store.ready.then(boot).catch(boot);
  } else {
    boot();
  }
})();
