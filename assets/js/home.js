/* ==========================================================================
   NÉON MEDIA — Home page runtime
   Rendering dynamic content from NeonStore + filters, modals, orders, forms.
   ========================================================================== */
(function () {
  'use strict';

  var qs = function (selector, root) { return (root || document).querySelector(selector); };
  var qsa = function (selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); };
  var store = window.NeonStore;
  var UI = window.NeonUI;
  var data = null;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var state = {
    serviceFilter: 'all',
    workFilter: 'all',
    currentServiceId: null,
    lastOrder: null,
    lastOrderText: ''
  };

  var modalInstances = {};

  function escapeHTML(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function n(value) {
    return Number(value) || 0;
  }

  function money(value) {
    return (store && store.formatPrice) ? store.formatPrice(value) : n(value).toLocaleString('en-US') + ' ' + ((data && data.settings.currency) || 'ج.م');
  }

  function activeList(name) {
    return (data && Array.isArray(data[name]) ? data[name] : []).filter(function (item) {
      return item && item.active !== false;
    });
  }

  function byId(name, id) {
    return (data && Array.isArray(data[name]) ? data[name] : []).find(function (item) { return item.id === id; }) || null;
  }

  function modal(id) {
    var el = qs('#' + id);
    if (!el || !window.bootstrap || !window.bootstrap.Modal) return null;
    if (!modalInstances[id]) modalInstances[id] = window.bootstrap.Modal.getOrCreateInstance(el);
    return modalInstances[id];
  }

  /* ------------------------------------------------------------------------
     Icons
     ------------------------------------------------------------------------ */
  var STAR = '<path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9L12 3Z"/>';
  var CHECK = '<path d="m5 13 4 4L19 7"/>';
  var ARROW = '<path d="M19 12H5M11 18l-6-6 6-6"/>';

  var ICONS = {
    palette: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18c1.7 0 2.1-1.4 1.2-2.4-.8-1.1-.3-2.7 1.2-2.7H17a4 4 0 0 0 4-3.9C21 7 17 3 12 3Z"/><circle cx="7.4" cy="10.2" r="1" fill="currentColor" stroke="none"/><circle cx="9.8" cy="6.8" r="1" fill="currentColor" stroke="none"/><circle cx="14.2" cy="6.8" r="1" fill="currentColor" stroke="none"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>',
    camera: '<path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.6"/>',
    menu: '<path d="M6 3v18M18 3v18M3 8h18M3 16h18M9 3v18"/>',
    barcode: '<path d="M4 5v14M7 5v14M11 5v14M13 5v14M17 5v14M20 5v14"/>',
    map: '<path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
    content: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    social: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>',
    ads: '<path d="M3 17 8 12l4 4 9-9"/><path d="M14 7h7v7"/>',
    building: '<path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16"/><path d="M15 9h4a1 1 0 0 1 1 1v11M2 21h20"/><path d="M7 8h4M7 12h4M7 16h4M18 13h1M18 17h1"/>',
    'camera-home': '<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/><path d="M9 14h6v4H9z"/><circle cx="12" cy="16" r="1.4"/>',
    food: '<path d="M5 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3M7 12v9M17 3c-2 1.5-2.5 3.5-2.5 5.5 0 1.6.8 2.5 2.5 2.5h2V3"/><path d="M19 11v10"/>',
    invoice: '<path d="M14 2H6a2 2 0 0 0-2 2v16l3-2 3 2 3-2 3 2 3-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    invitation: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/><path d="M12 19s-3-1.8-3-4a2 2 0 0 1 3-1.5A2 2 0 0 1 15 15c0 2.2-3 4-3 4Z"/>',
    megaphone: '<path d="M3 11v3a1 1 0 0 0 1 1h2l3 3V7L6 10H4a1 1 0 0 0-1 1Z"/><path d="m9 9 9-4v14L9 15"/><path d="M18 8a4 4 0 0 1 0 8"/>',
    print: '<path d="M6 9V3h12v6"/><rect x="6" y="14" width="12" height="7"/><path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 6h10"/>',
    rocket: '<path d="M4.5 16.5c-1.5 1.5-2 5-2 5s3.5-.5 5-2c.8-.8.8-2.2 0-3-.8-.8-2.2-.8-3 0Z"/><path d="m12 15-3-3c1.2-4.5 4-8 9-9 .8-.2 1.5.4 1.3 1.2-1 4.8-4.4 7.6-8.8 8.8Z"/><path d="M9 12H4l3-5h4M12 15v5l5-3v-4"/><circle cx="15.5" cy="8.5" r="1.5"/>',
    growth: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/><path d="M15 8h4v4"/>',
    crown: '<path d="m3 7 4.5 4L12 4l4.5 7L21 7l-2 11H5L3 7Z"/><path d="M5 21h14"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
    wallet: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/>',
    bank: '<path d="M3 10 12 4l9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18"/>',
    paypal: '<circle cx="12" cy="12" r="9"/><path d="M9 17V7h3.2a3 3 0 0 1 0 6H9"/><path d="M11.5 13H14a3 3 0 0 1 0 6h-3"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    arrowUpLeft: '<path d="M17 17 7 7M7 17V7h10"/>'
  };

  function icon(name) {
    var body = ICONS[name] || ICONS.spark;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  }

  function starRow(rating) {
    var total = Math.max(1, Math.min(5, Number(rating) || 5));
    var html = '';
    for (var i = 0; i < 5; i++) {
      html += '<svg viewBox="0 0 24 24" aria-hidden="true" style="' + (i >= total ? 'opacity:.22' : '') + '">' + STAR + '</svg>';
    }
    return '<div class="stars" role="img" aria-label="' + total + ' من 5">' + html + '</div>';
  }

  /* ------------------------------------------------------------------------
     Static / settings driven blocks
     ------------------------------------------------------------------------ */
  function renderHero(settings) {
    var statsWrap = qs('#heroStats');
    if (statsWrap && Array.isArray(settings.stats)) {
      statsWrap.innerHTML = settings.stats.map(function (stat) {
        return '' +
          '<div class="hero-stat">' +
            '<span class="hero-stat__value"><span data-counter="' + n(stat.value) + '" data-duration="1800">0</span>' + escapeHTML(stat.suffix || '') + '</span>' +
            '<span class="hero-stat__label">' + escapeHTML(stat.label || '') + '</span>' +
          '</div>';
      }).join('');
    }

    var skillsWrap = qs('#heroSkills');
    if (skillsWrap && Array.isArray(settings.skills)) {
      skillsWrap.innerHTML = settings.skills.slice(0, 5).map(function (skill) {
        return '<span>' + escapeHTML(skill) + '</span>';
      }).join('');
    }

    var marquee = qs('#heroMarquee');
    if (marquee) {
      var words = (activeList('services').length ? activeList('services').map(function (s) { return s.title; }) : ['تصميم جرافيك', 'سوشيال ميديا', 'تصوير', 'تسويق', 'مواقع', 'مطبوعات']).slice(0, 10);
      var track = '<div class="marquee__track">' + words.map(function (word) {
        return '<span class="marquee__item">' + icon('spark') + escapeHTML(word) + '</span>';
      }).join('') + '</div>';
      marquee.innerHTML = track + track;
    }

    var highlights = qs('#aboutHighlights');
    if (highlights && Array.isArray(settings.aboutHighlights)) {
      highlights.innerHTML = settings.aboutHighlights.map(function (item) {
        return '<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + CHECK + '</svg><span>' + escapeHTML(item) + '</span></li>';
      }).join('');
    }

    var aboutText = qs('#aboutText');
    if (aboutText && settings.aboutText) {
      aboutText.innerHTML = String(settings.aboutText).split(/\n{2,}/).map(function (paragraph) {
        return '<p>' + escapeHTML(paragraph).replace(/\n/g, '<br>') + '</p>';
      }).join('');
    }

    var aboutSkills = qs('#aboutSkills');
    if (aboutSkills && Array.isArray(settings.skills)) {
      var levels = [96, 93, 89, 86, 91, 84];
      aboutSkills.innerHTML = settings.skills.slice(0, 5).map(function (skill, index) {
        var level = levels[index] || 85;
        return '' +
          '<div class="skill-row">' +
            '<div class="skill-row__head"><span>' + escapeHTML(skill) + '</span><span>' + level + '%</span></div>' +
            '<div class="skill-row__bar"><i data-skill="' + level + '" style="--level:' + level + '%"></i></div>' +
          '</div>';
      }).join('');
    }

    var audienceWrap = qs('#audienceChips');
    if (audienceWrap && Array.isArray(settings.audiences)) {
      audienceWrap.innerHTML = settings.audiences.map(function (item) {
        return '<span class="audience-chip">' + icon('spark') + escapeHTML(item) + '</span>';
      }).join('');
    }

    startTypewriter(Array.isArray(settings.heroRoles) && settings.heroRoles.length ? settings.heroRoles : ['مدير إبداع']);
  }

  var typeTimer = null;
  function startTypewriter(roles) {
    var el = qs('#typewriter');
    if (!el) return;
    if (typeTimer) clearTimeout(typeTimer);
    if (reducedMotion) { el.textContent = roles[0] || ''; return; }
    var roleIndex = 0;
    var charIndex = 0;
    var deleting = false;
    function tick() {
      var word = String(roles[roleIndex] || '');
      if (!deleting) {
        charIndex++;
        el.textContent = word.slice(0, charIndex);
        if (charIndex >= word.length) {
          deleting = true;
          typeTimer = setTimeout(tick, 1600);
          return;
        }
        typeTimer = setTimeout(tick, 78);
      } else {
        charIndex--;
        el.textContent = word.slice(0, Math.max(0, charIndex));
        if (charIndex <= 0) {
          deleting = false;
          roleIndex = (roleIndex + 1) % roles.length;
          typeTimer = setTimeout(tick, 340);
          return;
        }
        typeTimer = setTimeout(tick, 38);
      }
    }
    el.textContent = '';
    typeTimer = setTimeout(tick, 420);
  }

  /* ------------------------------------------------------------------------
     Services
     ------------------------------------------------------------------------ */
  function serviceCard(service) {
    var features = Array.isArray(service.features) ? service.features.slice(0, 4) : [];
    var badge = service.badge ? '<span class="service-badge' + (service.badge === 'جديد' ? ' service-badge--new' : '') + '">' + escapeHTML(service.badge) + '</span>' : '';
    return '' +
      '<article class="card-neon spotlight service-card' + (service.featured ? ' service-card--featured' : '') + '" data-reveal data-service-card="' + escapeHTML(service.id) + '">' +
        '<div class="service-card__head">' +
          '<span class="service-icon">' + icon(service.icon) + '</span>' +
          badge +
        '</div>' +
        '<h3>' + escapeHTML(service.title) + '</h3>' +
        '<p class="service-card__short">' + escapeHTML(service.short) + '</p>' +
        (features.length ? '<ul class="service-features">' + features.map(function (feature) {
          return '<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + CHECK + '</svg><span>' + escapeHTML(feature) + '</span></li>';
        }).join('') + '</ul>' : '') +
        '<div class="service-card__footer">' +
          '<div class="service-price">' +
            '<small>' + escapeHTML(service.priceNote || 'يبدأ من') + '</small>' +
            '<strong>' + money(service.price) + (service.unit ? ' <em>' + escapeHTML(service.unit) + '</em>' : '') + '</strong>' +
          '</div>' +
          '<div class="service-actions">' +
            '<button type="button" class="service-link" data-service-detail="' + escapeHTML(service.id) + '" aria-label="تفاصيل ' + escapeHTML(service.title) + '" title="التفاصيل">' + icon('info') + '</button>' +
            '<button type="button" class="service-order-btn" data-service-order="' + escapeHTML(service.id) + '">اطلب ' + icon('arrowUpLeft') + '</button>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function emptyState(text) {
    return '<div class="filter-empty">' + icon('image') + '<p>' + escapeHTML(text) + '</p></div>';
  }

  function renderServices() {
    var grid = qs('#servicesGrid');
    if (!grid) return;
    var all = activeList('services');
    var categories = [];
    all.forEach(function (service) {
      if (service.category && categories.indexOf(service.category) === -1) categories.push(service.category);
    });
    if (state.serviceFilter !== 'all' && categories.indexOf(state.serviceFilter) === -1) state.serviceFilter = 'all';

    var filters = qs('#serviceFilters');
    if (filters) {
      filters.innerHTML = ['all'].concat(categories).map(function (cat) {
        var label = cat === 'all' ? 'كل الخدمات' : cat;
        return '<button type="button" class="filter-btn' + (state.serviceFilter === cat ? ' is-active' : '') + '" data-filter="' + escapeHTML(cat) + '" role="tab" aria-selected="' + (state.serviceFilter === cat) + '">' + escapeHTML(label) + '</button>';
      }).join('');
    }

    var list = state.serviceFilter === 'all' ? all : all.filter(function (service) { return service.category === state.serviceFilter; });
    grid.innerHTML = list.length ? list.map(serviceCard).join('') : emptyState('لا توجد خدمات في هذا التصنيف حاليًا.');
    if (UI) {
      UI.refreshReveal(grid);
      bindSpotlight(grid);
    }
  }

  /* ------------------------------------------------------------------------
     Packages
     ------------------------------------------------------------------------ */
  function renderPackages() {
    var grid = qs('#packagesGrid');
    if (!grid) return;
    var packages = activeList('packages');
    var icons = ['rocket', 'growth', 'crown'];
    grid.innerHTML = packages.length ? packages.map(function (pkg, index) {
      return '' +
        '<article class="package-card' + (pkg.highlighted ? ' package-card--featured' : '') + '" data-reveal>' +
          (pkg.badge ? '<span class="package-badge">' + escapeHTML(pkg.badge) + '</span>' : '') +
          '<div class="package-icon">' + icon(icons[index % icons.length]) + '</div>' +
          '<h3>' + escapeHTML(pkg.name) + '</h3>' +
          '<p class="package-card__sub">' + escapeHTML(pkg.subtitle || '') + '</p>' +
          '<div class="package-price"><strong>' + n(pkg.price).toLocaleString('en-US') + '</strong><span>' + escapeHTML((data.settings.currency || 'ج.م') + ' ' + (pkg.period || '')) + '</span></div>' +
          '<ul class="package-features">' + (Array.isArray(pkg.features) ? pkg.features.map(function (feature) {
            return '<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + CHECK + '</svg><span>' + escapeHTML(feature) + '</span></li>';
          }).join('') : '') + '</ul>' +
          '<button type="button" class="btn-neon" data-package-order="' + escapeHTML(pkg.id) + '">اطلب الباقة ' + icon('arrowUpLeft') + '</button>' +
        '</article>';
    }).join('') : emptyState('لا توجد باقات منشورة حاليًا.');
    if (UI) UI.refreshReveal(grid);
  }

  /* ------------------------------------------------------------------------
     Works
     ------------------------------------------------------------------------ */
  function workCard(work) {
    return '' +
      '<article class="work-card" data-work-id="' + escapeHTML(work.id) + '" tabindex="0" role="button" aria-label="عرض تفاصيل ' + escapeHTML(work.title) + '" data-reveal="scale">' +
        '<img src="' + escapeHTML(work.image || 'assets/img/works/work-brand.svg') + '" alt="' + escapeHTML(work.title) + '" loading="lazy">' +
        '<div class="work-card__content">' +
          '<div>' +
            '<span class="work-card__tag">' + escapeHTML(work.category || 'مشروع') + '</span>' +
            '<h3 class="work-card__title">' + escapeHTML(work.title) + '</h3>' +
          '</div>' +
          '<span class="work-card__open" aria-hidden="true">' + icon('arrowUpLeft') + '</span>' +
        '</div>' +
      '</article>';
  }

  function renderWorks() {
    var grid = qs('#worksGrid');
    if (!grid) return;
    var all = activeList('works');
    var categories = [];
    all.forEach(function (work) {
      if (work.category && categories.indexOf(work.category) === -1) categories.push(work.category);
    });
    if (state.workFilter !== 'all' && categories.indexOf(state.workFilter) === -1) state.workFilter = 'all';

    var filters = qs('#workFilters');
    if (filters) {
      filters.innerHTML = ['all'].concat(categories).map(function (cat) {
        var label = cat === 'all' ? 'كل الأعمال' : cat;
        return '<button type="button" class="filter-btn' + (state.workFilter === cat ? ' is-active' : '') + '" data-filter="' + escapeHTML(cat) + '" role="tab" aria-selected="' + (state.workFilter === cat) + '">' + escapeHTML(label) + '</button>';
      }).join('');
    }

    var list = state.workFilter === 'all' ? all : all.filter(function (work) { return work.category === state.workFilter; });
    grid.classList.toggle('is-filtered', state.workFilter !== 'all');
    grid.innerHTML = list.length ? list.map(workCard).join('') : emptyState('لا توجد أعمال في هذا التصنيف حاليًا.');
    if (UI) UI.refreshReveal(grid);
  }

  /* ------------------------------------------------------------------------
     Testimonials + clients
     ------------------------------------------------------------------------ */
  function renderTestimonials() {
    var grid = qs('#testimonialsGrid');
    if (!grid) return;
    var list = activeList('testimonials');
    grid.innerHTML = list.length ? list.map(function (item) {
      var avatar = item.avatar
        ? '<span class="testimonial-avatar"><img src="' + escapeHTML(item.avatar) + '" alt="' + escapeHTML(item.name) + '" loading="lazy"></span>'
        : '<span class="testimonial-avatar" aria-hidden="true">' + escapeHTML(String(item.name || 'ع').trim().charAt(0)) + '</span>';
      return '' +
        '<article class="testimonial-card" data-reveal>' +
          '<span class="testimonial-card__quote" aria-hidden="true">”</span>' +
          starRow(item.rating) +
          '<p class="testimonial-card__text">' + escapeHTML(item.text) + '</p>' +
          '<div class="testimonial-card__author">' +
            avatar +
            '<div><strong>' + escapeHTML(item.name) + '</strong><span>' + escapeHTML([item.role, item.company].filter(Boolean).join(' · ')) + '</span></div>' +
          '</div>' +
        '</article>';
    }).join('') : emptyState('لا توجد آراء منشورة حاليًا.');
    if (UI) UI.refreshReveal(grid);
  }

  function renderClientsMarquee() {
    var marquee = qs('#clientsMarquee');
    if (!marquee) return;
    var items = '';
    var clients = activeList('clients');

    if (clients.length) {
      items = clients.map(function (client) {
        var inner = client.logo
          ? '<img src="' + escapeHTML(client.logo) + '" alt="' + escapeHTML(client.name || '') + '" loading="lazy">'
          : icon('spark') + escapeHTML(client.name || '');
        if (client.url) {
          return '<a class="client-logo" href="' + escapeHTML(client.url) + '" target="_blank" rel="noopener noreferrer">' + inner + '</a>';
        }
        return '<span class="client-logo">' + inner + '</span>';
      }).join('');
    } else {
      var names = [];
      activeList('works').forEach(function (work) {
        if (work.client && names.indexOf(work.client) === -1) names.push(work.client);
      });
      activeList('testimonials').forEach(function (item) {
        if (item.company && names.indexOf(item.company) === -1) names.push(item.company);
      });
      if (!names.length) names = ['كافيه نون', 'مطعم بحر', 'الإعمار للتطوير', 'مكتبة المعرفة', 'قاعة النور', 'NOOR Parfum'];
      items = names.map(function (name) {
        return '<span class="client-logo">' + icon('spark') + escapeHTML(name) + '</span>';
      }).join('');
    }

    var track = '<div class="marquee__track">' + items + '</div>';
    marquee.innerHTML = track + track;
  }

  /* ------------------------------------------------------------------------
     Payments
     ------------------------------------------------------------------------ */
  var PAYMENT_LABELS = {
    instapay: 'محفظة إلكترونية',
    wallet: 'محفظة موبايل',
    bank: 'تحويل بنكي',
    paypal: 'دفع دولي',
    card: 'بطاقة / رابط دفع'
  };

  function renderPayments() {
    var grid = qs('#paymentGrid');
    var section = qs('#payment');
    var enabled = !!(data && data.settings && data.settings.onlinePaymentEnabled !== false);

    if (section) {
      section.hidden = !enabled;
      section.style.display = enabled ? '' : 'none';
    }
    qsa('a[href="#payment"]').forEach(function (link) {
      link.hidden = !enabled;
      link.style.display = enabled ? '' : 'none';
    });
    if (!grid) return;

    var list = enabled ? activeList('payments') : [];
    grid.innerHTML = list.length ? list.map(function (payment) {
      var link = payment.link
        ? '<a class="pay-mini-btn pay-mini-btn--primary" href="' + escapeHTML(payment.link) + '" target="_blank" rel="noopener noreferrer">ادفع ' + icon('arrowUpLeft') + '</a>'
        : '<button type="button" class="pay-mini-btn pay-mini-btn--primary" data-payment-request="' + escapeHTML(payment.id) + '">اطلب</button>';
      return '' +
        '<article class="payment-card" data-reveal>' +
          '<div class="payment-card__head">' +
            '<span class="payment-icon">' + icon(payment.type || 'card') + '</span>' +
            '<div><h3>' + escapeHTML(payment.name) + '</h3><span>' + escapeHTML(PAYMENT_LABELS[payment.type] || 'طريقة دفع') + '</span></div>' +
          '</div>' +
          '<div class="payment-card__value">' + escapeHTML(payment.value || '—') + '</div>' +
          '<p class="payment-card__desc">' + escapeHTML(payment.instructions || '') + '</p>' +
          '<div class="payment-card__actions">' +
            '<button type="button" class="pay-mini-btn" data-copy="' + escapeHTML(payment.value || '') + '">' + icon('copy') + ' نسخ</button>' +
            link +
          '</div>' +
        '</article>';
    }).join('') : emptyState('لا توجد طرق دفع منشورة حاليًا.');
    if (UI) UI.refreshReveal(grid);
  }

  /* ------------------------------------------------------------------------
     FAQ
     ------------------------------------------------------------------------ */
  function renderFaqs() {
    var accordion = qs('#faqAccordion');
    if (!accordion) return;
    var list = activeList('faqs');
    accordion.innerHTML = list.length ? list.map(function (faq, index) {
      var id = 'faqPanel' + index;
      return '' +
        '<div class="accordion-item">' +
          '<h3 class="accordion-header">' +
            '<button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#' + id + '" aria-expanded="false" aria-controls="' + id + '">' + escapeHTML(faq.question) + '</button>' +
          '</h3>' +
          '<div id="' + id + '" class="accordion-collapse collapse" data-bs-parent="#faqAccordion">' +
            '<div class="accordion-body">' + escapeHTML(faq.answer) + '</div>' +
          '</div>' +
        '</div>';
    }).join('') : emptyState('لا توجد أسئلة شائعة منشورة حاليًا.');
  }

  /* ------------------------------------------------------------------------
     Order modal
     ------------------------------------------------------------------------ */
  function orderItems() {
    var items = [];
    activeList('services').forEach(function (service) {
      items.push({
        kind: 'service',
        id: service.id,
        title: service.title,
        price: service.price,
        unit: service.unit || '',
        priceNote: service.priceNote || 'السعر يبدأ من'
      });
    });
    activeList('packages').forEach(function (pkg) {
      items.push({
        kind: 'package',
        id: pkg.id,
        title: pkg.name,
        price: pkg.price,
        unit: pkg.period || '',
        priceNote: 'سعر الباقة'
      });
    });
    return items;
  }

  function findOrderItem(value) {
    return orderItems().find(function (item) { return item.kind + ':' + item.id === value; }) || null;
  }

  function populateOrderSelect() {
    var select = qs('#orderService');
    if (!select) return;
    var services = activeList('services');
    var packages = activeList('packages');
    var current = select.value;
    var html = '';
    if (services.length) {
      html += '<optgroup label="الخدمات">' + services.map(function (service) {
        return '<option value="service:' + escapeHTML(service.id) + '">' + escapeHTML(service.title) + ' — ' + money(service.price) + (service.unit ? ' ' + escapeHTML(service.unit) : '') + '</option>';
      }).join('') + '</optgroup>';
    }
    if (packages.length) {
      html += '<optgroup label="الباقات الشهرية">' + packages.map(function (pkg) {
        return '<option value="package:' + escapeHTML(pkg.id) + '">' + escapeHTML(pkg.name) + ' — ' + money(pkg.price) + (pkg.period ? ' ' + escapeHTML(pkg.period) : '') + '</option>';
      }).join('') + '</optgroup>';
    }
    select.innerHTML = html || '<option value="">لا توجد خدمات متاحة</option>';
    if (current && select.querySelector('option[value="' + current.replace(/"/g, '\\"') + '"]')) select.value = current;
  }

  function renderOrderPayments() {
    var wrap = qs('#orderPaymentOptions');
    if (!wrap) return;
    var enabled = !!(data && data.settings && data.settings.onlinePaymentEnabled !== false);
    if (!enabled) {
      wrap.innerHTML = '<p class="form-text">الدفع الإلكتروني غير مفعّل حاليًا. أكمل طلبك عبر واتساب وسيتم الاتفاق على طريقة الدفع.</p>';
      return;
    }
    var list = activeList('payments');
    wrap.innerHTML = list.length ? list.map(function (payment, index) {
      return '' +
        '<label class="order-option">' +
          '<input type="radio" name="paymentMethod" value="' + escapeHTML(payment.id) + '"' + (index === 0 ? ' checked' : '') + '>' +
          '<span class="order-option__icon">' + icon(payment.type || 'card') + '</span>' +
          '<span>' + escapeHTML(payment.name) + '</span>' +
          '<span class="order-option__check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' + CHECK + '</svg></span>' +
        '</label>';
    }).join('') : '<p class="form-text">لا توجد طرق دفع مضافة. أكمل الطلب عبر واتساب.</p>';
  }

  function syncOrderSummary() {
    var select = qs('#orderService');
    var title = qs('#orderSummaryTitle');
    var price = qs('#orderSummaryPrice');
    var note = qs('#orderSummaryNote');
    if (!select) return;
    var item = findOrderItem(select.value);
    if (!item) {
      if (title) title.textContent = 'اختر خدمة أو باقة';
      if (price) price.textContent = '—';
      if (note) note.textContent = 'السعر يبدأ من';
      return;
    }
    state.currentServiceId = item.kind === 'service' ? item.id : null;
    if (title) title.textContent = item.title;
    if (price) price.textContent = money(item.price);
    if (note) note.textContent = item.priceNote + (item.unit ? ' ' + item.unit : '');
  }

  function openOrder(kind, id) {
    if (!data) return;
    if (data.settings.ordersEnabled === false) {
      if (UI) UI.toast('استقبال الطلبات متوقف مؤقتًا. تواصل معنا على واتساب.', 'info', 5000);
      if (UI) UI.openWhatsApp(data.settings.orderDisabledText || 'مرحبًا نِيون ميديا، أريد الاستفسار عن خدماتكم.');
      return;
    }
    populateOrderSelect();
    renderOrderPayments();
    var select = qs('#orderService');
    if (select) {
      if (kind && id) {
        var value = kind + ':' + id;
        if (select.querySelector('option[value="' + value + '"]')) select.value = value;
      }
      if (!select.value && select.options.length) select.selectedIndex = 0;
    }
    syncOrderSummary();
    var instance = modal('orderModal');
    if (instance) instance.show();
  }

  function buildOrderWhatsApp(order) {
    var lines = [
      'مرحبًا نِيون ميديا 👋',
      'أنا ' + order.name + '.',
      'أريد طلب: ' + order.serviceTitle,
      'السعر: ' + money(order.amount) + (order.unit ? ' ' + order.unit : ''),
      'طريقة الدفع: ' + (order.paymentMethod || 'سيتم الاتفاق'),
      'رقم الطلب: ' + order.id,
      'هاتفي: ' + order.phone
    ];
    if (order.notes) lines.push('ملاحظات: ' + order.notes);
    lines.push('من فضلك أكدوا الطلب والموعد. شكرًا!');
    return lines.join('\n');
  }

  function showSuccess(order, payment, text) {
    state.lastOrder = order;
    state.lastOrderText = text;
    var idEl = qs('#successOrderId');
    var noteEl = qs('#successPayNote');
    var wa = qs('#successWaBtn');
    if (idEl) idEl.textContent = order.id;
    if (noteEl) {
      noteEl.textContent = payment
        ? payment.name + ' — ' + (payment.instructions || 'سيتم تأكيد التفاصيل على واتساب.')
        : 'سيتم تأكيد طريقة الدفع عبر واتساب.';
    }
    if (wa && UI) wa.href = UI.whatsappUrl(text);
    var instance = modal('successModal');
    if (instance) instance.show();
    if (UI) UI.confetti({ count: 150 });
  }

  /* ------------------------------------------------------------------------
     Service detail modal
     ------------------------------------------------------------------------ */
  function openServiceDetail(id) {
    var service = byId('services', id);
    if (!service) return;
    state.currentServiceId = service.id;
    var body = qs('#serviceModalBody');
    var titleEl = qs('#serviceModalTitle');
    var orderBtn = qs('#serviceModalOrderBtn');
    if (titleEl) titleEl.textContent = service.title;
    if (orderBtn) orderBtn.dataset.serviceId = service.id;
    if (body) {
      body.innerHTML = '' +
        '<div class="service-detail__head">' +
          '<span class="service-icon">' + icon(service.icon) + '</span>' +
          '<div>' +
            '<h3>' + escapeHTML(service.title) + '</h3>' +
            '<p>' + escapeHTML(service.category || 'خدمة') + (service.duration ? ' · مدة التنفيذ: ' + escapeHTML(service.duration) : '') + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="service-detail__body">' +
          '<p>' + escapeHTML(service.description || service.short || '') + '</p>' +
          (Array.isArray(service.features) && service.features.length ? '<ul class="service-detail__grid">' + service.features.map(function (feature) {
            return '<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + CHECK + '</svg><span>' + escapeHTML(feature) + '</span></li>';
          }).join('') + '</ul>' : '') +
          '<div class="service-detail__meta">' +
            '<span>السعر: <strong class="service-detail__price">' + money(service.price) + '</strong> ' + escapeHTML(service.unit || '') + '</span>' +
            (service.duration ? '<span>المدة: <strong>' + escapeHTML(service.duration) + '</strong></span>' : '') +
          '</div>' +
        '</div>';
    }
    var instance = modal('serviceModal');
    if (instance) instance.show();
  }

  /* ------------------------------------------------------------------------
     Work lightbox
     ------------------------------------------------------------------------ */
  function openWork(id) {
    var work = byId('works', id);
    if (!work) return;
    var image = qs('#workModalImage');
    if (image) {
      image.src = work.image || 'assets/img/works/work-brand.svg';
      image.alt = work.title || '';
    }
    var category = qs('#workModalCategory');
    if (category) category.textContent = work.category || 'مشروع';
    var title = qs('#workModalTitle');
    if (title) title.textContent = work.title || '';
    var desc = qs('#workModalDescription');
    if (desc) desc.textContent = work.description || '';
    var tags = qs('#workModalTags');
    if (tags) {
      tags.innerHTML = Array.isArray(work.tags) ? work.tags.map(function (tag) {
        return '<span>' + escapeHTML(tag) + '</span>';
      }).join('') : '';
    }
    var client = qs('#workModalClient');
    if (client) client.textContent = work.client || '—';
    var year = qs('#workModalYear');
    if (year) year.textContent = work.year || '—';
    var instance = modal('workModal');
    if (instance) instance.show();
  }

  /* ------------------------------------------------------------------------
     Contact forms
     ------------------------------------------------------------------------ */
  function fillContactServiceOptions() {
    qsa('#hcService, #contactService').forEach(function (select) {
      var current = select.value;
      var options = '<option value="">اختر الخدمة (اختياري)</option>' + activeList('services').map(function (service) {
        return '<option value="' + escapeHTML(service.title) + '">' + escapeHTML(service.title) + '</option>';
      }).join('');
      select.innerHTML = options;
      if (current) select.value = current;
    });
  }

  function initContactForms() {
    qsa('.js-contact-form').forEach(function (form) {
      if (form.dataset.ready === '1') return;
      form.dataset.ready = '1';
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        event.stopPropagation();
        form.classList.add('was-validated');
        if (!form.checkValidity()) {
          var firstInvalid = form.querySelector(':invalid');
          if (firstInvalid) firstInvalid.focus();
          return;
        }
        if (!data) return;
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
          source: 'website',
          status: 'جديد'
        });
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
      });
    });
  }

  /* ------------------------------------------------------------------------
     Spotlight for dynamic cards
     ------------------------------------------------------------------------ */
  function bindSpotlight(root) {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    qsa('.spotlight:not([data-spotlight-bound])', root || document).forEach(function (el) {
      el.setAttribute('data-spotlight-bound', '1');
      el.addEventListener('pointermove', function (event) {
        var rect = el.getBoundingClientRect();
        el.style.setProperty('--mx', ((event.clientX - rect.left) / rect.width * 100) + '%');
        el.style.setProperty('--my', ((event.clientY - rect.top) / rect.height * 100) + '%');
      });
    });
  }

  /* ------------------------------------------------------------------------
     Render all + events
     ------------------------------------------------------------------------ */
  function renderAll() {
    if (!data) data = store.get();
    renderHero(data.settings);
    renderServices();
    renderPackages();
    renderWorks();
    renderTestimonials();
    renderClientsMarquee();
    renderPayments();
    renderFaqs();
    fillContactServiceOptions();
    populateOrderSelect();
    renderOrderPayments();
    syncOrderSummary();
    if (UI) {
      UI.refreshReveal();
      UI.initCounters();
      UI.initSkills();
      UI.initCopyButtons();
    }
    bindSpotlight();
  }

  function bindEvents() {
    document.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var openOrderBtn = target.closest('[data-open-order]');
      if (openOrderBtn) { event.preventDefault(); openOrder(); return; }

      var serviceOrder = target.closest('[data-service-order]');
      if (serviceOrder) { event.preventDefault(); openOrder('service', serviceOrder.getAttribute('data-service-order')); return; }

      var packageOrder = target.closest('[data-package-order]');
      if (packageOrder) { event.preventDefault(); openOrder('package', packageOrder.getAttribute('data-package-order')); return; }

      var serviceDetail = target.closest('[data-service-detail]');
      if (serviceDetail) { event.preventDefault(); openServiceDetail(serviceDetail.getAttribute('data-service-detail')); return; }

      var paymentRequest = target.closest('[data-payment-request]');
      if (paymentRequest) { event.preventDefault(); openOrder(); return; }

      var workCard = target.closest('[data-work-id]');
      if (workCard) { event.preventDefault(); openWork(workCard.getAttribute('data-work-id')); return; }

      var serviceFilter = target.closest('#serviceFilters [data-filter]');
      if (serviceFilter) {
        state.serviceFilter = serviceFilter.getAttribute('data-filter') || 'all';
        renderServices();
        return;
      }

      var workFilter = target.closest('#workFilters [data-filter]');
      if (workFilter) {
        state.workFilter = workFilter.getAttribute('data-filter') || 'all';
        renderWorks();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      var card = event.target && event.target.closest ? event.target.closest('[data-work-id]') : null;
      if (!card) return;
      event.preventDefault();
      openWork(card.getAttribute('data-work-id'));
    });

    var orderService = qs('#orderService');
    if (orderService) orderService.addEventListener('change', syncOrderSummary);

    var orderForm = qs('#orderForm');
    if (orderForm) {
      orderForm.addEventListener('submit', function (event) {
        event.preventDefault();
        event.stopPropagation();
        orderForm.classList.add('was-validated');
        if (!orderForm.checkValidity()) {
          var invalid = orderForm.querySelector(':invalid');
          if (invalid) invalid.focus();
          return;
        }
        if (!data) return;
        var select = qs('#orderService');
        var item = findOrderItem(select ? select.value : '');
        if (!item) {
          if (UI) UI.toast('اختر خدمة أو باقة أولًا.', 'error');
          return;
        }
        var paymentInput = orderForm.querySelector('input[name="paymentMethod"]:checked');
        var payment = paymentInput ? byId('payments', paymentInput.value) : null;
        var formData = new FormData(orderForm);
        var order = store.addOrder({
          name: String(formData.get('name') || '').trim(),
          phone: String(formData.get('phone') || '').trim(),
          notes: String(formData.get('notes') || '').trim(),
          itemType: item.kind,
          serviceId: item.id,
          serviceTitle: item.title,
          unit: item.unit,
          amount: n(item.price),
          currency: data.settings.currency,
          paymentId: payment ? payment.id : '',
          paymentMethod: payment ? payment.name : 'سيتم الاتفاق',
          status: 'جديد',
          source: 'الموقع'
        });
        var text = buildOrderWhatsApp(order);
        if (UI) UI.openWhatsApp(text);

        var orderInstance = modal('orderModal');
        var orderModalEl = qs('#orderModal');
        if (orderModalEl && orderInstance) {
          orderModalEl.addEventListener('hidden.bs.modal', function () {
            showSuccess(order, payment, text);
          }, { once: true });
          orderInstance.hide();
        } else {
          showSuccess(order, payment, text);
        }

        var notes = qs('#orderNotes');
        var nameField = qs('#orderName');
        var phoneField = qs('#orderPhone');
        if (notes) notes.value = '';
        if (nameField) nameField.value = '';
        if (phoneField) phoneField.value = '';
        orderForm.classList.remove('was-validated');
        if (UI) UI.toast('تم تسجيل طلبك، وفتح واتساب لتأكيده.', 'success', 5000);
      });
    }

    var serviceOrderBtn = qs('#serviceModalOrderBtn');
    if (serviceOrderBtn) {
      serviceOrderBtn.addEventListener('click', function () {
        var id = serviceOrderBtn.dataset.serviceId || state.currentServiceId;
        var serviceInstance = modal('serviceModal');
        var serviceModalEl = qs('#serviceModal');
        if (serviceModalEl && serviceInstance) {
          serviceModalEl.addEventListener('hidden.bs.modal', function () {
            openOrder('service', id);
          }, { once: true });
          serviceInstance.hide();
        } else {
          openOrder('service', id);
        }
      });
    }

    var successCopy = qs('#successCopyBtn');
    if (successCopy) {
      successCopy.addEventListener('click', function () {
        if (state.lastOrder && UI) UI.copyText(state.lastOrder.id);
      });
    }

    initContactForms();

    window.addEventListener('neon:datachange', function () {
      data = store.get();
      renderAll();
      initContactForms();
    });
  }

  function boot() {
    if (!store) return;
    bindEvents();
    store.ready.then(function () {
      data = store.get();
      renderAll();
      initContactForms();
      bindSpotlight();
    }).catch(function (error) {
      console.error('[NeonHome] تعذر تحميل البيانات', error);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
