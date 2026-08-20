/* CycleFlow Service Worker - versioned offline-first cache */
const CACHE_NAME = 'cycleflow-v2-2026-08';
const CORE_ASSETS = [
    '/',
    '/static/css/main.css',
    '/static/js/hardening.js',
    '/static/js/app.js',
    '/static/manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(CORE_ASSETS))
            .catch(() => {})
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key.startsWith('cycleflow-') && key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    const isNavigation = event.request.mode === 'navigate';
    const isStatic = url.pathname.startsWith('/static/');

    if (isNavigation) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
                    }
                    return response;
                })
                .catch(() => caches.match('/'))
        );
        return;
    }

    if (isStatic) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                const network = fetch(event.request).then((response) => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
                    }
                    return response;
                }).catch(() => null);
                return cached || network;
            })
        );
    }
});
