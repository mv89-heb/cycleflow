/* Verify Israel-local date behavior when the device timezone differs. */
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const path = require('node:path');

const script = String.raw`
require('./static/js/calendar-services.js');
const calendar = globalThis.CycleFlowCalendar;
const instant = new Date('2026-11-16T22:30:00.000Z');
const clock = calendar.getIsraelClock(instant);
if (JSON.stringify(clock) !== JSON.stringify({ date: '2026-11-17', time: '00:30' })) {
  throw new Error('Israel clock changed with device timezone: ' + JSON.stringify(clock));
}
if (calendar.getIsraelCivilDate(instant) !== '2026-11-17') {
  throw new Error('Israel civil date changed with device timezone');
}
const hebrewFromCivil = calendar.formatHebrewDate('2026-11-17');
const hebrewFromInstant = calendar.getCurrentHebrewDate(instant, 'beit-shemesh');
if (!hebrewFromCivil || hebrewFromInstant !== hebrewFromCivil) {
  throw new Error('Current Hebrew date is inconsistent near Israel midnight: ' + hebrewFromInstant + ' / ' + hebrewFromCivil);
}
if (calendar.addCivilDays('2024-02-28', 1) !== '2024-02-29' ||
    calendar.addCivilDays('2024-02-29', 1) !== '2024-03-01') {
  throw new Error('Civil day arithmetic changed with device timezone');
}
const solarTimes = calendar.getSolarTimes('2026-11-16', 'beit-shemesh');
if (!solarTimes || !/^([01]\\d|2[0-3]):[0-5]\\d$/.test(solarTimes.sunrise) ||
    !/^([01]\\d|2[0-3]):[0-5]\\d$/.test(solarTimes.sunset)) {
  throw new Error('Solar times must be valid Israel-local clock values');
}
process.stdout.write(JSON.stringify({ sunrise: solarTimes.sunrise, sunset: solarTimes.sunset }));
`;

const solarResults = [];
for (const timezone of ['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Asia/Jerusalem']) {
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    env: { ...process.env, TZ: timezone }
  });
  assert.equal(result.status, 0,
    `calendar behavior must be stable with device timezone ${timezone}: ${result.stderr || result.stdout}`);
  solarResults.push(JSON.parse(result.stdout));
}
assert(solarResults.every(value => value.sunrise === solarResults[0].sunrise &&
  value.sunset === solarResults[0].sunset),
  'sunrise and sunset estimates must be identical across device timezones');
console.log('Israel clock, Hebrew date, and solar-time timezone regression tests passed (4 device timezones).');
