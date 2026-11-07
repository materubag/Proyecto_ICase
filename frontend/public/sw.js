// Retire the obsolete root worker. The application no longer caches requests.
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Replace the old fetch handler for open pages without reloading their forms.
    await self.clients.claim();
    await self.registration.unregister();
  })());
});

// No fetch listener: requests, including /api, go directly to the network.
