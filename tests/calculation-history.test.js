/** Immutable calculation history regression tests. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('', { runScripts: 'outside-only', url: 'https://cycleflow-history.test/' });
const { window } = dom;
window.eval(fs.readFileSync(path.join(__dirname, '..', 'static', 'js', 'calculation-history.js'), 'utf8'));
const api = window.CycleFlowCalculationHistory;
assert(api, 'calculation history API should load');

const state = {
  periods: [{ id: 'p1', date: '2026-11-01', type: 'veset', cityId: 'beit-shemesh' }],
  hefseks: {}, hefsekMeta: {}, tevilot: {},
  settings: { minhag: 'ashkenaz', cityId: 'beit-shemesh', minimumWaitMode: 'five_from_onset', onahBeinonitMode: 'day30_onah' }
};
const status = {
  type: 'nidda', text: 'נידה - ממתינה להפסק', canHefsek: false,
  provenance: {
    rulesetId: 'cycleflow-yoatzot-standard', rulesetVersion: '1.0.0',
    sourceIds: ['nishmat-yoatzot-common'], confidence: 'advisory',
    reviewState: 'source-based-advisory', isPersonalPsak: false,
    sourceEvents: [{ type: 'period', id: 'p1', date: '2026-11-01' }]
  }
};
const capturedAt = new Date('2026-11-16T12:00:00.000Z');
const snapshot = api.createSnapshot(state, '2026-11-16', status, capturedAt);
assert(snapshot, 'valid calculation should produce a snapshot');
assert(api.validateSnapshot(snapshot), 'created snapshot should pass schema validation');
assert.strictEqual(snapshot.result.text, status.text);
assert.strictEqual(snapshot.provenance.isPersonalPsak, false);

// The stored record is a detached copy: later changes to live state/status cannot rewrite it.
status.provenance.sourceEvents[0].date = '2099-01-01';
state.periods[0].date = '2099-01-01';
assert.strictEqual(snapshot.provenance.sourceEvents[0].date, '2026-11-01');
assert.strictEqual(snapshot.evaluatedDate, '2026-11-16');

const ledger = { calculationSnapshots: [] };
assert.strictEqual(api.append(ledger, snapshot), true, 'first snapshot should append');
assert.strictEqual(api.append(ledger, snapshot), false, 'same input/date must be deduplicated');
assert.strictEqual(ledger.calculationSnapshots.length, 1);
const changedSettings = {
  ...state,
  settings: { ...state.settings, cityId: 'jerusalem' }
};
const changedSnapshot = api.createSnapshot(changedSettings, '2026-11-16', {
  ...status, provenance: { ...status.provenance, isPersonalPsak: false }
}, capturedAt);
assert.notStrictEqual(changedSnapshot.snapshotId, snapshot.snapshotId,
  'a calculation input change must create a distinct immutable snapshot');

assert.strictEqual(api.validateSnapshot({ ...snapshot, provenance: { ...snapshot.provenance, isPersonalPsak: true } }), false,
  'a snapshot must never claim to be a personal ruling');
assert.strictEqual(api.validateSnapshot({ ...snapshot, inputFingerprint: 'invalid' }), false,
  'malformed fingerprints must be rejected');
assert.strictEqual(api.validateSnapshot({ ...snapshot, evaluatedDate: '2026-02-30' }), false,
  'impossible date labels must be rejected');
assert.strictEqual(api.append({ calculationSnapshots: [] }, null), false);
console.log('Immutable calculation history regression tests passed.');
