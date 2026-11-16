/** Cryptographic backup and transactional import regression tests. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { webcrypto } = require('crypto');
const { TextEncoder, TextDecoder } = require('util');

(async () => {
  const dom = new JSDOM('<div id="toast"><span id="toast_msg"></span></div><input id="import_file">', {
    runScripts: 'outside-only',
    url: 'https://cycleflow-backup.test/'
  });
  const { window } = dom;
  Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
  window.TextEncoder = TextEncoder;
  window.TextDecoder = TextDecoder;
  window.__CYCLEFLOW_TEST__ = true;
  window.prompt = () => 'correct horse battery';
  window.setTimeout = () => 0;

  const hardening = fs.readFileSync(path.join(__dirname, '..', 'static', 'js', 'hardening.js'), 'utf8');
  const backupScript = fs.readFileSync(path.join(__dirname, '..', 'static', 'js', 'backup-integrity.js'), 'utf8');
  window.eval(hardening);
  window.eval(backupScript);
  const api = window.__CycleFlowBackupTest;
  assert(api, 'test-only backup API should be available when explicitly enabled');

  const state = {
    periods: [{ id: 'p1', date: '2026-06-01', type: 'veset', isSunset: false, eventTime: '14:20', cityId: 'beit-shemesh', sunsetRelation: 'before' }],
    hefseks: { '2026-06-06': true },
    hefsekMeta: { '2026-06-06': { eventTime: '17:10', cityId: 'beit-shemesh', sunsetRelation: 'after' } },
    manualReminders: [{ id: 'r1', date: '2026-06-20', time: '18:30', title: 'תזכורת', notes: '' }],
    stainReports: [{ id: 's1', date: '2026-06-21', time: null, color: 'brown', size: 'small', surface: 'tissue', source: 'unknown', note: '' }],
    mikvehChecklist: { '2026-06-22': ['hair', 'nails'] },
    ovulationObservations: [{ id: 'o1', date: '2026-06-23', time: '08:00', type: 'opk_positive', immersionDate: '2026-06-26', note: '' }],
    tevilot: { '2026-06-15': true },
    daily: {},
    settings: { minhag: 'ashkenaz', cycle: 28, pinHash: null, theme: 'dark', cityId: 'beit-shemesh' }
  };

  const encrypted = await api.encrypt(state, 'correct horse battery');
  const envelope = JSON.parse(encrypted);
  assert.strictEqual(envelope.magic, 'CFBK');
  assert.strictEqual(envelope.version, 2);
  assert.strictEqual(envelope.iterations, 600000);

  const decrypted = await api.decrypt(encrypted, 'correct horse battery');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(decrypted)), state);

  await assert.rejects(() => api.encrypt(state, 'short'), /10 תווים/);
  await assert.rejects(() => api.decrypt(encrypted, 'wrong passphrase'), /OperationError|decrypt|operation/i);

  const tamperedEnvelope = JSON.parse(encrypted);
  const cipherBytes = Buffer.from(tamperedEnvelope.ciphertext, 'base64');
  cipherBytes[cipherBytes.length - 1] ^= 1;
  tamperedEnvelope.ciphertext = cipherBytes.toString('base64');
  await assert.rejects(() => api.decrypt(JSON.stringify(tamperedEnvelope), 'correct horse battery'));

  assert.throws(() => api.validateState({ ...state, periods: [{ ...state.periods[0], eventTime: '25:99' }] }), /שעת אירוע לא תקינה/);
  assert.throws(() => api.validateState({ ...state, settings: { ...state.settings, cityId: 'not-a-city' } }), /יישוב לא תקין/);
  assert.throws(() => api.validateState({ ...state, manualReminders: [{ ...state.manualReminders[0], time: '29:99' }] }), /שעת תזכורת לא תקינה/);
  assert.throws(() => api.validateState({ ...state, manualReminders: [{ ...state.manualReminders[0], date: '2026-02-30' }] }), /תזכורת לא תקינה/);
  assert.throws(() => api.validateState({ ...state, stainReports: [{ ...state.stainReports[0], color: 'invalid' }] }), /צבע כתם לא תקין/);
  assert.throws(() => api.validateState({ ...state, mikvehChecklist: { '2026-06-22': ['not-a-check'] } }), /סימון הכנה למקווה אינו תקין/);
  assert.throws(() => api.validateState({ ...state, ovulationObservations: [{ ...state.ovulationObservations[0], type: 'diagnosis' }] }), /תיעוד ביוץ לא תקין/);

  assert.throws(() => api.validateState({ ...state, tevilot: { 'not-a-date': true } }),
    /נתוני טבילה לא תקינים/);

  const storageKey = 'cycleflow_v61_python_pro';
  const recoveryKey = 'cycleflow_recovery_v1';
  const previous = JSON.stringify({
    periods: [{ id: 'old', date: '2026-05-01', type: 'veset', isSunset: false }],
    hefseks: {}, daily: {},
    settings: { minhag: 'ashkenaz', cycle: 28, pinHash: null, theme: 'dark' }
  });
  window.localStorage.setItem(storageKey, previous);
  window.localStorage.setItem(recoveryKey, 'recovery-copy');

  const fileInput = {
    files: [{ size: Buffer.byteLength(encrypted), text: async () => encrypted }],
    value: 'selected'
  };
  await api.importBackup(fileInput);
  assert.strictEqual(window.localStorage.getItem(storageKey), JSON.stringify(state),
    'a fully validated backup should atomically replace the active state');
  assert.strictEqual(window.localStorage.getItem(recoveryKey), null,
    'successful backup recovery should clear the recovery block');
  assert.strictEqual(fileInput.value, '', 'file input should be reset after import');

  const beforeFailedImport = window.localStorage.getItem(storageKey);
  const brokenInput = {
    files: [{ size: 100, text: async () => '{broken-json' }],
    value: 'selected'
  };
  await api.importBackup(brokenInput);
  assert.strictEqual(window.localStorage.getItem(storageKey), beforeFailedImport,
    'failed import must leave existing active state unchanged');
  assert.strictEqual(brokenInput.value, '');

  console.log('Backup crypto and transactional import tests passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
