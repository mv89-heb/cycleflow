/**
 * CycleFlow Service Worker - תמיכה במצב לא-מקוון (offline-first)
 * מאפשר לאפליקציה לעבוד גם ללא חיבור אינטרנט - קריטי לאפליקציה פרטית
 */
const CACHE_NAME = 'cycleflow-v1';
const CORE_ASSETS = [
    '/',
    '/static/css/main.css',
    '/static/js/app.js',
    '/static/manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(CORE_ASSETS).catch(() => {}))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    // אסטרטגיית network-first עבור HTML, cache-first עבור נכסים סטטיים
    const url = new URL(event.request.url);
    const isStatic = url.pathname.startsWith('/static/');

    if (isStatic) {
        event.respondWith(
            caches.match(event.request).then((cached) =>
                cached || fetch(event.request).then((resp) => {
                    const copy = resp.clone();
                    caches.open(CACHE_NAME).then((c) => c.put(event.request, copy)).catch(() => {});
                    return resp;
                }).catch(() => cached)
            )
        );
    } else {
        event.respondWith(
            fetch(event.request)
                .then((resp) => {
                    const copy = resp.clone();
                    caches.open(CACHE_NAME).then((c) => c.put(event.request, copy)).catch(() => {});
                    return resp;
                })
                .catch(() => caches.match(event.request).then((c) => c || caches.match('/')))
        );
    }
});
