/* Civil-day counting must remain stable through device DST transitions. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'templates', 'index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://cycleflow-timezone.test/' });
const { window } = dom;
window.localStorage.setItem('cycleflow_v61_python_pro', JSON.stringify({
  periods: [{ id: 'period-start', date: '2026-03-01', type: 'veset', sunsetRelation: 'before', isSunset: false }],
  hefseks: { '2026-03-07': true },
  hefsekMeta: {},
  tevilot: {},
  daily: {},
  settings: { minhag: 'ashkenaz', cycle: 28, pinHash: null, theme: 'dark' }
}));
window.eval(fs.readFileSync(path.join(__dirname, '..', 'static', 'js', 'calendar-services.js'), 'utf8'));
window.eval(fs.readFileSync(path.join(__dirname, '..', 'static', 'js', 'app.js'), 'utf8') +
  '\nwindow.__api = { Utils, HalachaLogic };');
const { Utils, HalachaLogic } = window.__api;

assert.equal(Utils.diffDays(Utils.newDate('2026-03-09'), Utils.newDate('2026-03-07')), 2,
  'civil day difference must not lose a day when the device timezone enters daylight saving');
assert.equal(Utils.fmt(Utils.addDays(Utils.newDate('2026-03-07'), 2)), '2026-03-09',
  'adding civil days must retain the expected calendar date through DST');
assert.equal(HalachaLogic.getStatus(Utils.newDate('2026-03-09')).cleanCount, 2,
  'clean-day counting must advance by calendar dates through DST rather than elapsed 24-hour blocks');

const israelDstDifference = Utils.diffDays(Utils.newDate('2026-03-28'), Utils.newDate('2026-03-26'));
assert.equal(israelDstDifference, 2,
  'Israel DST transition must not undercount two consecutive civil dates');

console.log('Device timezone and daylight-saving civil-day regression tests passed (' + process.env.TZ + ').');
