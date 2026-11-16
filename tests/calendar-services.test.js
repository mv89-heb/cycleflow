/* Regression tests for local Hebrew date and sunset calculations. */
require('../static/js/calendar-services.js');
const calendar = globalThis.CycleFlowCalendar;
const assert = require('node:assert/strict');

assert(calendar, 'calendar services must be exposed locally');
assert.equal(calendar.CITIES.length >= 10, true, 'manual Israeli city list is available');
assert.match(calendar.formatHebrewDate('2026-11-16'), /.+/, 'Intl Hebrew calendar should format a civil date');
assert.match(calendar.formatHebrewMonth('2026-11-16'), /.+/, 'Intl Hebrew calendar should format Hebrew month and year');
assert.notEqual(
  calendar.formatHebrewDate('2026-11-16'),
  calendar.formatHebrewDate('2026-11-16', { afterSunset: true }),
  'Hebrew date changes after sunset'
);
assert.equal(calendar.addCivilDays('2024-02-28', 1), '2024-02-29', 'leap day arithmetic');
assert.equal(calendar.addCivilDays('2024-02-29', 1), '2024-03-01', 'leap day rollover');

const solarTimes = calendar.getSolarTimes('2026-11-16', 'beit-shemesh');
assert(solarTimes && /^([01]\d|2[0-3]):[0-5]\d$/.test(solarTimes.sunrise), 'sunrise estimate is a local HH:mm time');
assert(solarTimes && /^([01]\d|2[0-3]):[0-5]\d$/.test(solarTimes.sunset), 'solar times include sunset');
const shiftTime = (value, delta) => {
  const [hour, minute] = value.split(':').map(Number);
  const total = hour * 60 + minute + delta;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};
assert.equal(calendar.resolveEventOnah({
  date: '2026-11-16', eventTime: shiftTime(solarTimes.sunrise, -1), cityId: 'beit-shemesh'
}), 'night', 'one minute before sunrise belongs to the estimated night onah');
assert.equal(calendar.resolveEventOnah({
  date: '2026-11-16', eventTime: solarTimes.sunrise, cityId: 'beit-shemesh'
}), 'day', 'sunrise starts the estimated day onah');
assert.equal(calendar.resolveEventOnah({
  date: '2026-11-16', eventTime: shiftTime(solarTimes.sunset, -1), cityId: 'beit-shemesh'
}), 'day', 'one minute before sunset remains in the estimated day onah');
assert.equal(calendar.resolveEventOnah({
  date: '2026-11-16', eventTime: solarTimes.sunset, cityId: 'beit-shemesh'
}), 'night', 'sunset starts the estimated night onah');
assert.equal(calendar.resolveEventOnah({
  date: '2026-11-16', eventTime: '12:00', cityId: null
}), 'unknown', 'onah remains unknown without the event city');

let ordinaryMonthDay = null;
let day30Rollover = null;
for (let cursor = '2026-01-01'; cursor <= '2027-01-01'; cursor = calendar.addCivilDays(cursor, 1)) {
  const parts = calendar.getHebrewDateParts(cursor);
  if (parts && parts.day === 15 && !ordinaryMonthDay) ordinaryMonthDay = cursor;
  if (parts && parts.day === 30 && !day30Rollover) {
    const target = calendar.getNextYomHachodeshDate(cursor);
    const targetParts = target && calendar.getHebrewDateParts(target);
    if (targetParts && targetParts.day === 1) day30Rollover = { source: cursor, target };
  }
}
assert(ordinaryMonthDay, 'Hebrew calendar parts should identify day 15');
const ordinaryTarget = calendar.getNextYomHachodeshDate(ordinaryMonthDay);
assert.equal(calendar.getHebrewDateParts(ordinaryTarget).day, 15,
  'yom hachodesh preserves the Hebrew day number in the next month');
assert(day30Rollover, 'the test year should include a 30-day month followed by a 29-day month');
assert.equal(calendar.getHebrewDateParts(day30Rollover.target).day, 1,
  'day 30 followed by a 29-day month rolls to the first of the following month in this source profile');

const israelClock = calendar.getIsraelClock(new Date('2026-11-16T20:00:00Z'));
assert.deepEqual(israelClock, { date: '2026-11-16', time: '22:00' },
  'direct event recording uses Israel-local civil date and time independent of device timezone');

let firstOfMonthWith30DayNextMonth = null;
for (let cursor = '2026-01-01'; cursor <= '2027-01-01'; cursor = calendar.addCivilDays(cursor, 1)) {
  const parts = calendar.getHebrewDateParts(cursor);
  if (parts && parts.day === 1) {
    const target = calendar.getNextYomHachodeshDate(cursor, 30);
    const targetParts = target && calendar.getHebrewDateParts(target);
    if (targetParts && targetParts.day === 30) {
      firstOfMonthWith30DayNextMonth = { source: cursor, target };
      break;
    }
  }
}
assert(firstOfMonthWith30DayNextMonth,
  'a fixed day-30 pattern continues to day 30 of a following 30-day month instead of drifting to day 1');

let adarOneDayOne = null;
for (let cursor = '2023-09-01'; cursor <= '2024-10-15'; cursor = calendar.addCivilDays(cursor, 1)) {
  const parts = calendar.getHebrewDateParts(cursor);
  if (parts && parts.month === 'Adar I' && parts.day === 1) {
    adarOneDayOne = cursor;
    break;
  }
}
assert(adarOneDayOne, 'the Hebrew leap-year calendar exposes Adar I');
const adarTwoDayOne = calendar.getNextYomHachodeshDate(adarOneDayOne, 1);
const adarTwoParts = adarTwoDayOne && calendar.getHebrewDateParts(adarTwoDayOne);
assert(adarTwoParts && adarTwoParts.month === 'Adar II' && adarTwoParts.day === 1,
  'the next Hebrew month after Adar I is Adar II, not a collapsed generic Adar');
const nisanDayOne = calendar.getNextYomHachodeshDate(adarTwoDayOne, 1);
const nisanParts = nisanDayOne && calendar.getHebrewDateParts(nisanDayOne);
assert(nisanParts && nisanParts.month === 'Nisan' && nisanParts.day === 1,
  'the month after Adar II is Nisan');

const sunset = calendar.getSunset('2026-11-16', 'beit-shemesh');
assert(sunset && /^([01]\d|2[0-3]):[0-5]\d$/.test(sunset.time), 'sunset estimate is a local HH:mm time');
const before = sunset.time === '00:00' ? '00:01' : '00:00';
const after = sunset.time === '23:59' ? '23:58' : '23:59';
assert.equal(calendar.resolveEventRelation({ date: '2026-11-16', eventTime: before, cityId: 'beit-shemesh' }), 'before');
assert.equal(calendar.resolveEventRelation({ date: '2026-11-16', eventTime: after, cityId: 'beit-shemesh' }), 'after');
assert.equal(calendar.resolveEventRelation({ date: '2026-11-16', eventTime: '18:00', isSunset: true }), 'after',
  'manual legacy sunset choice remains available when no city is selected');
assert.equal(calendar.resolveEventRelation({ date: '2026-11-16' }), 'unknown',
  'missing historical event time must remain unknown');
assert.equal(calendar.resolveEventRelation({ date: '2026-11-16', isSunset: false }), 'before',
  'an explicit unchecked after-sunset flag preserves the recorded before-sunset choice');
assert.equal(calendar.resolveEventRelation({ date: '2026-11-16', isSunset: null }), 'unknown',
  'missing sunset relation remains unknown');
const timedBeforeSunset = {
  date: '2026-11-16',
  eventTime: shiftTime(calendar.getSunset('2026-11-16', 'beit-shemesh').time, -1),
  cityId: 'beit-shemesh'
};
const estimatedRelationInfo = calendar.getEventDateInfo(timedBeforeSunset);
assert.equal(estimatedRelationInfo.dateConfidence, 'astronomical-estimate',
  'an event date inferred by comparing its time to approximate sunset is not labeled as manually recorded');
assert.equal(estimatedRelationInfo.relationSource, 'event-time-compared-with-approximate-sunset',
  'the source of a sunset relation inferred from a time is explicit');
const manuallyRecordedRelationInfo = calendar.getEventDateInfo({
  date: '2026-11-16', sunsetRelation: 'after'
});
assert.equal(manuallyRecordedRelationInfo.dateConfidence, 'recorded',
  'an explicitly recorded sunset relation is distinguished from an astronomical estimate');
assert.equal(manuallyRecordedRelationInfo.relationSource, 'explicit-recorded-sunset-relation',
  'explicitly recorded relation provenance is retained');
assert.equal(calendar.getEventDateInfo(null), null,
  'invalid event records return no date information instead of throwing');
assert.equal(calendar.getEventDateInfo({
  date: '2026-11-16', sunsetRelation: 'after'
}).effectiveDate, '2026-11-17', 'after-sunset event belongs to the next Hebrew-date civil label');
assert.equal(calendar.getEventDateInfo({
  date: '2026-11-16', sunsetRelation: 'before'
}).effectiveDate, '2026-11-16', 'before-sunset event keeps the same Hebrew-date civil label');
assert.equal(calendar.resolveEventRelation({ date: '2026-11-16', eventTime: '17:00', cityId: null, sunsetRelation: 'before', isSunset: false }, 'beit-shemesh'), 'before',
  'a later settings city must not rewrite an event recorded without a city');
assert.equal(calendar.resolveEventRelation({
  date: '2026-11-16', eventTime: '23:59'
}, 'beit-shemesh'), 'unknown',
  'a current settings city must not be borrowed for a historical event that has no recorded city or sunset relation');
const historicalCityInfo = calendar.getEventDateInfo({
  date: '2026-11-16', eventTime: '23:59',
  ruleContext: { cityId: 'beit-shemesh' }
}, 'jerusalem');
assert.equal(historicalCityInfo.dateConfidence, 'astronomical-estimate',
  'a city saved in the event rule-context can be used for its historical sunset estimate');
assert.equal(historicalCityInfo.relationSource, 'event-time-compared-with-approximate-sunset',
  'the saved event city, rather than the current profile, supplies the historical estimate');
assert.equal(calendar.getSunset('2026-11-16', 'other'), null, 'other city never fabricates a sunset');

const dstBefore = calendar.getSunset('2026-03-26', 'jerusalem');
const dstAfter = calendar.getSunset('2026-03-27', 'jerusalem');
const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
const dstShift = minutes(dstAfter.time) - minutes(dstBefore.time);
assert(dstShift >= 45 && dstShift <= 75, 'Israel DST transition is reflected in local sunset time');


const israelFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
const israelParts = date => Object.fromEntries(israelFormatter.formatToParts(date).map(part => [part.type, part.value]));
const currentInstant = new Date('2026-11-16T22:30:00.000Z');
const currentParts = israelParts(currentInstant);
const expectedIsraelDate = `${currentParts.year}-${currentParts.month}-${currentParts.day}`;
assert.equal(calendar.getIsraelCivilDate(currentInstant), expectedIsraelDate,
  'current Hebrew date must derive its civil date from Israel time, not the device timezone');
assert.equal(calendar.getIsraelCivilDate(new Date('invalid')), '', 'invalid current instant returns an empty date');
assert.match(calendar.getCurrentHebrewDate(currentInstant, 'beit-shemesh'), /.+/,
  'current Hebrew date remains available for an instant near the Israel civil-day boundary');


const elulEnd = calendar.getHebrewDateParts('2024-10-02');
const roshHashanah = calendar.getHebrewDateParts('2024-10-03');
assert.deepEqual(
  { day: elulEnd.day, month: elulEnd.month, year: elulEnd.year },
  { day: 29, month: 'Elul', year: '5784' },
  'the last day of Elul 5784 is identified before the Hebrew year rollover'
);
assert.deepEqual(
  { day: roshHashanah.day, month: roshHashanah.month, year: roshHashanah.year },
  { day: 1, month: 'Tishri', year: '5785' },
  'Rosh Hashanah advances the Hebrew year and starts Tishrei 5785'
);
const nextHebrewYear = calendar.getNextYomHachodeshDate('2024-10-02', 1);
assert.deepEqual(
  calendar.getHebrewDateParts(nextHebrewYear),
  { day: 1, month: 'Tishri', year: '5785' },
  'a fixed day-one monthly date advances correctly across the Hebrew year boundary'
);
const followingRoshHashanah = calendar.getHebrewDateParts('2025-09-23');
assert.deepEqual(
  { day: followingRoshHashanah.day, month: followingRoshHashanah.month, year: followingRoshHashanah.year },
  { day: 1, month: 'Tishri', year: '5786' },
  'the next Hebrew year boundary is also represented correctly'
);

console.log('Local Hebrew calendar and sunset regression tests passed.');
