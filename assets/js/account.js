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

  /* -------------------------- Validation helpers --------------------------- */
  function digitsOf(value) {
    return String(value == null ? '' : value).replace(/\D/g, '');
  }

  function normalizePhone(value) {
    var digits = digitsOf(value);
    if (digits.indexOf('0020') === 0) digits = digits.slice(4);
    else if (digits.indexOf('20') === 0 && digits.length > 10) digits = digits.slice(2);
    if (digits.length === 10 && digits.charAt(0) === '1') digits = '0' + digits;
    return digits;
  }

  function validPhone(value) {
    return /^01[0125]\d{8}$/.test(normalizePhone(value));
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
  }

  function passwordChecks(password) {
    var text = String(password || '');
    return {
      length: text.length >= 8,
      lower: /[a-z]/.test(text),
      upper: /[A-Z]/.test(text),
      digit: /\d/.test(text),
      symbol: /[^A-Za-z0-9]/.test(text)
    };
  }

  function passwordScore(password) {
    var checks = passwordChecks(password);
    var score = 0;
    if (checks.length) score += 1;
    if (checks.lower && checks.upper) score += 1;
    if (checks.digit) score += 1;
    if (checks.symbol) score += 1;
    if (String(password || '').length >= 12) score += 1;
    return Math.min(5, score);
  }

  function passwordOk(password) {
    var text = String(password || '');
    var checks = passwordChecks(text);
    var groups = (checks.lower ? 1 : 0) + (checks.upper ? 1 : 0) + (checks.digit ? 1 : 0) + (checks.symbol ? 1 : 0);
    return checks.length && groups >= 3 && !/\s/.test(text);
  }

  function passwordHint(password) {
    if (!password) return '8 أحرف على الأقل، مع حرف كبير وصغير ورقم ورمز.';
    var checks = passwordChecks(password);
    var missing = [];
    if (!checks.length) missing.push('8 أحرف على الأقل');
    if (!(checks.lower && checks.upper)) missing.push('حرف كبير وصغير');
    if (!checks.digit) missing.push('رقم');
    if (!checks.symbol) missing.push('رمز');
    if (/\s/.test(String(password))) missing.push('بدون مسافات');
    return missing.length ? 'ناقص: ' + missing.join(' · ') : 'كلمة مرور قوية ✓';
  }

  /* ---------------------------- Login guard -------------------------------- */
  var LOGIN_GUARD_KEY = 'neonCustomerLoginGuard_v1';

  function readGuard() {
    try {
      var raw = localStorage.getItem(LOGIN_GUARD_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? parsed : { count: 0, first: 0, blockedUntil: 0 };
    } catch (error) {
      return { count: 0, first: 0, blockedUntil: 0 };
    }
  }

  function writeGuard(value) {
    try { localStorage.setItem(LOGIN_GUARD_KEY, JSON.stringify(value)); } catch (error) { /* تجاهل */ }
  }

  function guardWaitMinutes() {
    var guard = readGuard();
    var left = Number(guard.blockedUntil) - Date.now();
    return left > 0 ? Math.ceil(left / 60000) : 0;
  }

  function noteLoginFailure() {
    var now = Date.now();
    var guard = readGuard();
    if (!guard.first || now - Number(guard.first) > 10 * 60 * 1000) {
      guard = { count: 0, first: now, blockedUntil: 0 };
    }
    guard.count = (Number(guard.count) || 0) + 1;
    if (guard.count >= 5) guard.blockedUntil = now + 5 * 60 * 1000;
    writeGuard(guard);
    return guard;
  }

  function clearLoginGuard() {
    try { localStorage.removeItem(LOGIN_GUARD_KEY); } catch (error) { /* تجاهل */ }
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
    profileEmail: qs('#profileEmail'),
    profileGovernorate: qs('#profileGovernorate'),
    profileCity: qs('#profileCity'),
    profileAddress: qs('#profileAddress'),
    profileCompany: qs('#profileCompany'),
    profileBirthdate: qs('#profileBirthdate'),
    profileGender: qs('#profileGender'),
    profileContact: qs('#profileContact'),
    verify: qs('#emailVerify'),
    resendVerify: qs('#resendVerify'),
    refreshVerify: qs('#refreshVerify'),
    passwordForm: qs('#passwordForm'),
    currentPassword: qs('#currentPassword'),
    newPassword: qs('#newPassword'),
    newPassword2: qs('#newPassword2'),
    changePasswordBtn: qs('#changePasswordBtn'),
    pwStrength: qs('#pwStrength'),
    pwStrengthBar: qs('#pwStrengthBar'),
    pwStrengthText: qs('#pwStrengthText'),
    registerPassword: qs('#registerPassword'),
    registerTerms: qs('#registerTerms'),
    registerMarketing: qs('#registerMarketing'),
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

  function fieldValue(selector) {
    var element = qs(selector);
    return element ? String(element.value == null ? '' : element.value).trim() : '';
  }

  function updatePasswordMeter() {
    if (!els.pwStrength || !els.registerPassword) return;
    var password = els.registerPassword.value;
    var score = passwordScore(password);
    if (els.pwStrengthBar) els.pwStrengthBar.style.width = Math.max(0, Math.min(100, score * 20)) + '%';
    var tone = score >= 4 ? 'strong' : score >= 3 ? 'good' : score >= 2 ? 'weak' : 'bad';
    els.pwStrength.setAttribute('data-tone', tone);
    if (els.pwStrengthText) els.pwStrengthText.textContent = passwordHint(password);
  }

  function fillProfileForm(profile) {
    var data = profile || {};
    var user = state.user || {};
    var values = {
      profileName: data.name || user.displayName || '',
      profilePhone: data.phone || '',
      profileEmail: data.email || user.email || '',
      profileGovernorate: data.governorate || '',
      profileCity: data.city || '',
      profileAddress: data.address || '',
      profileCompany: data.company || '',
      profileBirthdate: data.birthdate || '',
      profileGender: data.gender || '',
      profileContact: data.contactPreference || 'whatsapp'
    };
    Object.keys(values).forEach(function (id) {
      var element = qs('#' + id);
      if (!element || document.activeElement === element) return;
      var value = values[id] == null ? '' : String(values[id]);
      if (element.tagName === 'SELECT') {
        element.value = value;
        if (element.value !== value) element.value = '';
      } else {
        element.value = value;
      }
    });
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
      if (!validEmail(email)) {
        setStatus('صيغة البريد الإلكتروني غير صحيحة.', 'error');
        return;
      }
      var wait = guardWaitMinutes();
      if (wait > 0) {
        setStatus('محاولات دخول كثيرة على هذا المتصفح. انتظر ' + wait + ' دقيقة ثم حاول مرة أخرى، أو استخدم «نسيت كلمة المرور».', 'error');
        return;
      }
      if (!cloud || !cloud.customerSignIn) {
        setStatus('خدمة الحسابات غير متاحة حاليًا.', 'error');
        return;
      }
      setBusy(els.loginBtn, true, 'جارٍ الدخول…');
      setStatus('جارٍ تسجيل الدخول…', 'info');
      cloud.customerSignIn(email, password).then(function () {
        clearLoginGuard();
        setStatus('');
        els.loginForm.reset();
        toast('أهلًا بيك من جديد 👋', 'success');
      }).catch(function (error) {
        var guard = noteLoginFailure();
        var extra = guard.blockedUntil > Date.now() ? ' تم إيقاف المحاولة 5 دقائق لحماية حسابك.' : '';
        setStatus(errorMessage(error) + extra, 'error');
      }).then(function () {
        setBusy(els.loginBtn, false);
      });
    });
  }

  if (els.registerForm) {
    els.registerForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var name = fieldValue('#registerName');
      var phone = fieldValue('#registerPhone');
      var email = fieldValue('#registerEmail').toLowerCase();
      var governorate = fieldValue('#registerGovernorate');
      var city = fieldValue('#registerCity');
      var address = fieldValue('#registerAddress');
      var company = fieldValue('#registerCompany');
      var birthdate = fieldValue('#registerBirthdate');
      var gender = fieldValue('#registerGender');
      var contactPreference = fieldValue('#registerContact') || 'whatsapp';
      var password = String((qs('#registerPassword') || {}).value || '');
      var confirm = String((qs('#registerPassword2') || {}).value || '');

      if (name.length < 2) { setStatus('اكتب اسمك بالكامل (حرفان على الأقل).', 'error'); return; }
      if (!validPhone(phone)) { setStatus('أدخل رقم موبايل مصري صحيح يبدأ بـ 010 أو 011 أو 012 أو 015.', 'error'); return; }
      if (!validEmail(email)) { setStatus('أدخل بريدًا إلكترونيًا صحيحًا.', 'error'); return; }
      if (!governorate) { setStatus('اختر المحافظة.', 'error'); return; }
      if (city.length < 2) { setStatus('اكتب المدينة أو المركز.', 'error'); return; }
      if (!passwordOk(password)) { setStatus('كلمة المرور ضعيفة: ' + passwordHint(password), 'error'); return; }
      if (password !== confirm) { setStatus('كلمتا المرور غير متطابقتين.', 'error'); return; }
      if (!els.registerTerms || !els.registerTerms.checked) { setStatus('يجب الموافقة على سياسة الخصوصية وشروط الاستخدام.', 'error'); return; }
      if (!cloud || !cloud.customerRegister) {
        setStatus('خدمة الحسابات غير متاحة حاليًا.', 'error');
        return;
      }

      setBusy(els.registerBtn, true, 'جارٍ إنشاء الحساب…');
      setStatus('جارٍ إنشاء حسابك…', 'info');
      cloud.customerRegister({
        name: name,
        email: email,
        phone: normalizePhone(phone),
        password: password,
        profile: {
          governorate: governorate,
          city: city,
          address: address,
          company: company,
          birthdate: birthdate,
          gender: gender,
          contactPreference: contactPreference,
          marketingConsent: Boolean(els.registerMarketing && els.registerMarketing.checked)
        }
      }).then(function () {
        clearLoginGuard();
        setStatus('');
        els.registerForm.reset();
        updatePasswordMeter();
        toast('تم إنشاء حسابك بنجاح 🎉 أكّد بريدك الإلكتروني من الرابط المرسل إليك.', 'success', 6500);
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
      var payload = {
        name: fieldValue('#profileName'),
        phone: normalizePhone(fieldValue('#profilePhone')),
        governorate: fieldValue('#profileGovernorate'),
        city: fieldValue('#profileCity'),
        address: fieldValue('#profileAddress'),
        company: fieldValue('#profileCompany'),
        birthdate: fieldValue('#profileBirthdate'),
        gender: fieldValue('#profileGender'),
        contactPreference: fieldValue('#profileContact') || 'whatsapp'
      };
      if (payload.name.length < 2) { toast('اكتب اسمك بالكامل.', 'error'); return; }
      if (!validPhone(payload.phone)) { toast('أدخل رقم موبايل مصري صحيح.', 'error'); return; }
      if (!cloud || !cloud.saveCustomerProfile) return;
      var button = qs('button[type="submit"]', els.profileForm);
      setBusy(button, true, 'جارٍ الحفظ…');
      cloud.saveCustomerProfile(payload).then(function () {
        state.profile = Object.assign({}, state.profile || {}, payload);
        renderIdentity();
        toast('تم حفظ بياناتك بنجاح.', 'success');
      }).catch(function (error) {
        toast(errorMessage(error), 'error');
      }).then(function () {
        setBusy(button, false);
      });
    });
  }

  if (els.passwordForm) {
    els.passwordForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var current = String((els.currentPassword || {}).value || '');
      var next = String((els.newPassword || {}).value || '');
      var confirm = String((els.newPassword2 || {}).value || '');
      if (!current) { toast('أدخل كلمة المرور الحالية.', 'error'); return; }
      if (!passwordOk(next)) { toast('كلمة المرور الجديدة ضعيفة: ' + passwordHint(next), 'error', 6000); return; }
      if (next !== confirm) { toast('كلمتا المرور الجديدتان غير متطابقتين.', 'error'); return; }
      if (!cloud || !cloud.customerChangePassword) { toast('خدمة تغيير كلمة المرور غير متاحة حاليًا.', 'error'); return; }
      setBusy(els.changePasswordBtn, true, 'جارٍ التغيير…');
      cloud.customerChangePassword(current, next).then(function () {
        els.passwordForm.reset();
        toast('تم تغيير كلمة المرور بنجاح 🔐', 'success');
      }).catch(function (error) {
        toast(errorMessage(error), 'error');
      }).then(function () {
        setBusy(els.changePasswordBtn, false);
      });
    });
  }

  if (els.registerPassword) {
    els.registerPassword.addEventListener('input', updatePasswordMeter);
    updatePasswordMeter();
  }

  if (els.resendVerify) {
    els.resendVerify.addEventListener('click', function () {
      if (!cloud || !cloud.sendCustomerVerification) return;
      els.resendVerify.disabled = true;
      cloud.sendCustomerVerification().then(function () {
        toast('أرسلنا رابط التأكيد مرة أخرى. راجع بريدك.', 'success', 5500);
      }).catch(function (error) {
        toast(errorMessage(error), 'error');
      }).then(function () {
        els.resendVerify.disabled = false;
      });
    });
  }

  if (els.refreshVerify) {
    els.refreshVerify.addEventListener('click', function () {
      if (!cloud || !cloud.reloadCustomerUser) return;
      els.refreshVerify.disabled = true;
      cloud.reloadCustomerUser().then(function (user) {
        state.user = user || state.user;
        renderVerification();
        toast(user && user.emailVerified ? 'تم تأكيد بريدك بنجاح ✅' : 'البريد لم يُؤكَّد بعد. افتح رابط التأكيد ثم حاول مجددًا.', user && user.emailVerified ? 'success' : 'info', 5500);
      }).catch(function (error) {
        toast(errorMessage(error), 'error');
      }).then(function () {
        els.refreshVerify.disabled = false;
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
    fillProfileForm(profile);
    renderVerification();
  }

  function renderVerification() {
    if (!els.verify) return;
    var user = state.user;
    var unverified = Boolean(user && user.emailVerified === false);
    els.verify.hidden = !unverified;
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
    if (cloud && cloud.reloadCustomerUser) {
      cloud.reloadCustomerUser().then(function (user) {
        if (!user) return;
        state.user = user;
        renderIdentity();
      }).catch(function () { /* التحقق اختياري */ });
    }
    if (!cloud || !cloud.getCustomerProfile) return;
    cloud.getCustomerProfile().then(function (profile) {
      state.profile = profile || null;
      renderIdentity();
    }).catch(function () { /* الملف الشخصي اختياري */ });
    loadOrders();
  }

  function handleAuth(user) {
    var uid = user ? user.uid : null;
    var same = state.uid === uid && state.rendered;
    state.uid = uid;
    state.user = user || null;
    if (same) {
      renderVerification();
      return;
    }
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
