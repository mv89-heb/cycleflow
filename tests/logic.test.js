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
    const calendarCode = fs.readFileSync(path.join(__dirname, '..', 'static', 'js', 'calendar-services.js'), 'utf8');
    window.eval(calendarCode);
    const code = fs.readFileSync(APP_PATH, 'utf8');
    window.eval(code + `
        window.__api = { Utils, HalachaLogic, FertilityLogic, State, UI, todayCivilDate, document: window.document, window };
    `);
    return window.__api;
}

const baseSettings = { minhag: 'ashkenaz', cycle: 28, pinHash: null, theme: 'dark' };


(function testTodayUsesIsraelCivilDateAcrossDeviceTimezone() {
    const { todayCivilDate, window } = loadApp({
        periods: [], hefseks: {}, daily: {}, settings: { ...baseSettings }
    });
    const instant = new window.Date('2026-11-16T22:30:00.000Z');
    eq(todayCivilDate(instant), '2026-11-17',
       'screens use the Israel civil date after midnight in Israel even if the device date is still previous day');
})();

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

(function testSettingsAndCheckboxChangesPersistAfterControlUpdates() {
    const { UI, State, document, window, Utils } = loadApp({
        periods: [], hefseks: {}, daily: {}, settings: { ...baseSettings }
    });
    UI.cacheDOM();
    UI.bindEvents();

    const city = document.getElementById('set_city');
    city.value = 'beit-shemesh';
    city.dispatchEvent(new window.Event('change', { bubbles: true }));
    eq(State.get().settings.cityId, 'beit-shemesh', 'city selection persists on change');

    UI.selectedDate = Utils.newDate('2026-06-10');
    const morning = document.getElementById('chk_morning');
    morning.checked = true;
    morning.dispatchEvent(new window.Event('change', { bubbles: true }));
    eq(State.get().daily['2026-06-10'].checks.morning, true, 'checkbox state persists after change');
})();

(function testHalacha() {
    const state = {
        periods: [{ date: '2026-06-01', type: 'veset', isSunset: false, id: 'p1' }],
        hefseks: {}, daily: {}, settings: baseSettings
    };
    const { HalachaLogic, Utils } = loadApp(state);
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-01')).type, 'nidda', 'day 1 is nidda');
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-04')).canHefsek, false, 'day 4 cannot hefsek under the five-day practice');
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-05')).canHefsek, true, 'hefsek may be performed on the fifth halachic day when bleeding has ceased');
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-06')).canHefsek, true, 'hefsek remains possible after the fifth day');

    const stateWithTahara = {
        periods: [{ date: '2026-06-01', type: 'veset', isSunset: false, id: 'p1' }],
        hefseks: { '2026-06-06': true }, daily: {}, settings: baseSettings
    };
    const api2 = loadApp(stateWithTahara);
    const beinonit = api2.HalachaLogic.getStatus(api2.Utils.newDate('2026-06-30'));
    eq(beinonit.type, 'onah', 'day 30 is onah after tahara completed');
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-30')).type, 'nidda', 'day 30 without hefsek stays nidda');
})();

(function testFailedPersistenceRollsBackInMemoryState() {
    const { State, window } = loadApp({
        periods: [], hefseks: {}, daily: {},
        settings: { ...baseSettings }
    });
    const before = JSON.stringify(State.get());
    Object.defineProperty(window.Storage.prototype, 'setItem', { configurable: true, value() { throw new window.DOMException('quota exceeded', 'QuotaExceededError'); } });
    const saved = State.update(s => { s.settings.theme = 'light'; });
    eq(saved, false, 'failed persistence returns false');
    eq(JSON.stringify(State.get()), before, 'failed persistence rolls back in-memory state');
})();

(function testHistoryDoesNotInterpretStoredIdsAsHtml() {
    const maliciousId = 'x"><img src=x onerror=alert(1)>';
    const { UI, document } = loadApp({
        periods: [{ date: '2026-06-01', type: 'veset', isSunset: false, id: maliciousId }],
        hefseks: {}, daily: {}, settings: baseSettings
    });
    UI.renderHistory();
    assert(document.querySelector('#history_list img') === null,
       'stored record IDs must never be parsed as HTML');
    const deleteButton = document.querySelector('#history_list button[data-action="deletePeriod"]');
    assert(deleteButton && deleteButton.dataset.id === maliciousId,
       'delete action must retain the exact stored identifier safely');
})();

(function testCalendarHandlesLegacyDailyNotesWithoutChecks() {
    const { UI, Utils, document } = loadApp({
        periods: [], hefseks: {},
        daily: { '2026-06-10': { note: 'הערה היסטורית ללא שדות בדיקה' } },
        settings: baseSettings
    });
    UI.navDate = Utils.newDate('2026-06-01');
    let renderError = null;
    try { UI.renderCalendar(); } catch (error) { renderError = error; }
    assert(renderError === null, 'calendar must render legacy daily notes without a checks object');
    assert(document.querySelector('#cal_grid .cal-day'), 'calendar days should render for legacy daily notes');
    assert(document.querySelector('#cal_grid .day-hebrew')?.textContent, 'calendar cells should include Hebrew dates');
})();

(function testHalachaUsesVesetChronology() {
    const state = {
        periods: [
            { date: '2026-06-01', type: 'veset', isSunset: false, id: 'v1' },
            { date: '2026-06-04', type: 'spotting', isSunset: false, id: 's1' },
            { date: '2026-06-20', type: 'veset', isSunset: false, id: 'v2' }
        ],
        hefseks: { '2026-06-06': true }, daily: {}, settings: baseSettings
    };
    const { HalachaLogic, Utils } = loadApp(state);
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-05')).type, 'nidda',
       'spotting does not replace the latest veset for an earlier date');
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-07')).type, 'naki',
       'clean-day calculation uses the hefsek after the preceding veset');
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-21')).type, 'nidda',
       'a later veset starts a new status period');
})();

(function testAfterSunsetOnsetUsesNextHebrewDate() {
    const state = {
        periods: [{ date: '2026-06-01', type: 'veset', sunsetRelation: 'after', isSunset: true, id: 'after-sunset' }],
        hefseks: {}, hefsekMeta: {}, daily: {}, settings: { ...baseSettings }
    };
    const { HalachaLogic, Utils } = loadApp(state);
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-01')).type, 'regular',
       'after-sunset onset is not applied to the preceding daytime Hebrew date');
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-02')).type, 'nidda',
       'after-sunset onset begins on the next Hebrew-date calendar label');
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-02')).text, 'וסת (יום 1)',
       'the effective Hebrew-date label is also recognized as cycle day one');
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-07')).canHefsek, true,
       'minimum-wait day count is based on the effective Hebrew-date label');
})();

(function testCycleStatisticsUseEffectiveHebrewDates() {
    const state = {
        periods: [
            { date: '2026-06-01', type: 'veset', sunsetRelation: 'after', isSunset: true, id: 'first' },
            { date: '2026-06-30', type: 'veset', sunsetRelation: 'before', isSunset: false, id: 'second' }
        ],
        hefseks: {}, daily: {}, settings: { ...baseSettings }
    };
    const { FertilityLogic, Utils } = loadApp(state);
    eq(FertilityLogic.getAvgCycleLength(), 28,
       'cycle length is measured between effective Hebrew-date labels, not raw civil entry dates');
    eq(Utils.fmt(FertilityLogic.getEstimate().nextPeriodEstimate), '2026-07-28',
       'future estimates start from the effective Hebrew-date label');
})();

(function testAfterSunsetHefsekIsNotSilentlyAccepted() {
    const state = {
        periods: [{ date: '2026-06-01', type: 'veset', sunsetRelation: 'before', isSunset: false, id: 'before' }],
        hefseks: { '2026-06-06': true },
        hefsekMeta: { '2026-06-06': { sunsetRelation: 'after', isSunset: true, cityId: null } },
        daily: {}, settings: { ...baseSettings }
    };
    const { HalachaLogic, Utils } = loadApp(state);
    const status = HalachaLogic.getStatus(Utils.newDate('2026-06-07'));
    eq(status.type, 'nidda', 'after-sunset hefsek remains pending review instead of starting clean days');
    eq(status.canHefsek, true, 'the calendar does not treat the after-sunset record as a completed hefsek');
})();

(function testUnknownHefsekTimeDoesNotUseLaterCitySetting() {
    const state = {
        periods: [{ date: '2026-11-10', type: 'veset', sunsetRelation: 'before', isSunset: false, id: 'before' }],
        hefseks: { '2026-11-15': true },
        hefsekMeta: { '2026-11-15': { eventTime: '16:30', cityId: null } },
        daily: {}, settings: { ...baseSettings, cityId: 'beit-shemesh' }
    };
    const { HalachaLogic, Utils } = loadApp(state);
    const status = HalachaLogic.getStatus(Utils.newDate('2026-11-16'));
    eq(status.type, 'nidda',
       'a later selected city must not retroactively classify a hefsek recorded without a city');
    eq(status.canHefsek, true, 'an unknown-time-relation hefsek remains pending review');
})();

(function testOnahStatusUsesEstimatedDayNightFromOnset() {
    const dayState = {
        periods: [{ date: '2026-11-16', type: 'veset', eventTime: '10:00', cityId: 'beit-shemesh', id: 'day-onset' }],
        hefseks: { '2026-11-22': true },
        hefsekMeta: { '2026-11-22': { eventTime: '15:00', cityId: 'beit-shemesh' } },
        daily: {}, settings: { ...baseSettings, cityId: 'beit-shemesh' }
    };
    const dayApi = loadApp(dayState);
    const dayStatus = dayApi.HalachaLogic.getStatus(dayApi.Utils.newDate('2026-12-15'));
    assert(dayStatus.text.includes('עונת יום (אומדן)'),
       'onah beinonit uses the estimated daytime onah of the original onset');

    const nightState = {
        periods: [{ date: '2026-11-16', type: 'veset', eventTime: '18:00', cityId: 'beit-shemesh', id: 'night-onset' }],
        hefseks: { '2026-11-23': true },
        hefsekMeta: { '2026-11-23': { eventTime: '15:00', cityId: 'beit-shemesh' } },
        daily: {}, settings: { ...baseSettings, cityId: 'beit-shemesh' }
    };
    const nightApi = loadApp(nightState);
    const nightStatus = nightApi.HalachaLogic.getStatus(nightApi.Utils.newDate('2026-12-16'));
    assert(nightStatus.text.includes('עונת לילה (אומדן)'),
       'after-sunset onset shifts to the next Hebrew date and uses the estimated night onah');
})();

(function testLongCycleExemptionReturnsAfterOneOrTwoShortCycles() {
    const dates = ['2026-01-01', '2026-02-02', '2026-03-06', '2026-04-07', '2026-05-01', '2026-06-02'];
    const state = {
        periods: dates.map((date, index) => ({
            date, type: 'veset', isSunset: false, eventTime: '10:00',
            cityId: 'beit-shemesh', id: `cycle-${index}`
        })),
        hefseks: { '2026-06-07': true },
        hefsekMeta: { '2026-06-07': { eventTime: '15:00', cityId: 'beit-shemesh' } },
        daily: {}, settings: { ...baseSettings, cityId: 'beit-shemesh' }
    };
    const api = loadApp(state);
    eq(api.HalachaLogic.getStatus(api.Utils.newDate('2026-07-01')).type, 'pending-tevila',
       'after one shorter cycle, a subsequent long cycle restores the exemption immediately');
})();

(function testUnknownOnsetRelationBlocksAutomaticOnot() {
    const state = {
        periods: [{ date: '2026-06-01', type: 'veset', id: 'unknown-onset' }],
        hefseks: {}, daily: {}, settings: { ...baseSettings }
    };
    const api = loadApp(state);
    eq(api.HalachaLogic.getStatus(api.Utils.newDate('2026-06-30')).type, 'needs-review',
       'unknown before/after-sunset relation blocks automatic halachic-date calculations');
    eq(api.FertilityLogic.getEstimate(), null,
       'fertility estimates do not silently use an uncertain event date');
})();

(function testYomHachodeshAndStandardHaflagah() {
    const state = {
        periods: [
            { date: '2026-06-01', type: 'veset', isSunset: false, eventTime: '10:00', cityId: 'beit-shemesh', id: 'p1' },
            { date: '2026-06-29', type: 'veset', isSunset: false, eventTime: '10:00', cityId: 'beit-shemesh', id: 'p2' }
        ],
        hefseks: { '2026-07-04': true },
        hefsekMeta: { '2026-07-04': { eventTime: '15:00', cityId: 'beit-shemesh' } },
        daily: {}, settings: { ...baseSettings, cityId: 'beit-shemesh' }
    };
    const api = loadApp(state);
    const hachodeshDate = api.window.CycleFlowCalendar.getNextYomHachodeshDate('2026-06-29');
    const hachodeshStatus = api.HalachaLogic.getStatus(api.Utils.newDate(hachodeshDate));
    eq(hachodeshStatus.type, 'onah', 'the next Hebrew-month date is displayed as an onah');
    assert(hachodeshStatus.text.includes('וסת החודש'), 'the status identifies yom hachodesh');

    const haflagahStatus = api.HalachaLogic.getStatus(api.Utils.newDate('2026-07-27'));
    eq(haflagahStatus.type, 'onah', 'the same interval from the most recent flow is displayed');
    assert(haflagahStatus.text.includes('וסת הפלגה (28)'), 'standard haflagah uses the interval between the two most recent flows');
})();

(function testChabadDoesNotUseStandardDayIntervalForHaflagah() {
    const state = {
        periods: [
            { date: '2026-06-01', type: 'veset', isSunset: false, eventTime: '10:00', cityId: 'beit-shemesh', id: 'p1' },
            { date: '2026-06-29', type: 'veset', isSunset: false, eventTime: '10:00', cityId: 'beit-shemesh', id: 'p2' }
        ],
        hefseks: { '2026-07-04': true },
        hefsekMeta: { '2026-07-04': { eventTime: '15:00', cityId: 'beit-shemesh' } },
        daily: {}, settings: { ...baseSettings, minhag: 'chabad', cityId: 'beit-shemesh' }
    };
    const api = loadApp(state);
    const status = api.HalachaLogic.getStatus(api.Utils.newDate('2026-07-27'));
    assert(!status.text.includes('וסת הפלגה'),
       'Chabad haflagah is not approximated with the non-Chabad day-interval formula');
})();

(function testLongCycleExemptionAfterThreeLongIntervals() {
    const dates = ['2026-01-01', '2026-02-02', '2026-03-06', '2026-04-07'];
    const state = {
        periods: dates.map((date, index) => ({
            date, type: 'veset', isSunset: false, eventTime: '10:00',
            cityId: 'beit-shemesh', id: `long-${index}`
        })),
        hefseks: { '2026-04-12': true },
        hefsekMeta: { '2026-04-12': { eventTime: '15:00', cityId: 'beit-shemesh' } },
        daily: {}, settings: { ...baseSettings, cityId: 'beit-shemesh' }
    };
    const api = loadApp(state);
    const status = api.HalachaLogic.getStatus(api.Utils.newDate('2026-05-06'));
    eq(status.type, 'pending-tevila',
       'after three consecutive 32-day-or-longer intervals, day 30 and yom hachodesh are exempt in this source profile');
})();

(function testFixedVesetHachodeshPatternDetection() {
    const base = loadApp({ periods: [], hefseks: {}, daily: {}, settings: { ...baseSettings, cityId: 'beit-shemesh' } });
    const calendar = base.window.CycleFlowCalendar;
    const dates = ['2026-01-01'];
    dates.push(calendar.getNextYomHachodeshDate(dates[0]));
    dates.push(calendar.getNextYomHachodeshDate(dates[1]));
    const state = {
        periods: dates.map((date, index) => ({
            date, type: 'veset', eventTime: '10:00', cityId: 'beit-shemesh',
            isSunset: false, id: `month-${index}`
        })),
        hefseks: {}, daily: {}, settings: { ...baseSettings, cityId: 'beit-shemesh' }
    };
    const api = loadApp(state);
    const candidates = api.HalachaLogic.getFixedVesetCandidates();
    assert(candidates.some(candidate => candidate.type === 'hachodesh'),
       'three consecutive same-Hebrew-day, same-onah flows are detected as a possible fixed yom hachodesh');
})();

(function testFixedHaflagahPatternDetectionAndChabadGuard() {
    const dates = ['2026-06-01', '2026-06-30', '2026-07-28', '2026-08-25'];
    const periods = dates.map((date, index) => ({
        date, type: 'veset', eventTime: index === 0 ? '18:00' : '10:00',
        cityId: 'beit-shemesh', isSunset: false, id: `interval-${index}`
    }));
    const standardApi = loadApp({
        periods, hefseks: {}, daily: {},
        settings: { ...baseSettings, cityId: 'beit-shemesh' }
    });
    assert(standardApi.HalachaLogic.getFixedVesetCandidates().some(candidate =>
        candidate.type === 'haflagah' && candidate.intervalDays === 28
    ), 'three equal intervals with the last three on the same onah are detected');

    const chabadApi = loadApp({
        periods, hefseks: {}, daily: {},
        settings: { ...baseSettings, minhag: 'chabad', cityId: 'beit-shemesh' }
    });
    assert(!chabadApi.HalachaLogic.getFixedVesetCandidates().some(candidate => candidate.type === 'haflagah'),
       'the standard day-interval fixed-haflagah detector is not used for Chabad');
})();

(function testFixedVesetRequiresKnownOnah() {
    const base = loadApp({ periods: [], hefseks: {}, daily: {}, settings: { ...baseSettings } });
    const calendar = base.window.CycleFlowCalendar;
    const dates = ['2026-01-01'];
    dates.push(calendar.getNextYomHachodeshDate(dates[0]));
    dates.push(calendar.getNextYomHachodeshDate(dates[1]));
    const api = loadApp({
        periods: dates.map((date, index) => ({ date, type: 'veset', isSunset: false, id: `unknown-${index}` })),
        hefseks: {}, daily: {}, settings: { ...baseSettings }
    });
    eq(api.HalachaLogic.getFixedVesetCandidates().length, 0,
       'a repeated date pattern without known day/night onah is not promoted to a fixed-pattern candidate');
})();

(function testHalachaSepharad() {
    const state = {
        periods: [{ date: '2026-06-01', type: 'veset', isSunset: false, id: 'p1' }],
        hefseks: {}, daily: {}, settings: { ...baseSettings, minhag: 'sepharad' }
    };
    const { HalachaLogic, Utils } = loadApp(state);
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-05')).canHefsek, true, 'day 5 can hefsek under the five-day baseline regardless of the broad Sephardi label');
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-04')).canHefsek, false, 'day 4 cannot hefsek (sepharad)');
})();

(function testMinimumWaitProfilesRequireTheirCorrectStartReference() {
    const fourDayState = {
        periods: [{
            date: '2026-06-01', type: 'veset', isSunset: false, eventTime: '10:00', cityId: 'beit-shemesh', id: 'four-day',
            lastRelations: { date: '2026-05-30', eventTime: '15:00', cityId: 'beit-shemesh' }
        }],
        hefseks: {}, hefsekMeta: {}, daily: {},
        settings: { ...baseSettings, minimumWaitMode: 'four_from_last_relations', cityId: 'beit-shemesh' }
    };
    const fourDayApi = loadApp(fourDayState);
    eq(fourDayApi.HalachaLogic.getStatus(fourDayApi.Utils.newDate('2026-06-01')).canHefsek, false,
       'four-day wait does not finish before the fourth day from last relations');
    eq(fourDayApi.HalachaLogic.getStatus(fourDayApi.Utils.newDate('2026-06-02')).canHefsek, true,
       'four-day wait permits a hefsek on the fourth halachic day from last relations');

    const missingDataState = {
        periods: [{ date: '2026-06-01', type: 'veset', isSunset: false, id: 'missing-last-relations' }],
        hefseks: {}, daily: {},
        settings: { ...baseSettings, minimumWaitMode: 'four_from_last_relations' }
    };
    const missingApi = loadApp(missingDataState);
    eq(missingApi.HalachaLogic.getStatus(missingApi.Utils.newDate('2026-06-05')).type, 'needs-review',
       'four-day profile never guesses the missing last-relations reference');
})();

(function testOnahBeinonitProfileDefaultsAndCustoms() {
    const state = {
        periods: [{ date: '2026-06-01', type: 'veset', isSunset: false, id: 'onah-profile' }],
        hefseks: { '2026-06-06': true }, daily: {}, settings: { ...baseSettings }
    };
    const { HalachaLogic, Utils } = loadApp(state);
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-30')).type, 'onah',
       'day 30 is the baseline onah beinonit');
    const day31Status = HalachaLogic.getStatus(Utils.newDate('2026-07-01'));
    assert(!day31Status.text.includes('עונה בינונית (31)'),
       'day 31 is not silently enabled in the default profile, even if another onah falls on the same date');

    const customState = {
        ...state,
        settings: { ...baseSettings, onahBeinonitMode: 'day30_plus31_onah' }
    };
    const customApi = loadApp(customState);
    eq(customApi.HalachaLogic.getStatus(customApi.Utils.newDate('2026-07-01')).type, 'onah',
       'day 31 is included only when the selected custom profile requests it');

    const fullDayState = {
        ...state,
        settings: { ...baseSettings, onahBeinonitMode: 'day30_full_day' }
    };
    const fullDayApi = loadApp(fullDayState);
    assert(fullDayApi.HalachaLogic.getStatus(fullDayApi.Utils.newDate('2026-06-30')).text.includes('כל היממה'),
       'the 24-hour custom is displayed only when explicitly selected');
})();

(function testPrematureHefsekDoesNotStartCleanDays() {
    const state = {
        periods: [{ date: '2026-06-01', type: 'veset', isSunset: false, id: 'five-day' }],
        hefseks: { '2026-06-04': true }, daily: {}, settings: { ...baseSettings }
    };
    const { HalachaLogic, Utils } = loadApp(state);
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-04')).type, 'nidda',
       'a hefsek entered before the fifth halachic day is not accepted');
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-05')).type, 'nidda',
       'an early hefsek does not start the seven clean days on the next date');
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-05')).canHefsek, true,
       'the user can perform a valid hefsek on the fifth halachic day');
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
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-15')).type, 'pending-tevila',
       'app must not assume immersion occurred after the estimated immersion night');
})();

(function testExplicitImmersionReport() {
    const state = {
        periods: [{ date: '2026-06-01', type: 'veset', isSunset: false, id: 'p1' }],
        hefseks: { '2026-06-06': true },
        tevilot: { '2026-06-14': true },
        daily: {}, settings: baseSettings
    };
    const { HalachaLogic, Utils } = loadApp(state);
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-14')).type, 'tevila-done',
       'immersion night is marked only after explicit user report');
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-15')).text, 'לאחר טבילה מדווחת',
       'later status must be based on the explicit immersion report');
})();

(function testTevilaPanelCanToggleTheReport() {
    const { UI, State, Utils, HalachaLogic } = loadApp({
        periods: [{ date: '2026-06-01', type: 'veset', isSunset: false, id: 'p1' }],
        hefseks: { '2026-06-06': true }, tevilot: {}, daily: {}, settings: baseSettings
    });
    UI.selectedDate = Utils.newDate('2026-06-15');
    UI.actions.toggleTevilaPanel.call(UI);
    assert(State.get().tevilot['2026-06-15'] === true,
       'day panel action records the actual reported immersion date');
    eq(HalachaLogic.getStatus(Utils.newDate('2026-06-15')).text, 'לאחר טבילה מדווחת',
       'status changes only after the actual immersion date is recorded');
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
