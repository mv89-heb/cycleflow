/* Cross-screen premium visual consistency regressions. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'static', 'css', 'main.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'templates', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'static', 'sw.js'), 'utf8');

assert.match(css, /--surface-highlight:\s*color-mix/, 'shared surface tokens unify cards and interactive elements');
assert.match(css, /\.card h3 > i\s*\{[^}]*border-radius/s, 'card heading icons use a consistent premium treatment');
assert.match(css, /\.chart-container\s*\{[^}]*border-radius/s, 'history charts sit inside a refined responsive surface');
assert.match(css, /\.tool-list-row:focus-within/, 'interactive diary and reminder rows expose keyboard focus');
assert.match(css, /\.cal-day:focus-visible/, 'calendar days retain a visible keyboard focus state');
assert.match(css, /#day_panel\s*\{[^}]*overscroll-behavior:\s*contain/s, 'the day sheet prevents scroll chaining');
assert.match(css, /@media\s*\(hover:\s*hover\) and \(pointer:\s*fine\)/, 'hover effects are limited to pointer devices');
assert.match(css, /@media\s*\(max-width:\s*360px\)/, 'the finishing layer preserves compact-phone layouts');
assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.app-view:not\(\.hidden\)\s*\{\s*animation:\s*none/s, 'view transitions respect reduced motion');
assert.match(html, /dir="rtl"/, 'the complete interface remains Hebrew RTL');
assert.equal((html.match(/class="nav-item/g) || []).length, 5, 'the five existing navigation destinations are preserved');
assert.match(sw, /cycleflow-v10-premium-polish/, 'the visual refresh invalidates the previous offline cache');

console.log('CycleFlow premium visual polish tests passed.');
