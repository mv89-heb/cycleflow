# Hebrew calendar, event location, and sunset provenance

## Current implementation status

This document describes the current main-branch behavior. The halachic rule research and source matrix are maintained in [halachic-rule-research.md](./halachic-rule-research.md).

- The browser's built-in Hebrew calendar conversion is used by the status engine to derive the effective Hebrew-date label.
- An event recorded after sunset belongs to the next Hebrew-date label.
- Selected Israeli city coordinates provide an approximate local sunrise/sunset estimate for day/night onah and event-time relation.
- The application does not use GPS and does not call a remote calendar or zmanim service.
- All outputs are advisory. The astronomical estimate is not a certified halachic zman and does not calculate tzeit hakochavim.

## Privacy and offline behavior

- City selection is manual. The application does not request GPS permission.
- City coordinates, selected city, event time, sunset relation, and rule context remain in browser-local state and encrypted backup.
- No calendar, sunset, font, icon, or chart service is called over the network.
- Hebrew date formatting uses the browser's built-in `Intl.DateTimeFormat` Hebrew calendar support.
- No user-entered cycle or health data is transmitted by these local services.

## Hebrew date and effective date

The stored event date remains the original Gregorian civil date (`YYYY-MM-DD`) to preserve existing data and backup compatibility.

The status engine uses `CalendarServices.getEventDateInfo()` to derive the effective civil date:
- Before sunset: the original civil date.
- After sunset: the following civil date, representing the next Hebrew date.
- Unknown relation: the effective Hebrew date is not inferred; the event remains in review.

The Hebrew month resolver preserves distinct Adar I and Adar II identities. Regression tests cover day-30 rollover, leap-month transitions, and fixed yom-hachodesh continuity across Adar I → Adar II → Nisan.

## Sunrise and sunset estimates

`calendar-services.js` includes a local astronomical estimate for selected Israeli cities. It uses the NOAA solar-calculation approach with the apparent-sunset zenith correction and formats the UTC instant in the `Asia/Jerusalem` time zone. The browser's IANA time-zone database handles Israel daylight-saving transitions.

City coordinates are approximate city-center coordinates. The calculation does not model the user's exact elevation, local horizon, nearby buildings, atmospheric conditions, or a community's halachic definition of sunset. Therefore:
- Every calculated sunrise/sunset is labeled as an estimate.
- A day/night onah inferred from the estimate is labeled as estimated, not as a manually recorded fact.
- The source and confidence of an event's before/after-sunset relation are included in calculation provenance.
- No exact tzeit or immersion time is generated. The user must verify tzeit with the local mikveh and their community practice.

If the user selects “יישוב אחר”, no sunset time is fabricated. The relation must come from an explicit recorded before/after choice or remain unknown.

## Historical city provenance

A current settings city must never silently rewrite an old event.

City resolution follows this order:
1. `periods[].cityId` when the event explicitly stores a city (including explicit `null`, which means unknown).
2. `periods[].ruleContext.cityId` when the event has no direct city field but its original rule context records one.
3. Otherwise, no city is assumed for the historical event.

The current settings city is not used as a fallback for a historical event. If its time cannot be related to sunset without a recorded city or an explicit before/after relation, the relation and onah remain unknown and the calculation is flagged for review.

## Stored metadata

Existing fields are retained. Optional event metadata includes:

- `settings.cityId`: manually selected current city ID; nullable.
- `periods[].eventTime`: local `HH:mm` time entered for the event.
- `periods[].cityId`: city used when the event was entered; explicit null means unknown.
- `periods[].sunsetRelation`: before, after, or unknown when explicitly recorded.
- `periods[].ruleContext`: versioned rule profile and the city/time calculation context at event entry.
- `hefsekMeta[YYYY-MM-DD]`: optional event time, city ID, sunset relation, and rule context for a hefsek; the legacy `hefseks[date] = true` map remains intact.

Old records are not assigned invented times or city IDs. The legacy `isSunset` boolean is preserved as a recorded hint. Old encrypted backups remain importable; new metadata is validated by local-storage hardening and backup validation.

## Current halachic rule scope

The common source-based profiles are documented in [halachic-rule-research.md](./halachic-rule-research.md). In brief, current supported logic includes:
- Explicit minimum-wait and onah-beinonit modes.
- Common fixed yom-hachodesh and standard fixed-haflagah state machines.
- A separate Chabad haflagah onot-count calculation.
- Calculation provenance and explicit needs-review states.
- A narrow, review-only possible veset-dilug detector. It does not activate a dilug rule or project a future onah.

Veset haguf, stains, overlapping/compound patterns, Or Zarua, hormonal/fertility exceptions, and other personal cases remain review-only until the required event data and source-specific rule logic exist. The app is not an individualized psak.

## Remaining validation

1. Immutable historical snapshots of calculated statuses, distinct from the current live recalculation provenance.
2. A selected, sourced local tzeit convention before exact immersion-time calculation can be introduced.
3. Dedicated event capture and a reviewed rule matrix for veset haguf and other exceptional patterns.
4. Further regression coverage for unusual month transitions, historical backups, and source-profile migration.

## Sources

- Nishmat Yoatzot Halacha, [Guide to Observing Vesatot](https://www.yoatzot.org/547/).
- Nishmat Yoatzot Halacha, [Veset Hachodesh](https://www.yoatzot.org/677/).
- Nishmat Yoatzot Halacha, [Veset hadilug Q&A](https://www.yoatzot.org/faq/veset-hadilug/).
- Nishmat Yoatzot Halacha, [Veset Haguf](https://www.yoatzot.org/674/).
- Nishmat Yoatzot Halacha, [Mikveh Timing & Scheduling](https://www.yoatzot.org/542/).
- NOAA Global Monitoring Laboratory, [Solar Calculation Details](https://gml.noaa.gov/grad/solcalc/calcdetails.html) and [Sunrise/Sunset Calculations PDF](https://gml.noaa.gov/grad/solcalc/solareqns.PDF).
