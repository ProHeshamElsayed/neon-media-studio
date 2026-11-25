/* ============================================================
   نِيون ميديا — Service Worker للوحة التحكم (PWA)
   يجعل اللوحة تعمل كتطبيق مستقل على الجوال:
   - تشغيل بدون إنترنت للواجهة (البيانات تُزامن عند العودة)
   - تحديث تلقائي عند نشر نسخة جديدة
   ============================================================ */
'use strict';

var ADMIN_CACHE = 'neon-admin-v1';
var CORE = [
  './admin.html',
  './base.css',
  './assets/vendor/bootstrap.rtl.min.css',
  './assets/css/components.css',
  './assets/css/admin.css',
  './assets/css/glass.css',
  './assets/css/admin-bell.css',
  './assets/vendor/bootstrap.bundle.min.js',
  './assets/js/firebase-config.js',
  './assets/js/firebase-sync.js',
  './assets/js/store.js',
  './assets/js/app.js',
  './assets/js/admin.js',
  './assets/js/admin-bell.js',
  './assets/img/logo.svg',
  './assets/img/icon-192.png',
  './assets/img/icon-maskable-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(ADMIN_CACHE).then(function (cache) {
      return cache.addAll(CORE).catch(function () { /* تجاهل الملفات الناقصة */ });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== ADMIN_CACHE) return caches.delete(key);
        return null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* الشبكة أولًا مع رجوع للكاش — حتى تبقى البيانات حية كل ما أمكن */
self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok && (url.pathname.endsWith('.html') || url.pathname.endsWith('.css') || url.pathname.endsWith('.js'))) {
        var copy = res.clone();
        caches.open(ADMIN_CACHE).then(function (cache) { cache.put(req, copy); }).catch(function () {});
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        return hit || caches.match('./admin.html');
      });
    })
  );
});
