# Local reminders and personal tools

All features in this module operate in the browser. Data is stored in the existing local state and included in encrypted backups. The module has no fetch/XHR calls, external account integration, analytics, or third-party export endpoint.

## Calendar reminders

- Users enter the title, date, and optional local time themselves.
- The app does not generate halachic dates or infer immersion dates.
- ICS export contains all saved reminders. Timed reminders are converted from Asia/Jerusalem local time to UTC using the browser IANA time-zone database.
- A local time that does not exist during the daylight-saving spring transition or is ambiguous during the autumn transition is rejected rather than guessed.
- All-day reminders use RFC 5545 VALUE=DATE fields.
- Importing the resulting ICS file into a calendar is a user-controlled action.

## Stain description questionnaire

The form records only descriptive fields: date/time, observed color, size, surface, possible source, and free-text note. It does not classify a stain, determine niddah status, or change the cycle/hefsek state. The generated shareable text has no name or phone fields. Free-text notes and dates can still identify a person, so the UI instructs users to review the summary before sharing.

## Mikveh preparation checklist

The checklist is a generic organizational list, not a halachic checklist or ruling. Completion is stored by user-selected date and can be reset for that date. Users are instructed to adapt the list to their custom and the guidance they received.

## Ovulation observations

Users may record a positive LH test, basal-temperature shift, ultrasound observation, personal estimate, or other note. The early-ovulation indicator only compares the user-entered observation date with a separately user-entered immersion date. It does not predict ovulation, diagnose infertility, change a halachic date, or recommend treatment.

## Doctor visit summary

The local TXT export can include:
- reported period start dates and spotting events,
- intervals between reported period starts,
- recorded ovulation observations,
- immersion dates the user marked,
- stain descriptions only if the user explicitly checks the include-stains option.

The export is based on user-entered data and is not a medical assessment. Free-text notes may contain identifying details and should be reviewed before sharing.

## Data and compatibility

New optional state fields:
- manualReminders[]
- stainReports[]
- mikvehChecklist[YYYY-MM-DD]
- ovulationObservations[]

Both hardening.js and backup-integrity.js validate the new fields. Existing records and backups without these fields remain valid. The service worker precaches local-tools.js for offline use.
