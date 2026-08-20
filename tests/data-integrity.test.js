/**
 * Regression tests for chronological data handling.
 * These tests intentionally avoid changing halachic policy; they verify
 * that reporting/statistics are based on chronological veset records.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const APP_PATH = path.join(__dirname, '..', 'static', 'js', 'app.js');
const HTML_PATH = path.join(__dirname, '..', 'templates', 'index.html');

function loadApp(state) {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/' });
  dom.window.localStorage.setItem('cycleflow_v61_python_pro', JSON.stringify(state));
  dom.window.eval(fs.readFileSync(APP_PATH, 'utf8') + `\nwindow.__api = { Utils, FertilityLogic };`);
  return dom.window.__api;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const settings = { minhag: 'ashkenaz', cycle: 28, pinHash: null, theme: 'dark' };

// History entered newest-first must still produce chronological cycle lengths.
{
  const { Utils, FertilityLogic } = loadApp({
    periods: [
      { id: 'new', date: '2026-05-29', type: 'veset', isSunset: false },
      { id: 'spot', date: '2026-05-15', type: 'spotting', isSunset: false },
      { id: 'old', date: '2026-05-01', type: 'veset', isSunset: false }
    ],
    hefseks: {}, daily: {}, settings
  });
  assert(Utils.chronologicalVesets([
    { date: '2026-05-29', type: 'veset' },
    { date: '2026-05-01', type: 'veset' }
  ])[0].date === '2026-05-01', 'vesets must sort chronologically');
  assert(FertilityLogic.getAvgCycleLength() === 28, 'spotting must not become a cycle boundary');
}

// Multiple spotting records must not affect fertility statistics.
{
  const { FertilityLogic } = loadApp({
    periods: [
      { id: 'a', date: '2026-01-01', type: 'veset', isSunset: false },
      { id: 's1', date: '2026-01-10', type: 'spotting', isSunset: false },
      { id: 'b', date: '2026-01-29', type: 'veset', isSunset: false },
      { id: 's2', date: '2026-02-05', type: 'spotting', isSunset: false },
      { id: 'c', date: '2026-02-26', type: 'veset', isSunset: false }
    ],
    hefseks: {}, daily: {}, settings
  });
  assert(FertilityLogic.getAvgCycleLength() === 28, 'spotting records must be ignored by cycle statistics');
}

console.log('Data-integrity regression tests passed.');
