/* CycleFlow Service Worker - versioned offline-first cache */
const CACHE_NAME = 'cycleflow-v4-local-tools';
const CORE_ASSETS = [
    '/',
    '/static/css/main.css',
    '/static/js/hardening.js',
    '/static/js/calendar-services.js',
    '/static/js/local-tools.js',
    '/static/css/local-icons.css',
    '/static/js/app.js',
    '/static/js/backup-integrity.js',
    '/static/manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);

        // The app shell is required for offline startup; fail installation if it cannot be cached.
        const shell = await fetch('/');
        if (!shell.ok) throw new Error('CycleFlow app shell could not be cached');
        await cache.put('/', shell);

        // Cache each asset independently so one transient failure does not discard every asset.
        await Promise.all(CORE_ASSETS.filter((asset) => asset !== '/').map(async (asset) => {
            try {
                const response = await fetch(asset, { cache: 'reload' });
                if (response.ok) await cache.put(asset, response);
            } catch (_) {
                // A failed optional asset can be retried by the runtime fetch handler.
            }
        }));

        await self.skipWaiting();
    })());
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
            caches.match(event.request, { ignoreSearch: true }).then((cached) => {
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
