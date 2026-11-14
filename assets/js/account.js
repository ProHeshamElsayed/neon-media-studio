/* ==========================================================================
   NÉON MEDIA — Customer account runtime
   تسجيل الدخول/إنشاء الحساب + لوحة الطلبات وتتبّع الحالة والدفع.
   يعتمد على Firebase Auth (تطبيق مستقل) + NeonStore للمحتوى العام فقط.
   ========================================================================== */
(function () {
  'use strict';

  var cloud = window.NeonCloud;
  var UI = window.NeonUI;

  function qs(selector, root) { return (root || document).querySelector(selector); }
  function qsa(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function n(value) { return Number(value) || 0; }

  function money(value, currency) {
    var num = n(value);
    var text;
    try {
      text = num.toLocaleString('ar-EG', { maximumFractionDigits: 2 });
    } catch (error) {
      text = String(num);
    }
    return text + ' ' + (currency || 'ج.م');
  }

  function formatDate(iso, withTime) {
    if (!iso) return '—';
    var date = new Date(iso);
    if (isNaN(date.getTime())) return String(iso);
    try {
      return new Intl.DateTimeFormat('ar-EG', withTime
        ? { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { day: 'numeric', month: 'long', year: 'numeric' }
      ).format(date);
    } catch (error) {
      return date.toLocaleDateString('ar-EG');
    }
  }

  var STATUS_CLASS = { 'جديد': 'new', 'قيد التنفيذ': 'work', 'مكتمل': 'done', 'ملغي': 'cancel' };
  var STATUS_STEP = { 'جديد': 0, 'قيد التنفيذ': 1, 'مكتمل': 2 };
  var PAY_CLASS = { 'غير مدفوع': 'muted', 'دفعة مقدمة': 'partial', 'مدفوع': 'paid' };

  var els = {
    notice: qs('#accountNotice'),
    auth: qs('#accountAuth'),
    dash: qs('#accountDash'),
    loginForm: qs('#loginForm'),
    registerForm: qs('#registerForm'),
    loginBtn: qs('#loginSubmit'),
    registerBtn: qs('#registerSubmit'),
    forgotBtn: qs('#forgotPassword'),
    authStatus: qs('#authStatus'),
    tabs: qsa('[data-auth-tab]'),
    avatar: qs('#accountAvatar'),
    name: qs('#accountName'),
    email: qs('#accountEmail'),
    stats: qs('#accountStats'),
    profileForm: qs('#profileForm'),
    profileName: qs('#profileName'),
    profilePhone: qs('#profilePhone'),
    orders: qs('#ordersList'),
    ordersCount: qs('#ordersCount'),
    pager: qs('#ordersPager'),
    refresh: qs('#refreshOrders'),
    logout: qs('#logoutAccount')
  };

  if (!els.auth || !els.dash) return;

  var state = {
    uid: null,
    rendered: false,
    user: null,
    profile: null,
    orders: [],
    page: 1,
    perPage: 4,
    loadingOrders: false,
    tab: 'login'
  };

  /* ------------------------------- Status -------------------------------- */
  function setStatus(message, tone) {
    if (!els.authStatus) return;
    if (!message) {
      els.authStatus.hidden = true;
      els.authStatus.textContent = '';
      return;
    }
    els.authStatus.hidden = false;
    els.authStatus.setAttribute('data-tone', tone || 'info');
    els.authStatus.textContent = message;
  }

  function toast(message, type, duration) {
    if (UI && UI.toast) UI.toast(message, type || 'info', duration || 4500);
  }

  function showNotice(message, tone) {
    if (!els.notice) return;
    els.notice.hidden = false;
    els.notice.setAttribute('data-tone', tone || 'warn');
    els.notice.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg><span>' + message + '</span>';
  }

  function hideNotice() {
    if (els.notice) els.notice.hidden = true;
  }

  function errorMessage(error) {
    var code = (error && error.code) || '';
    var map = {
      'auth/invalid-email': 'صيغة البريد الإلكتروني غير صحيحة.',
      'auth/user-not-found': 'لا يوجد حساب بهذا البريد الإلكتروني.',
      'auth/wrong-password': 'كلمة المرور غير صحيحة.',
      'auth/invalid-credential': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
      'auth/invalid-login-credentials': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
      'auth/email-already-in-use': 'هذا البريد الإلكتروني مسجّل بالفعل. جرّب تسجيل الدخول.',
      'auth/weak-password': 'كلمة المرور ضعيفة — استخدم 8 أحرف على الأقل.',
      'auth/too-many-requests': 'محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.',
      'auth/network-request-failed': 'تعذر الاتصال بالإنترنت. تحقق من الشبكة وحاول مجددًا.',
      'auth/operation-not-allowed': 'خدمة الحسابات غير مفعّلة حاليًا. تواصل معنا على واتساب لحين تفعيلها.',
      'auth/configuration-not-found': 'خدمة تسجيل الدخول تحتاج تفعيلًا من إدارة الموقع. تواصل معنا على واتساب.',
      'auth/user-disabled': 'هذا الحساب موقوف. تواصل معنا على واتساب.',
      'auth/missing-fields': 'أدخل البريد الإلكتروني وكلمة المرور.',
      'auth/unavailable': 'خدمة الحسابات غير متاحة حاليًا. حاول لاحقًا.',
      'permission-denied': 'تعذر تحميل طلباتك الآن. حدّث الصفحة وحاول مجددًا.',
      'unavailable': 'تعذر الاتصال بالسحابة. تحقق من الإنترنت وحاول مجددًا.'
    };
    return map[code] || (error && error.message) || 'حدث خطأ غير متوقع. حاول مرة أخرى.';
  }

  /* -------------------------------- Tabs --------------------------------- */
  function setTab(tab) {
    state.tab = tab === 'register' ? 'register' : 'login';
    els.tabs.forEach(function (button) {
      var active = button.getAttribute('data-auth-tab') === state.tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    if (els.loginForm) els.loginForm.hidden = state.tab !== 'login';
    if (els.registerForm) els.registerForm.hidden = state.tab !== 'register';
    setStatus('');
    var focus = state.tab === 'login' ? qs('#loginEmail') : qs('#registerName');
    if (focus) setTimeout(function () { focus.focus(); }, 80);
  }

  els.tabs.forEach(function (button) {
    button.addEventListener('click', function () { setTab(button.getAttribute('data-auth-tab')); });
  });

  /* ------------------------------- Actions -------------------------------- */
  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      button.dataset.label = button.innerHTML;
      button.disabled = true;
      button.innerHTML = label || 'لحظات…';
    } else {
      button.disabled = false;
      if (button.dataset.label) button.innerHTML = button.dataset.label;
    }
  }

  if (els.loginForm) {
    els.loginForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var email = String((qs('#loginEmail') || {}).value || '').trim();
      var password = String((qs('#loginPassword') || {}).value || '');
      if (!email || !password) {
        setStatus('أدخل البريد الإلكتروني وكلمة المرور.', 'error');
        return;
      }
      if (!cloud || !cloud.customerSignIn) {
        setStatus('خدمة الحسابات غير متاحة حاليًا.', 'error');
        return;
      }
      setBusy(els.loginBtn, true, 'جارٍ الدخول…');
      setStatus('جارٍ تسجيل الدخول…', 'info');
      cloud.customerSignIn(email, password).then(function () {
        setStatus('');
        els.loginForm.reset();
        toast('أهلًا بيك من جديد 👋', 'success');
      }).catch(function (error) {
        setStatus(errorMessage(error), 'error');
      }).then(function () {
        setBusy(els.loginBtn, false);
      });
    });
  }

  if (els.registerForm) {
    els.registerForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var name = String((qs('#registerName') || {}).value || '').trim();
      var phone = String((qs('#registerPhone') || {}).value || '').trim();
      var email = String((qs('#registerEmail') || {}).value || '').trim();
      var password = String((qs('#registerPassword') || {}).value || '');
      var confirm = String((qs('#registerPassword2') || {}).value || '');

      if (name.length < 2) { setStatus('اكتب اسمك بشكل صحيح.', 'error'); return; }
      if (phone && phone.replace(/\D/g, '').length < 8) { setStatus('رقم الهاتف غير صحيح.', 'error'); return; }
      if (!email) { setStatus('أدخل البريد الإلكتروني.', 'error'); return; }
      if (password.length < 8) { setStatus('كلمة المرور يجب أن تكون 8 أحرف على الأقل.', 'error'); return; }
      if (password !== confirm) { setStatus('كلمتا المرور غير متطابقتين.', 'error'); return; }
      if (!cloud || !cloud.customerRegister) {
        setStatus('خدمة الحسابات غير متاحة حاليًا.', 'error');
        return;
      }

      setBusy(els.registerBtn, true, 'جارٍ إنشاء الحساب…');
      setStatus('جارٍ إنشاء حسابك…', 'info');
      cloud.customerRegister({ name: name, email: email, phone: phone, password: password }).then(function () {
        setStatus('');
        els.registerForm.reset();
        toast('تم إنشاء حسابك بنجاح 🎉', 'success');
      }).catch(function (error) {
        setStatus(errorMessage(error), 'error');
      }).then(function () {
        setBusy(els.registerBtn, false);
      });
    });
  }

  if (els.forgotBtn) {
    els.forgotBtn.addEventListener('click', function () {
      var email = String((qs('#loginEmail') || {}).value || '').trim();
      if (!email) {
        setStatus('اكتب بريدك الإلكتروني أولًا ثم اضغط «نسيت كلمة المرور؟».', 'error');
        return;
      }
      if (!cloud || !cloud.customerResetPassword) {
        setStatus('خدمة الحسابات غير متاحة حاليًا.', 'error');
        return;
      }
      setStatus('جارٍ إرسال رابط إعادة التعيين…', 'info');
      cloud.customerResetPassword(email).then(function () {
        setStatus('أرسلنا رابط إعادة تعيين كلمة المرور إلى ' + email + '. راجع بريدك (وصندوق الرسائل غير المرغوب فيها).', 'success');
      }).catch(function (error) {
        setStatus(errorMessage(error), 'error');
      });
    });
  }

  if (els.logout) {
    els.logout.addEventListener('click', function () {
      if (!cloud || !cloud.customerSignOut) return;
      els.logout.disabled = true;
      cloud.customerSignOut().then(function () {
        toast('تم تسجيل الخروج.', 'info');
      }).catch(function (error) {
        toast(errorMessage(error), 'error');
      }).then(function () {
        els.logout.disabled = false;
      });
    });
  }

  /* ------------------------------ Profile --------------------------------- */
  if (els.profileForm) {
    els.profileForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var name = String(els.profileName ? els.profileName.value : '').trim();
      var phone = String(els.profilePhone ? els.profilePhone.value : '').trim();
      if (name.length < 2) { toast('اكتب اسمك بشكل صحيح.', 'error'); return; }
      if (phone && phone.replace(/\D/g, '').length < 8) { toast('رقم الهاتف غير صحيح.', 'error'); return; }
      if (!cloud || !cloud.saveCustomerProfile) return;
      var button = qs('button[type="submit"]', els.profileForm);
      setBusy(button, true, 'جارٍ الحفظ…');
      cloud.saveCustomerProfile({ name: name, phone: phone }).then(function () {
        state.profile = Object.assign({}, state.profile || {}, { name: name, phone: phone });
        renderIdentity();
        toast('تم حفظ بياناتك.', 'success');
      }).catch(function (error) {
        toast(errorMessage(error), 'error');
      }).then(function () {
        setBusy(button, false);
      });
    });
  }

  /* ----------------------------- Dashboard -------------------------------- */
  function initial(name) {
    var text = String(name || '').trim();
    return text ? text.charAt(0) : 'ع';
  }

  function renderIdentity() {
    var profile = state.profile || {};
    var user = state.user || {};
    var name = profile.name || (user.displayName || '') || (user.email ? user.email.split('@')[0] : 'عميل نِيون');
    if (els.avatar) els.avatar.textContent = initial(name);
    if (els.name) els.name.textContent = name;
    if (els.email) els.email.textContent = profile.email || user.email || '';
    if (els.profileName && !els.profileName.value) els.profileName.value = name;
    if (els.profilePhone && !els.profilePhone.value) els.profilePhone.value = profile.phone || '';
  }

  function renderStats() {
    if (!els.stats) return;
    var orders = state.orders;
    var active = 0;
    var done = 0;
    var paid = 0;
    orders.forEach(function (order) {
      if (order.status === 'مكتمل') done += 1;
      if (order.status === 'جديد' || order.status === 'قيد التنفيذ') active += 1;
      if (order.paymentStatus === 'مدفوع') paid += n(order.total != null ? order.total : order.amount);
    });
    els.stats.innerHTML =
      '<div class="account-stat"><b>' + orders.length + '</b><span>إجمالي الطلبات</span></div>' +
      '<div class="account-stat account-stat--accent"><b>' + active + '</b><span>قيد التنفيذ</span></div>' +
      '<div class="account-stat account-stat--green"><b>' + done + '</b><span>طلبات مكتملة</span></div>' +
      '<div class="account-stat"><b>' + esc(money(paid)) + '</b><span>إجمالي المدفوع</span></div>';
  }

  function orderNo(order) {
    var raw = order.orderNo || (order.number != null ? order.number : order.id) || '';
    raw = String(raw).replace(/^#/, '');
    return raw ? '#' + raw : '—';
  }

  function trackHtml(order) {
    if (order.status === 'ملغي') return '';
    var index = STATUS_STEP[order.status];
    if (index == null) index = 0;
    var steps = ['تم الاستلام', 'قيد التنفيذ', 'مكتمل'];
    return '<div class="acc-track" aria-label="مراحل الطلب">' + steps.map(function (label, stepIndex) {
      return '<span class="acc-step' + (stepIndex <= index ? ' is-done' : '') + '">' + label + '</span>';
    }).join('') + '</div>';
  }

  function orderLines(order) {
    var items = Array.isArray(order.items) ? order.items : [];
    var rows = items.map(function (item) {
      var title = item.title || item.name || 'خدمة';
      var qty = n(item.qty) || 1;
      var price = n(item.price);
      return '<div class="account-order__line"><span>' + esc(title) + ' × ' + qty + '</span><b>' + esc(money(price * qty, order.currency)) + '</b></div>';
    });
    if (order.vatEnabled === true && n(order.vatAmount) > 0) {
      rows.push('<div class="account-order__line"><span>ضريبة القيمة المضافة (' + esc(n(order.vatRate)) + '%)</span><b>' + esc(money(order.vatAmount, order.currency)) + '</b></div>');
    }
    if (order.paymentMethod) {
      rows.push('<div class="account-order__line"><span>طريقة الدفع</span><b>' + esc(order.paymentMethod) + '</b></div>');
    }
    if (order.executedAt) {
      rows.push('<div class="account-order__line"><span>تاريخ التنفيذ</span><b>' + esc(formatDate(order.executedAt)) + '</b></div>');
    }
    if (order.paidAt) {
      rows.push('<div class="account-order__line"><span>تاريخ السداد</span><b>' + esc(formatDate(order.paidAt)) + '</b></div>');
    }
    if (order.notes) {
      rows.push('<p class="account-order__note">ملاحظات: ' + esc(order.notes) + '</p>');
    }
    return rows.join('');
  }

  function orderCard(order) {
    var status = order.status || 'جديد';
    var payStatus = order.paymentStatus || 'غير مدفوع';
    var serviceTitle = order.serviceTitle || (Array.isArray(order.items) && order.items.length
      ? order.items.map(function (item) { return item.title || item.name; }).filter(Boolean).join(' + ')
      : 'طلب خدمة');
    var count = Array.isArray(order.items) ? order.items.reduce(function (sum, item) { return sum + (n(item.qty) || 1); }, 0) : n(order.quantity);
    var total = order.total != null ? order.total : order.amount;

    return '<article class="account-order' + (status === 'ملغي' ? ' is-cancelled' : '') + '">' +
      '<div class="account-order__head">' +
        '<div>' +
          '<div class="account-order__no"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2 4 6v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6l-2-4H6Z"/><path d="M4 6h16M16 10a4 4 0 0 1-8 0"/></svg>' + esc(orderNo(order)) + '</div>' +
          '<div class="account-order__meta">' +
            '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>' + esc(formatDate(order.createdAt, true)) + '</span>' +
            (count ? '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6h15l-1.5 9h-12L6 6Z"/><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M6 6 5 3H2"/></svg>' + count + ' عنصر</span>' : '') +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:.35rem;flex-wrap:wrap">' +
          '<span class="acc-chip acc-chip--' + (STATUS_CLASS[status] || 'new') + '">' + esc(status) + '</span>' +
          '<span class="acc-chip acc-chip--' + (PAY_CLASS[payStatus] || 'muted') + '">' + esc(payStatus) + '</span>' +
        '</div>' +
      '</div>' +
      '<p class="account-order__title">' + esc(serviceTitle) + '</p>' +
      '<div class="account-order__amount">' +
        '<b>' + esc(money(total, order.currency)) + '</b>' +
        '<small>شامل الضريبة عند تفعيلها</small>' +
      '</div>' +
      trackHtml(order) +
      '<details class="account-order__more">' +
        '<summary>تفاصيل الطلب</summary>' +
        '<div class="account-order__body">' +
          orderLines(order) +
          '<div class="account-order__line"><span>حالة الدفع</span><b>' + esc(payStatus) + '</b></div>' +
        '</div>' +
      '</details>' +
    '</article>';
  }

  function emptyOrders() {
    return '<div class="account-empty">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2 4 6v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6l-2-4H6Z"/><path d="M4 6h16M16 10a4 4 0 0 1-8 0"/></svg>' +
      '<h3>لا توجد طلبات على هذا الحساب بعد</h3>' +
      '<p>أول ما تطلب خدمة وأنت مسجّل الدخول، هتلاقي الطلب هنا مع حالته وتفاصيله لحظة بلحظة.</p>' +
      '<a class="btn-neon btn-sm" href="index.html#services">اطلب خدمتك الأولى</a>' +
    '</div>';
  }

  function renderOrders() {
    if (!els.orders) return;
    var total = state.orders.length;
    if (els.ordersCount) els.ordersCount.textContent = total ? total + ' طلب' : 'لا طلبات';

    if (!total) {
      els.orders.innerHTML = emptyOrders();
      if (els.pager) els.pager.innerHTML = '';
      return;
    }

    var pages = Math.ceil(total / state.perPage);
    if (state.page > pages) state.page = pages;
    var start = (state.page - 1) * state.perPage;
    var slice = state.orders.slice(start, start + state.perPage);
    els.orders.innerHTML = slice.map(orderCard).join('');

    if (els.pager) {
      if (pages <= 1) {
        els.pager.innerHTML = '';
      } else {
        var buttons = '';
        for (var i = 1; i <= pages; i += 1) {
          buttons += '<button type="button" class="' + (i === state.page ? 'is-active' : '') + '" data-orders-page="' + i + '" aria-label="صفحة ' + i + '">' + i + '</button>';
        }
        els.pager.innerHTML = buttons;
      }
    }
  }

  function setOrdersLoading() {
    if (!els.orders) return;
    els.orders.innerHTML = '<div class="account-skeleton"></div><div class="account-skeleton"></div>';
    if (els.pager) els.pager.innerHTML = '';
  }

  function loadOrders() {
    if (!cloud || !cloud.fetchCustomerOrders || !state.user) return Promise.resolve();
    state.loadingOrders = true;
    setOrdersLoading();
    return cloud.fetchCustomerOrders().then(function (orders) {
      state.orders = Array.isArray(orders) ? orders : [];
      state.page = 1;
      renderStats();
      renderOrders();
      hideNotice();
    }).catch(function (error) {
      state.orders = [];
      renderStats();
      if (els.orders) {
        els.orders.innerHTML = '<div class="account-empty">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>' +
          '<h3>تعذر تحميل الطلبات الآن</h3>' +
          '<p>' + esc(errorMessage(error)) + '</p>' +
          '<button type="button" class="btn-ghost btn-sm" data-refresh-orders>إعادة المحاولة</button>' +
        '</div>';
      }
      if ((error && error.code) === 'permission-denied') {
        showNotice('قراءة الطلبات تحتاج تحديث قواعد Firestore. اطلب من إدارة الموقع نشر القواعد المرفقة مع التحديث، ثم أعد تحميل الصفحة.', 'warn');
      }
    }).then(function () {
      state.loadingOrders = false;
    });
  }

  function loadDashboard() {
    renderIdentity();
    renderStats();
    if (!cloud || !cloud.getCustomerProfile) return;
    cloud.getCustomerProfile().then(function (profile) {
      state.profile = profile || null;
      renderIdentity();
    }).catch(function () { /* الملف الشخصي اختياري */ });
    loadOrders();
  }

  function handleAuth(user) {
    var uid = user ? user.uid : null;
    if (state.uid === uid && state.rendered) return;
    state.uid = uid;
    state.user = user || null;
    state.profile = null;
    state.orders = [];
    state.page = 1;

    if (user) {
      state.rendered = true;
      els.auth.hidden = true;
      els.dash.hidden = false;
      setStatus('');
      loadDashboard();
      if (window.NeonUI && window.NeonUI.refreshMotion) {
        setTimeout(function () { window.NeonUI.refreshMotion(); }, 120);
      }
    } else {
      state.rendered = false;
      els.dash.hidden = true;
      els.auth.hidden = false;
      hideNotice();
      setTab(state.tab);
    }
  }

  /* ------------------------------- Events --------------------------------- */
  els.orders.addEventListener('click', function (event) {
    var pageBtn = event.target.closest('[data-orders-page]');
    if (pageBtn) {
      state.page = Number(pageBtn.getAttribute('data-orders-page')) || 1;
      renderOrders();
      var main = qs('.account-main');
      if (main) main.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (event.target.closest('[data-refresh-orders]')) loadOrders();
  });

  if (els.pager) {
    els.pager.addEventListener('click', function (event) {
      var pageBtn = event.target.closest('[data-orders-page]');
      if (!pageBtn) return;
      state.page = Number(pageBtn.getAttribute('data-orders-page')) || 1;
      renderOrders();
    });
  }

  if (els.refresh) {
    els.refresh.addEventListener('click', function () {
      if (state.loadingOrders) return;
      els.refresh.disabled = true;
      loadOrders().then(function () { els.refresh.disabled = false; });
    });
  }

  window.addEventListener('neon:customerauth', function (event) {
    handleAuth(event && event.detail ? event.detail.user : null);
  });

  /* -------------------------------- Boot ---------------------------------- */
  var deepTab = '';
  try {
    deepTab = new URLSearchParams(location.search).get('mode') || '';
  } catch (error) { deepTab = ''; }
  if (!deepTab && location.hash === '#register') deepTab = 'register';
  setTab(deepTab === 'register' ? 'register' : 'login');

  if (!cloud || !cloud.isConfigured || !cloud.isConfigured() || !cloud.initCustomer) {
    showNotice('خدمة الحسابات تحتاج اتصالًا بـ Firebase. تأكد من الإنترنت ثم أعد تحميل الصفحة. تقدر تطلب مباشرة من <a href="index.html#services">صفحة الخدمات</a> في أي وقت.', 'warn');
    setStatus('خدمة الحسابات غير متاحة حاليًا. جرّب لاحقًا أو تواصل معنا على واتساب.', 'error');
    return;
  }

  els.auth.hidden = false;
  cloud.initCustomer().then(function () {
    return cloud.whenCustomerReady(6000);
  }).then(function (user) {
    handleAuth(user || null);
  }).catch(function (error) {
    showNotice('تعذر تشغيل خدمة الحسابات: ' + esc(errorMessage(error)), 'error');
  });
})();
