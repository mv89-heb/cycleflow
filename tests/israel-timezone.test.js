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
`;

for (const timezone of ['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Asia/Jerusalem']) {
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    env: { ...process.env, TZ: timezone }
  });
  assert.equal(result.status, 0,
    `calendar behavior must be stable with device timezone ${timezone}: ${result.stderr || result.stdout}`);
}

console.log('Israel timezone independence regression tests passed (4 device timezones).');
