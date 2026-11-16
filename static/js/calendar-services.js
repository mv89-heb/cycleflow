/* Local-only Hebrew calendar and approximate sunset utilities.
 * No GPS, cookies, analytics, CDN, or remote requests.
 * Sunset is an astronomical estimate; local horizon/elevation may differ.
 */
(() => {
  'use strict';

  const TIME_ZONE = 'Asia/Jerusalem';
  const CITIES = Object.freeze([
    { id: 'beit-shemesh', name: 'בית שמש', lat: 31.745, lon: 34.988 },
    { id: 'jerusalem', name: 'ירושלים', lat: 31.7683, lon: 35.2137 },
    { id: 'bnei-brak', name: 'בני ברק', lat: 32.0809, lon: 34.8338 },
    { id: 'tel-aviv', name: 'תל אביב–יפו', lat: 32.0853, lon: 34.7818 },
    { id: 'haifa', name: 'חיפה', lat: 32.794, lon: 34.9896 },
    { id: 'ashdod', name: 'אשדוד', lat: 31.8044, lon: 34.6553 },
    { id: 'ashkelon', name: 'אשקלון', lat: 31.6688, lon: 34.5743 },
    { id: 'netanya', name: 'נתניה', lat: 32.3215, lon: 34.8532 },
    { id: 'petah-tikva', name: 'פתח תקווה', lat: 32.084, lon: 34.8878 },
    { id: 'modiin', name: 'מודיעין', lat: 31.8969, lon: 35.0104 },
    { id: 'other', name: 'יישוב אחר – ללא חישוב שקיעה', lat: null, lon: null }
  ]);

  const cityById = id => CITIES.find(city => city.id === id) || null;
  const validDate = value => {
    if (value instanceof Date) return !Number.isNaN(value.getTime());
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = new Date(value + 'T12:00:00Z');
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
  };
  const dateParts = value => {
    if (value instanceof Date) return { year: value.getFullYear(), month: value.getMonth() + 1, day: value.getDate() };
    const [year, month, day] = value.split('-').map(Number);
    return { year, month, day };
  };
  const normalizeDegrees = value => ((value % 360) + 360) % 360;
  const toRadians = value => value * Math.PI / 180;
  const toDegrees = value => value * 180 / Math.PI;

  function solarEventUtc(date, city, isSunrise = false) {
    if (!validDate(date) || !city || !Number.isFinite(city.lat) || !Number.isFinite(city.lon)) return null;
    const { year, month, day } = dateParts(date);
    const n = Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86400000);
    const longitudeHour = city.lon / 15;
    const t = n + (((isSunrise ? 6 : 18) - longitudeHour) / 24);
    const meanAnomaly = 0.9856 * t - 3.289;
    const trueLongitude = normalizeDegrees(meanAnomaly + 1.916 * Math.sin(toRadians(meanAnomaly)) +
      0.020 * Math.sin(2 * toRadians(meanAnomaly)) + 282.634);
    let rightAscension = normalizeDegrees(toDegrees(Math.atan(0.91764 * Math.tan(toRadians(trueLongitude)))));
    rightAscension += Math.floor(trueLongitude / 90) * 90 - Math.floor(rightAscension / 90) * 90;
    rightAscension /= 15;
    const sinDeclination = 0.39782 * Math.sin(toRadians(trueLongitude));
    const cosDeclination = Math.cos(Math.asin(sinDeclination));
    const cosHourAngle = (Math.cos(toRadians(90.833)) - sinDeclination * Math.sin(toRadians(city.lat))) /
      (cosDeclination * Math.cos(toRadians(city.lat)));
    if (cosHourAngle < -1 || cosHourAngle > 1) return null;
    const hourAngleDegrees = toDegrees(Math.acos(cosHourAngle));
    const hourAngle = (isSunrise ? 360 - hourAngleDegrees : hourAngleDegrees) / 15;
    const localMeanTime = hourAngle + rightAscension - 0.06571 * t - 6.622;
    const utcHour = ((localMeanTime - longitudeHour) % 24 + 24) % 24;
    const utcMinutes = Math.round(utcHour * 60);
    return new Date(Date.UTC(year, month - 1, day, 0, utcMinutes));
  }

  function formatTimeInZone(date, timeZone = TIME_ZONE) {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).format(date);
  }

  function getSunset(date, cityId) {
    const city = cityById(cityId);
    const instant = solarEventUtc(date, city, false);
    if (!instant) return null;
    return { time: formatTimeInZone(instant), timeZone: TIME_ZONE, approximate: true, cityId };
  }

  function getSunrise(date, cityId) {
    const city = cityById(cityId);
    const instant = solarEventUtc(date, city, true);
    if (!instant) return null;
    return { time: formatTimeInZone(instant), timeZone: TIME_ZONE, approximate: true, cityId };
  }

  function getSolarTimes(date, cityId) {
    const sunrise = getSunrise(date, cityId);
    const sunset = getSunset(date, cityId);
    if (!sunrise || !sunset) return null;
    return { sunrise: sunrise.time, sunset: sunset.time, timeZone: TIME_ZONE, approximate: true, cityId };
  }

  function addCivilDays(value, amount) {
    const { year, month, day } = dateParts(value);
    const date = new Date(Date.UTC(year, month - 1, day + amount, 12));
    return date.toISOString().slice(0, 10);
  }

  function formatHebrewDate(value, options = {}) {
    if (!validDate(value)) return '';
    const civil = typeof value === 'string' ? value : [
      value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')
    ].join('-');
    const effectiveDate = options.afterSunset ? addCivilDays(civil, 1) : civil;
    const { year, month, day } = dateParts(effectiveDate);
    const instant = new Date(Date.UTC(year, month - 1, day, 12));
    try {
      return new Intl.DateTimeFormat('he-u-ca-hebrew', {
        timeZone: TIME_ZONE, day: 'numeric', month: 'long', year: 'numeric'
      }).format(instant);
    } catch (_) {
      return '';
    }
  }

  function formatHebrewMonth(value) {
    if (!validDate(value)) return '';
    const { year, month, day } = dateParts(value);
    const instant = new Date(Date.UTC(year, month - 1, day, 12));
    try {
      return new Intl.DateTimeFormat('he-u-ca-hebrew', {
        timeZone: TIME_ZONE, month: 'long', year: 'numeric'
      }).format(instant);
    } catch (_) {
      return '';
    }
  }

  function getHebrewDateParts(value) {
    if (!validDate(value)) return null;
    const { year, month, day } = dateParts(value);
    const instant = new Date(Date.UTC(year, month - 1, day, 12));
    try {
      const parts = new Intl.DateTimeFormat('en-US-u-ca-hebrew-nu-latn', {
        timeZone: TIME_ZONE, day: 'numeric', month: 'long', year: 'numeric'
      }).formatToParts(instant);
      const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
      const hebrewDay = Number(values.day);
      if (!Number.isInteger(hebrewDay) || !values.month || !values.year) return null;
      return { day: hebrewDay, month: values.month, year: values.year };
    } catch (_) {
      return null;
    }
  }

  function getNextYomHachodeshDate(value) {
    const current = getHebrewDateParts(value);
    if (!current) return null;
    const monthKey = parts => parts ? `${parts.year}:${parts.month}` : '';
    const currentKey = monthKey(current);
    let nextMonthStart = null;
    let nextMonthKey = '';
    for (let offset = 1; offset <= 40; offset++) {
      const candidate = addCivilDays(value, offset);
      const parts = getHebrewDateParts(candidate);
      if (parts && monthKey(parts) !== currentKey) {
        nextMonthStart = candidate;
        nextMonthKey = monthKey(parts);
        break;
      }
    }
    if (!nextMonthStart) return null;

    let nextMonthLastDate = nextMonthStart;
    let nextMonthLength = 0;
    for (let offset = 0; offset <= 35; offset++) {
      const candidate = addCivilDays(nextMonthStart, offset);
      const parts = getHebrewDateParts(candidate);
      if (!parts || monthKey(parts) !== nextMonthKey) break;
      nextMonthLastDate = candidate;
      nextMonthLength = parts.day;
    }

    if (current.day <= nextMonthLength) {
      for (let offset = 0; offset <= 35; offset++) {
        const candidate = addCivilDays(nextMonthStart, offset);
        const parts = getHebrewDateParts(candidate);
        if (!parts || monthKey(parts) !== nextMonthKey) break;
        if (parts.day === current.day) return candidate;
      }
      return null;
    }

    // For a period beginning on day 30 when the next Hebrew month has only 29 days,
    // this source profile follows the view that observes the first of the following month.
    if (current.day === 30 && nextMonthLength === 29) {
      return addCivilDays(nextMonthLastDate, 1);
    }
    return null;
  }

  function resolveEventRelation(record, fallbackCityId) {
    if (!record || !validDate(record.date)) return 'unknown';
    const cityId = Object.prototype.hasOwnProperty.call(record, 'cityId') ? record.cityId : (fallbackCityId || null);
    if (typeof record.eventTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(record.eventTime)) {
      const sunset = getSunset(record.date, cityId);
      if (sunset) return record.eventTime >= sunset.time ? 'after' : 'before';
    }
    if (record.sunsetRelation === 'before' || record.sunsetRelation === 'after') return record.sunsetRelation;
    if (record.isSunset === true) return 'after';
    if (record.isSunset === false) return 'before';
    return 'unknown';
  }

  function resolveEventOnah(record, fallbackCityId) {
    if (!record || !validDate(record.date) ||
        typeof record.eventTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(record.eventTime)) {
      return 'unknown';
    }
    const cityId = Object.prototype.hasOwnProperty.call(record, 'cityId')
      ? record.cityId
      : fallbackCityId;
    const solarTimes = getSolarTimes(record.date, cityId);
    if (!solarTimes) return 'unknown';
    return record.eventTime >= solarTimes.sunrise && record.eventTime < solarTimes.sunset
      ? 'day'
      : 'night';
  }

  function getEventDateInfo(record, fallbackCityId) {
    const relation = resolveEventRelation(record, fallbackCityId);
    const cityId = record && (Object.prototype.hasOwnProperty.call(record, 'cityId') ? record.cityId : fallbackCityId);
    const effectiveDate = relation === 'after' ? addCivilDays(record.date, 1) : record.date;
    const hebrewDate = formatHebrewDate(record.date, { afterSunset: relation === 'after' });
    const sunset = getSunset(record.date, cityId);
    const sunrise = getSunrise(record.date, cityId);
    const estimatedOnah = resolveEventOnah(record, fallbackCityId);
    return {
      hebrewDate, relation, effectiveDate, estimatedOnah,
      sunriseTime: sunrise ? sunrise.time : null,
      sunsetTime: sunset ? sunset.time : null,
      approximate: Boolean(sunset && sunrise),
      dateConfidence: relation === 'unknown' ? 'unknown' : 'recorded',
      onahConfidence: estimatedOnah === 'unknown' ? 'unknown' : 'astronomical-estimate'
    };
  }

  function getIsraelCivilDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function getCurrentHebrewDate(now = new Date(), cityId = null) {
    const date = getIsraelCivilDate(now);
    if (!date) return '';
    const sunset = getSunset(date, cityId);
    const time = formatTimeInZone(now);
    return formatHebrewDate(date, { afterSunset: Boolean(sunset && time >= sunset.time) });
  }

  globalThis.CycleFlowCalendar = Object.freeze({
    CITIES, cityById, getSunrise, getSunset, getSolarTimes,
    formatHebrewDate, formatHebrewMonth, getHebrewDateParts, getNextYomHachodeshDate, getEventDateInfo,
    resolveEventRelation, resolveEventOnah, getCurrentHebrewDate, getIsraelCivilDate, addCivilDays, TIME_ZONE
  });
})();
