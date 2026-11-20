/* Premium UI and theme regressions. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const css = fs.readFileSync(path.join(__dirname, '..', 'static', 'css', 'main.css'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'static', 'js', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'templates', 'index.html'), 'utf8');

assert.match(css, /--bg-body:\s*#f5f1ec/, 'the default interface uses a warm, low-glare palette');
assert.match(css, /--primary:\s*#68465f/, 'the primary palette uses the CycleFlow plum accent');
assert.match(css, /body\.dark-theme\s*\{[^}]*--bg-body:\s*#201b22/s, 'the optional dark theme remains available');
assert.match(css, /\.bottom-nav\s*\{[^}]*width:\s*min\(720px,\s*calc\(100% - 36px\)\)/s, 'desktop navigation is centered and constrained');
assert.match(css, /@media\s*\(max-width:\s*600px\)/, 'the layout has a dedicated mobile treatment');
assert.match(css, /prefers-reduced-motion:\s*reduce/, 'reduced-motion preferences are respected');
assert.match(app, /theme:\s*'light'/, 'new installations default to the light premium theme');
assert.match(app, /classList\.toggle\('dark-theme',\s*theme === 'dark'\)/, 'existing dark-theme preference is preserved');
assert.match(html, /dir="rtl"/, 'Hebrew RTL document direction is preserved');
assert.match(html, /<meta name="theme-color" content="#f5f1ec">/, 'browser chrome matches the light default theme');
assert.ok(app.includes("document.querySelector('meta[name=\"theme-color\"]')"), 'theme changes update browser chrome');
assert.ok(app.includes("theme === 'light' ? '#f5f1ec' : '#201b22'"), 'browser chrome follows both theme palettes');
assert.match(html, /id="bottom_nav"/, 'the existing functional navigation remains in place');
const sw = fs.readFileSync(path.join(__dirname, '..', 'static', 'sw.js'), 'utf8');
assert.match(sw, /cycleflow-v8-brand-refresh/, 'theme metadata changes activate a fresh offline cache');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'static', 'manifest.json'), 'utf8'));
assert.equal(manifest.theme_color, '#f5f1ec', 'installed PWA chrome matches the light theme');
assert.equal(manifest.background_color, '#f5f1ec', 'installed PWA launch background matches the light theme');

console.log('Premium UI theme and responsive layout tests passed.');
