/* Mobile layout regressions for safe areas and narrow viewports. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const css = fs.readFileSync(path.join(__dirname, '..', 'static', 'css', 'main.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'templates', 'index.html'), 'utf8');

assert.match(html, /viewport-fit=cover/i, 'the viewport must expose device safe-area insets');
assert.match(css, /padding-bottom:\s*calc\(90px\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\)/,
  'page content must clear the bottom navigation and device safe area');
assert.match(css, /\.bottom-nav\s*\{[^}]*env\(safe-area-inset-bottom,\s*0px\)/s,
  'fixed bottom navigation must stay above the device home indicator');
assert.match(css, /#day_panel\s*\{[^}]*max-height:\s*90dvh/s,
  'the day panel must use the dynamic viewport height');
assert.match(css, /#day_panel\s*\{[^}]*overscroll-behavior:\s*contain/s,
  'scrolling inside the day panel must not chain to the page');
assert.match(css, /@media\s*\(max-width:\s*380px\)/,
  'very narrow phones must receive a dedicated compact layout');
assert.match(css, /\.header-actions button\s*\{[^}]*width:\s*40px/s,
  'header action buttons must have reliable touch targets');
assert.match(css, /\.cal-grid\s*\{[^}]*gap:\s*4px/s,
  'calendar spacing must tighten on narrow screens');

console.log('Mobile safe-area and narrow-layout regression tests passed.');
