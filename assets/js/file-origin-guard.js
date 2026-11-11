/* ============================================================
   حماية عنوان التشغيل — نِيون ميديا
   ------------------------------------------------------------
   بيانات الموقع محفوظة داخل المتصفح على العنوان:
       http://localhost:8123
   وليست داخل الملفات. لذلك فتح index.html بالدبل كليك
   (عنوان file://) يعرض محتوى افتراضيًا مختلفًا.

   هذا الملف: إذا فُتحت الصفحة من file://
     1) يتحقق من وجود خادم المعاينة على 8123
     2) إن كان يعمل  → يحوّل تلقائيًا إلى العنوان الصحيح
     3) إن كان متوقفًا → يعرض رسالة واضحة بطريقة التشغيل
   ============================================================ */
(function () {
  'use strict';
  if (location.protocol !== 'file:') return;

  var PORT = 8123;
  var ORIGIN = 'http://localhost:' + PORT;
  var script = document.currentScript;
  var page = (script && script.getAttribute('data-page')) || 'index.html';
  if (['index.html', 'contact.html', 'admin.html'].indexOf(page) === -1) page = 'index.html';
  var target = ORIGIN + '/' + page;

  var settled = false;

  function redirect() {
    if (settled) return;
    settled = true;
    location.replace(target);
  }

  function help() {
    if (settled) return;
    settled = true;
    if (document.getElementById('fileOriginHelp')) return;

    var box = document.createElement('div');
    box.id = 'fileOriginHelp';
    box.setAttribute('dir', 'rtl');
    box.setAttribute('role', 'alertdialog');
    box.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483647',
      'display:flex', 'align-items:center', 'justify-content:center',
      'padding:24px', 'background:rgba(4,6,12,.94)',
      'font-family:Tajawal,Cairo,system-ui,sans-serif', 'color:#eaf6ff'
    ].join(';');

    box.innerHTML =
      '<div style="max-width:640px;width:100%;border:1px solid rgba(0,229,255,.35);' +
      'border-radius:18px;padding:28px;background:#080c16;box-shadow:0 0 40px rgba(0,229,255,.18)">' +
        '<h2 style="margin:0 0 14px;font-size:1.35rem;color:#00e5ff">الموقع لازم يفتح من الخادم المحلي</h2>' +
        '<p style="margin:0 0 12px;line-height:1.9;color:#cfe6f5">' +
          'أنت فتحت الملف مباشرة (عنوان <code style="color:#ff4fd8">file://</code>)، ' +
          'وده عنوان مختلف عن المكان اللي بياناتك وتعديلاتك محفوظة فيه.' +
        '</p>' +
        '<p style="margin:0 0 18px;line-height:1.9;color:#cfe6f5">' +
          'شغّل الملف <b style="color:#9dff5e">START-SITE.cmd</b> الموجود في نفس المجلد، ' +
          'أو افتح الرابط ده مباشرة:' +
        '</p>' +
        '<p style="margin:0 0 20px"><a href="' + target + '" ' +
          'style="display:inline-block;padding:13px 22px;border-radius:12px;' +
          'background:linear-gradient(135deg,#00e5ff,#7a5cff);color:#04060c;' +
          'font-weight:800;text-decoration:none">' + target + '</a></p>' +
        '<p style="margin:0 0 16px;font-size:.92rem;color:#8fa6b8">' +
          'ملاحظة: بياناتك لا تُفقد — هي محفوظة في المتصفح على عنوان localhost:8123 فقط.' +
        '</p>' +
        '<button type="button" id="fileOriginContinue" ' +
          'style="background:none;border:1px solid rgba(255,255,255,.25);color:#cfe6f5;' +
          'padding:9px 16px;border-radius:10px;cursor:pointer;font-family:inherit;font-size:.9rem">' +
          'المتابعة على أي حال (بدون بياناتي)</button>' +
      '</div>';

    document.body.appendChild(box);

    var btn = document.getElementById('fileOriginContinue');
    if (btn) btn.addEventListener('click', function () {
      box.parentNode.removeChild(box);
      try { sessionStorage.setItem('neonAllowFileOrigin', '1'); } catch (e) {}
    });
  }

  try {
    if (sessionStorage.getItem('neonAllowFileOrigin') === '1') return;
  } catch (e) { /* ignore */ }

  // فحص سريع: صورة من الخادم المحلي (لا تحتاج CORS)
  var probe = new Image();
  var timer = null;

  probe.onload = redirect;
  probe.onerror = function () {
    if (timer) clearTimeout(timer);
    help();
  };

  function startProbe() {
    timer = setTimeout(help, 2200);
    probe.src = ORIGIN + '/assets/img/logo.svg?ping=' + Date.now();
  }

  if (document.body) startProbe();
  else document.addEventListener('DOMContentLoaded', startProbe);
})();
