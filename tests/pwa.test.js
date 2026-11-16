/** Regression checks for the offline-first asset manifest. */
const fs = require('fs');
const path = require('path');
const sw = fs.readFileSync(path.join(__dirname, '..', 'static', 'sw.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'templates', 'index.html'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(html.includes('/static/js/backup-integrity.js'), 'HTML must load the backup integrity module');
assert(html.includes('/static/js/calculation-history.js'), 'HTML must load the calculation history module');
assert(sw.includes("'/static/js/calculation-history.js'"), 'service worker must precache the calculation history module');
assert(sw.includes("'/static/js/backup-integrity.js'"), 'service worker must precache the backup integrity module');
assert(sw.includes("await cache.put('/', shell)"), 'service worker must cache the app shell before activation');
assert(sw.includes('Promise.all(CORE_ASSETS.filter'), 'service worker must cache core assets independently');
assert(sw.includes('caches.match(event.request, { ignoreSearch: true })'),
  'versioned static asset URLs must match their offline cache entries');

assert(sw.includes("'/static/js/calendar-services.js'"), 'service worker must precache Hebrew calendar services');
assert(sw.includes("'/static/css/local-icons.css'"), 'service worker must precache local icon CSS');
assert(html.includes('/static/js/calendar-services.js'), 'HTML must load local calendar services');
for (const remote of ['fonts.googleapis.com', 'cdnjs.cloudflare.com', 'cdn.jsdelivr.net']) {
  assert(!html.includes(remote), `HTML must not depend on remote asset host: ${remote}`);
}
assert(!html.includes('chart.js'), 'chart rendering must not require a remote Chart.js script');

assert(sw.includes("'/static/js/local-tools.js'"), 'service worker must precache local tools');
assert(html.includes('/static/js/local-tools.js'), 'HTML must load local tools');
assert(html.includes('id="view_tools"'), 'personal tools view must exist');

console.log('PWA offline asset regression tests passed.');
