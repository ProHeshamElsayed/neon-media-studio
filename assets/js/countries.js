/* ==========================================================================
   NÉON MEDIA — Countries & currencies (public pages)
   - الأسعار الأساسية بالجنيه المصري، والتحويل بمعدل يضبطه الأدمن
   - الاختيار محفوظ في localStorage: neonCountry (لا يمسح أي بيانات أخرى)
   - الدولة المفعّلة فقط تظهر في القائمة
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'neonCountry';
  var FALLBACK = [
    { code: 'EG', nameAr: 'مصر', nameEn: 'Egypt', currency: 'EGP', symbol: 'ج.م', rate: 1, enabled: true, primary: true },
    { code: 'SA', nameAr: 'السعودية', nameEn: 'Saudi Arabia', currency: 'SAR', symbol: 'ر.س', rate: 0.08, enabled: true, primary: false },
    { code: 'AE', nameAr: 'الإمارات', nameEn: 'UAE', currency: 'AED', symbol: 'د.إ', rate: 0.09, enabled: true, primary: false }
  ];

  function settings() {
    var store = window.NeonStore;
    var data = store && typeof store.get === 'function' ? store.get() : null;
    return (data && data.settings) || {};
  }

  function countries() {
    var list = settings().countries;
    if (!Array.isArray(list) || !list.length) return FALLBACK.slice();
    return list.filter(function (c) { return c && c.code; }).map(function (c) {
      return {
        code: String(c.code || '').toUpperCase(),
        nameAr: String(c.nameAr || c.code),
        nameEn: String(c.nameEn || c.code),
        currency: String(c.currency || c.code),
        symbol: String(c.symbol || c.currency || c.code),
        rate: Number(c.rate) || 1,
        enabled: c.enabled !== false,
        primary: !!c.primary
      };
    });
  }

  function enabledCountries() {
    return countries().filter(function (c) { return c.enabled; });
  }

  function savedCode() {
    try { return String(localStorage.getItem(KEY) || '').toUpperCase(); } catch (e) { return ''; }
  }

  function activeCountry() {
    var list = enabledCountries();
    var code = savedCode();
    var found = list.filter(function (c) { return c.code === code; })[0];
    if (found) return found;
    var configured = String((settings().activeCountry || '')).toUpperCase();
    found = list.filter(function (c) { return c.code === configured; })[0];
    if (found) return found;
    var primary = list.filter(function (c) { return c.primary; })[0];
    return primary || list[0] || FALLBACK[0];
  }

  function convert(value, country) {
    var c = country || activeCountry();
    var amount = Number(value) || 0;
    var rate = Number(c.rate);
    if (!Number.isFinite(rate) || rate <= 0) rate = 1;
    return amount * rate;
  }

  function locale() {
    return 'en-US';
  }

  var CURRENCY_ALIASES = {
    'ج.م': 'EGP', 'جنيه': 'EGP', 'جنيهمصري': 'EGP', 'egp': 'EGP', 'le': 'EGP', 'l.e': 'EGP',
    'ر.س': 'SAR', 'ريال': 'SAR', 'ريالسعودي': 'SAR', 'sar': 'SAR',
    'د.إ': 'AED', 'درهم': 'AED', 'درهماماراتي': 'AED', 'aed': 'AED'
  };

  function currencyCode(text) {
    var key = String(text || '').trim().toLowerCase().replace(/[\s\u064b-\u065f]/g, '');
    return CURRENCY_ALIASES[key] || '';
  }

  // عملة صريحة (طلب قديم/فاتورة) تُعرض كما هي بدون تحويل.
  // عدم وجود عملة صريحة يعني أن الرقم سعر أساسي بالجنيه → يُحوّل للدولة المختارة.
  function format(value, currency) {
    var num = Number(value) || 0;
    var explicit = String(currency || '').trim();
    if (explicit) {
      var code = currencyCode(explicit);
      var match = code ? countries().filter(function (c) { return c.currency === code; })[0] : null;
      if (match) return number(num) + ' ' + match.symbol;
      if (code === 'EGP') return number(num) + ' ج.م';
      return number(num) + ' ' + explicit;
    }
    var c = activeCountry();
    return number(convert(num, c)) + ' ' + c.symbol;
  }

  function number(value) {
    try {
      return Number(value).toLocaleString(locale(), { maximumFractionDigits: 2 });
    } catch (e) {
      return String(Math.round(Number(value) * 100) / 100);
    }
  }

  function label(country) {
    var en = window.NeonI18n && window.NeonI18n.getLang() === 'en';
    return (en ? country.nameEn : country.nameAr) + ' (' + country.symbol + ')';
  }

  function addStyles() {
    if (document.getElementById('neonCountryStyles')) return;
    var style = document.createElement('style');
    style.id = 'neonCountryStyles';
    style.textContent =
      '.neon-country-switch{position:relative;z-index:60;display:inline-flex;align-items:center}' +
      '.neon-country-switch select{max-width:150px;height:32px;padding:0 10px;border-radius:999px;' +
      'border:1px solid rgba(167,139,250,.45);background:rgba(8,14,26,.72);color:#c4b5fd;' +
      'font-size:12px;font-weight:700;cursor:pointer;outline:none}' +
      '.neon-country-switch select:focus-visible{box-shadow:0 0 0 2px rgba(167,139,250,.4)}' +
      '@media(max-width:575.98px){.neon-country-switch select{max-width:88px;width:88px;padding:0 6px;font-size:11px}}' +
      '@media(max-width:399.98px){.neon-country-switch select{max-width:74px;width:74px;font-size:10px}}';
    document.head.appendChild(style);
  }

  function addSwitcher() {
    var wrap = document.getElementById('neonCountrySwitch');
    var select = document.getElementById('neonCountrySelect');
    var header = document.querySelector('.site-header, #siteHeader, header');
    if (!header) return;
    var target = header.querySelector('.header-actions') || header;
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'neonCountrySwitch';
      wrap.className = 'neon-country-switch';
      var langSwitch = document.getElementById('neonLangSwitch');
      if (langSwitch && langSwitch.parentNode === target) target.insertBefore(wrap, langSwitch.nextSibling);
      else target.insertBefore(wrap, target.firstChild);
    }
    if (!select) {
      select = document.createElement('select');
      select.id = 'neonCountrySelect';
      select.setAttribute('aria-label', 'Country / currency');
      select.setAttribute('data-no-i18n', '');
      wrap.appendChild(select);
    }
    addStyles();
    var current = activeCountry().code;
    var list = enabledCountries();
    select.innerHTML = '';
    list.forEach(function (c) {
      var option = document.createElement('option');
      option.value = c.code;
      option.textContent = label(c);
      if (c.code === current) option.selected = true;
      select.appendChild(option);
    });
    select.onchange = function () { applySelection(select.value); };
  }

  function applySelection(code) {
    try { localStorage.setItem(KEY, code); } catch (e) { /* تجاهل */ }
    refresh();
    window.dispatchEvent(new CustomEvent('neon:countrychange', { detail: { code: code } }));
    window.dispatchEvent(new CustomEvent('neon:datachange', {
      detail: { data: (window.NeonStore && window.NeonStore.get && window.NeonStore.get()) || {}, source: 'country' }
    }));
  }

  function decorate(root) {
    if (!root || !root.querySelectorAll) return;
    var nodes = root.querySelectorAll('[data-price]');
    Array.prototype.forEach.call(nodes, function (el) {
      if (el.hasAttribute('data-no-i18n')) return;
      el.textContent = format(el.getAttribute('data-price'));
    });
  }

  function refresh() {
    addSwitcher();
    if (document.body) decorate(document.body);
  }

  function patchStore() {
    var store = window.NeonStore;
    if (!store || store.__neonCountryPatched) return;
    var original = store.formatPrice;
    store.formatPrice = function (value, currency) { return format(value, currency); };
    store.__neonCountryPatched = true;
    store.__neonFormatPriceOriginal = original;
  }

  window.NeonCountries = {
    KEY: KEY,
    countries: countries,
    enabled: enabledCountries,
    active: activeCountry,
    convert: convert,
    format: format,
    number: number,
    refresh: refresh,
    set: function (code) {
      var found = countries().filter(function (c) { return c.code === String(code || '').toUpperCase(); })[0];
      if (!found || !found.enabled) return false;
      applySelection(found.code);
      return true;
    }
  };

  function init() {
    patchStore();
    refresh();
    if (window.NeonStore && window.NeonStore.subscribe) window.NeonStore.subscribe(refresh);
    if (window.NeonStore && window.NeonStore.ready) window.NeonStore.ready.then(refresh).catch(function () {});
    window.addEventListener('neon:langchange', refresh);
    if (window.MutationObserver) {
      var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          if (mutation.addedNodes) {
            Array.prototype.forEach.call(mutation.addedNodes, function (node) {
              if (node.nodeType === 1) decorate(node);
            });
          }
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
