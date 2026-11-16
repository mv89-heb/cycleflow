const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'templates', 'index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://cycleflow-tools.test/' });
const { window } = dom;
window.confirm = () => true;
window.TextEncoder = TextEncoder;
window.localStorage.setItem('cycleflow_v61_python_pro', JSON.stringify({
  periods: [], hefseks: {}, hefsekMeta: {}, tevilot: {}, daily: {},
  settings: { minhag: 'ashkenaz', cycle: 28, pinHash: null, theme: 'dark', cityId: null }
}));
const sources = ['calendar-services.js', 'local-tools.js', 'app.js'].map(file =>
  fs.readFileSync(path.join(__dirname, '..', 'static', 'js', file), 'utf8')
);
window.eval(sources.join('\n') + '\nwindow.__api = { UI, State, document: window.document, window };');
const { UI, State, document } = window.__api;
UI.cacheDOM();
UI.toast = () => {};
UI.bindEvents();
UI.switchTab('tools');
document.getElementById('mikveh_checklist_date').value = '2026-11-16';
UI.renderTools();

document.getElementById('reminder_date').value = '2026-11-16';
document.getElementById('reminder_title').value = 'תזכורת פרטית';
document.getElementById('reminder_time').value = '18:30';
UI.actions.addReminder.call(UI);
assert.equal(State.get().manualReminders.length, 1);
assert.equal(State.get().manualReminders[0].title, 'תזכורת פרטית');

document.getElementById('stain_date').value = '2026-11-17';
document.getElementById('stain_color').value = 'brown';
document.getElementById('stain_size').value = 'small';
document.getElementById('stain_surface').value = 'tissue';
document.getElementById('stain_source').value = 'unknown';
document.getElementById('stain_note').value = 'תיאור עובדתי';
UI.actions.addStainReport.call(UI);
assert.equal(State.get().stainReports.length, 1);
assert.equal(State.get().stainReports[0].note, 'תיאור עובדתי');
UI.actions.deleteStainReport.call(UI, { dataset: { id: State.get().stainReports[0].id } });
assert.equal(State.get().stainReports.length, 0, 'stain report can be deleted locally');

const checklist = document.querySelector('[data-action="toggleMikvehChecklist"][data-item="hair"]');
checklist.checked = true;
UI.actions.toggleMikvehChecklist.call(UI, checklist);
assert(State.get().mikvehChecklist['2026-11-16'].includes('hair'));

const checklistDate = document.getElementById('mikveh_checklist_date');
checklistDate.value = '2026-11-18';
checklistDate.dispatchEvent(new window.Event('change', { bubbles: true }));
assert.equal(document.querySelector('[data-action="toggleMikvehChecklist"]').dataset.date, '2026-11-18');

document.getElementById('ovulation_date').value = '2026-11-15';
document.getElementById('ovulation_type').value = 'opk_positive';
document.getElementById('ovulation_immersion_date').value = '2026-11-18';
UI.actions.addOvulationObservation.call(UI);
assert.equal(State.get().ovulationObservations.length, 1);
assert.equal(State.get().ovulationObservations[0].immersionDate, '2026-11-18');
UI.actions.deleteOvulationObservation.call(UI, { dataset: { id: State.get().ovulationObservations[0].id } });
assert.equal(State.get().ovulationObservations.length, 0, 'ovulation observation can be deleted locally');

console.log('Local tools UI persistence tests passed.');
