/** Regression checks for the offline-first asset manifest. */
const fs = require('fs');
const path = require('path');
const sw = fs.readFileSync(path.join(__dirname, '..', 'static', 'sw.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'templates', 'index.html'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(html.includes('/static/js/backup-integrity.js'), 'HTML must load the backup integrity module');
assert(sw.includes("'/static/js/backup-integrity.js'"), 'service worker must precache the backup integrity module');
assert(sw.includes('cache.addAll(CORE_ASSETS)'), 'service worker must precache all core assets during install');

console.log('PWA offline asset regression tests passed.');
