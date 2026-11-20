/* CycleFlow identity, logo, and branded navigation regressions. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'templates', 'index.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'static', 'manifest.json'), 'utf8'));
const sw = fs.readFileSync(path.join(root, 'static', 'sw.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'static', 'css', 'main.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'static', 'js', 'app.js'), 'utf8');

assert.match(html, /<title>CycleFlow \| מעקב אישי<\/title>/, 'browser title uses the CycleFlow brand');
assert.match(html, /class="brand"[^>]*aria-label="CycleFlow"/, 'header brand is accessible');
assert.match(html, /\/static\/icons\/cycleflow-mark\.svg/, 'header loads the CycleFlow brand mark');
assert.match(html, /\/static\/icons\/favicon\.svg/, 'browser favicon uses the branded icon');
assert.match(html, /apple-mobile-web-app-title" content="CycleFlow"/, 'installed app title uses CycleFlow');
assert.doesNotMatch(html, /MyCycle Pro|MyCycle Secure/, 'legacy product naming is removed from the app shell');
assert.match(html, /aria-label="ניווט ראשי"/, 'bottom navigation has an accessible landmark name');
assert.equal((html.match(/class="nav-item/g) || []).length, 5, 'all five primary navigation destinations remain available');
assert.match(html, /<svg viewBox="0 0 24 24"/, 'navigation uses crisp local vector icons');

const mark = fs.readFileSync(path.join(root, 'static', 'icons', 'cycleflow-mark.svg'), 'utf8');
const favicon = fs.readFileSync(path.join(root, 'static', 'icons', 'favicon.svg'), 'utf8');
assert.match(mark, /<svg[^>]+viewBox="0 0 512 512"/, 'brand mark is a scalable vector');
assert.match(favicon, /<svg[^>]+viewBox="0 0 64 64"/, 'favicon is a scalable vector');

assert.equal(manifest.name, 'CycleFlow', 'PWA full name uses CycleFlow');
assert.equal(manifest.short_name, 'CycleFlow', 'PWA short name uses CycleFlow');
assert.equal(manifest.theme_color, '#f5f1ec', 'PWA chrome matches the new brand palette');
assert.equal(manifest.background_color, '#f5f1ec', 'PWA launch background matches the new brand palette');
assert.ok(manifest.icons.some(icon => icon.src === '/static/icons/cycleflow-mark.svg'), 'PWA manifest includes the branded icon');
assert.match(sw, /cycleflow-v10-premium-polish/, 'brand assets receive a fresh offline cache');
assert.match(sw, /\/static\/icons\/cycleflow-mark\.svg/, 'service worker precaches the brand mark');
assert.match(sw, /\/static\/icons\/favicon\.svg/, 'service worker precaches the favicon');
assert.match(css, /--primary:\s*#68465f/, 'the new visual system uses the branded plum');
assert.match(css, /\.brand img\s*\{/, 'the header logo has a dedicated responsive treatment');
assert.match(css, /\.nav-item svg\s*\{/, 'vector navigation icons are styled consistently');
assert.match(css, /@media\s*\(max-width:\s*360px\)/, 'the brand header handles compact phones');
assert.match(app, /theme === 'light' \? '#f5f1ec' : '#201b22'/, 'browser chrome follows both new brand themes');

console.log('CycleFlow brand and navigation tests passed.');
