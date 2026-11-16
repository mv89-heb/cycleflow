/* Immutable, local-only snapshots of calculation results. */
(() => {
  'use strict';

  const MAX_SNAPSHOTS = 5000;
  const RELEVANT_SETTINGS = ['minhag', 'cityId', 'minimumWaitMode', 'onahBeinonitMode'];

  function stableInputs(state, evaluatedDate) {
    const settings = state && state.settings ? state.settings : {};
    const selectedSettings = {};
    RELEVANT_SETTINGS.forEach(key => { selectedSettings[key] = settings[key] ?? null; });
    return {
      evaluatedDate,
      periods: Array.isArray(state.periods) ? state.periods : [],
      hefseks: state.hefseks || {},
      hefsekMeta: state.hefsekMeta || {},
      tevilot: state.tevilot || {},
      settings: selectedSettings
    };
  }

  function fingerprint(value) {
    const input = JSON.stringify(value);
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function clone(value) {
    return value === undefined ? null : JSON.parse(JSON.stringify(value));
  }

  function createSnapshot(state, evaluatedDate, status, capturedAt = new Date()) {
    if (!state || !/^\\d{4}-\\d{2}-\\d{2}$/.test(evaluatedDate) || !status || !status.provenance) return null;
    const inputFingerprint = fingerprint(stableInputs(state, evaluatedDate));
    const provenance = clone(status.provenance);
    const result = {
      type: String(status.type || 'unknown'),
      text: String(status.text || ''),
      canHefsek: Boolean(status.canHefsek),
      cleanCount: Number.isFinite(status.cleanCount) ? status.cleanCount : null,
      expectedTevilaDate: status.expectedTevilaDate || null,
      reportedTevilaDate: status.reportedTevilaDate || null
    };
    return {
      schemaVersion: 1,
      snapshotId: `cf-calc-v1:${evaluatedDate}:${inputFingerprint}`,
      evaluatedDate,
      capturedAt: capturedAt.toISOString(),
      inputFingerprint,
      result,
      provenance
    };
  }

  function append(state, snapshot) {
    if (!snapshot) return false;
    if (!Array.isArray(state.calculationSnapshots)) state.calculationSnapshots = [];
    if (state.calculationSnapshots.some(item => item && item.snapshotId === snapshot.snapshotId)) return false;
    if (state.calculationSnapshots.length >= MAX_SNAPSHOTS) return false;
    state.calculationSnapshots.push(snapshot);
    return true;
  }

  function validateSnapshot(snapshot) {
    return Boolean(snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) &&
      snapshot.schemaVersion === 1 &&
      typeof snapshot.snapshotId === 'string' && snapshot.snapshotId.length <= 100 &&
      /^cf-calc-v1:\\d{4}-\\d{2}-\\d{2}:[a-f0-9]{8}$/.test(snapshot.snapshotId) &&
      /^\\d{4}-\\d{2}-\\d{2}$/.test(snapshot.evaluatedDate) &&
      typeof snapshot.capturedAt === 'string' && !Number.isNaN(Date.parse(snapshot.capturedAt)) &&
      typeof snapshot.inputFingerprint === 'string' && /^[a-f0-9]{8}$/.test(snapshot.inputFingerprint) &&
      snapshot.snapshotId.endsWith(snapshot.inputFingerprint) &&
      snapshot.result && typeof snapshot.result === 'object' &&
      typeof snapshot.result.type === 'string' && typeof snapshot.result.text === 'string' &&
      typeof snapshot.result.canHefsek === 'boolean' &&
      snapshot.provenance && typeof snapshot.provenance === 'object' &&
      snapshot.provenance.isPersonalPsak === false);
  }

  window.CycleFlowCalculationHistory = Object.freeze({
    MAX_SNAPSHOTS,
    createSnapshot,
    append,
    validateSnapshot,
    fingerprint
  });
})();
