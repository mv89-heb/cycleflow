/**
 * ערכת בדיקות ליבה - HalachaLogic, FertilityLogic, Utils
 * הרצה: node tests/logic.test.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const APP_PATH = path.join(__dirname, '..', 'static', 'js', 'app.js');
const HTML_PATH = path.join(__dirname, '..', 'templates', 'index.html');

let passed = 0, failed = 0;
const failures = [];

function assert(cond, msg) {
    if (cond) passed++;
    else { failed++; failures.push(msg); }
}
function eq(actual, expected, msg) {
    assert(actual === expected, `${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function loadApp(state) {
    const html = fs.readFileSync(HTML_PATH, 'utf8').replace(/\/static\/css\/main.css[^"]*/, 'about:blank');
    const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/' });
    const { window } = dom;
    window.localStorage.setItem('cycleflow_v61_python_pro', JSON.stringify(state));
    delete window.navigator.serviceWorker;
    const code = fs.readFileSync(APP_PATH, 'utf8');
    window.eval(code + `
        window.__api = { Utils, HalachaLogic, FertilityLogic, State };
    `);
    return window.__api;
}

const baseSettings = { minhag: 'ashkenaz', cycle: 28, pinHash: null, theme: 'dark' };

(function testUtils() {
    const { Utils } = loadApp({ periods: [], hefseks: {}, daily: {}, settings: baseSettings });
    eq(Utils.diffDays(Utils.newDate('2026-01-10'), Utils.newDate('2026-01-01')), 9, 'diffDays basic');
    eq(Utils.fmt(Utils.addDays(Utils.newDate('2026-01-01'), 5)), '2026-01-06', 'addDays basic');
    eq(Utils.fmt(Utils.addDays(Utils.newDate('2024-02-28'), 1)), '2024-02-29', 'leap year Feb 29');
    eq(Utils.fmt(Utils.addDays(Utils.newDate('2024-02-29'), 1)), '2024-03-01', 'leap year rollover');
    eq(Utils.fmt(Utils.addDays(Utils.newDate('2025-12-31'), 1)), '2026-01-01', 'year boundary');
})();

(function testChronologicalHelpers() {
    const { Utils } = loadApp({ periods: [], hefseks: {}, daily: {}, settings: baseSettings });
    const periods = [
        { date: '2026-06-15', type: 'veset', id: 'late' },
        { date: '2026-05-01', type: 'veset', id: 'early' },
        { date: '2026-05-20', type: 'spotting', id: 'spot' }
    ];
    const chronological = Utils.chronologicalPeriods(periods);
    eq(chronological.map(p => p.date).join(','), '2026-05-01,2026-05-20,2026-06-15', 'periods sort chronologically');
    eq(Utils.chronologicalVesets(periods).map(p => p.date).join(','), '2026-05-01,2026-06-15', 'vesets exclude spotting and sort chronologically');
    assert(periods[0].date === '2026-06-15', 'chronological helpers do not mutate source array');
})();

(function testHalacha() {
    const state = {
        periods: [{ date: '2026-06-01', type: 'veset', isSunset: false, id: 'p1' }],
        hefseks: {}, daily: {}, settings: baseSettings
    };
    const { HalachaLogic, Utils } = loadApp(state);
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-01')).type, 'nidda', 'day 1 is nidda');
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-03')).canHefsek, false, 'day 3 cannot hefsek (ashkenaz)');
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-06')).canHefsek, true, 'day 6 can hefsek (ashkenaz)');

    const stateWithTahara = {
        periods: [{ date: '2026-06-01', type: 'veset', isSunset: false, id: 'p1' }],
        hefseks: { '2026-06-06': true }, daily: {}, settings: baseSettings
    };
    const api2 = loadApp(stateWithTahara);
    const beinonit = api2.HalachaLogic.getStatus(api2.Utils.newDate('2026-06-30'));
    eq(beinonit.type, 'onah', 'day 30 is onah after tahara completed');
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-30')).type, 'nidda', 'day 30 without hefsek stays nidda');
})();

(function testHalachaSepharad() {
    const state = {
        periods: [{ date: '2026-06-01', type: 'veset', isSunset: false, id: 'p1' }],
        hefseks: {}, daily: {}, settings: { ...baseSettings, minhag: 'sepharad' }
    };
    const { HalachaLogic, Utils } = loadApp(state);
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-05')).canHefsek, true, 'day 5 can hefsek (sepharad)');
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-04')).canHefsek, false, 'day 4 cannot hefsek (sepharad)');
})();

(function testCleanDays() {
    const state = {
        periods: [{ date: '2026-06-01', type: 'veset', isSunset: false, id: 'p1' }],
        hefseks: { '2026-06-06': true }, daily: {}, settings: baseSettings
    };
    const { HalachaLogic, Utils } = loadApp(state);
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-06')).type, 'hefsek', 'hefsek day');
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-07')).type, 'naki', 'clean day 1');
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-07')).cleanCount, 1, 'clean day 1 count');
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-13')).cleanCount, 7, 'clean day 7 count');
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-14')).type, 'tevila', 'tevila night on day 8');
})();

(function testFertility() {
    const state = {
        periods: [
            { date: '2026-05-01', type: 'veset', isSunset: false, id: 'a' },
            { date: '2026-05-29', type: 'veset', isSunset: false, id: 'b' }
        ],
        hefseks: {}, daily: {}, settings: baseSettings
    };
    const { FertilityLogic, Utils } = loadApp(state);
    eq(FertilityLogic.getAvgCycleLength(), 28, 'avg cycle length = 28');
    const est = FertilityLogic.getEstimate();
    eq(Utils.fmt(est.nextPeriodEstimate), '2026-06-26', 'next period estimate');
    eq(Utils.fmt(est.ovulationDate), '2026-06-12', 'ovulation estimate');
    eq(Utils.fmt(est.fertileStart), '2026-06-07', 'fertile window start');
    eq(Utils.fmt(est.fertileEnd), '2026-06-13', 'fertile window end');
    assert(FertilityLogic.getFertility(Utils.newDate('2026-06-10')).isFertile, 'June 10 is fertile');
    assert(!FertilityLogic.getFertility(Utils.newDate('2026-06-20')).isFertile, 'June 20 is not fertile');
    assert(FertilityLogic.getFertility(Utils.newDate('2026-06-12')).isOvulation, 'June 12 is ovulation');
})();

(function testFertilityNoData() {
    const { FertilityLogic } = loadApp({ periods: [], hefseks: {}, daily: {}, settings: baseSettings });
    eq(FertilityLogic.getEstimate(), null, 'no periods -> null estimate');
    eq(FertilityLogic.getAvgCycleLength(), 28, 'no data -> default 28');
})();

(function testFertilityIrregularAndOutOfOrder() {
    const state = {
        periods: [
            { date: '2026-03-02', type: 'veset', isSunset: false, id: '3' },
            { date: '2026-01-01', type: 'veset', isSunset: false, id: '1' },
            { date: '2026-01-30', type: 'veset', isSunset: false, id: '2' },
            { date: '2026-01-15', type: 'spotting', isSunset: false, id: 's' }
        ],
        hefseks: {}, daily: {}, settings: baseSettings
    };
    const { FertilityLogic, Utils } = loadApp(state);
    eq(FertilityLogic.getAvgCycleLength(), 30, 'out-of-order vesets average 29 and 31 = 30');
    const est = FertilityLogic.getEstimate();
    eq(Utils.fmt(est.nextPeriodEstimate), '2026-04-01', 'latest chronological veset drives estimate');
})();

console.log(`\n${'='.repeat(50)}`);
console.log(`בדיקות עברו: ${passed} | נכשלו: ${failed}`);
if (failures.length) {
    console.log('\nכשלונות:');
    failures.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
} else {
    console.log('כל הבדיקות עברו בהצלחה ✓');
}
