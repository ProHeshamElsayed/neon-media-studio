/* ==========================================================================
   NEON MEDIA — Marketing & CRM runtime
   Promo banner · notification centre · welcome popup · loyalty hints
   Self-contained: reads NeonStore settings and never replaces page content.
   ========================================================================== */
(function () {
  'use strict';

  var store = window.NeonStore;
  var UI = window.NeonUI;
  if (!store) return;

  var qs = function (selector, root) { return (root || document).querySelector(selector); };
  var qsa = function (selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); };
  var esc = function (value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  var n = function (value) { return Number(value) || 0; };
  var BANNER_KEY = 'neonBannerDismissed_v1';
  var NOTIF_KEY = 'neonNotificationsRead_v1';
  var POP_KEY = 'neonPopupSeen_v2';

  function data() { return store.get(); }
  function settings() { return (data() && data().settings) || {}; }

  function safeGet(storage, key) {
    try { return storage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(storage, key, value) {
    try { storage.setItem(key, value); } catch (e) { /* ignore */ }
  }

  function parseDate(value, endOfDay) {
    if (!value) return null;
    var date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? value + (endOfDay ? 'T23:59:59' : 'T00:00:00') : value);
    return isNaN(date.getTime()) ? null : date;
  }

  function dateWindow(item) {
    var now = Date.now();
    var start = parseDate(item.startAt, false);
    var end = parseDate(item.endAt, true);
    if (start && now < start.getTime()) return false;
    if (end && now > end.getTime()) return false;
    return true;
  }

  function internalLink(link) {
    var href = String(link || '').trim();
    if (!href) return '';
    if (href.charAt(0) !== '#') return href;
    var exists = false;
    try { exists = Boolean(document.querySelector(href)); } catch (e) { exists = false; }
    if (exists) return href;
    return 'index.html' + href;
  }

  /* ------------------------------ PROMO BANNERS -------------------------- */
  var bannerImpressions = {};

  function currentPage() {
    return /contact\.html$/i.test(window.location.pathname) ? 'contact' : 'home';
  }

  function currentDevice() {
    return window.matchMedia && window.matchMedia('(max-width: 767.98px)').matches ? 'mobile' : 'desktop';
  }

  function matchesTarget(item) {
    var page = item.pages || 'all';
    var device = item.devices || 'all';
    if (page !== 'all' && page !== currentPage()) return false;
    if (device !== 'all' && device !== currentDevice()) return false;
    return true;
  }

  function sortCampaigns(list) {
    return list.slice().sort(function (a, b) {
      var pa = n(a.priority);
      var pb = n(b.priority);
      if (pa !== pb) return pb - pa;
      return n(a.order) - n(b.order);
    });
  }

  function activeBanners() {
    return sortCampaigns((data().banners || []).filter(function (item) {
      return item && item.active !== false && dateWindow(item) && matchesTarget(item);
    }));
  }

  function dismissedBanners() {
    try {
      var parsed = JSON.parse(safeGet(localStorage, BANNER_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }

  function dismissBanner(id) {
    var list = dismissedBanners();
    if (list.indexOf(id) === -1) list.push(id);
    safeSet(localStorage, BANNER_KEY, JSON.stringify(list.slice(-100)));
  }

  function bannerMarkup(item) {
    var cta = internalLink(item.link);
    var end = parseDate(item.endAt, true);
    var media = item.image
      ? '<img class="promo-banner__media" src="' + esc(item.image) + '" alt="" loading="lazy">'
      : '';
    var countdown = end
      ? '<span class="promo-banner__countdown" data-promo-countdown data-promo-end="' + esc(item.endAt) + '"></span>'
      : '';
    return '<section class="promo-banner' + (item.image ? ' promo-banner--image' : '') + '" data-banner-id="' + esc(item.id) + '" aria-label="إعلان">' +
      (item.dismissible !== false ? '<button type="button" class="promo-banner__close" data-promo-close aria-label="إغلاق الإعلان">×</button>' : '') +
      '<div class="promo-banner__inner">' +
        media +
        '<div class="promo-banner__content">' +
          (item.kicker ? '<span class="promo-banner__kicker">' + esc(item.kicker) + '</span>' : '') +
          '<h2 class="promo-banner__title">' + esc(item.title || '') + '</h2>' +
          (item.text ? '<p class="promo-banner__text">' + esc(item.text) + '</p>' : '') +
        '</div>' +
        '<div class="promo-banner__actions">' +
          countdown +
          (item.code ? '<span class="promo-banner__code">كود: ' + esc(item.code) + '</span>' : '') +
          (cta ? '<a class="btn-neon btn-sm" href="' + esc(cta) + '" data-promo-cta' + (/^https?:/i.test(cta) ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + esc(item.cta || 'اعرف المزيد') + '</a>' : '') +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function renderPromos() {
    var main = qs('main');
    if (!main) return;
    var dismissed = dismissedBanners();
    var items = activeBanners().filter(function (item) {
      return item.dismissible === false || dismissed.indexOf(item.id) === -1;
    });
    var stack = qs('#promoStack');
    if (!items.length) {
      if (stack) stack.remove();
      return;
    }
    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'promoStack';
      stack.className = 'promo-stack';
      main.insertBefore(stack, main.firstChild);
    }
    stack.innerHTML = items.map(bannerMarkup).join('');

    qsa('.promo-banner', stack).forEach(function (banner) {
      var id = banner.getAttribute('data-banner-id');
      var item = items.filter(function (entry) { return entry.id === id; })[0];
      if (!item) return;
      if (!bannerImpressions[id]) {
        bannerImpressions[id] = true;
        store.trackCampaign(id, 'impression');
      }
      var close = qs('[data-promo-close]', banner);
      if (close) {
        close.addEventListener('click', function () {
          dismissBanner(id);
          store.trackCampaign(id, 'dismiss');
          banner.style.transition = 'opacity .25s ease, transform .25s ease';
          banner.style.opacity = '0';
          banner.style.transform = 'translateY(-8px)';
          setTimeout(function () {
            banner.remove();
            var left = qs('#promoStack');
            if (left && !qs('.promo-banner', left)) left.remove();
          }, 260);
        });
      }
      var cta = qs('[data-promo-cta]', banner);
      if (cta) cta.addEventListener('click', function () { store.trackCampaign(id, 'click'); });
    });
    updatePromoCountdowns();
  }

  function updatePromoCountdowns() {
    qsa('[data-promo-countdown]').forEach(function (el) {
      var end = parseDate(el.getAttribute('data-promo-end'), true);
      if (!end) { el.textContent = ''; return; }
      var diff = end.getTime() - Date.now();
      if (diff <= 0) { el.textContent = 'انتهى العرض'; return; }
      var days = Math.floor(diff / 86400000);
      var hours = Math.floor((diff % 86400000) / 3600000);
      el.textContent = days > 0
        ? 'ينتهي بعد ' + days + ' يوم' + (hours ? ' و' + hours + ' ساعة' : '')
        : 'ينتهي بعد ' + Math.max(1, hours) + ' ساعة';
    });
  }

  /* ---------------------------- NOTIFICATIONS ---------------------------- */
  var notifWrap = null;
  var notifPanel = null;

  function activeNotifications() {
    if (settings().notificationsEnabled === false) return [];
    return (data().notifications || []).filter(function (item) {
      return item && item.active !== false && dateWindow(item);
    }).sort(function (a, b) {
      if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
  }

  function readIds() {
    try {
      var parsed = JSON.parse(safeGet(localStorage, NOTIF_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }

  function saveReadIds(ids) {
    safeSet(localStorage, NOTIF_KEY, JSON.stringify(ids.slice(0, 200)));
  }

  function unreadCount() {
    var read = readIds();
    return activeNotifications().filter(function (item) { return read.indexOf(item.id) === -1; }).length;
  }

  function notifTypeLabel(type) {
    return ({ info: 'تنبيه', offer: 'عرض', alert: 'مهم', success: 'تم' })[type] || 'تنبيه';
  }

  function buildNotifications() {
    if (settings().notificationsEnabled === false) {
      if (notifWrap) notifWrap.remove();
      if (notifPanel) notifPanel.remove();
      notifWrap = null;
      notifPanel = null;
      return;
    }
    var actions = qs('.header-actions');
    if (!actions) return;

    if (!notifWrap) {
      notifWrap = document.createElement('div');
      notifWrap.className = 'notif-wrap';
      notifWrap.innerHTML =
        '<button type="button" class="icon-btn notif-bell" id="notifBell" aria-label="الإشعارات" aria-expanded="false" title="الإشعارات">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>' +
          '<span class="notif-bell__badge" id="notifBadge" hidden>0</span>' +
        '</button>';
      actions.insertBefore(notifWrap, actions.firstChild);
    }

    if (!notifPanel) {
      notifPanel = document.createElement('div');
      notifPanel.className = 'notif-panel';
      notifPanel.id = 'notifPanel';
      notifPanel.setAttribute('role', 'dialog');
      notifPanel.setAttribute('aria-label', 'الإشعارات');
      notifPanel.innerHTML =
        '<div class="notif-panel__head"><h3>الإشعارات</h3><button type="button" id="notifReadAll">تحديد الكل كمقروء</button></div>' +
        '<div class="notif-panel__list" id="notifList"></div>' +
        '<div class="notif-panel__foot"><a href="index.html#contact">تواصل معنا لأي استفسار</a></div>';
      document.body.appendChild(notifPanel);

      qs('#notifBell').addEventListener('click', function (event) {
        event.stopPropagation();
        toggleNotifications(notifPanel.classList.contains('is-open') ? false : true);
      });
      qs('#notifReadAll').addEventListener('click', function () {
        saveReadIds(activeNotifications().map(function (item) { return item.id; }));
        updateNotifications();
        if (UI) UI.toast('تم تعليم كل الإشعارات كمقروءة.', 'success');
      });
      notifPanel.addEventListener('click', function (event) { event.stopPropagation(); });
      document.addEventListener('click', function () { toggleNotifications(false); });
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') toggleNotifications(false);
      });
    }
    updateNotifications();
  }

  function toggleNotifications(open) {
    if (!notifPanel) return;
    notifPanel.classList.toggle('is-open', !!open);
    var bell = qs('#notifBell');
    if (bell) bell.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function updateNotifications() {
    if (!notifPanel) return;
    var list = activeNotifications();
    var read = readIds();
    var unread = list.filter(function (item) { return read.indexOf(item.id) === -1; });
    var badge = qs('#notifBadge');
    var badgeText = unread.length > 9 ? '9+' : String(unread.length);
    if (badge) {
      badge.textContent = badgeText;
      badge.hidden = unread.length === 0;
    }
    var bell = qs('#notifBell');
    if (bell) {
      bell.setAttribute('aria-label', unread.length ? 'الإشعارات (' + badgeText + ')' : 'الإشعارات');
    }
    var listEl = qs('#notifList');
    if (!listEl) return;
    if (!list.length) {
      listEl.innerHTML = '<div class="notif-empty">لا توجد إشعارات جديدة حاليًا.<br>تابعنا قريبًا ✨</div>';
      return;
    }
    listEl.innerHTML = list.map(function (item) {
      var isUnread = read.indexOf(item.id) === -1;
      var href = internalLink(item.link);
      var tag = href ? 'a' : 'div';
      return '<' + tag + ' class="notif-item' + (isUnread ? ' is-unread' : '') + '"' +
        (href ? ' href="' + esc(href) + '"' + (/^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : '') : '') +
        ' data-notif-id="' + esc(item.id) + '">' +
        '<h4>' + (isUnread ? '<span class="notif-item__dot" aria-hidden="true"></span>' : '') +
          esc(item.title || '') + '<span class="notif-item__type">' + notifTypeLabel(item.type) + '</span></h4>' +
        '<p>' + esc(item.message || '') + '</p>' +
        (item.createdAt ? '<time>' + esc(store.formatDate(item.createdAt)) + '</time>' : '') +
      '</' + tag + '>';
    }).join('');

    qsa('[data-notif-id]', listEl).forEach(function (el) {
      el.addEventListener('click', function () {
        var id = el.getAttribute('data-notif-id');
        var next = readIds();
        if (next.indexOf(id) === -1) next.push(id);
        saveReadIds(next);
        updateNotifications();
        setTimeout(function () { toggleNotifications(false); }, 120);
      });
    });
  }

  /* ----------------------------- WELCOME POPUP --------------------------- */
  var popupEl = null;
  var popupScheduled = false;

  function gateBlocking() {
    var gate = qs('#welcomeGate');
    if (!gate || gate.hasAttribute('hidden')) return false;
    var styles = window.getComputedStyle(gate);
    return styles.visibility !== 'hidden' && styles.display !== 'none';
  }

  function whenGateClosed(callback) {
    if (!gateBlocking()) return callback();
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (!gateBlocking() || tries > 40) {
        clearInterval(timer);
        if (!gateBlocking()) callback();
      }
    }, 400);
  }

  function activePopups() {
    return sortCampaigns((data().popups || []).filter(function (item) {
      return item && item.active !== false && dateWindow(item) && matchesTarget(item);
    }));
  }

  function popupSeenMap() {
    try {
      var parsed = JSON.parse(safeGet(localStorage, POP_KEY) || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (e) { return {}; }
  }

  function popupAlreadySeen(item) {
    var freq = item.frequency || 'once';
    if (freq === 'always') return false;
    var key = item.id || 'legacy';
    if (freq === 'session') return safeGet(sessionStorage, POP_KEY + ':' + key) === 'shown';
    if (freq === 'day') return popupSeenMap()[key] === new Date().toISOString().slice(0, 10);
    return Boolean(popupSeenMap()[key]);
  }

  function markPopupSeen(item) {
    var freq = item.frequency || 'once';
    if (freq === 'always') return;
    var key = item.id || 'legacy';
    if (freq === 'session') {
      safeSet(sessionStorage, POP_KEY + ':' + key, 'shown');
      return;
    }
    var map = popupSeenMap();
    map[key] = freq === 'day' ? new Date().toISOString().slice(0, 10) : 'seen';
    safeSet(localStorage, POP_KEY, JSON.stringify(map));
  }

  function nextPopup() {
    var list = activePopups();
    for (var i = 0; i < list.length; i += 1) {
      if (!popupAlreadySeen(list[i])) return list[i];
    }
    return null;
  }

  function closePopup(action) {
    if (!popupEl) return;
    var id = popupEl.getAttribute('data-popup-id');
    if (id && action) store.trackCampaign(id, action);
    popupEl.classList.remove('is-open');
    var node = popupEl;
    popupEl = null;
    setTimeout(function () { node.remove(); }, 360);
  }

  function showPopup(item) {
    item = item || nextPopup();
    if (!item || popupEl) return;
    var cta = internalLink(item.link);
    popupEl = document.createElement('div');
    popupEl.className = 'neon-pop';
    popupEl.setAttribute('data-popup-id', item.id || '');
    popupEl.setAttribute('role', 'dialog');
    popupEl.setAttribute('aria-modal', 'true');
    popupEl.setAttribute('aria-label', item.title || 'ترحيب');
    popupEl.innerHTML =
      '<div class="neon-pop__card">' +
        '<button type="button" class="neon-pop__close" data-pop-close aria-label="إغلاق">×</button>' +
        (item.image
          ? '<img class="neon-pop__media" src="' + esc(item.image) + '" alt="" loading="lazy">'
          : '<div class="neon-pop__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/><path d="M19 15v4M17 17h4M5 4v3M3.5 5.5h3"/></svg></div>') +
        '<h2>' + esc(item.title || 'أهلًا بك') + '</h2>' +
        '<p>' + esc(item.text || '') + '</p>' +
        '<div class="neon-pop__actions">' +
          (cta ? '<a class="btn-neon" href="' + esc(cta) + '" data-pop-cta' + (/^https?:/i.test(cta) ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + esc(item.cta || 'ابدأ الآن') + '</a>' : '') +
          '<button type="button" class="btn-ghost" data-pop-close>لاحقًا</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(popupEl);
    markPopupSeen(item);
    if (item.id) store.trackCampaign(item.id, 'impression');
    requestAnimationFrame(function () { popupEl.classList.add('is-open'); });
    qsa('[data-pop-close]', popupEl).forEach(function (btn) {
      btn.addEventListener('click', function () { closePopup('dismiss'); });
    });
    qsa('[data-pop-cta]', popupEl).forEach(function (btn) {
      btn.addEventListener('click', function () { closePopup('click'); });
    });
    popupEl.addEventListener('click', function (event) {
      if (event.target === popupEl) closePopup('dismiss');
    });
    document.addEventListener('keydown', function onEsc(event) {
      if (event.key === 'Escape') {
        closePopup('dismiss');
        document.removeEventListener('keydown', onEsc);
      }
    });
  }

  function schedulePopup() {
    if (popupScheduled) return;
    var item = nextPopup();
    if (!item) return;
    popupScheduled = true;

    function openNow() {
      whenGateClosed(function () {
        if (popupAlreadySeen(item)) return;
        showPopup(item);
      });
    }

    if (item.trigger === 'scroll') {
      var depth = Math.max(10, Math.min(100, n(item.scrollDepth) || 50));
      var onScroll = function () {
        var doc = document.documentElement;
        var max = doc.scrollHeight - window.innerHeight;
        var percent = max <= 0 ? 100 : (window.pageYOffset / max) * 100;
        if (percent >= depth) {
          window.removeEventListener('scroll', onScroll);
          openNow();
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
      return;
    }

    if (item.trigger === 'exit') {
      var onExit = function (event) {
        if (event && event.type === 'mouseout' && event.relatedTarget) return;
        if (event && typeof event.clientY === 'number' && event.clientY > 0) return;
        document.removeEventListener('mouseout', onExit);
        document.removeEventListener('mouseleave', onExit);
        openNow();
      };
      document.addEventListener('mouseout', onExit);
      document.addEventListener('mouseleave', onExit);
      return;
    }

    var delay = Math.max(0, Math.min(120, n(item.delay))) * 1000;
    whenGateClosed(function () {
      setTimeout(openNow, delay + 500);
    });
  }

  /* ------------------------------- LOYALTY ------------------------------- */
  function initLoyalty() {
    var phone = qs('#orderPhone');
    if (!phone) return;
    var s = settings();
    var hint = qs('#orderLoyalty');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'orderLoyalty';
      hint.className = 'order-loyalty';
      hint.hidden = true;
      hint.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9L12 3Z"/></svg><span></span>';
      phone.parentNode.appendChild(hint);
      phone.addEventListener('input', function () { updateLoyalty(); });
    }
    if (s.loyaltyEnabled === false) { hint.hidden = true; return; }
    updateLoyalty();
  }

  function updateLoyalty() {
    var s = settings();
    var phone = qs('#orderPhone');
    var hint = qs('#orderLoyalty');
    if (!phone || !hint) return;
    if (s.loyaltyEnabled === false) { hint.hidden = true; return; }
    var value = store.normalizePhone ? store.normalizePhone(phone.value) : phone.value;
    var label = s.loyaltyLabel || 'نقاط الولاء';
    var rate = n(s.loyaltyPointsPerCurrency);
    if (value.length >= 8) {
      var customer = store.findCustomerByPhone ? store.findCustomerByPhone(phone.value) : null;
      if (customer) {
        hint.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9L12 3Z"/></svg>' +
          '<span>لديك <b>' + n(customer.points) + '</b> ' + esc(label) + (rate > 0 ? ' — وتكسب نقاطًا مع كل طلب جديد.' : '') + '</span>';
        hint.hidden = false;
        return;
      }
    }
    if (rate > 0) {
      var per = rate >= 1 ? (Math.round((1 / rate) * 100) / 100) : (1 / rate);
      hint.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9L12 3Z"/></svg>' +
        '<span>اجمع <b>' + esc(label) + '</b> مع كل طلب — كل ' + esc(per) + ' ' + esc(s.currency || 'ج.م') + ' = نقطة.</span>';
      hint.hidden = false;
    } else {
      hint.hidden = true;
    }
  }

  /* --------------------------------- BOOT -------------------------------- */
  function refresh() {
    renderPromos();
    buildNotifications();
    initLoyalty();
    schedulePopup();
  }

  function init() {
    store.ready.then(function () {
      refresh();
      updatePromoCountdowns();
      setInterval(updatePromoCountdowns, 60000);
    });
    store.subscribe(function () { refresh(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.NeonMarketing = {
    refresh: refresh,
    showWelcomePopup: showPopup,
    notifications: activeNotifications
  };
})();
