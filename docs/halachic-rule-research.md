# Halachic rule research matrix — CycleFlow

Status: the common rule families are implemented from a documented public-source baseline. The selected reference for standard non-Chabad rules is Nishmat–Yoatzot Halacha; Chabad haflagah uses its separate onot-count sources. This is a traceable educational/calendar implementation, not an individualized psak. The document records remaining exceptions and what the software must not infer.

## Executive finding

A two-value setting ("Ashkenaz" / "Sephard") is not a sufficient rule model. CycleFlow therefore uses explicit choices for the minimum-wait method and onah-beinonit custom, and keeps Chabad haflagah separate from the standard interval method. The baseline for common non-Chabad rules follows the published Nishmat–Yoatzot Halacha guides cited below; Sephardi practice is not inferred from the community label alone.

## Rule matrix

| Rule family | What the sources establish | Software implication | Remaining exception / automation boundary |
|---|---|---|---|
| Minimum wait | Nishmat describes a five-day baseline for many communities and a four-day method in some Sephardi communities, counted from the last intercourse rather than onset of niddah. | Implemented as an explicit setting: five days from onset by default; the four-day route requires an explicit choice plus the last-relations date/time and onset time. It is never inferred from "Sepharad". | Qualifying stains, special circumstances, and cases where the four-day route does not apply remain manual review. |
| Seven clean days | The clean days are counted by the Jewish calendar, each day beginning at sunset. A valid hefsek before sunset permits the first clean day to begin that night; immersion is after nightfall following completion. | The app counts clean days from a recorded hefsek that passes the before-sunset check. Tzeit is not calculated, so immersion time is not derived from sunset. | Exact local zmanim/tzeit convention, backup-check reliance, and exceptional cases remain outside automation. |
| Hefsek taharah | Nishmat describes a hefsek before sunset; an after-sunset attempt cannot automatically start the clean-day count. | The app records date, time, and selected city; it accepts only a known before-sunset hefsek for automatic counting. Unknown or after-sunset records remain review-only. | Exact-boundary timestamps and reliance on earlier backup checks remain manual review. |
| Onah day/night | Nishmat's onah guide describes day onot as sunrise-to-sunset and night onot as sunset-to-sunrise. | Implemented using selected city plus astronomical sunrise/sunset estimates; unknown city/time remains unknown. The result is explicitly labeled as an estimate, not a zman. | Local horizon/elevation differences and exact halachic boundary conventions remain outside this approximation. |
| Onah beinonit | The common view is day 30 from the beginning of the last flow. Other authorities/customs observe day 31, and some observe the full 24-hour Hebrew date on day 30. | Implemented as explicit settings for day 30 in the same onah, day 30 full day, optional day 31, or combined custom. Day 30 same-onah is the default. | The user must select the practice they actually follow; individual exceptions remain manual review. |
| Yom hachodesh | Calculated by Hebrew day-of-month and the onah of the original onset. Sources differ when day 30 is absent from the next month. | Implemented on Hebrew-date labels, with the documented Nishmat approach of moving a fixed day 30 to the first of the following month when the intervening month has 29 days; fixed-pattern deviations, uprooting, and reinstatement are covered. | Unusual patterns and other community-specific day-30 approaches remain manual review. |
| Veset haflagah | The standard method counts equal intervals between onsets; Chabad uses a separate count of onot from the first night after a successful hefsek, including the onset onah. | Standard fixed haflagah (four flows / three equal intervals) and its deviation state machine are implemented for non-Chabad profiles. Chabad has a separate onot-count calculation and is excluded from the standard day-interval detector. | Missing/uncertain hefsek data and unusual interval patterns remain review-only. |
| Or Zarua | An additional onah before a primary veset is a custom/stringency, not a universal base rule. The scope can differ by veset type; some sources distinguish whether the veset is kavua. | Make Or Zarua an explicit optional rule with scope per veset type; do not turn it on automatically for all Ashkenazi users. | Which preceding onot are observed for each profile and what happens when it overlaps mikveh night. |
| Stain vs. flow | Sources distinguish a flow from a stain and explain that the minimum wait begins when niddah status is incurred, which can also occur through a qualifying stain. Not every stain automatically has that status. | A questionnaire can collect size, color, surface, source, and context; it must not decide niddah status or reset a count automatically. | Which questions to ask and how to route uncertainty to a qualified authority. |
| Fertility / early ovulation | Nishmat and PUAH describe cases where documented ovulation, hormonal treatment, and fertility concerns affect how some authorities approach veset observance. Their answers differ by authority and circumstance. | Store ovulation tests/medical data as user-entered observations and produce a clinician/halachic-consultation summary. Never automatically waive a veset or change immersion dates. | Medical thresholds, evidence requirements, and authority-specific decision rules. |

## Current implementation and remaining data-model work

Implemented in the current main branch:

- Flow onset and spotting are separate record types; a stain questionnaire stores observations only and never decides niddah status.
- Period and hefsek records preserve civil date, event time when known, and the manually selected city. Historical records are not reclassified from a later city selection.
- The app uses the Israel timezone for its own current clock and preserves an explicit unknown state when the event time or city is missing.
- Sunrise and sunset are computed locally as astronomical estimates. They are not certified zmanim; tzeit is not calculated.
- The selected source practice is represented through explicit minimum-wait and onah-beinonit settings rather than inferring every rule from the Ashkenaz/Sephard/Chabad label.
- Standard fixed yom hachodesh and fixed haflagah patterns have state machines for establishment, deviations, uprooting, and reinstatement. Chabad haflagah uses its separate onot-count method.

Versioned event context now stored on new records:

- `ruleContext` is attached to newly recorded period/spotting events, last-relations references, and hefsek metadata.
- The snapshot includes schema version, ruleset ID/version, source IDs, community label, explicit minimum-wait mode, onah-beinonit mode, city ID, Israel timezone, solar-time method, and record-entry timestamp.
- Standard records use `cycleflow-yoatzot-standard@1.0.0`; Chabad records use `cycleflow-chabad-onot-count@1.0.0` plus the common-source rules.
- Historical records are not backfilled from today's settings. If an old record has no `ruleContext`, its original profile is unknown and remains unknown.

Remaining engineering work:

- Persist per-calculation output provenance (source event IDs, rule ID/version, assumptions, confidence, and review state) alongside each displayed result; event snapshots are not a substitute for a calculation audit trail.
- Add a configurable, sourced tzeit/zmanim convention before showing any immersion-time estimate. Until then, no sunset-to-tzeit offset is inferred.
- Keep unknown / needs-review states for ambiguous stains, missing event times, and missing hefsek context; do not infer a confident date.

## Solar-time engineering note

The local sunrise/sunset helper uses a NOAA-style astronomical approximation with the apparent-sun horizon correction (90.833°). NOAA explains that the equations are based on Jean Meeus' *Astronomical Algorithms* and that calculated values can differ from observed times because of atmospheric conditions, pressure, temperature, and horizon/elevation effects. NOAA also states its calculator is for research/recreational use and does not certify sunrise or sunset times.

- NOAA, [Solar Calculation Details](https://gmd-prod.cmdl.noaa.gov/grad/solcalc/calcdetails.html).
- NOAA, [Sunrise/Sunset Calculations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF).

**Product rule:** these values are only an estimate for showing an event's likely daytime/nighttime onah. They are not zmanim, do not calculate tzeit, and must never be presented as a halachic time. A missing city or event time remains unknown.

## Required calculation and test matrix

1. Event exactly at sunset; one minute before; one minute after; missing event time.
2. Day and night onah across sunrise/sunset and across civil midnight.
3. Hebrew month with 29 days, month with 30 days, day 30 onset followed by a month without day 30.
4. Leap Hebrew year, Adar I and Adar II, and year transitions.
5. Day-30, day-31, and 24-hour onah-beinonit profiles.
6. Or Zarua before yom hachodesh, onah beinonit, and haflagah, with different scope settings.
7. Common haflagah versus Chabad end-of-bleeding-to-onset calculation; missing hefsek/cessation time.
8. Minimum wait counted from onset versus last intercourse; flow versus qualifying stain; unknown classification.
9. Valid hefsek before sunset, late hefsek after sunset, and a prior valid backup examination.
10. Seven clean days across Shabbat/holidays and immersion after tzeit rather than sunset.
11. DST transition, device timezone different from Israel, city change after historical event, and no selected city.
12. Ovulation/fertility observations that are recorded without automatically changing halachic dates.
13. Old encrypted backups, new backups, invalid metadata, and round-trip equality.

## Research sources

### Minimum wait and seven clean days
- Nishmat, [Minimum Wait](https://www.yoatzot.org/526/).
- Nishmat, [Sephardi practice varies by community](https://www.yoatzot.org/faq/sephardi-practice/).
- Nishmat, [Shivah Neki'im](https://www.yoatzot.org/529/).
- Chabad, [Kitzur Shulchan Aruch, Chapter 159](https://www.chabad.org/library/article_cdo/aid/4298004/jewish/Chapter-159-Putting-on-White-Linen-and-Counting-the-Clean-Days.htm).

### Hefsek and immersion timing
- Nishmat, [Hefsek Taharah](https://www.yoatzot.org/527/).
- Nishmat, [Mikveh Timing & Scheduling](https://www.yoatzot.org/542/).
- Nishmat, [Hefsek after sunset](https://www.yoatzot.org/faq/hefsek-after-sunset/).

### Vesatot, onah, and Or Zarua
- Nishmat, [Guide to Observing Vesatot](https://www.yoatzot.org/547/).
- Nishmat, [Onah Beinonit](https://www.yoatzot.org/672/).
- Nishmat, [Keeping days 30 & 31 as onah beinonit](https://www.yoatzot.org/faq/keeping-days-30-31-as-onah-beinonit/).
- Nishmat, [Yom Hachodesh](https://www.yoatzot.org/677/).
- Nishmat, [Yom Hachodesh when the next month has no day 30](https://www.yoatzot.org/faq/veset-hachodesh-when-period-began-on-30th-day-of-month/).
- Nishmat, [Or Zarua & 24-hour onah beinonit](https://www.yoatzot.org/faq/or-zarua-24-hour-onah-beinonit/).
- Nishmat, [Or Zarua scope and practice differences](https://www.yoatzot.org/faq/or-zarua/).
- Chabad, [Veset Haflagah — Shulchan Aruch HaRav approach](https://abc770.org/article_node_3175/).
- Chabad, [Vesatot overview](https://abc770.org/article_node_1982/).

### Fertility and ovulation
- Nishmat, [Trying to conceive and ovulation timing](https://www.yoatzot.org/faq/trying-to-conceive-for-a-year/).
- PUAH, [Fertility medication and halachic veset calculations](https://puah.org.il/%D7%98%D7%99%D7%A4%D7%95%D7%9C-%D7%AA%D7%A8%D7%95%D7%A4%D7%AA%D7%99-%D7%9C%D7%90-%D7%A4%D7%95%D7%A8%D7%99%D7%95%D7%AA/).
- PUAH, [Vesatot in fertility treatment](https://puah.org.il/Article/203065/).

## Hebrew-source verification audit — 2026-11-16

The following Hebrew-language pages were opened and checked against the rule matrix above. They are research references, not a signed ruling for CycleFlow's users.

| Topic | Verified source finding | Engineering consequence |
|---|---|---|
| Fixed veset | Yoatzot Halacha defines a fixed pattern by exact repeated regularity and gives importance to the same day/night onah; a civil/Gregorian recurring date is not enough. | Do not infer a fixed veset from a Gregorian date or average cycle length. Require explicit halachic pattern evidence and reviewer-approved logic. |
| Day/night onah | The Hebrew Yoatzot guide divides the halachic day into daytime and nighttime onot, with sunrise and sunset as boundaries. | Sunset alone cannot classify an event's onah; sunrise and the actual/unknown event time are also required. |
| Onah beinonit | Nishmat's current guide describes day 30 as the basic calculation and explicitly identifies day 31 and a full 24-hour day as additional customs/stringencies, not universal defaults. | The current UI's simultaneous day-30/day-31 alerts must not be represented as one universal ruling. A future profile must explicitly choose the approved convention. |
| Minimum wait | Nishmat explains the rationale for four- and five-day practices and states that the start reference and the applicable community practice matter. It also notes exceptions and individual questions. | A two-option Ashkenaz/Sepharad setting cannot safely select a minimum wait by itself. Do not auto-select four days for every Sephardi user. |
| Stains | Nishmat describes several cumulative criteria for a stain and distinguishes stains from flow; internal bedikah findings and doubtful colors require separate treatment. | The app may record a stain observation, but must not infer niddah status, reset the wait, or invalidate clean days from a simple stain checkbox. |

### Verified Hebrew-language references

- Yoatzot Halacha (Hebrew), [עונה – חלוקה הלכתית של היממה](https://hebrew.yoatzot.org/5075-2/).
- Yoatzot Halacha (Hebrew), [וסת קבוע](https://hebrew.yoatzot.org/6118-2/).
- Yoatzot Halacha, [Guide to Observing Vesatot](https://www.yoatzot.org/547/), updated 10 June 2026.
- Yoatzot Halacha, [Onah Beinonit](https://www.yoatzot.org/672/).
- Yoatzot Halacha, [Minimum Wait](https://www.yoatzot.org/526/).
- Yoatzot Halacha, [Minimum wait: Sephardi and Ashkenazi practice](https://www.yoatzot.org/faq/sephardi-practice/).
- Yoatzot Halacha, [Keeping days 30 & 31 as onah beinonit](https://www.yoatzot.org/faq/keeping-days-30-31-as-onah-beinonit/).
- Yoatzot Halacha, [Shivah Neki'im](https://www.yoatzot.org/529/).
- Yoatzot Halacha, [Laws of Stains](https://www.yoatzot.org/522/).
- Din Online, [זמני הפרישה בעונה בינונית](https://din.org.il/2010/11/25/זמני-הפרישה-בעונה-בינונית/), presenting a 24-hour practice and additional stringencies.
- Din Online, [עונה בינונית](https://din.org.il/2024/09/12/עונה-בינונית/), explaining the distinction between day 30, day 31 and whether a missed check must be completed.
- Peninei Halacha, [הפרישה לווסת שאינו קבוע](https://ph.yhb.org.il/18-06-05/), overview of the three basic onot.

### Source-backed profile defaults implemented in CycleFlow

The current application profile is deliberately explicit rather than inferred from the broad Ashkenazi/Sephardi/Chabad selector:

- **Minimum wait default:** five halachic days from the onset of niddah. The hefsek eligibility boundary is the fifth halachic day (counting the onset day as day one), not the sixth civil-date label.
- **Optional four-day practice:** available only as a separate selected mode for communities that follow it. The start is the halachic day of the most recent marital relations, not automatically the onset of bleeding. CycleFlow requires the user to record the date/time of the last relations and the onset, plus the selected city; if that context is missing or inconsistent, the engine returns "needs review" and does not calculate an early hefsek.
- **Onah beinonit default:** day 30, on the same day/night onah as the onset of the most recent flow.
- **Optional customs:** day 31 and a full 24-hour day 30 are separate selectable modes. Neither is enabled by default.
- These are source-derived application defaults and options, not a claim that one profile fits every family or a personal ruling. Exceptions (including stains, special circumstances, long cycles, and hormonal regimens) remain outside automatic calculation.

The implementation is based on the following specific guidance:
- [Minimum Wait](https://www.yoatzot.org/526/) describes the five-day-from-onset practice and the four-day-from-last-relations practice, including the halachic-day start reference.
- [Minimum wait: Sephardi and Ashkenazi practice](https://www.yoatzot.org/faq/sephardi-practice/) explicitly states that Sephardi community practice varies.
- [Onah Beinonit](https://www.yoatzot.org/672/) describes day 30 as the baseline and day 31 as a view held by some authorities.
- [Keeping days 30 & 31 as onah beinonit](https://www.yoatzot.org/faq/keeping-days-30-31-as-onah-beinonit/) and [Guide to Observing Vesatot](https://www.yoatzot.org/547/) describe day 31 and the full 24-hour day as additional customs.

### Fixed yom-hachodesh state machine

The simple fixed yom-hachodesh profile is now active after three consecutive flows on the same Hebrew day and same known onah:

- With no deviations, the calendar observes only the fixed yom-hachodesh onah; onah beinonit and other non-fixed onot are suppressed.
- After one or two missed fixed onot, the fixed onah remains in force and the non-fixed yom hachodesh / haflagah based on the latest onset are also observed; onah beinonit remains suppressed.
- After three consecutive expected fixed onot pass without the onset, the fixed pattern is uprooted and the regular three non-fixed onot resume.
- A later onset on the original fixed date and onah reinstates the pattern if no newer fixed pattern has replaced it.
- A newer established fixed pattern supersedes the previous pattern.
- Day-30 month rollover preserves the fixed day number when moving from a 29-day month to the first of the following month.

The standard fixed-haflagah state machine is now active for non-Chabad profiles. It requires four recorded flows with three equal intervals, with the final three onsets in the same known onah; the first onset may be in the opposite onah. It projects the fixed interval forward, retains the fixed onah plus the current non-fixed calendar onot after one or two deviations, suppresses onah beinonit while the fixed pattern remains active, uproots after three consecutive missed expected onot, and immediately reinstates the prior pattern after a matching onset if no newer fixed pattern has replaced it. Chabad remains excluded from this day-interval algorithm and continues to use its separate onot-count calculation.

Source:
- [Veset Kavua](https://www.yoatzot.org/676/) – establishment, deviation, uprooting, and reinstatement of fixed patterns.

### Chabad haflagah onot-count implementation

The Chabad profile now uses the distinct onot-count method rather than the standard day-interval formula:

- For each period after the first, find the latest successful hefsek taharah after the previous period and before the new onset.
- Count from the first night onah immediately following that hefsek, including the onah on which the new period began. The count is 2 × complete Hebrew-date steps + 1 for a night onset, or 2 × complete Hebrew-date steps + 2 for a day onset.
- A newly recorded number cancels lower carried numbers, while larger existing numbers remain active.
- After the current period has a successful hefsek, project each active number from the first night following that hefsek: odd numbers map to night onot and even numbers to day onot.
- Only hefsek records with a verified pre-sunset time, city, and applicable minimum-wait boundary are used. Without that context, no Chabad haflagah is calculated.

Sources:
- [Yoatzot Halacha FAQ: back-to-back onot](https://www.yoatzot.org/faq/bedikot-with-back-to-back-onot/) distinguishes the Chabad count from standard date-based haflagah.
- [How to Keep Your Calendar](https://www.mikvah.org/images/cheshbon%20calendar%20outline.pdf) explains counting from the first night after hefsek, including the onset onah, and carrying higher numbers.
- [Veses Haflagah](https://tieba.mikvah.org/images/slideshow/6.pdf) illustrates the inclusive onot count and carried numbers.
- [Overview of Family Purity Laws](https://repo.mikvah.org/overview) explains the first-night start and odd/even night/day mapping.

### Basic calendar onot added

For the selected Yoatzot Halacha source profile, CycleFlow now calculates the two remaining basic calendar onot for non-fixed patterns:

- **Yom hachodesh:** the same Hebrew day in the next month, during the same day/night onah as the most recent flow. If the prior flow began on day 30 and the next month has only 29 days, this profile follows the published Yoatzot position to observe the first of the following month.
- **Standard haflagah:** the interval between the two most recent flow onsets, measured by Hebrew-date labels (sunset to sunset), counted forward from the latest onset. The onah is based on the most recent flow.
- **Chabad haflagah:** intentionally not calculated by the standard day-interval formula. The Chabad method counts onot and uses the hefsek taharah as its starting point; it requires a dedicated implementation and tests before activation. The long-cycle exemption is also not automatically applied in the Chabad selector until its applicability is verified.
- **Long-cycle exemption:** the source profile suspends onah beinonit and yom hachodesh after three consecutive intervals of 32 days or more. One or two shorter intervals resume them; a subsequent long interval restores the exemption immediately. Three consecutive shorter intervals reset the requirement for three long intervals.

**Still intentionally not automated:** unusual or compound fixed-veset patterns (including veset haguf, dilug, and overlapping patterns) that the source itself directs users to review with a halachic authority. The two common patterns—fixed yom hachodesh and standard fixed haflagah—now have tested state machines for establishment, deviations, uprooting, and reinstatement.

Sources:
- [Veset Hachodesh](https://www.yoatzot.org/677/) – including the day-30 / 29-day-month case and the long-cycle exemption.
- [Haflagah (Interval)](https://www.yoatzot.org/670/) – Hebrew-date interval, onah of the latest flow, Chabad distinction, and differing views on shorter cycles.
- [Guide to Observing Vesatot](https://www.yoatzot.org/547/) – the three basic onot for a non-fixed pattern.
- [Keeping a Veset Calendar](https://www.yoatzot.org/548/) – practical calendar calculations.

### Review outcome

- **Research verified:** the source matrix is sufficient to define implementation questions and negative/edge-case tests.
- **Technical approval:** date/time capture, explicit unknown states, profile versioning, and non-destructive history can be implemented independently of the halachic decisions.
- **Not approved for automatic psak:** the source pages describe differing community practices, exceptions, and individual-question cases. No universal CycleFlow profile can be inferred from them.
- **Release gate remains open:** a qualified reviewer representing the intended community must sign off on each profile row, including the exact source/authority, rule version, exceptions, and test vectors. Until then, all generated dates remain advisory and the existing engine must not be advertised as a halachic ruling.

## Implementation gate

The online sources provide enough material to build a traceable research matrix and test scenarios. They do not establish one universally applicable rule set. The engine must remain unchanged until an authorized reviewer selects and signs off on the exact profile matrix. A source citation is not a substitute for that approval.
