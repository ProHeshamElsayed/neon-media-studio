/* ==========================================================================
   NÉON MEDIA — Order tracking runtime
   تتبّع طلبك (للعملاء المسجّلين) — يعرض حالة الطلب + الدفع + التفاصيل.
   ========================================================================== */
(function () {
  'use strict';

  var cloud = window.NeonCloud;
  var UI = window.NeonUI;

  function qs(s, r) { return (r || document).querySelector(s); }
  function esc(v) { return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function money(v) { return (window.NeonStore && window.NeonStore.formatPrice) ? window.NeonStore.formatPrice(v) : (Number(v)||0).toLocaleString('en-US'); }

  var els = {
    form: qs('#trackForm'),
    input: qs('#trackNumber'),
    status: qs('#trackStatus'),
    result: qs('#trackResult'),
    authMsg: qs('#trackAuthMsg')
  };

  function setStatus(text, tone) {
    if (!els.status) return;
    els.status.hidden = !text;
    els.status.textContent = text || '';
    els.status.setAttribute('data-tone', tone || 'info');
  }

  function renderOrder(order) {
    if (!els.result) return;
    if (!order) {
      els.result.innerHTML = '<div class="track-empty">لم نعثر على طلب بهذا الرقم. تأكد من إدخال رقم الطلب (مثال: HE-1001) أو تواصل معنا على واتساب.</div>';
      return;
    }
    var status = order.status || 'جديد';
    var payStatus = (window.NeonStore && window.NeonStore.orderPaymentStatus) ? window.NeonStore.orderPaymentStatus(order) : (order.paymentStatus || '—');
    var steps = ['جديد', 'قيد التنفيذ', 'مكتمل'];
    var currentIdx = steps.indexOf(status);
    if (currentIdx < 0) currentIdx = 0;
    var stepsHtml = steps.map(function (s, i) {
      var done = i <= currentIdx;
      return '<div class="track-step' + (done ? ' is-done' : '') + (i === currentIdx ? ' is-current' : '') + '">' +
        '<span class="track-step__dot"></span>' +
        '<span class="track-step__label">' + esc(s) + '</span>' +
      '</div>';
    }).join('');

    els.result.innerHTML =
      '<div class="track-card">' +
        '<div class="track-card__head">' +
          '<strong>رقم الطلب: ' + esc(order.orderNo || order.id || '—') + '</strong>' +
          '<span class="track-card__badge">' + esc(status) + '</span>' +
        '</div>' +
        '<div class="track-timeline">' + stepsHtml + '</div>' +
        '<div class="track-meta">' +
          '<div><span>الخدمة</span><strong>' + esc(order.serviceTitle || '—') + '</strong></div>' +
          '<div><span>الإجمالي</span><strong>' + esc(money(order.total)) + ' ' + esc(order.currency || 'ج.م') + '</strong></div>' +
          '<div><span>حالة الدفع</span><strong>' + esc(payStatus) + '</strong></div>' +
          '<div><span>طريقة الدفع</span><strong>' + esc(order.paymentMethod || '—') + '</strong></div>' +
          '<div><span>تاريخ الطلب</span><strong>' + esc(order.createdAt || '—') + '</strong></div>' +
        '</div>' +
        '<p class="track-hint">لتفاصيل إضافية (إيصال ضريبي، تعديل)، تواصل معنا على واتساب.</p>' +
      '</div>';
  }

  function findOrder(number) {
    var num = String(number || '').trim();
    if (!num) { setStatus('أدخل رقم الطلب.', 'error'); return; }
    setStatus('جارٍ البحث…', 'info');
    if (!cloud || !cloud.getCustomerUser || !cloud.getCustomerUser()) {
      if (els.authMsg) els.authMsg.hidden = false;
      setStatus('سجّل الدخول في «حسابي» لعرض طلباتك، أو تواصل معنا على واتساب.', 'info');
      els.result.innerHTML = '';
      return;
    }
    if (typeof cloud.fetchCustomerOrders !== 'function') {
      setStatus('خدمة التتبع غير متاحة حاليًا.', 'error');
      return;
    }
    cloud.fetchCustomerOrders().then(function (orders) {
      var list = Array.isArray(orders) ? orders : [];
      var found = list.find(function (o) {
        var no = String(o.orderNo || o.number || o.id || '').replace(/^#/, '');
        return no === num.replace(/^#/, '') || String(o.id || '') === num;
      });
      setStatus('', '');
      renderOrder(found || null);
      if (!found) setStatus('لم نعثر على طلب بهذا الرقم في حسابك.', 'warn');
    }).catch(function (error) {
      setStatus('تعذر جلب الطلبات: ' + (error && error.message ? error.message : 'خطأ غير معروف'), 'error');
    });
  }

  if (els.form) {
    els.form.addEventListener('submit', function (e) {
      e.preventDefault();
      findOrder(els.input ? els.input.value : '');
    });
  }

  // Auto-load if logged in
  if (cloud && cloud.whenCustomerReady) {
    cloud.whenCustomerReady(4000).then(function (user) {
      if (user && els.authMsg) els.authMsg.hidden = true;
    }).catch(function () {});
  }
})();
