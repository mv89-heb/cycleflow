/* Animated CycleFlow intro regressions. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'templates', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'static', 'css', 'main.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'static', 'js', 'app.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'static', 'sw.js'), 'utf8');

assert.match(html, /id="intro_screen" class="intro-screen" aria-hidden="true"/, 'intro is decorative and hidden from assistive technology');
assert.match(html, /class="intro-logo" src="\/static\/icons\/cycleflow-mark\.svg"/, 'intro reuses the first-party CycleFlow logo');
assert.match(html, /המחזוריות שלך\. בקצב שלך\./, 'intro uses the approved CycleFlow tagline');
assert.match(html, /id="lock_screen"/, 'the existing optional PIN lock remains available');
assert.doesNotMatch(html.slice(html.indexOf('id="intro_screen"'), html.indexOf('id="lock_screen"')), /<input|<form|data-action=/, 'intro does not introduce a login or data-entry gate');
assert.match(css, /\.intro-screen\s*\{[^}]*position:\s*fixed/s, 'intro covers the viewport during startup');
assert.match(css, /@keyframes intro-logo-arrive/, 'logo has a dedicated entrance animation');
assert.match(css, /@keyframes intro-orbit-spin/, 'cycle motif has a subtle orbit animation');
assert.match(css, /@keyframes intro-progress-fill/, 'intro has a short progress accent');
assert.match(css, /body\.dark-theme #intro_screen/, 'intro follows the existing dark theme');
assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*?\.intro-content/, 'intro respects reduced-motion preferences');
assert.match(app, /function startIntroScreen\(\)/, 'intro lifecycle is encapsulated');
assert.match(app, /const visibleDuration = reducedMotion \? 180 : 1450/, 'intro remains short and accessible');
assert.match(app, /startIntroScreen\(\);/, 'intro begins only after app initialization');
assert.match(app, /intro\.remove\(\)/, 'intro is removed after its fade');
assert.match(app, /document\.getElementById\('intro_screen'\)\?\.remove\(\)/, 'intro cannot block the recovery error screen');
assert.match(sw, /cycleflow-v9-animated-intro/, 'updated intro assets are fetched with a fresh offline cache');

console.log('CycleFlow animated intro tests passed.');
