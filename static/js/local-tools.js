/* Offline-only personal tools: calendar export and structured summaries.
 * No network calls, no external accounts, and no halachic/medical conclusions.
 */
(() => {
  'use strict';

  const CHECKLIST_ITEMS = Object.freeze([
    { id: 'body-prep', label: 'הכנה אישית לפי ההדרכה שקיבלת' },
    { id: 'hair', label: 'סירוק ובדיקת השיער' },
    { id: 'nails', label: 'בדיקת ציפורניים' },
    { id: 'barriers', label: 'בדיקת חציצות לפי ההדרכה שקיבלת' },
    { id: 'clothing', label: 'הכנת בגדים נקיים' },
    { id: 'towel', label: 'הכנת מגבת וציוד אישי' },
    { id: 'schedule', label: 'וידוא שעות ותיאום מול המקווה' },
    { id: 'personal', label: 'השלמת הכנות אישיות נוספות' }
  ]);

  const OVULATION_LABELS = Object.freeze({ opk_positive: 'בדיקת LH חיובית', bbt_shift: 'עליית חום בסיסי', ultrasound: 'מעקב אולטרסאונד', estimate: 'הערכה אישית', other: 'אחר' });

  const STAIN_LABELS = Object.freeze({
    color: { red: 'אדום', pink: 'ורוד', brown: 'חום', yellow: 'צהוב', clear: 'שקוף', other: 'אחר', unknown: 'לא ידוע' },
    size: { small: 'קטן', medium: 'בינוני', large: 'גדול', multiple: 'מספר כתמים', unknown: 'לא ידוע' },
    surface: {
      white_underwear: 'תחתון לבן', colored_underwear: 'תחתון צבעוני', sheet: 'מצעים',
      tissue: 'נייר', pad: 'תחבושת/מגן', bedikah_cloth: 'בדיקה/עד', other: 'אחר', unknown: 'לא ידוע'
    },
    source: {
      unknown: 'לא ידוע', external: 'מקור חיצוני אפשרי', medical: 'הליך/בדיקה רפואית',
      other: 'אחר'
    }
  });

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T12:00:00Z');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function escapeIcsText(value) {
    return String(value ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/\r?\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  }

  function icsDate(value) {
    if (!validDate(value)) throw new Error('תאריך תזכורת לא תקין');
    return value.replace(/-/g, '');
  }

  function addDays(value, days) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day + days, 12)).toISOString().slice(0, 10);
  }

  function zonedLocalToUtc(date, time, timeZone = 'Asia/Jerusalem') {
    if (!validDate(date) || typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      throw new Error('תאריך או שעה לתזכורת אינם תקינים');
    }
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    const target = Date.UTC(year, month - 1, day, hour, minute);
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    const matches = [];
    for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
      const candidate = new Date(target - offset * 60000);
      const parts = Object.fromEntries(formatter.formatToParts(candidate).map(part => [part.type, part.value]));
      if (Number(parts.year) === year && Number(parts.month) === month && Number(parts.day) === day &&
          Number(parts.hour) === hour && Number(parts.minute) === minute) {
        matches.push(candidate);
      }
    }
    const unique = [...new Map(matches.map(dateValue => [dateValue.getTime(), dateValue])).values()];
    if (unique.length !== 1) {
      throw new Error(unique.length ? 'השעה שנבחרה אינה חד-משמעית במעבר שעון קיץ' : 'השעה שנבחרה אינה קיימת באזור הזמן בתאריך זה');
    }
    return unique[0];
  }

  function utcStamp(date) {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }

  function buildIcs(reminders) {
    if (!Array.isArray(reminders) || !reminders.length) throw new Error('אין תזכורות לייצוא');
    const events = reminders.map((item, index) => {
      if (!item || !validDate(item.date) || typeof item.title !== 'string' || !item.title.trim()) {
        throw new Error('נמצאה תזכורת ללא תאריך או כותרת תקינים');
      }
      const uid = String(item.id || `cycleflow-${index}-${icsDate(item.date)}`).replace(/[^a-zA-Z0-9-]/g, '-');
      const stamp = utcStamp(new Date());
      const lines = [
        'BEGIN:VEVENT',
        `UID:${uid}@cycleflow.local`,
        `DTSTAMP:${stamp}`,
        `SUMMARY:${escapeIcsText(item.title.trim())}`,
        'DESCRIPTION:תזכורת אישית שנוצרה במכשיר. אינה קביעה הלכתית או רפואית.'
      ];
      if (item.time) {
        const start = zonedLocalToUtc(item.date, item.time);
        const end = new Date(start.getTime() + 30 * 60000);
        lines.push(`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`);
      } else {
        lines.push(`DTSTART;VALUE=DATE:${icsDate(item.date)}`, `DTEND;VALUE=DATE:${icsDate(addDays(item.date, 1))}`);
      }
      if (item.notes) lines.push(`X-ALT-DESC;FMTTYPE=text/plain:${escapeIcsText(item.notes)}`);
      lines.push('END:VEVENT');
      return lines.join('\r\n');
    });
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CycleFlow//Local Reminders//HE',
      'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', ...events, 'END:VCALENDAR', ''
    ].join('\r\n');
  }

  function buildStainSummary(report) {
    if (!report || !validDate(report.date)) throw new Error('רישום תיאור הכתם אינו תקין');
    const label = (group, value) => STAIN_LABELS[group][value] || STAIN_LABELS[group].unknown;
    return [
      'סיכום אנונימי לתיאור ממצא — CycleFlow',
      'הסיכום מתאר נתונים שנמסרו בלבד ואינו קובע מעמד הלכתי.',
      `תאריך: ${report.date}`,
      `שעה: ${report.time || 'לא נמסרה'}`,
      `צבע כפי שתואר: ${label('color', report.color)}`,
      `גודל כפי שתואר: ${label('size', report.size)}`,
      `משטח: ${label('surface', report.surface)}`,
      `מקור אפשרי: ${label('source', report.source)}`,
      `הערות: ${String(report.note || '').trim() || 'ללא'}`,
      'לא הוזנו שם, טלפון או פרטי זיהוי.'
    ].join('\n');
  }

  function buildDoctorSummary(state, from, to, options = {}) {
    if (!state || !validDate(from) || !validDate(to) || from > to) throw new Error('טווח התאריכים אינו תקין');
    const inRange = date => typeof date === 'string' && date >= from && date <= to;
    const periods = (state.periods || []).filter(p => inRange(p.date)).sort((a, b) => a.date.localeCompare(b.date));
    const starts = (state.periods || []).filter(p => p.type === 'veset').sort((a, b) => a.date.localeCompare(b.date));
    const periodLines = periods.filter(p => p.type === 'veset').map(p => `- ${p.date}${p.eventTime ? ' ' + p.eventTime : ''}`);
    const intervals = [];
    for (let i = 1; i < starts.length; i++) {
      const days = Math.round((new Date(starts[i].date + 'T12:00:00Z') - new Date(starts[i - 1].date + 'T12:00:00Z')) / 86400000);
      if (inRange(starts[i].date)) intervals.push(`${starts[i - 1].date} → ${starts[i].date}: ${days} ימים`);
    }
    const ovulation = (state.ovulationObservations || []).filter(item => inRange(item.date));
    const immersion = Object.keys(state.tevilot || {}).filter(inRange).sort();
    const lines = [
      'סיכום אישי לפגישה רפואית',
      `טווח: ${from} עד ${to}`,
      'המסמך מבוסס על דיווחים אישיים בלבד; אינו אבחון או המלצה רפואית.',
      '',
      'תחילות וסת שדווחו:',
      ...(periodLines.length ? periodLines : ['- אין דיווחים בטווח']),
      '',
      'מרווחים בין תחילות וסת:',
      ...(intervals.length ? intervals.map(item => `- ${item}`) : ['- אין מספיק נתונים בטווח']),
      '',
      'תיעודי ביוץ:',
      ...(ovulation.length ? ovulation.map(item => `- ${item.date}${item.time ? ' ' + item.time : ''}: ${OVULATION_LABELS[item.type] || item.type}${item.note ? ' — ' + item.note : ''}`) : ['- אין תיעוד בטווח']),
      '',
      'מועדי טבילה שסומנו:',
      ...(immersion.length ? immersion.map(date => `- ${date}`) : ['- אין מועדים שסומנו בטווח'])
    ];
    if (options.includeStains) {
      const stains = (state.stainReports || []).filter(item => inRange(item.date));
      lines.push('', 'תיאורי כתמים שנרשמו:');
      if (stains.length) stains.forEach(item => lines.push('- ' + buildStainSummary(item).replace(/\n/g, ' | ')));
      else lines.push('- אין תיעוד בטווח');
    }
    return lines.join('\n');
  }

  function earlyOvulationIndicator(item) {
    if (!item || !validDate(item.date)) return 'אין תיעוד ביוץ תקין.';
    if (!validDate(item.immersionDate)) return 'לא הוזן תאריך טבילה להשוואה.';
    const ovulation = new Date(item.date + 'T12:00:00Z');
    const immersion = new Date(item.immersionDate + 'T12:00:00Z');
    const difference = Math.round((immersion - ovulation) / 86400000);
    if (difference > 0) return `תיעוד הביוץ קודם לתאריך הטבילה שסומן ב-${difference} ימים. חיווי תאריכים בלבד.`;
    if (difference === 0) return 'תיעוד הביוץ ותאריך הטבילה שסומן באותו יום. חיווי תאריכים בלבד.';
    return `תיעוד הביוץ מאוחר לתאריך הטבילה שסומן ב-${Math.abs(difference)} ימים. חיווי תאריכים בלבד.`;
  }

  globalThis.CycleFlowTools = Object.freeze({
    CHECKLIST_ITEMS, STAIN_LABELS, OVULATION_LABELS, escapeIcsText, buildIcs,
    buildStainSummary, buildDoctorSummary, earlyOvulationIndicator,
    zonedLocalToUtc, validDate
  });
})();
