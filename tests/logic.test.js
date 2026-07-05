/**
 * ערכת בדיקות ליבה - HalachaLogic, FertilityLogic, Utils
 * הרצה: node tests/logic.test.js
 *
 * הבדיקות טוענות את app.js בסביבת jsdom מדומה כדי לבדוק את הלוגיקה הטהורה
 * ללא תלות ב-DOM אמיתי. אין כאן פסיקת הלכה - רק אימות עקביות חישובית.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const APP_PATH = path.join(__dirname, '..', 'static', 'js', 'app.js');
const HTML_PATH = path.join(__dirname, '..', 'templates', 'index.html');

let passed = 0, failed = 0;
const failures = [];

function assert(cond, msg) {
    if (cond) { passed++; }
    else { failed++; failures.push(msg); }
}
function eq(actual, expected, msg) {
    assert(actual === expected, `${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// טעינת האפליקציה בסביבה מדומה עם state נתון
function loadApp(state) {
    const html = fs.readFileSync(HTML_PATH, 'utf8').replace(/\/static\/css\/main.css[^"]*/, 'about:blank');
    const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/' });
    const { window } = dom;
    window.localStorage.setItem('cycleflow_v61_python_pro', JSON.stringify(state));
    // מונע רישום service worker בבדיקות
    delete window.navigator.serviceWorker;
    const code = fs.readFileSync(APP_PATH, 'utf8');
    const api = {};
    window.eval(code + `
        window.__api = { Utils, HalachaLogic, FertilityLogic, State };
    `);
    return window.__api;
}

const baseSettings = { minhag: 'ashkenaz', cycle: 28, pinHash: null, theme: 'dark' };

// ---------- Utils ----------
(function testUtils() {
    const { Utils } = loadApp({ periods: [], hefseks: {}, daily: {}, settings: baseSettings });
    eq(Utils.diffDays(Utils.newDate('2026-01-10'), Utils.newDate('2026-01-01')), 9, 'diffDays basic');
    eq(Utils.fmt(Utils.addDays(Utils.newDate('2026-01-01'), 5)), '2026-01-06', 'addDays basic');
    // מבחן שנה מעוברת: 2024 מעוברת, פברואר 29 יום
    eq(Utils.fmt(Utils.addDays(Utils.newDate('2024-02-28'), 1)), '2024-02-29', 'leap year Feb 29');
    eq(Utils.fmt(Utils.addDays(Utils.newDate('2024-02-29'), 1)), '2024-03-01', 'leap year rollover');
    // מבחן מעבר חודש/שנה
    eq(Utils.fmt(Utils.addDays(Utils.newDate('2025-12-31'), 1)), '2026-01-01', 'year boundary');
})();

// ---------- HalachaLogic ----------
(function testHalacha() {
    // מחזור בודד ב-1 ליוני, מנהג אשכנז (5 ימי המתנה)
    const state = {
        periods: [{ date: '2026-06-01', type: 'veset', isSunset: false, id: 'p1' }],
        hefseks: {}, daily: {}, settings: baseSettings
    };
    const { HalachaLogic, Utils } = loadApp(state);

    // יום הוסת עצמו
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-01')).type, 'nidda', 'day 1 is nidda');

    // יום 3 - עדיין נידה בהמתנה (לפני 5 ימים)
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-03')).canHefsek, false, 'day 3 cannot hefsek (ashkenaz)');

    // יום 6 (5 ימים אחרי) - יכולה לעשות הפסק
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-06')).canHefsek, true, 'day 6 can hefsek (ashkenaz)');

    // עונה בינונית - יום 30 מתחילת הוסת, מוצג רק לאחר השלמת תהליך הטהרה
    // (אם לא נרשם הפסק, הסטטוס נשאר "נידה - ממתינה להפסק" וזו התנהגות נכונה)
    const stateWithTahara = {
        periods: [{ date: '2026-06-01', type: 'veset', isSunset: false, id: 'p1' }],
        hefseks: { '2026-06-06': true }, daily: {}, settings: baseSettings
    };
    const api2 = loadApp(stateWithTahara);
    const beinonit = api2.HalachaLogic.getStatus(api2.Utils.newDate('2026-06-30'));
    eq(beinonit.type, 'onah', 'day 30 is onah beinonit after tahara completed (was previously unreachable)');

    // ואימות שללא הפסק - נשאר נידה בהמתנה (התנהגות נכונה, לא באג)
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-30')).type, 'nidda', 'day 30 without hefsek stays nidda');
})();

(function testHalachaSepharad() {
    const state = {
        periods: [{ date: '2026-06-01', type: 'veset', isSunset: false, id: 'p1' }],
        hefseks: {}, daily: {}, settings: { ...baseSettings, minhag: 'sepharad' }
    };
    const { HalachaLogic, Utils } = loadApp(state);
    // ספרד = 4 ימי המתנה, כלומר יום 5 כבר אפשרי
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-05')).canHefsek, true, 'day 5 can hefsek (sepharad)');
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-04')).canHefsek, false, 'day 4 cannot hefsek (sepharad)');
})();

(function testCleanDays() {
    // הפסק טהרה ב-6 ליוני, ואז שבעה נקיים
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

// ---------- FertilityLogic ----------
(function testFertility() {
    // שני מחזורים במרווח 28 יום
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
    // וסת הבאה: 29 במאי + 28 = 26 ביוני
    eq(Utils.fmt(est.nextPeriodEstimate), '2026-06-26', 'next period estimate');
    // ביוץ: 14 יום לפני = 12 ביוני
    eq(Utils.fmt(est.ovulationDate), '2026-06-12', 'ovulation estimate');
    // חלון פוריות: 5 לפני ביוץ עד יום אחרי
    eq(Utils.fmt(est.fertileStart), '2026-06-07', 'fertile window start');
    eq(Utils.fmt(est.fertileEnd), '2026-06-13', 'fertile window end');
    // בדיקת isFertile
    assert(FertilityLogic.getFertility(Utils.newDate('2026-06-10')).isFertile, 'June 10 is fertile');
    assert(!FertilityLogic.getFertility(Utils.newDate('2026-06-20')).isFertile, 'June 20 is not fertile');
    assert(FertilityLogic.getFertility(Utils.newDate('2026-06-12')).isOvulation, 'June 12 is ovulation');
})();

(function testFertilityNoData() {
    // ללא מספיק נתונים - נופל לברירת מחדל
    const { FertilityLogic } = loadApp({ periods: [], hefseks: {}, daily: {}, settings: baseSettings });
    eq(FertilityLogic.getEstimate(), null, 'no periods -> null estimate');
    eq(FertilityLogic.getAvgCycleLength(), 28, 'no data -> default 28');
})();

(function testFertilityIrregular() {
    // מחזורים לא סדירים - ממוצע נכון, מסנן ערכים חריגים
    const state = {
        periods: [
            { date: '2026-01-01', type: 'veset', isSunset: false, id: '1' },
            { date: '2026-01-30', type: 'veset', isSunset: false, id: '2' }, // 29
            { date: '2026-03-02', type: 'veset', isSunset: false, id: '3' }  // 31
        ],
        hefseks: {}, daily: {}, settings: baseSettings
    };
    const { FertilityLogic } = loadApp(state);
    eq(FertilityLogic.getAvgCycleLength(), 30, 'avg of 29 and 31 = 30');
})();

// ---------- דוח ----------
console.log(`\n${'='.repeat(50)}`);
console.log(`בדיקות עברו: ${passed} | נכשלו: ${failed}`);
if (failures.length) {
    console.log('\nכשלונות:');
    failures.forEach((f) => console.log('  ✗ ' + f));
    process.exit(1);
} else {
    console.log('כל הבדיקות עברו בהצלחה ✓');
}
