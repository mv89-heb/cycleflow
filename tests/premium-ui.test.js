/* Premium UI and theme regressions. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const css = fs.readFileSync(path.join(__dirname, '..', 'static', 'css', 'main.css'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'static', 'js', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'templates', 'index.html'), 'utf8');

assert.match(css, /--bg-body:\s*#f7f4ef/, 'the default interface uses a warm, low-glare palette');
assert.match(css, /--primary:\s*#70465f/, 'the primary palette uses the CycleFlow plum accent');
assert.match(css, /body\.dark-theme\s*\{[^}]*--bg-body:\s*#211d23/s, 'the optional dark theme remains available');
assert.match(css, /\.bottom-nav\s*\{[^}]*width:\s*min\(720px,\s*calc\(100% - 36px\)\)/s, 'desktop navigation is centered and constrained');
assert.match(css, /@media\s*\(max-width:\s*600px\)/, 'the layout has a dedicated mobile treatment');
assert.match(css, /prefers-reduced-motion:\s*reduce/, 'reduced-motion preferences are respected');
assert.match(app, /theme:\s*'light'/, 'new installations default to the light premium theme');
assert.match(app, /classList\.toggle\('dark-theme',\s*theme === 'dark'\)/, 'existing dark-theme preference is preserved');
assert.match(html, /dir="rtl"/, 'Hebrew RTL document direction is preserved');
assert.match(html, /<meta name="theme-color" content="#f7f4ef">/, 'browser chrome matches the light default theme');
assert.ok(app.includes("document.querySelector('meta[name=\"theme-color\"]')"), 'theme changes update browser chrome');
assert.ok(app.includes("theme === 'light' ? '#f7f4ef' : '#211d23'"), 'browser chrome follows both theme palettes');
assert.match(html, /id="bottom_nav"/, 'the existing functional navigation remains in place');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'static', 'manifest.json'), 'utf8'));
assert.equal(manifest.theme_color, '#f7f4ef', 'installed PWA chrome matches the light theme');
assert.equal(manifest.background_color, '#f7f4ef', 'installed PWA launch background matches the light theme');

console.log('Premium UI theme and responsive layout tests passed.');
