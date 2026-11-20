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
    const start = html.indexOf('<section id="' + id + '"');
    assert.notEqual(start, -1, id + ' must exist');
    const end = html.indexOf('</section>', start);
    const section = html.slice(start, end);
    assert.ok(section.includes('class="view-heading"'), id + ' must have a screen heading');
    assert.ok(section.includes('<h1>') && section.includes('</h1>'), id + ' must have a meaningful page title');
}
assert.equal((html.match(/class="nav-item/g) || []).length, 5, 'all five navigation destinations remain intact');
const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
assert.equal(ids.length, new Set(ids).size, 'page IDs remain unique');
assert.ok(css.includes('input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"])'), 'visible text, date, time, and password fields share a full-width control style');
assert.ok(css.includes('.checkbox-label input[type="checkbox"], .checkbox-label input[type="radio"]'), 'checkbox and radio dimensions remain independent from text fields');
assert.ok(css.includes('.checkbox-label {'), 'only explicit checkbox labels receive a filled surface');
assert.ok(html.includes('<label for="set_minhag">') && html.includes('<label for="set_cycle_len">'), 'settings controls have programmatically associated labels');
assert.ok(css.includes('#view_tools,\n    #view_settings'), 'tools and settings receive desktop grid layouts');
assert.ok(css.includes('@media (max-width: 600px)'), 'the layout retains a dedicated mobile breakpoint');
assert.ok(css.includes('prefers-reduced-motion: reduce'), 'screen heading motion respects reduced-motion preferences');
assert.ok(sw.includes('cycleflow-v11-screen-hierarchy'), 'the PWA cache is refreshed for the new screen layout');

console.log('CycleFlow screen hierarchy tests passed.');
