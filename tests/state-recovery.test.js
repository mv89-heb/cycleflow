/** Verify invalid local state is preserved and cannot be overwritten silently. */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('', { runScripts: 'outside-only', url: 'https://cycleflow.test/' });
const { window } = dom;
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
assert(backup.includes("localStorage.removeItem('cycleflow_recovery_v1')"),
  'a validated backup import must be able to clear the recovery block');


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

console.log('Local state recovery regression tests passed.');
