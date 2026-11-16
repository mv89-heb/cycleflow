require('../static/js/local-tools.js');
const assert = require('node:assert/strict');
const tools = globalThis.CycleFlowTools;

assert(tools, 'local tools module should load without a browser or network');
assert.equal(tools.CHECKLIST_ITEMS.length, 8, 'mikveh checklist items are available');

const allDay = tools.buildIcs([{ id: 'reminder-1', date: '2026-11-16', title: 'תזכורת אישית' }]);
assert(allDay.includes('BEGIN:VCALENDAR'));
assert(allDay.includes('DTSTART;VALUE=DATE:20261116'));
assert(allDay.includes('DTEND;VALUE=DATE:20261117'));
assert(allDay.includes('תזכורת אישית'));

const timed = tools.buildIcs([{ id: 'reminder-2', date: '2026-11-16', time: '18:30', title: 'בדיקה, תזכורת; אישית', notes: 'שורה ראשונה\nשורה שנייה' }]);
assert.match(timed, /DTSTART:[0-9]{8}T[0-9]{6}Z/);
assert.match(timed, /DTEND:[0-9]{8}T[0-9]{6}Z/);
assert(timed.includes('בדיקה\\, תזכורת\\; אישית'));
assert(timed.includes('שורה ראשונה\\nשורה שנייה'));
const longIcs = tools.buildIcs([{ date: '2026-11-16', title: 'תזכורת'.repeat(20), notes: 'פרט ארוך '.repeat(60) }]);
for (const line of longIcs.split(/\r\n/)) {
  assert(new TextEncoder().encode(line).length <= 75, 'ICS content lines must respect the 75-octet folding limit');
}

const winterUtc = tools.zonedLocalToUtc('2026-11-16', '18:30');
const summerUtc = tools.zonedLocalToUtc('2026-07-16', '18:30');
assert.equal(winterUtc.toISOString().slice(11, 16), '16:30', 'Israel winter UTC offset is applied');
assert.equal(summerUtc.toISOString().slice(11, 16), '15:30', 'Israel summer UTC offset is applied');
assert.throws(() => tools.zonedLocalToUtc('2026-03-27', '02:30'), /אינה קיימת באזור הזמן/,
  'nonexistent local times during DST transition are rejected');
assert.throws(() => tools.zonedLocalToUtc('2026-10-25', '01:30'), /אינה חד-משמעית/,
  'ambiguous local times during DST transition are rejected');
assert.throws(() => tools.buildIcs([]), /אין תזכורות/);
assert.throws(() => tools.buildIcs([{ date: '2026-02-30', title: 'invalid' }]), /תזכורת ללא תאריך/);

const stain = tools.buildStainSummary({
  date: '2026-11-16', time: '10:20', color: 'brown', size: 'small',
  surface: 'white_underwear', source: 'unknown', note: 'תיאור בלבד'
});
assert(stain.includes('סיכום אנונימי'));
assert(stain.includes('חום'));
assert(!stain.includes('שם:'));
assert(stain.includes('אינו קובע מעמד הלכתי'));

const doctor = tools.buildDoctorSummary({
  periods: [
    { date: '2026-09-01', type: 'veset' },
    { date: '2026-09-29', type: 'veset' },
    { date: '2026-10-27', type: 'veset' },
    { date: '2026-10-10', type: 'spotting' }
  ],
  ovulationObservations: [{ date: '2026-10-20', type: 'opk_positive', immersionDate: '2026-10-18', note: 'תוצאה חיובית' }],
  tevilot: { '2026-10-18': true },
  stainReports: [{ date: '2026-10-10', color: 'pink', size: 'small', surface: 'tissue', source: 'unknown' }]
}, '2026-10-01', '2026-10-31', { includeStains: true });
assert(doctor.includes('28 ימים'));
assert(doctor.includes('דיווחי הכתמה/דימום נוספים'));
assert(doctor.includes('2026-10-10'));
assert(doctor.includes('בדיקת LH חיובית'));
assert(doctor.includes('טבילה להשוואה 2026-10-18'));
assert(doctor.includes('תיאורי כתמים'));
assert(doctor.includes('2026-10-18'));
assert(!doctor.includes('שם:'));

assert(tools.earlyOvulationIndicator({ date: '2026-10-15', immersionDate: '2026-10-18' }).includes('3 ימים'));
assert(tools.earlyOvulationIndicator({ date: '2026-10-15' }).includes('לא הוזן תאריך טבילה'));
assert(tools.earlyOvulationIndicator({ date: '2026-10-20', immersionDate: '2026-10-18' }).includes('מאוחר'));

console.log('Local reminders, anonymous summaries, and checklist tests passed.');
