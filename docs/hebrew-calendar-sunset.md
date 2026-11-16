# Hebrew calendar and sunset foundation

## Scope of this change

This change adds date display and event metadata only. It does not change the halachic status engine, does not issue a halachic conclusion, and does not make the existing status engine sunset-aware. Issue #17 therefore remains open.

## Privacy and offline behavior

- City selection is manual. The application does not request GPS permission.
- City coordinates, selected city, event time, and sunset relation remain in the existing browser-local state and encrypted backup.
- No calendar, sunset, font, icon, or chart service is called over the network.
- Hebrew date formatting uses the browser's built-in Intl.DateTimeFormat Hebrew calendar support.
- The cycle history chart is rendered as local SVG. Icon fallbacks and system fonts replace remote CDN assets.
- No user-entered cycle or health data is transmitted by these new services.

## Hebrew calendar display

The stored date remains the original Gregorian civil date (YYYY-MM-DD) to preserve existing data and backup compatibility.

For display, Intl.DateTimeFormat('he-u-ca-hebrew', ...) converts that civil date to a Hebrew calendar date. Calendar cells display the daytime Hebrew date. An event recorded after sunset displays the next Hebrew date.

The conversion is presentation metadata only. It is not yet used as the input to the halachic status engine.

## Sunset estimate

calendar-services.js includes a local astronomical sunset estimate for selected Israeli cities. It uses the NOAA solar-calculation approach with the apparent-sunset zenith correction and formats the resulting UTC instant in the Asia/Jerusalem time zone. The browser's IANA time-zone database handles Israel daylight-saving transitions.

Available city coordinates are approximate city-center coordinates. The calculation does not model the user's exact elevation, local horizon, nearby buildings, atmospheric conditions, or a community's halachic definition of sunset. NOAA itself notes that observed conditions may vary from calculated values. Therefore the UI labels every result as an estimate and must not present it as a halachic time.

If the user selects “יישוב אחר”, no sunset time is fabricated. Manual event time may still be recorded, but without a selected supported city the relation to sunset remains based on the user's explicit before/after choice or unknown.

## Stored metadata

Existing fields are retained. New optional fields:

- settings.cityId: manually selected city ID; nullable.
- periods[].eventTime: optional local HH:mm time.
- periods[].cityId: city used when the event was entered, preserving historical context if the settings city later changes.
- periods[].sunsetRelation: before, after, or unknown.
- hefsekMeta[YYYY-MM-DD]: optional event time, city ID, and sunset relation for a hefsek, while the legacy hefseks[date] = true map remains intact.

Old records are not assigned invented times or city IDs. The existing isSunset boolean is preserved and remains available as a legacy/manual hint. Old encrypted backups remain importable; new metadata is validated by both local-storage hardening and backup validation.

## Halachic rule research — not yet implemented

Online sources confirm that the rules cannot safely be reduced to a single Ashkenazi/Sephardi toggle:

- Nishmat explains that Ashkenazi and some Sephardi communities use a five-day wait, while some Sephardi authorities use a four-day method with a different starting point; community practice varies.
- Nishmat's guide describes the basic calendar vesatot: Hebrew-date veset, haflagah interval, and onah beinonit, and explicitly notes a distinct Chabad haflagah calculation.
- The Chabad reference by הרב דב טברדוביץ describes the Chabad-specific calculation from the hefsek taharah rather than the ordinary start-to-start interval in the approach described there.

Until a rule matrix is reviewed and approved by a qualified halachic authority, the existing calculation rules remain unchanged and must not be described as a halachic decision engine.

## Required next validation before Issue #17 can close

1. Approve explicit community profiles and sub-community variations.
2. Define whether event time, estimated sunset, manual before/after selection, or an unknown state controls each rule.
3. Define the Hebrew-day boundary for period onset and hefsek events.
4. Specify onah beinonit, yom hachodesh, haflagah, day/night onah, or zarua, and missing-date edge cases.
5. Add a rule-by-rule test matrix, including missing Hebrew month days, leap years, Adar I/II, DST transitions, and historical records.
6. Have the rule matrix reviewed before enabling the new calculations.

## Sources

- Nishmat Yoatzot Halacha, [Minimum Wait](https://www.yoatzot.org/526/).
- Nishmat Yoatzot Halacha, [Sephardi practice varies by community](https://www.yoatzot.org/faq/sephardi-practice/).
- Nishmat Yoatzot Halacha, [Guide to Observing Vesatot](https://www.yoatzot.org/547/).
- Nishmat Yoatzot Halacha, [Onah Beinonit](https://www.yoatzot.org/672/).
- Nishmat Yoatzot Halacha, [Sefardi/Ashkenazi differences](https://www.yoatzot.org/faq/sefardi-ashkenazi-differences/).
- Chabad, [Halachot of Vesatot — overview](https://abc770.org/article_node_1982/).
- Chabad, [Veset Haflagah and the Chabad calculation](https://abc770.org/article_node_3175/).
- NOAA Global Monitoring Laboratory, [Solar Calculation Details](https://gmd-prod.cmdl.noaa.gov/grad/solcalc/calcdetails.html) and [Sunrise/Sunset Calculations PDF](https://gml.noaa.gov/grad/solcalc/solareqns.PDF).
