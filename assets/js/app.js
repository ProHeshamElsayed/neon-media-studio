/* ==========================================================================
   NÉON MEDIA — Shared UI Runtime
   Theme · Preloader · Navigation · Motion · Audio · Toasts · Canvas FX
   ========================================================================== */
(function () {
  'use strict';

  var qs = function (selector, root) { return (root || document).querySelector(selector); };
  var qsa = function (selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); };
  var isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  function escapeHTML(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getPath(object, path) {
    return String(path || '').split('.').reduce(function (acc, key) {
      if (acc == null) return undefined;
      return acc[key];
    }, object);
  }

  function setPath(object, path, value) {
    var keys = String(path || '').split('.');
    var last = keys.pop();
    var target = keys.reduce(function (acc, key) {
      if (!acc[key] || typeof acc[key] !== 'object') acc[key] = {};
      return acc[key];
    }, object);
    target[last] = value;
  }

  function debounce(fn, wait) {
    var timer;
    return function () {
      var context = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(context, args); }, wait || 120);
    };
  }

  /* ------------------------------------------------------------------------
     Theme
     ------------------------------------------------------------------------ */
  var themeKey = 'neonTheme';
  var accentKey = 'neonAccent';

  function getStoredTheme() {
    try { return localStorage.getItem(themeKey); } catch (e) { return null; }
  }

  function setTheme(theme, persist) {
    var next = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    if (persist) {
      try { localStorage.setItem(themeKey, next); } catch (e) { /* ignore */ }
    }
    qsa('[data-theme-toggle]').forEach(function (btn) {
      btn.setAttribute('aria-label', next === 'dark' ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن');
      btn.setAttribute('aria-pressed', next === 'light' ? 'true' : 'false');
      btn.title = next === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن';
    });
    var meta = qs('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'dark' ? '#04060c' : '#f2f6ff');
  }

  function setAccent(accent, persist) {
    var allowed = ['cyan', 'magenta', 'violet', 'lime'];
    var next = allowed.indexOf(accent) !== -1 ? accent : 'cyan';
    document.documentElement.setAttribute('data-accent', next);
    if (persist) {
      try { localStorage.setItem(accentKey, next); } catch (e) { /* ignore */ }
    }
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || 'dark';
    setTheme(current === 'dark' ? 'light' : 'dark', true);
  }

  function initTheme() {
    var stored = getStoredTheme();
    setTheme(stored || 'dark', false);
    var storedAccent = null;
    try { storedAccent = localStorage.getItem(accentKey); } catch (e) { /* ignore */ }
    if (storedAccent) setAccent(storedAccent, false);
    qsa('[data-theme-toggle]').forEach(function (btn) {
      btn.addEventListener('click', toggleTheme);
    });
  }

  /* ------------------------------------------------------------------------
     Preloader
     ------------------------------------------------------------------------ */
  var whenReady = new Promise(function (resolve) { window.__neonResolveReady = resolve; });
  var preloaderDone = false;

  function initPreloader() {
    var preloader = qs('#preloader');
    if (!preloader) {
      document.body.classList.remove('is-loading');
      return;
    }
    var bar = qs('#loaderProgress', preloader);
    var percent = qs('#loaderPercent', preloader);
    var progress = 0;
    var started = performance.now();
    var MIN_TIME = 450;
    var hardStop = setTimeout(function () { finish(); }, 2500);

    function tick() {
      if (preloaderDone) return;
      var target = 88;
      progress += Math.max(0.6, (target - progress) * 0.055);
      if (progress > target) progress = target;
      if (bar) bar.style.width = progress + '%';
      if (percent) percent.textContent = Math.round(progress) + '%';
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    function finish() {
      if (preloaderDone) return;
      preloaderDone = true;
      clearTimeout(hardStop);
      if (bar) bar.style.width = '100%';
      if (percent) percent.textContent = '100%';
      setTimeout(function () {
        preloader.classList.add('is-done');
        document.body.classList.remove('is-loading');
        setTimeout(function () { preloader.setAttribute('hidden', ''); }, 500);
        if (window.__neonResolveReady) window.__neonResolveReady();
      }, 150);
    }

    var assetsReady = Promise.resolve();
    if (document.fonts && document.fonts.ready) {
      // Never let a slow/offline font file hold the page hostage.
      assetsReady = Promise.race([
        document.fonts.ready.catch(function () { return null; }),
        new Promise(function (resolve) { setTimeout(resolve, 600); })
      ]);
    }
    var storeReady = (window.NeonStore && window.NeonStore.ready) ? window.NeonStore.ready : Promise.resolve();
    var windowLoad = new Promise(function (resolve) {
      if (document.readyState === 'complete') resolve();
      else window.addEventListener('load', resolve, { once: true });
    });

    Promise.race([
      Promise.all([storeReady, windowLoad, assetsReady]),
      // Never hold the page behind a slow image/network for more than 0.8s.
      new Promise(function (resolve) { setTimeout(resolve, 800); })
    ]).then(function () {
      var elapsed = performance.now() - started;
      var wait = Math.max(0, MIN_TIME - elapsed);
      setTimeout(finish, wait);
    }).catch(function () {
      setTimeout(finish, 600);
    });
  }

  /* ------------------------------------------------------------------------
     Site settings binding
     ------------------------------------------------------------------------ */
  function applySettings(settings) {
    if (!settings) return;

    // Accept either the full store data object or just the settings object,
    // so `data-bind="settings.x"` resolves correctly in both cases.
    var root = (settings.settings && typeof settings.settings === 'object') ? settings : { settings: settings };

    qsa('[data-bind]').forEach(function (el) {
      var value = getPath(root, el.getAttribute('data-bind'));
      if (value === undefined || value === null) return;
      if (Array.isArray(value)) return;
      if (el.hasAttribute('data-bind-html')) el.innerHTML = value;
      else el.textContent = value;
    });

    qsa('[data-site-src]').forEach(function (el) {
      var value = getPath(root, el.getAttribute('data-site-src'));
      if (value) el.setAttribute('src', value);
    });

    qsa('[data-site-href]').forEach(function (el) {
      var value = getPath(root, el.getAttribute('data-site-href'));
      if (value) el.setAttribute('href', value);
    });

    qsa('[data-phone-link]').forEach(function (el) {
      var raw = String(settings.phone || '').replace(/[^\d+]/g, '');
      if (raw) el.setAttribute('href', 'tel:' + raw);
    });

    qsa('[data-email-link]').forEach(function (el) {
      if (settings.email) el.setAttribute('href', 'mailto:' + settings.email);
    });

    qsa('[data-social]').forEach(function (el) {
      var network = el.getAttribute('data-social');
      var url = settings.socials && settings.socials[network];
      if (url) {
        el.setAttribute('href', url);
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
        el.removeAttribute('hidden');
      } else {
        el.setAttribute('hidden', '');
      }
    });

    qsa('[data-wa-link]').forEach(function (el) {
      var text = el.getAttribute('data-wa-text') || '';
      var digits = String(settings.whatsapp || '').replace(/\D/g, '');
      el.setAttribute('href', 'https://wa.me/' + digits + (text ? '?text=' + encodeURIComponent(text) : ''));
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    });

    qsa('[data-admin-link]').forEach(function (el) {
      if (settings.showAdminLink === false) el.setAttribute('hidden', '');
      else el.removeAttribute('hidden');
    });

    qsa('[data-announcement]').forEach(function (el) {
      if (settings.announcementEnabled === false) {
        el.setAttribute('hidden', '');
      } else {
        el.removeAttribute('hidden');
      }
      var textEl = qs('[data-announcement-text]', el);
      if (textEl) textEl.textContent = settings.announcement || '';
      var link = qs('[data-announcement-link]', el);
      if (link) {
        if (!settings.announcementLink) {
          link.setAttribute('hidden', '');
        } else {
          var href = settings.announcementLink;
          // الروابط الداخلية على صفحة الاتصال يجب أن تعود للرئيسية
          if (href.charAt(0) === '#') {
            var targetExists = false;
            try { targetExists = Boolean(document.querySelector(href)); } catch (error) { targetExists = false; }
            if (!targetExists) href = 'index.html' + href;
          }
          link.setAttribute('href', href);
          link.removeAttribute('hidden');
        }
      }
    });

    qsa('[data-logo]').forEach(function (el) {
      if (settings.logo) el.setAttribute('src', settings.logo);
    });

    var faviconHref = settings.favicon || settings.logo;
    if (faviconHref) {
      qsa('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').forEach(function (el) {
        el.setAttribute('href', faviconHref);
      });
    }

    if (settings.quranTitle) {
      qsa('[data-audio-toggle]').forEach(function (el) {
        el.setAttribute('title', 'التلاوة — ' + settings.quranTitle);
      });
    }

    qsa('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

    qsa('[data-owner-name]').forEach(function (el) { el.textContent = settings.ownerName || ''; });
    qsa('[data-owner-title]').forEach(function (el) { el.textContent = settings.ownerTitle || ''; });

    if (qs('#quranAudio') && settings.quranUrl) {
      var audio = qs('#quranAudio');
      if (!audio.dataset.initialized) {
        audio.dataset.initialized = '1';
        audio.src = settings.quranUrl;
        audio.volume = 0.55;
        audio.setAttribute('data-local-src', settings.quranLocalUrl || '');
      }
    }

    if (settings.accent) setAccent(settings.accent, false);

    var fixedMeta = document.body && document.body.hasAttribute('data-fixed-meta');
    if (settings.seoTitle && !fixedMeta) document.title = settings.seoTitle;
    var metaDesc = qs('meta[name="description"]');
    if (metaDesc && settings.seoDescription && !fixedMeta) metaDesc.setAttribute('content', settings.seoDescription);
  }

  /* ------------------------------------------------------------------------
     WhatsApp helper
     ------------------------------------------------------------------------ */
  function whatsappUrl(text) {
    var settings = window.NeonStore ? window.NeonStore.get().settings : {};
    var digits = String(settings.whatsapp || '').replace(/\D/g, '');
    return 'https://wa.me/' + digits + (text ? '?text=' + encodeURIComponent(text) : '');
  }

  function openWhatsApp(text) {
    window.open(whatsappUrl(text), '_blank', 'noopener');
  }

  /* ------------------------------------------------------------------------
     Quran audio / welcome gate
     ------------------------------------------------------------------------ */
  function initAudio() {
    var audio = qs('#quranAudio');
    var gate = qs('#welcomeGate');
    var settings = window.NeonStore ? window.NeonStore.get().settings : {};
    if (!settings.quranEnabled) {
      if (audio) audio.remove();
      if (gate) gate.remove();
      qsa('[data-audio-toggle]').forEach(function (btn) { btn.setAttribute('hidden', ''); });
      return;
    }
    if (!audio) return;

    var toggles = qsa('[data-audio-toggle]');
    var eqs = qsa('.audio-equalizer');

    function syncUI(playing) {
      toggles.forEach(function (btn) {
        btn.classList.toggle('is-playing', playing);
        btn.setAttribute('aria-label', playing ? 'إيقاف التلاوة' : 'تشغيل التلاوة');
        btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
        var label = qs('.audio-toggle-label', btn);
        if (label) label.textContent = playing ? 'إيقاف التلاوة' : 'تشغيل التلاوة';
      });
      eqs.forEach(function (eq) { eq.classList.toggle('is-paused', !playing); });
    }

    function play() {
      var promise = audio.play();
      if (promise && promise.then) {
        promise.then(function () { syncUI(true); }).catch(function () {
          syncUI(false);
          showToast('اسمع تلاوة عطرة بالضغط على زر الصوت.', 'info');
        });
      } else {
        syncUI(true);
      }
    }

    function pause() {
      audio.pause();
      syncUI(false);
    }

    function toggle() {
      if (audio.paused) play(); else pause();
    }

    toggles.forEach(function (btn) { btn.addEventListener('click', toggle); });
    audio.addEventListener('play', function () { syncUI(true); });
    audio.addEventListener('pause', function () { syncUI(false); });
    audio.addEventListener('ended', function () { syncUI(false); });
    audio.addEventListener('error', function () {
      var local = audio.getAttribute('data-local-src');
      if (local && audio.src.indexOf(local) === -1) {
        audio.src = local;
        audio.load();
      }
    });

    var GATE_KEY = 'neonQuranGateSeen_v2';
    function markGateSeen() {
      try { localStorage.setItem(GATE_KEY, '1'); } catch (e) { /* ignore */ }
    }
    function hasSeenGate() {
      try { return localStorage.getItem(GATE_KEY) === '1'; } catch (e) { return false; }
    }
    var gateSeen = hasSeenGate();

    if (gate) {
      gate.querySelectorAll('[data-gate-enter]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var withSound = btn.getAttribute('data-gate-enter') === 'sound';
          markGateSeen();
          gate.classList.add('is-closing');
          setTimeout(function () { gate.classList.remove('is-open'); gate.setAttribute('hidden', ''); }, 600);
          document.body.classList.remove('is-loading');
          if (withSound) play(); else pause();
        });
      });
    }

    whenReady.then(function () {
      // لا نجلب ملف التلاوة من الشبكة في كل فتحة — فقط عند أول زيارة وعند ضغط المستخدم
      if (!settings.quranAutoplay || gateSeen) return;
      // محاولة تشغيل تلقائي — المتصفحات قد تمنع الصوت قبل تفاعل المستخدم
      var attempt = audio.play();
      if (attempt && attempt.then) {
        attempt.then(function () {
          syncUI(true);
          markGateSeen();
        }).catch(function () {
          syncUI(false);
          if (gate && !gateSeen) {
            document.body.classList.add('is-loading');
            gate.removeAttribute('hidden');
            requestAnimationFrame(function () { gate.classList.add('is-open'); });
            var primary = gate.querySelector('[data-gate-enter="sound"]');
            if (primary) setTimeout(function () { primary.focus(); }, 400);
          }
        });
      }
    });

    if (gate) {
      document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape' || !gate.classList.contains('is-open')) return;
        markGateSeen();
        document.body.classList.remove('is-loading');
        gate.classList.add('is-closing');
        setTimeout(function () { gate.classList.remove('is-open'); gate.setAttribute('hidden', ''); }, 500);
      });
    }
  }

  /* ------------------------------------------------------------------------
     Header / navigation
     ------------------------------------------------------------------------ */
  function initNavigation() {
    var header = qs('#siteHeader');
    var progress = qs('#scrollProgress');
    var backTop = qs('[data-back-top]');

    var onScroll = function () {
      var y = window.scrollY || window.pageYOffset;
      if (header) header.classList.toggle('is-scrolled', y > 24);
      if (progress) {
        var height = document.documentElement.scrollHeight - window.innerHeight;
        var value = height > 0 ? Math.min(100, (y / height) * 100) : 0;
        progress.style.width = value + '%';
      }
      if (backTop) backTop.classList.toggle('is-visible', y > 520);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (backTop) {
      backTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: isReducedMotion ? 'auto' : 'smooth' });
      });
    }

    var toggle = qs('#navToggle');
    var mobileMenu = qs('#mobileMenu');
    function closeMenu() {
      if (!toggle || !mobileMenu) return;
      toggle.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      mobileMenu.classList.remove('is-open');
      mobileMenu.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('is-loading');
    }
    if (toggle && mobileMenu) {
      toggle.addEventListener('click', function () {
        var open = !mobileMenu.classList.contains('is-open');
        toggle.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        mobileMenu.classList.toggle('is-open', open);
        mobileMenu.setAttribute('aria-hidden', open ? 'false' : 'true');
        document.body.classList.toggle('is-loading', open);
      });
      qsa('a', mobileMenu).forEach(function (link) { link.addEventListener('click', closeMenu); });
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') closeMenu();
      });
    }

    // Active nav link based on visible sections
    var navLinks = qsa('.nav-links a[href^="#"], .mobile-menu__nav a[href^="#"]');
    var sections = [];
    navLinks.forEach(function (link) {
      var id = link.getAttribute('href');
      if (!id || id === '#') return;
      var section = qs(id);
      if (section && sections.indexOf(section) === -1) sections.push(section);
    });
    if ('IntersectionObserver' in window && sections.length) {
      var navObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var id = '#' + entry.target.id;
          navLinks.forEach(function (link) {
            link.classList.toggle('is-active', link.getAttribute('href') === id);
          });
        });
      }, { rootMargin: '-42% 0px -50% 0px', threshold: 0 });
      sections.forEach(function (section) { navObserver.observe(section); });
    }
  }

  /* ------------------------------------------------------------------------
     Reveal / counters / bars / tilt / spotlight / magnetic
     ------------------------------------------------------------------------ */
  var revealObserver = null;

  function getRevealObserver() {
    if (revealObserver || !('IntersectionObserver' in window)) return revealObserver;
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    return revealObserver;
  }

  function refreshReveal(root) {
    var nodes = qsa('[data-reveal]:not(.is-visible)', root || document);
    nodes.forEach(function (node, index) {
      var parent = node.parentElement;
      if (parent && parent.hasAttribute('data-stagger') && !node.style.getPropertyValue('--reveal-delay')) {
        var siblings = Array.prototype.slice.call(parent.querySelectorAll(':scope > [data-reveal]'));
        var order = siblings.indexOf(node);
        if (order > -1) node.style.setProperty('--reveal-delay', (order * 70) + 'ms');
      }
      var observer = getRevealObserver();
      if (observer) observer.observe(node);
      else node.classList.add('is-visible');
    });
  }

  var counterObserver = null;
  function initCounterObserver() {
    if (counterObserver || !('IntersectionObserver' in window)) return;
    counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      });
    }, { threshold: 0.4 });
  }

  function animateCounter(el) {
    if (el.dataset.counted === '1') return;
    el.dataset.counted = '1';
    var target = parseFloat(el.getAttribute('data-counter')) || 0;
    var decimals = (el.getAttribute('data-decimals') | 0);
    var duration = parseInt(el.getAttribute('data-duration'), 10) || 1600;
    var start = null;
    function step(timestamp) {
      if (!start) start = timestamp;
      var progress = Math.min((timestamp - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = target * eased;
      el.textContent = current.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
    if (isReducedMotion) {
      el.textContent = target.toLocaleString('en-US');
      return;
    }
    requestAnimationFrame(step);
  }

  function initCounters(root) {
    initCounterObserver();
    qsa('[data-counter]', root || document).forEach(function (el) {
      if (counterObserver) counterObserver.observe(el);
      else animateCounter(el);
    });
  }

  var skillObserver = null;
  function initSkills(root) {
    var bars = qsa('[data-skill]', root || document);
    if (!bars.length) return;
    if (!('IntersectionObserver' in window)) {
      bars.forEach(function (bar) { bar.style.width = (bar.getAttribute('data-skill') || 80) + '%'; });
      return;
    }
    if (!skillObserver) {
      skillObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.style.width = (entry.target.getAttribute('data-skill') || 80) + '%';
          skillObserver.unobserve(entry.target);
        });
      }, { threshold: 0.35 });
    }
    bars.forEach(function (bar) { skillObserver.observe(bar); });
  }

  function initTilt() {
    if (!isFinePointer || isReducedMotion) return;
    qsa('[data-tilt]').forEach(function (el) {
      var max = parseFloat(el.getAttribute('data-tilt')) || 8;
      el.addEventListener('pointermove', function (event) {
        var rect = el.getBoundingClientRect();
        var px = (event.clientX - rect.left) / rect.width;
        var py = (event.clientY - rect.top) / rect.height;
        var rx = (0.5 - py) * max * 2;
        var ry = (px - 0.5) * max * 2;
        el.style.transform = 'perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
      });
      el.addEventListener('pointerleave', function () {
        el.style.transform = '';
      });
    });
  }

  function initSpotlight() {
    if (!isFinePointer) return;
    qsa('.spotlight').forEach(function (el) {
      el.addEventListener('pointermove', function (event) {
        var rect = el.getBoundingClientRect();
        el.style.setProperty('--mx', ((event.clientX - rect.left) / rect.width * 100) + '%');
        el.style.setProperty('--my', ((event.clientY - rect.top) / rect.height * 100) + '%');
      });
    });
  }

  function initMagnetic() {
    if (!isFinePointer || isReducedMotion) return;
    qsa('[data-magnetic]').forEach(function (el) {
      var strength = parseFloat(el.getAttribute('data-magnetic')) || 6;
      el.addEventListener('pointermove', function (event) {
        var rect = el.getBoundingClientRect();
        var x = (event.clientX - rect.left - rect.width / 2) / (rect.width / 2);
        var y = (event.clientY - rect.top - rect.height / 2) / (rect.height / 2);
        el.style.transform = 'translate(' + (x * strength).toFixed(1) + 'px,' + (y * strength).toFixed(1) + 'px)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }

  /* ------------------------------------------------------------------------
     Cursor
     ------------------------------------------------------------------------ */
  function initCursor() {
    if (!isFinePointer || isReducedMotion) return;
    var dot = qs('.cursor-dot');
    var ring = qs('.cursor-ring');
    if (!dot || !ring) return;
    var mx = window.innerWidth / 2;
    var my = window.innerHeight / 2;
    var rx = mx;
    var ry = my;
    var active = false;
    var rafId = null;

    window.addEventListener('pointermove', function (event) {
      mx = event.clientX;
      my = event.clientY;
      if (!active) {
        active = true;
        document.body.classList.add('cursor-active');
      }
      dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
      var target = event.target;
      if (target && target.closest && target.closest('a, button, .work-card, .filter-btn, input, textarea, select, [role="button"]')) {
        document.body.classList.add('cursor-hover');
      } else {
        document.body.classList.remove('cursor-hover');
      }
      if (rafId === null) rafId = requestAnimationFrame(loop);
    }, { passive: true });
    window.addEventListener('pointerleave', function () {
      document.body.classList.remove('cursor-active');
    });
    function loop() {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
      if (Math.abs(mx - rx) > 0.15 || Math.abs(my - ry) > 0.15) {
        rafId = requestAnimationFrame(loop);
      } else {
        rafId = null;
      }
    }
  }

  /* ------------------------------------------------------------------------
     Hero particles
     ------------------------------------------------------------------------ */
  function initHeroCanvas() {
    var canvas = qs('#heroCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var particles = [];
    var width = 0;
    var height = 0;
    var linkDistance = 112;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.35);
    var running = true;
    var inView = true;
    var lastFrame = 0;
    var FRAME_MS = 33; // ~30fps is plenty for ambient dust
    var mouse = { x: -1000, y: -1000 };
    var accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#22e7ff';
    var accent2 = getComputedStyle(document.documentElement).getPropertyValue('--accent-3').trim() || '#ff3ddc';

    function rgb(hex) {
      var h = hex.replace('#', '');
      if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
      var num = parseInt(h, 16);
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }
    var c1 = rgb(accent);
    var c2 = rgb(accent2);

    function resize() {
      var rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }

    function build() {
      var count = Math.min(56, Math.max(18, Math.floor(width / 24)));
      linkDistance = width < 760 ? 96 : 112;
      particles = [];
      for (var i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.28,
          vy: (Math.random() - 0.5) * 0.28,
          r: Math.random() * 1.7 + 0.6,
          a: Math.random() * 0.5 + 0.2,
          c: Math.random() > 0.72 ? c2 : c1
        });
      }
    }

    function drawFrame() {
      ctx.clearRect(0, 0, width, height);
      var nearMouse = isFinePointer;
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;

        if (nearMouse) {
          var dx = p.x - mouse.x;
          var dy = p.y - mouse.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100 && dist > 0) {
            p.x += (dx / dist) * 0.6;
            p.y += (dy / dist) * 0.6;
          }
        }

        for (var j = i + 1; j < particles.length; j++) {
          var q = particles[j];
          var lx = p.x - q.x;
          var ly = p.y - q.y;
          var len = Math.sqrt(lx * lx + ly * ly);
          if (len < linkDistance) {
            var alpha = (1 - len / linkDistance) * 0.14;
            ctx.strokeStyle = 'rgba(' + c1[0] + ',' + c1[1] + ',' + c1[2] + ',' + alpha + ')';
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
        ctx.beginPath();
        ctx.fillStyle = 'rgba(' + p.c[0] + ',' + p.c[1] + ',' + p.c[2] + ',' + p.a + ')';
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function loop(now) {
      requestAnimationFrame(loop);
      if (!running || !inView) return;
      if (now - lastFrame < FRAME_MS) return;
      lastFrame = now;
      drawFrame();
    }

    var resizeDebounced = debounce(resize, 160);
    window.addEventListener('resize', resizeDebounced);
    if (isFinePointer) {
      canvas.addEventListener('pointermove', function (event) {
        var rect = canvas.getBoundingClientRect();
        mouse.x = event.clientX - rect.left;
        mouse.y = event.clientY - rect.top;
      });
      canvas.addEventListener('pointerleave', function () { mouse.x = -1000; mouse.y = -1000; });
    }
    document.addEventListener('visibilitychange', function () {
      running = !document.hidden;
      if (running) lastFrame = 0;
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
      }, { threshold: 0 }).observe(canvas);
    }

    resize();
    if (isReducedMotion) {
      // static single frame
      ctx.clearRect(0, 0, width, height);
      particles.forEach(function (p) {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(' + p.c[0] + ',' + p.c[1] + ',' + p.c[2] + ',' + p.a + ')';
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
    } else {
      requestAnimationFrame(loop);
    }
  }

  /* ------------------------------------------------------------------------
     Toast
     ------------------------------------------------------------------------ */
  var icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>'
  };

  function toast(message, type, duration) {
    var stack = qs('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      stack.setAttribute('aria-live', 'polite');
      document.body.appendChild(stack);
    }
    var item = document.createElement('div');
    item.className = 'toast-item toast-item--' + (type || 'info');
    item.innerHTML = (icons[type] || icons.info) + '<div>' + escapeHTML(message) + '</div>';
    stack.appendChild(item);
    var timer = setTimeout(function () { remove(); }, duration || 4200);
    function remove() {
      clearTimeout(timer);
      item.classList.add('is-out');
      setTimeout(function () { item.remove(); }, 350);
    }
    item.addEventListener('click', remove);
  }

  /* ------------------------------------------------------------------------
     Clipboard
     ------------------------------------------------------------------------ */
  function copyText(text) {
    function fallback() {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      area.remove();
      return ok;
    }
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () {
        toast('تم النسخ بنجاح', 'success');
        return true;
      }).catch(function () {
        if (fallback()) toast('تم النسخ بنجاح', 'success');
        else toast('تعذر النسخ، انسخ النص يدويًا', 'error');
        return false;
      });
    }
    if (fallback()) {
      toast('تم النسخ بنجاح', 'success');
      return Promise.resolve(true);
    }
    toast('تعذر النسخ، انسخ النص يدويًا', 'error');
    return Promise.resolve(false);
  }

  function initCopyButtons(root) {
    qsa('[data-copy]', root || document).forEach(function (btn) {
      btn.addEventListener('click', function () {
        copyText(btn.getAttribute('data-copy') || '');
      });
    });
  }

  /* ------------------------------------------------------------------------
     Confetti
     ------------------------------------------------------------------------ */
  function confetti(options) {
    if (isReducedMotion) return;
    options = options || {};
    var canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    document.body.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = window.innerWidth;
    var h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    var colors = ['#22e7ff', '#ff3ddc', '#8b5cff', '#b7ff3c', '#ffd6a5', '#ffffff'];
    var pieces = [];
    var count = options.count || 130;
    for (var i = 0; i < count; i++) {
      pieces.push({
        x: w / 2 + (Math.random() - 0.5) * 260,
        y: h * 0.38 + (Math.random() - 0.5) * 80,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 1.2) * 11,
        w: Math.random() * 8 + 4,
        h: Math.random() * 5 + 3,
        rot: Math.random() * 360,
        vr: (Math.random() - 0.5) * 16,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1
      });
    }
    var start = performance.now();
    function frame(now) {
      var elapsed = now - start;
      ctx.clearRect(0, 0, w, h);
      var alive = false;
      pieces.forEach(function (p) {
        p.vy += 0.3;
        p.vx *= 0.994;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life = Math.max(0, 1 - elapsed / 3200);
        if (p.life > 0 && p.y < h + 40) alive = true;
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (alive) requestAnimationFrame(frame);
      else canvas.remove();
    }
    requestAnimationFrame(frame);
    setTimeout(function () { if (canvas.parentNode) canvas.remove(); }, 4200);
  }

  /* ------------------------------------------------------------------------
     Init
     ------------------------------------------------------------------------ */
  function init() {
    document.documentElement.classList.add('js');
    initTheme();
    initPreloader();
    initNavigation();
    refreshReveal();
    initTilt();
    initSpotlight();
    initMagnetic();
    initCursor();
    initHeroCanvas();
    initCopyButtons();

    if (window.NeonStore) {
      window.NeonStore.ready.then(function () {
        var data = window.NeonStore.get();
        if (!getStoredTheme() && data.settings && data.settings.defaultTheme) {
          setTheme(data.settings.defaultTheme, false);
        }
        applySettings(data.settings);
        initAudio();
        refreshReveal();
        initCounters();
        initSkills();
        initCopyButtons();
      }).catch(function () {
        initAudio();
      });

      window.NeonStore.subscribe(function () {
        applySettings(window.NeonStore.get().settings);
      });
    }

    var yearEls = qsa('[data-year]');
    yearEls.forEach(function (el) { el.textContent = new Date().getFullYear(); });

    // Small fallback if something unexpected happens
    setTimeout(function () {
      var preloader = qs('#preloader');
      if (preloader && !preloader.classList.contains('is-done') && document.body.classList.contains('is-loading')) {
        if (window.__neonResolveReady && !preloaderDone) window.__neonResolveReady();
      }
    }, 8000);
  }

  window.NeonUI = {
    qs: qs,
    qsa: qsa,
    escapeHTML: escapeHTML,
    getPath: getPath,
    setPath: setPath,
    debounce: debounce,
    applySettings: applySettings,
    whatsappUrl: whatsappUrl,
    openWhatsApp: openWhatsApp,
    toast: toast,
    copyText: copyText,
    confetti: confetti,
    toggleTheme: toggleTheme,
    setTheme: setTheme,
    setAccent: setAccent,
    refreshReveal: refreshReveal,
    initCounters: initCounters,
    initSkills: initSkills,
    initCopyButtons: initCopyButtons,
    refreshMotion: function () {
      initTilt();
      initSpotlight();
      initMagnetic();
      refreshReveal();
      initCounters();
      initSkills();
      initCopyButtons();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
