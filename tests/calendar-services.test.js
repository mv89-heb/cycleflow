/* Regression tests for local Hebrew date and sunset calculations. */
require('../static/js/calendar-services.js');
const calendar = globalThis.CycleFlowCalendar;
const assert = require('node:assert/strict');

assert(calendar, 'calendar services must be exposed locally');
assert.equal(calendar.CITIES.length >= 10, true, 'manual Israeli city list is available');
assert.match(calendar.formatHebrewDate('2026-11-16'), /.+/, 'Intl Hebrew calendar should format a civil date');
assert.notEqual(
  calendar.formatHebrewDate('2026-11-16'),
  calendar.formatHebrewDate('2026-11-16', { afterSunset: true }),
  'Hebrew date changes after sunset'
);
assert.equal(calendar.addCivilDays('2024-02-28', 1), '2024-02-29', 'leap day arithmetic');
assert.equal(calendar.addCivilDays('2024-02-29', 1), '2024-03-01', 'leap day rollover');

const sunset = calendar.getSunset('2026-11-16', 'beit-shemesh');
assert(sunset && /^([01]\d|2[0-3]):[0-5]\d$/.test(sunset.time), 'sunset estimate is a local HH:mm time');
const before = sunset.time === '00:00' ? '00:01' : '00:00';
const after = sunset.time === '23:59' ? '23:58' : '23:59';
assert.equal(calendar.resolveEventRelation({ date: '2026-11-16', eventTime: before, cityId: 'beit-shemesh' }), 'before');
assert.equal(calendar.resolveEventRelation({ date: '2026-11-16', eventTime: after, cityId: 'beit-shemesh' }), 'after');
assert.equal(calendar.resolveEventRelation({ date: '2026-11-16', eventTime: '18:00', isSunset: true }), 'after',
  'manual legacy sunset choice remains available when no city is selected');
assert.equal(calendar.resolveEventRelation({ date: '2026-11-16' }), 'unknown',
  'missing historical event time must remain unknown');
assert.equal(calendar.getSunset('2026-11-16', 'other'), null, 'other city never fabricates a sunset');

const dstBefore = calendar.getSunset('2026-03-26', 'jerusalem');
const dstAfter = calendar.getSunset('2026-03-27', 'jerusalem');
const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
const dstShift = minutes(dstAfter.time) - minutes(dstBefore.time);
assert(dstShift >= 45 && dstShift <= 75, 'Israel DST transition is reflected in local sunset time');

console.log('Local Hebrew calendar and sunset regression tests passed.');
