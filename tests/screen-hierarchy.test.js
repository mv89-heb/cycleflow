/* Screen hierarchy and form-control visual regression checks. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'templates', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'static', 'css', 'main.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'static', 'sw.js'), 'utf8');

const screens = ['view_dashboard', 'view_calendar', 'view_history', 'view_tools', 'view_settings'];
for (const id of screens) {
    const match = html.match(new RegExp('<section id="' + id + '"[^>]*>([\\s\\S]*?)</section>'));
    assert(match, id + ' must exist');
    assert.match(match[1], /class="view-heading"/, id + ' must have a screen heading');
    assert.match(match[1], /<h1>[^<]+<\\/h1>/, id + ' must have a meaningful page title');
}
assert.equal((html.match(/class="nav-item/g) || []).length, 5, 'all five navigation destinations remain intact');
const ids = [...html.matchAll(/\\bid="([^"]+)"/g)].map((m) => m[1]);
assert.equal(ids.length, new Set(ids).size, 'page IDs remain unique');
assert.match(css, /input:not\\(\\[type="checkbox"\\]\\):not\\(\\[type="radio"\\]\\):not\\(\\[type="file"\\]\\)/, 'text, date, time, and password fields share a full-width control style');
assert.match(css, /input\\[type="checkbox"\\], input\\[type="radio"\\]/, 'checkbox and radio dimensions remain independent from text fields');
assert.match(css, /\\.checkbox-label\\s*\\{/, 'only explicit checkbox labels receive a filled surface');
assert.match(css, /#view_tools\\s*\\{[\\s\\S]*?grid-template-columns:\\s*repeat\\(2/, 'tools use a two-column desktop layout');
assert.match(css, /@media\\s*\\(max-width:\\s*600px\\)/, 'the layout retains a dedicated mobile breakpoint');
assert.match(css, /prefers-reduced-motion:\\s*reduce/, 'screen heading motion respects reduced-motion preferences');
assert.match(sw, /cycleflow-v11-screen-hierarchy/, 'the PWA cache is refreshed for the new screen layout');

console.log('CycleFlow screen hierarchy tests passed.');
