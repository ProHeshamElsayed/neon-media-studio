/* ==========================================================================
   NÉON MEDIA — Contact page runtime
   Renders service options + quick FAQs and handles the contact form.
   ========================================================================== */
(function () {
  'use strict';

  var qs = function (selector, root) { return (root || document).querySelector(selector); };
  var qsa = function (selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); };
  var store = window.NeonStore;
  var UI = window.NeonUI;

  function escapeHTML(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function activeList(name) {
    var data = store ? store.get() : null;
    return (data && Array.isArray(data[name]) ? data[name] : []).filter(function (item) {
      return item && item.active !== false;
    });
  }

  function requestedService() {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get('service') || '';
    } catch (error) {
      return '';
    }
  }

  /* ------------------------------------------------------------------------
     Service select
     ------------------------------------------------------------------------ */
  function renderServiceOptions() {
    var select = qs('#contactService');
    if (!select) return;
    var current = select.value || requestedService();
    var services = activeList('services');
    select.innerHTML = '<option value="">اختر الخدمة (اختياري)</option>' + services.map(function (service) {
      return '<option value="' + escapeHTML(service.title) + '">' + escapeHTML(service.title) + '</option>';
    }).join('');
    if (current) {
      var exists = Array.prototype.some.call(select.options, function (option) {
        return option.value === current;
      });
      if (exists) select.value = current;
    }
  }

  /* ------------------------------------------------------------------------
     Quick FAQs
     ------------------------------------------------------------------------ */
  function renderFaqs() {
    var accordion = qs('#contactFaqAccordion');
    if (!accordion) return;
    var list = activeList('faqs').slice(0, 6);
    if (!list.length) {
      accordion.innerHTML = '<div class="filter-empty"><p>لا توجد أسئلة شائعة منشورة حاليًا.</p></div>';
      return;
    }
    accordion.innerHTML = list.map(function (faq, index) {
      var id = 'contactFaqPanel' + index;
      return '' +
        '<div class="accordion-item">' +
          '<h3 class="accordion-header">' +
            '<button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#' + id + '" aria-expanded="false" aria-controls="' + id + '">' + escapeHTML(faq.question) + '</button>' +
          '</h3>' +
          '<div id="' + id + '" class="accordion-collapse collapse" data-bs-parent="#contactFaqAccordion">' +
            '<div class="accordion-body">' + escapeHTML(faq.answer) + '</div>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  /* ------------------------------------------------------------------------
     Contact form
     ------------------------------------------------------------------------ */
  function bindContactForm() {
    var form = qs('#contactForm');
    if (!form || form.dataset.ready === '1') return;
    form.dataset.ready = '1';

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      event.stopPropagation();
      form.classList.add('was-validated');
      if (!form.checkValidity()) {
        var invalid = form.querySelector(':invalid');
        if (invalid) invalid.focus();
        return;
      }
      if (!store) return;

      var formData = new FormData(form);
      var name = String(formData.get('name') || '').trim();
      var phone = String(formData.get('phone') || '').trim();
      var email = String(formData.get('email') || '').trim();
      var service = String(formData.get('service') || '').trim();
      var message = String(formData.get('message') || '').trim();

      var entry = store.addMessage({
        name: name,
        phone: phone,
        email: email,
        service: service,
        message: message,
        source: 'صفحة الاتصال',
        status: 'جديد'
      }, { cloud: false });

      if (window.NeonCloud && typeof window.NeonCloud.createRecord === 'function') {
        window.NeonCloud.createRecord('messages', {
          id: entry.id,
          name: entry.name,
          phone: entry.phone,
          email: entry.email,
          service: entry.service,
          message: entry.message,
          source: entry.source,
          status: entry.status,
          createdAt: entry.createdAt
        }).catch(function (error) {
          console.warn('[NeonContact] تعذر رفع الرسالة للسحابة:', error && error.code ? error.code : error);
        });
      }

      var text = [
        'مرحبًا نِيون ميديا 👋',
        'الاسم: ' + name,
        'الهاتف: ' + phone
      ];
      if (email) text.push('البريد: ' + email);
      if (service) text.push('الخدمة: ' + service);
      text.push('الرسالة: ' + message);
      text.push('رقم الرسالة: ' + entry.id);

      if (UI) {
        UI.openWhatsApp(text.join('\n'));
        UI.toast('تم حفظ رسالتك وفتح واتساب لإكمال الإرسال.', 'success', 5500);
      }

      form.reset();
      form.classList.remove('was-validated');

      var submit = form.querySelector('button[type="submit"]');
      if (submit) {
        var original = submit.innerHTML;
        submit.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 13 4 4L19 7"/></svg> تم الإرسال';
        submit.setAttribute('disabled', '');
        setTimeout(function () {
          submit.innerHTML = original;
          submit.removeAttribute('disabled');
        }, 2600);
      }
    });
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */
  function renderAll() {
    renderServiceOptions();
    renderFaqs();
  }

  function boot() {
    if (!store) {
      renderAll();
      bindContactForm();
      return;
    }
    renderAll();
    bindContactForm();

    store.ready.then(function () {
      renderAll();
    }).catch(function (error) {
      console.error('[NeonContact] تعذر تحميل البيانات', error);
    });

    window.addEventListener('neon:datachange', function () {
      renderAll();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
