/** Verify invalid local state is preserved and cannot be overwritten silently. */
process.env.TZ = 'Asia/Jerusalem';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('', { runScripts: 'outside-only', url: 'https://cycleflow.test/' });
const { window } = dom;
assert(new Date('2026-11-17T00:00:00').getUTCDate() === 16, 'test environment must exercise UTC date rollover in Israel');
const STORAGE_KEY = 'cycleflow_v61_python_pro';
const RECOVERY_KEY = 'cycleflow_recovery_v1';
const original = '{"periods":"corrupt-or-unsupported"}';

window.localStorage.setItem(STORAGE_KEY, original);
const hardening = fs.readFileSync(path.join(__dirname, '..', 'static', 'js', 'hardening.js'), 'utf8');
window.eval(hardening);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(window.localStorage.getItem(STORAGE_KEY) === null,
  'invalid persisted state must not be loaded into the application');
assert(window.localStorage.getItem(RECOVERY_KEY) === original,
  'the exact original persisted value must be preserved for recovery');

const validState = JSON.stringify({
  periods: [], hefseks: {}, daily: {},
  settings: { minhag: 'ashkenaz', cycle: 28, pinHash: null, theme: 'dark' }
});
let blocked = false;
try {
  window.localStorage.setItem(STORAGE_KEY, validState);
} catch (_) {
  blocked = true;
}
assert(blocked, 'normal state writes must be blocked while recovery data exists');
assert(window.localStorage.getItem(RECOVERY_KEY) === original,
  'blocked writes must not replace the preserved recovery copy');

const backup = fs.readFileSync(path.join(__dirname, '..', 'static', 'js', 'backup-integrity.js'), 'utf8');
assert(backup.includes('window.__cycleflowRestoreValidatedState(serialized)'),
  'a validated backup import must use the verified recovery restore path');

const validCalendarDom = new JSDOM('', { runScripts: 'outside-only', url: 'https://cycleflow-calendar.test/' });
const validCalendarWindow = validCalendarDom.window;
validCalendarWindow.eval(hardening);
const calendarState = {
  periods: [{ date: '2026-11-16', type: 'veset', isSunset: true, eventTime: '17:05', cityId: 'beit-shemesh', sunsetRelation: 'after' }],
  manualReminders: [{ id: 'r1', date: '2026-11-17', title: 'בדיקה', time: '18:00', notes: '' }],
  stainReports: [{ id: 's1', date: '2026-11-18', color: 'brown', size: 'small', surface: 'tissue', source: 'unknown', note: '' }],
  mikvehChecklist: { '2026-11-19': ['hair'] },
  symptomObservations: [{ id: 'symptom-1', date: '2026-11-19', time: '08:15', type: 'back_pain', distinctive: 'yes', occursOutsideFlow: 'no', flowWithoutSymptom: 'no', relatedFlowDate: '2026-11-20', note: '' }],
  ovulationObservations: [{ id: 'o1', date: '2026-11-20', type: 'opk_positive', immersionDate: '2026-11-23', note: '' }],
  calculationSnapshots: [{
    schemaVersion: 1, snapshotId: 'cf-calc-v1:2026-11-20:0123456789abcdef',
    evaluatedDate: '2026-11-20', capturedAt: '2026-11-20T12:00:00.000Z',
    inputFingerprint: '0123456789abcdef',
    result: { type: 'nidda', text: 'נידה', canHefsek: false },
    provenance: { isPersonalPsak: false }
  }],
  hefseks: {}, hefsekMeta: { '2026-11-20': { eventTime: '16:30', cityId: 'beit-shemesh', sunsetRelation: 'before' } },
  daily: {}, settings: { minhag: 'ashkenaz', cycle: 28, pinHash: null, theme: 'dark', cityId: 'beit-shemesh' }
};
validCalendarWindow.localStorage.setItem(STORAGE_KEY, JSON.stringify(calendarState));
assert(validCalendarWindow.localStorage.getItem(STORAGE_KEY) === JSON.stringify(calendarState),
  'valid calendar metadata and immutable calculation history must pass local storage hardening');
let invalidSnapshotBlocked = false;
try {
  validCalendarWindow.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...calendarState,
    calculationSnapshots: [{ ...calendarState.calculationSnapshots[0], provenance: { isPersonalPsak: true } }]
  }));
} catch (_) { invalidSnapshotBlocked = true; }
assert(invalidSnapshotBlocked, 'a snapshot that claims to be a personal psak must be rejected by local storage hardening');
let invalidCityBlocked = false;
try {
  validCalendarWindow.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...calendarState, settings: { ...calendarState.settings, cityId: 'unknown-city' }
  }));
} catch (_) { invalidCityBlocked = true; }
assert(invalidCityBlocked, 'unknown city identifiers must be rejected by local storage hardening');
let invalidSymptomDataBlocked = false;
try {
  validCalendarWindow.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...calendarState, symptomObservations: [{ id: 'bad', date: '2026-11-20', type: 'unknown', distinctive: 'yes', occursOutsideFlow: 'no' }]
  }));
} catch (_) { invalidSymptomDataBlocked = true; }
assert(invalidSymptomDataBlocked, 'unsupported symptom types must be rejected by storage hardening');

let invalidToolDataBlocked = false;
try {
  validCalendarWindow.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...calendarState, manualReminders: [{ id: 'bad', date: '2026-11-17', title: 'bad', time: '99:99' }]
  }));
} catch (_) { invalidToolDataBlocked = true; }
assert(invalidToolDataBlocked, 'invalid local reminder data must be rejected by storage hardening');
let invalidCivilDateBlocked = false;
try {
  validCalendarWindow.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...calendarState, manualReminders: [{ id: 'bad-date', date: '2026-02-30', title: 'bad' }]
  }));
} catch (_) { invalidCivilDateBlocked = true; }
assert(invalidCivilDateBlocked, 'impossible civil dates must be rejected in Israel timezone');


const noSpaceDom = new JSDOM('', { runScripts: 'outside-only', url: 'https://cycleflow-no-space.test/' });
const noSpaceWindow = noSpaceDom.window;
noSpaceWindow.localStorage.setItem(STORAGE_KEY, original);
Object.defineProperty(noSpaceWindow.Storage.prototype, 'setItem', {
  configurable: true,
  value() { throw new noSpaceWindow.DOMException('quota exceeded', 'QuotaExceededError'); }
});
noSpaceWindow.eval(hardening);
noSpaceWindow.localStorage.getItem(STORAGE_KEY);
assert(noSpaceWindow.__cycleflowRecoveryRequired === true,
  'writes must remain blocked even if there is not enough space to save a recovery copy');
let noSpaceWriteBlocked = false;
try { noSpaceWindow.localStorage.setItem(STORAGE_KEY, validState); } catch (_) { noSpaceWriteBlocked = true; }
assert(noSpaceWriteBlocked, 'failed recovery-copy storage must not permit destructive writes');

// A quota failure during a validated restore must not delete the only recovery copy.
const quotaDom = new JSDOM('', {
  runScripts: 'outside-only',
  url: 'https://cycleflow-quota.test/',
  storageQuota: 128
});
const quotaWindow = quotaDom.window;
quotaWindow.localStorage.setItem(RECOVERY_KEY, 'preserved-original-data');
quotaWindow.eval(hardening);
const oversizedValidState = JSON.stringify({
  periods: [], hefseks: {}, daily: {},
  settings: { minhag: 'ashkenaz', cycle: 28, pinHash: null, theme: 'dark' },
  notes: 'x'.repeat(300)
});
let restoreFailedOnQuota = false;
try { quotaWindow.__cycleflowRestoreValidatedState(oversizedValidState); }
catch (_) { restoreFailedOnQuota = true; }
assert(restoreFailedOnQuota, 'restore should report a storage quota failure');
assert(quotaWindow.localStorage.getItem(STORAGE_KEY) === null,
  'failed restore must not leave a partial active state');
assert(quotaWindow.localStorage.getItem(RECOVERY_KEY) === 'preserved-original-data',
  'failed restore must preserve the original recovery copy');

console.log('Local state recovery regression tests passed.');
