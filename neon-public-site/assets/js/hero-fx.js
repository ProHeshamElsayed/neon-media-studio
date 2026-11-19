/* ==========================================================================
   NÉON MEDIA — Hero portrait motion
   يضيف الهالة الكريستالية، اللمعة، الجزيئات، وتفاعل المؤشر حول الصورة.
   يعمل فقط في الصفحة التي تحتوي على .profile-orbit.
   ========================================================================== */
(function () {
  'use strict';

  var orbit = document.querySelector('.profile-orbit');
  if (!orbit) return;

  var frame = orbit.querySelector('.profile-frame');
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function make(tag, className) {
    var el = document.createElement(tag);
    el.className = className;
    el.setAttribute('aria-hidden', 'true');
    return el;
  }

  // طبقات الزجاج واللمعة
  if (frame && !frame.querySelector('.gx-sweep')) {
    frame.appendChild(make('span', 'gx-sweep'));
    frame.appendChild(make('span', 'gx-cursor'));
  }
  if (!orbit.querySelector('.gx-halo')) {
    orbit.appendChild(make('span', 'gx-halo'));
  }

  // جزيئات ضوئية
  if (!reduced && !orbit.querySelector('.gx-spark')) {
    var sparkCount = window.innerWidth < 576 ? 5 : 8;
    for (var i = 0; i < sparkCount; i += 1) {
      var spark = make('span', 'gx-spark');
      var angle = (Math.PI * 2 * i) / sparkCount;
      var radius = 44 + Math.random() * 8;
      var left = 50 + Math.cos(angle) * radius;
      var top = 50 + Math.sin(angle) * radius;
      spark.style.left = left.toFixed(2) + '%';
      spark.style.top = top.toFixed(2) + '%';
      spark.style.setProperty('--gx-size', (3 + Math.random() * 4).toFixed(1) + 'px');
      spark.style.setProperty('--gx-dur', (6 + Math.random() * 6).toFixed(2) + 's');
      spark.style.setProperty('--gx-delay', (Math.random() * -9).toFixed(2) + 's');
      spark.style.setProperty('--gx-dx', ((Math.random() - 0.5) * 26).toFixed(1) + 'px');
      orbit.appendChild(spark);
    }
  }

  if (reduced) return;

  var finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  if (!finePointer) return;

  var raf = 0;
  var target = { x: 0, y: 0 };

  function applyParallax() {
    raf = 0;
    orbit.style.translate = target.x.toFixed(2) + 'px ' + target.y.toFixed(2) + 'px';
  }

  orbit.addEventListener('pointermove', function (event) {
    var rect = orbit.getBoundingClientRect();
    var px = (event.clientX - rect.left) / rect.width - 0.5;
    var py = (event.clientY - rect.top) / rect.height - 0.5;
    target.x = px * -14;
    target.y = py * -12;
    if (!raf) raf = window.requestAnimationFrame(applyParallax);

    if (frame) {
      var fr = frame.getBoundingClientRect();
      var mx = ((event.clientX - fr.left) / fr.width) * 100;
      var my = ((event.clientY - fr.top) / fr.height) * 100;
      frame.style.setProperty('--gx-mx', mx.toFixed(2) + '%');
      frame.style.setProperty('--gx-my', my.toFixed(2) + '%');
    }
  }, { passive: true });

  orbit.addEventListener('pointerleave', function () {
    target.x = 0;
    target.y = 0;
    if (!raf) raf = window.requestAnimationFrame(applyParallax);
  });

  // وميض خفيف عند الظهور
  orbit.classList.add('gx-ready');
})();
