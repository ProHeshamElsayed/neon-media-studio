/* ==========================================================================
   NÉON MEDIA — Service Worker (PWA)
   - HTML / CSS / JS : network-first حتى تظهر التعديلات فورًا
   - الصور والخطوط : cache-first لتسريع التحميل
   - يعمل offline بشكل محدود (الصفحات الأساسية + الهوية البصرية)
   ملاحظة: كل المسارات نسبية لتعمل على Netlify وGitHub Pages معًا.
   ========================================================================== */
const CACHE_NAME = 'neon-media-v7';

const PRECACHE = [
  './',
  './index.html',
  './contact.html',
  './account.html',
  './track.html',
  './blog.html',
  './site.webmanifest',
  './glass.css',
  './home.css',
  './home.js',
  './app.js',
  './vec-designer.png',
  './vec-photographer.png',
  './vec-marketer.png',
  './vec-about.png',
  './vec-services.png',
  './vec-works.png',
  './vec-contact.png',
  './vec-scene-about.png',
  './components.css',
  './chatbot.js',
  './assets/css/base.css',
  './assets/css/home.css',
  './assets/css/components.css',
  './assets/css/glass.css',
  './assets/css/extras.css',
  './assets/js/app.js',
  './assets/js/store.js',
  './assets/js/home.js',
  './assets/img/logo.svg',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './assets/img/icon-maskable-512.png'
];

const OFFLINE_URL = './index.html';

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        return Promise.all(PRECACHE.map(function (url) {
          return cache.add(new Request(url, { credentials: 'same-origin' })).catch(function () {});
        }));
      })
      .catch(function () {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isAsset(pathname) {
  return /\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf)$/i.test(pathname);
}

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('admin') !== -1) return;

  // الصور والخطوط: من الكاش أولًا مع تحديث في الخلفية
  if (isAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then(function (cached) {
        const network = fetch(request).then(function (response) {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
          }
          return response;
        }).catch(function () { return cached; });
        return cached || network;
      })
    );
    return;
  }

  // الصفحات والملفات النصية: من الشبكة أولًا
  event.respondWith(
    fetch(request).then(function (response) {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
      }
      return response;
    }).catch(function () {
      return caches.match(request).then(function (cached) {
        return cached || caches.match(OFFLINE_URL);
      });
    })
  );
});
