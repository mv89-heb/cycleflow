/** Accessibility regressions for mobile zoom and keyboard navigation. */
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'templates', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'static', 'css', 'main.css'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

const viewport = html.match(/<meta\s+name="viewport"\s+content="([^"]+)"/i);
assert(viewport, 'the page must declare a mobile viewport');
assert(!/user-scalable\s*=\s*no/i.test(viewport[1]), 'users must be allowed to zoom the page');
assert(!/maximum-scale\s*=\s*1(?:\.0+)?(?:[,\s]|$)/i.test(viewport[1]), 'the viewport must not cap zoom at 100%');
assert(/width=device-width/i.test(viewport[1]), 'the layout must use the device width');
assert(/<html[^>]+lang="he"[^>]+dir="rtl"/i.test(html), 'the document must retain Hebrew RTL semantics');

const skipLink = html.match(/<a[^>]+class="skip-link"[^>]+href="#main_content"[^>]*>(.*?)<\/a>/i);
assert(skipLink, 'keyboard users must have a skip-to-main-content link');
assert(/<main[^>]+id="main_content"[^>]+tabindex="-1"/i.test(html), 'the main landmark must be programmatically focusable');
assert(/\.skip-link:focus\s*\{[^}]*transform:\s*translateY\(0\)/s.test(css), 'the skip link must become visible when focused');

console.log('Mobile accessibility regression tests passed.');
