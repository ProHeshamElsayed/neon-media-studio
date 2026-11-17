/* ==========================================================================
   NEON MEDIA — Extras (المؤثرات الإضافية)
   يُحمَّل بعد app.js و home.js. لا يعدّل أي ملف أصلي.

   المؤثرات:
   1. تموّج عند الضغط على الأزرار            (Ripple)
   2. ذيل نيون خلف مؤشر الفأرة                (Cursor trail)
   3. نقاط تنقل جانبية بين الأقسام            (Dot nav)
   4. ظهور عناوين الأقسام كلمة بكلمة         (Split titles)
   5. شريط نص عملاق يتأثر بسرعة التمرير       (Marquee band)
   6. بارالاكس للهيرو والخلفية               (Parallax)
   7. كشف صور الأعمال بمسح                   (Image wipe)
   8. حدود دوّارة للبطاقات المميزة            (CSS فقط)
   9. انتقال دائري بين الصفحات                (Page curtain)
  10. تبعثر حروف الشعار اللاتيني عند المرور   (Scramble)
  11. تغيير عنوان التبويب عند مغادرته        (Title swap)
  12. وضع الحفلة: ↑ ↑ ↓ ↓ ← → ← → B A        (Easter egg)

   التحكم: زر ✨ في الأزرار العائمة، أو من الكونسول:
   NeonFX.toggle() · NeonFX.enable() · NeonFX.disable() · NeonFX.party()
   ========================================================================== */
(function () {
  'use strict';

  if (window.NeonFX) return;

  var doc = document;
  var root = doc.documentElement;
  var KEY = 'neonFxPlus';

  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var finePointer = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);

  var state = { on: readPref() };
  var listeners = [];

  /* ------------------------------ helpers ------------------------------ */
  function readPref() {
    try { return localStorage.getItem(KEY) !== 'off'; } catch (e) { return true; }
  }
  function writePref(on) {
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* ignore */ }
  }
  function qs(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function raf(fn) { return window.requestAnimationFrame(fn); }
  function toast(msg, type) {
    if (window.NeonUI && typeof window.NeonUI.toast === 'function') window.NeonUI.toast(msg, type || 'info');
  }
  function onToggle(fn) { listeners.push(fn); }
  function isTypingTarget(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }

  /* مراقبة عناصر تُرسم لاحقًا بواسطة home.js (بطاقات الأعمال مثلًا) */
  function watch(containerSel, itemSel, fn) {
    var container = qs(containerSel);
    if (!container) return;
    var seen = typeof WeakSet === 'function' ? new WeakSet() : null;
    var scheduled = 0;
    function scan() {
      scheduled = 0;
      qsa(itemSel, container).forEach(function (el) {
        if (seen) {
          if (seen.has(el)) return;
          seen.add(el);
        } else {
          if (el.__fxSeen) return;
          el.__fxSeen = true;
        }
        fn(el);
      });
    }
    scan();
    if ('MutationObserver' in window) {
      new MutationObserver(function () {
        if (!scheduled) scheduled = raf(scan);
      }).observe(container, { childList: true, subtree: true });
    }
  }

  /* ------------------------ 0) زر التشغيل / الإيقاف ------------------------ */
  function buildToggle() {
    var stack = qs('.floating-stack');
    if (!stack || qs('.float-fx', stack)) return;
    var btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'float-btn float-fx';
    btn.setAttribute('aria-label', 'تشغيل أو إيقاف المؤثرات الإضافية');
    btn.title = 'المؤثرات الإضافية';
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/>' +
      '<path d="M19 15v4M17 17h4M5 4v3M3.5 5.5h3"/></svg>';
    btn.setAttribute('aria-pressed', state.on ? 'true' : 'false');
    btn.addEventListener('click', function () { setEnabled(!state.on, true); });
    stack.insertBefore(btn, stack.firstChild);
  }

  function setEnabled(on, announce) {
    state.on = !!on;
    writePref(state.on);
    root.classList.toggle('fx-on', state.on);
    qsa('.float-fx').forEach(function (b) { b.setAttribute('aria-pressed', state.on ? 'true' : 'false'); });
    listeners.forEach(function (fn) { try { fn(state.on); } catch (e) { /* ignore */ } });
    if (announce) toast(state.on ? 'تم تفعيل المؤثرات الإضافية ✨' : 'تم إيقاف المؤثرات الإضافية', 'info');
  }

  /* ------------------------------ 1) Ripple ------------------------------ */
  function initRipple() {
    doc.addEventListener('pointerdown', function (e) {
      if (!state.on || reduced) return;
      var t = e.target;
      var btn = t && t.closest ? t.closest('.btn-neon, .btn-ghost, .btn-soft, .btn-outline-neon') : null;
      if (!btn || btn.disabled) return;
      var r = btn.getBoundingClientRect();
      var size = Math.max(r.width, r.height) * 2;
      var dot = doc.createElement('span');
      dot.className = 'fx-ripple';
      dot.style.width = dot.style.height = size + 'px';
      dot.style.left = (e.clientX - r.left - size / 2) + 'px';
      dot.style.top = (e.clientY - r.top - size / 2) + 'px';
      btn.appendChild(dot);
      setTimeout(function () { if (dot.parentNode) dot.parentNode.removeChild(dot); }, 700);
    }, { passive: true });
  }

  /* --------------------------- 2) Cursor trail --------------------------- */
  function initTrail() {
    if (!finePointer || reduced) return;
    var canvas = doc.createElement('canvas');
    canvas.className = 'fx-trail';
    canvas.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var W = 0, H = 0;
    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    var LIFE = 420;
    var pts = [];
    var running = false;
    var rgb = '53,245,255';
    var lastColor = -9999;

    function readColor() {
      var v = getComputedStyle(root).getPropertyValue('--accent-rgb');
      if (v && v.trim()) rgb = v.trim().split(/[\s,]+/).join(',');
    }

    function tick(now) {
      ctx.clearRect(0, 0, W, H);
      while (pts.length && now - pts[0].t > LIFE) pts.shift();
      if (pts.length < 2 || doc.hidden || !state.on) { running = false; ctx.clearRect(0, 0, W, H); return; }
      if (now - lastColor > 1500) { readColor(); lastColor = now; }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i];
        var life = 1 - (now - b.t) / LIFE;
        if (life <= 0) continue;
        ctx.strokeStyle = 'rgba(' + rgb + ',' + (life * 0.55).toFixed(3) + ')';
        ctx.lineWidth = 1 + life * 5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      raf(tick);
    }

    window.addEventListener('pointermove', function (e) {
      if (!state.on || e.pointerType === 'touch') return;
      pts.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (pts.length > 40) pts.shift();
      if (!running) { running = true; raf(tick); }
    }, { passive: true });

    onToggle(function (on) { if (!on) { pts.length = 0; ctx.clearRect(0, 0, W, H); } });
  }

  /* ----------------------------- 3) Dot nav ------------------------------ */
  function initDotNav() {
    var sections = qsa('main section[id]');
    if (sections.length < 3 || qs('.fx-dotnav')) return;
    var labels = {
      home: 'الرئيسية', about: 'نبذة عنا', audience: 'جمهورنا', services: 'خدماتنا',
      packages: 'الباقات', works: 'أعمالنا', process: 'مراحل العمل', clients: 'عملائنا',
      payment: 'الدفع', faq: 'الأسئلة الشائعة', contact: 'تواصل معنا'
    };
    var nav = doc.createElement('nav');
    nav.className = 'fx-dotnav';
    nav.setAttribute('aria-label', 'التنقل بين الأقسام');
    var links = {};
    sections.forEach(function (sec) {
      var a = doc.createElement('a');
      var label = labels[sec.id] || sec.id;
      a.href = '#' + sec.id;
      a.setAttribute('data-label', label);
      a.setAttribute('aria-label', label);
      a.innerHTML = '<i></i>';
      nav.appendChild(a);
      links[sec.id] = a;
    });
    doc.body.appendChild(nav);

    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        Object.keys(links).forEach(function (k) {
          links[k].classList.remove('is-active');
          links[k].removeAttribute('aria-current');
        });
        var l = links[en.target.id];
        if (l) { l.classList.add('is-active'); l.setAttribute('aria-current', 'true'); }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { io.observe(s); });
  }

  /* --------------------------- 4) Split titles --------------------------- */
  function splitTitle(h) {
    if (h.__fxSplit || !h.textContent.trim()) return;
    h.__fxSplit = true;
    var idx = 0;
    Array.prototype.slice.call(h.childNodes).forEach(function (node) {
      if (node.nodeType === 3) {
        var frag = doc.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(doc.createTextNode(' ')); return; }
          var w = doc.createElement('span');
          w.className = 'fx-word';
          w.style.setProperty('--i', idx++);
          w.textContent = part;
          frag.appendChild(w);
        });
        h.replaceChild(frag, node);
      } else if (node.nodeType === 1 && node.tagName !== 'BR') {
        var unit = doc.createElement('span');
        unit.className = 'fx-unit';
        unit.style.setProperty('--i', idx++);
        h.insertBefore(unit, node);
        unit.appendChild(node);
      }
    });
    h.classList.add('fx-split');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { h.classList.add('fx-in'); io.disconnect(); }
        });
      }, { threshold: 0.35 });
      io.observe(h);
    } else {
      h.classList.add('fx-in');
    }
  }
  function initSplit() {
    qsa('.section-head h2, .page-hero h1').forEach(splitTitle);
  }

  /* --------------------------- 5) Marquee band --------------------------- */
  function initBand() {
    var home = qs('main #home');
    if (!home || qs('.fx-band')) return;
    var words = ['NEON MEDIA', 'DESIGN', 'SOCIAL', 'FILM', 'ADS', 'BRAND', 'GROWTH'];
    function row(cls) {
      var r = doc.createElement('div');
      r.className = 'fx-band__row ' + cls;
      var t = doc.createElement('div');
      t.className = 'fx-band__track';
      var html = '';
      for (var k = 0; k < 3; k++) {
        words.forEach(function (w) { html += '<span>' + w + '</span><b>✦</b>'; });
      }
      t.innerHTML = html;
      r.appendChild(t);
      return r;
    }
    var band = doc.createElement('div');
    band.className = 'fx-band';
    band.setAttribute('aria-hidden', 'true');
    band.setAttribute('dir', 'ltr');
    band.appendChild(row('fx-band__row--a'));
    band.appendChild(row('fx-band__row--b'));
    home.parentNode.insertBefore(band, home.nextSibling);

    var tracks = qsa('.fx-band__track', band);
    var widths = [1, 1];
    var progress = [0, 0];
    var visible = false;
    var running = false;
    var last = 0;
    var lastY = window.pageYOffset;
    var vel = 0;

    function measure() {
      widths = tracks.map(function (t) { return (t.scrollWidth / 3) || 1; });
    }
    measure();
    window.addEventListener('resize', measure, { passive: true });
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(measure);

    function paint() {
      var a = progress[0] % widths[0];
      var b = progress[1] % widths[1];
      tracks[0].style.transform = 'translate3d(' + (-a).toFixed(1) + 'px,0,0)';
      tracks[1].style.transform = 'translate3d(' + (b - widths[1]).toFixed(1) + 'px,0,0)';
    }
    paint();

    function loop(now) {
      if (!visible || !state.on || doc.hidden || reduced) { running = false; return; }
      var dt = Math.min(48, now - last) / 1000;
      last = now;
      var y = window.pageYOffset;
      vel += ((y - lastY) - vel) * 0.12;
      lastY = y;
      var speed = 55 + Math.min(Math.abs(vel), 60) * 7;
      progress[0] += speed * dt;
      progress[1] += speed * dt * 0.8;
      paint();
      raf(loop);
    }
    function kick() {
      if (running || !visible || !state.on || doc.hidden || reduced) return;
      running = true;
      last = performance.now();
      raf(loop);
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        kick();
      }).observe(band);
    }
    doc.addEventListener('visibilitychange', kick);
    onToggle(kick);
  }

  /* ----------------------------- 6) Parallax ----------------------------- */
  function initParallax() {
    if (reduced) return;
    var hero = qs('.hero');
    var visual = qs('.hero__visual');
    var bg = qs('.bg-effects');
    var tx = 0, ty = 0, cx = 0, cy = 0;
    var sy = window.pageYOffset, drawnSy = -1;
    var running = false;

    function kick() {
      if (running || !state.on) return;
      running = true;
      raf(frame);
    }
    function frame() {
      running = false;
      if (!state.on) return;
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      if (visual) {
        visual.style.setProperty('--px', cx.toFixed(3));
        visual.style.setProperty('--py', cy.toFixed(3));
      }
      if (bg && sy !== drawnSy) {
        drawnSy = sy;
        var total = Math.max(1, doc.documentElement.scrollHeight - window.innerHeight);
        bg.style.setProperty('--fx-sy', Math.min(1, sy / total).toFixed(4));
      }
      if (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002) kick();
    }

    if (hero && visual && finePointer) {
      hero.addEventListener('pointermove', function (e) {
        var r = hero.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
        kick();
      }, { passive: true });
      hero.addEventListener('pointerleave', function () { tx = 0; ty = 0; kick(); });
    }
    window.addEventListener('scroll', function () { sy = window.pageYOffset; kick(); }, { passive: true });
    onToggle(function (on) { if (on) kick(); });
    kick();
  }

  /* ----------------------------- 7) Image wipe --------------------------- */
  function initWipe() {
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('fx-in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.2 });
    watch('#worksGrid', '.work-card', function (card) {
      card.classList.add('fx-armed');
      io.observe(card);
    });
  }

  /* --------------------------- 9) Page curtain --------------------------- */
  function initCurtain() {
    if (reduced) return;
    var curtain = doc.createElement('div');
    curtain.className = 'fx-curtain';
    curtain.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(curtain);

    var entering = false;
    try {
      entering = sessionStorage.getItem('fxLeaving') === '1';
      sessionStorage.removeItem('fxLeaving');
    } catch (e) { /* ignore */ }

    if (entering && state.on) {
      curtain.classList.add('is-covering');
      raf(function () {
        raf(function () {
          curtain.classList.add('is-out');
          setTimeout(function () { curtain.className = 'fx-curtain'; }, 800);
        });
      });
    }

    window.addEventListener('pageshow', function (e) {
      if (e.persisted) curtain.className = 'fx-curtain';
    });

    doc.addEventListener('click', function (e) {
      if (!state.on || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#' || /^(mailto:|tel:|javascript:|sms:|https?:|\/\/)/i.test(href)) return;
      if (!/\.html?($|[?#])/i.test(href)) return;
      var url;
      try { url = new URL(a.href, window.location.href); } catch (err) { return; }
      if (url.pathname === window.location.pathname) return;

      e.preventDefault();
      curtain.style.setProperty('--fx-cx', e.clientX + 'px');
      curtain.style.setProperty('--fx-cy', e.clientY + 'px');
      curtain.classList.add('is-in');
      try { sessionStorage.setItem('fxLeaving', '1'); } catch (err2) { /* ignore */ }
      setTimeout(function () { window.location.href = a.href; }, 520);
      setTimeout(function () { curtain.className = 'fx-curtain'; }, 3000);
    });
  }

  /* ----------------------------- 10) Scramble ---------------------------- */
  function initScramble() {
    var brand = qs('.navbar-brand');
    var target = brand ? qs('.brand-text > span', brand) : null;
    if (!brand || !target || reduced) return;
    var CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var busy = false;
    brand.addEventListener('mouseenter', function () {
      var original = target.textContent;
      if (!state.on || busy || !/^[A-Za-z0-9 ]+$/.test(original)) return;
      busy = true;
      var start = performance.now();
      var DURATION = 650;
      (function step(now) {
        var p = Math.min(1, (now - start) / DURATION);
        var out = '';
        for (var i = 0; i < original.length; i++) {
          var ch = original.charAt(i);
          if (ch === ' ' || i < Math.floor(p * original.length)) out += ch;
          else out += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
        }
        target.textContent = out;
        if (p < 1) raf(step);
        else { target.textContent = original; busy = false; }
      })(start);
    });
  }

  /* ----------------------------- 11) Title swap -------------------------- */
  function initTitleSwap() {
    var saved = '';
    doc.addEventListener('visibilitychange', function () {
      if (!state.on) return;
      if (doc.hidden) {
        if (!saved) { saved = doc.title; doc.title = '👋 وحشتنا! ارجع كمّل مشروعك'; }
      } else if (saved) {
        doc.title = saved;
        saved = '';
      }
    });
  }

  /* ----------------------------- 12) Party mode -------------------------- */
  var partyTimer = 0;
  function party() {
    if (partyTimer) return;
    var accents = ['cyan', 'magenta', 'violet', 'lime'];
    var original = root.getAttribute('data-accent') || 'cyan';
    var i = 0;
    root.classList.add('fx-party');
    toast('وضع الحفلة شغّال! 🎉', 'success');
    if (window.NeonUI && typeof window.NeonUI.confetti === 'function') window.NeonUI.confetti();
    var cycle = setInterval(function () {
      i = (i + 1) % accents.length;
      root.setAttribute('data-accent', accents[i]);
    }, 380);
    var boom = setInterval(function () {
      if (window.NeonUI && typeof window.NeonUI.confetti === 'function') window.NeonUI.confetti();
    }, 2600);
    partyTimer = setTimeout(function () {
      clearInterval(cycle);
      clearInterval(boom);
      root.setAttribute('data-accent', original);
      root.classList.remove('fx-party');
      partyTimer = 0;
    }, 8000);
  }

  function initKonami() {
    var seq = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
    var pos = 0;
    doc.addEventListener('keydown', function (e) {
      if (isTypingTarget(e.target) || !e.key) return;
      var k = e.key.toLowerCase();
      if (k === seq[pos]) pos++;
      else pos = (k === seq[0]) ? 1 : 0;
      if (pos === seq.length) { pos = 0; party(); }
    });
  }

  /* -------------------------------- boot -------------------------------- */
  function boot() {
    root.classList.toggle('fx-on', state.on);
    buildToggle();
    initRipple();
    initTrail();
    initDotNav();
    initSplit();
    initBand();
    initParallax();
    initWipe();
    initCurtain();
    initScramble();
    initTitleSwap();
    initKonami();
    // العناوين المرتبطة بالإعدادات قد تُملأ متأخرًا؛ نعيد المحاولة بعد التحميل الكامل
    window.addEventListener('load', initSplit);
  }

  window.NeonFX = {
    isOn: function () { return state.on; },
    enable: function () { setEnabled(true, true); },
    disable: function () { setEnabled(false, true); },
    toggle: function () { setEnabled(!state.on, true); },
    party: party
  };

  // نضبط الكلاس مبكرًا حتى لا يحدث وميض عند التحميل
  root.classList.toggle('fx-on', state.on);

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
