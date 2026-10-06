const CACHE_NAME = 'echo-companion-v7.3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/location.js',
  '/location.css',
  '/robo-roupas.js',
  '/robo-motor.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon.svg',
  '/luna',
  '/luna.html',
  '/luna.css',
  '/luna.js',
  '/manifest-luna.json',
  '/icon-luna.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // NUNCA faz cache de rotas de API (SSE, TTS, eventos, autenticação)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Só o shell público (a mesma lista do precache) é guardado; arquivos protegidos por PIN nunca ficam no cache
  const cacheable = STATIC_ASSETS.includes(url.pathname);

  // Estratégia Network First para o shell estático, com fallback para o cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (cacheable && networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// Notificação do modo celular: só o tipo de pedido e o projeto (nada de comando nem caminho)
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = {}; }
  const title = data.title || 'Echo';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || 'Abra o Echo para responder',
    tag: data.tag || 'echo-aprovacao',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 300],
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' }
  }));
});

// Tocar na notificação abre (ou traz para frente) o Echo
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((client) => client.url.startsWith(self.location.origin));
      if (open) return open.focus();
      return self.clients.openWindow(target);
    })
  );
});
