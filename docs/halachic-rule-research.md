# Halachic rule research matrix — CycleFlow

Status: research completed for the core rule families; implementation is intentionally gated. This document records what public sources say, where customs differ, and what the software must not infer. It is not a psak halacha.

## Executive finding

A two-value setting ("Ashkenaz" / "Sephard") is not a sufficient rule model. Sources describe different practices within Sephardi communities, additional stringencies among some Ashkenazi communities, and a distinct Chabad approach to veset haflagah. A future engine must use explicit, reviewable rule profiles rather than infer every rule from one community label.

## Rule matrix

| Rule family | What the sources establish | Software implication | Approval still required |
|---|---|---|---|
| Minimum wait | Nishmat describes a five-day wait for Ashkenazi and some Sephardi communities. Some Sephardi communities use a four-day method with a different starting point (last intercourse rather than onset of niddah). Stain cases and special circumstances have additional details. | Do not implement as simply Ashkenaz=5, Sephard=4. Store onset type/time and, only where appropriate, the last-intercourse reference. | Exact family/community profile, starting point, count convention, stain/flow cases, and exceptions. |
| Seven clean days | The clean days are counted by the Jewish calendar, each day beginning at sunset. A valid hefsek before sunset permits the first clean day to begin that night; immersion is after nightfall following completion. | Keep sunset and nightfall (tzeit) as distinct astronomical/halachic inputs. Do not equate sunset with immersion time. | Exact local zmanim convention and all exceptional cases. |
| Hefsek taharah | Nishmat describes a hefsek before sunset, ideally in the late afternoon; after-sunset attempts require a question and cannot automatically start the next day's count. A prior valid examination may sometimes be relied on. | Save the actual time and date; never silently convert an after-sunset hefsek into a before-sunset one. | Rules for exact-boundary timestamps, early backup checks, and profile-specific practices. |
| Onah day/night | Nishmat's onah guide describes day onot as sunrise-to-sunset and night onot as sunset-to-sunrise. | A sunset-only calculation is insufficient for assigning day/night onah. The service also needs sunrise, and the rule engine must store the source onah. | Exact boundary convention and handling of uncertain event times. |
| Onah beinonit | The common view is day 30 from the beginning of the last flow. Other authorities/customs observe day 31, and some observe the full 24-hour Hebrew date on day 30. | Make day 30, day 31, and full 24-hour day separate profile settings; never hard-code both days for everyone. | Which position/custom is selected and how it interacts with other vesatot. |
| Yom hachodesh | Calculated by Hebrew day-of-month and the onah of the original onset. If the original onset was on day 30 and the next month has no day 30, sources describe multiple approaches: skip, observe day 29, or observe the first day of the next month. | Use a Hebrew calendar engine and an explicit missing-day policy per profile. | Chosen policy for each approved community profile and the carry-over/uprooting rules. |
| Veset haflagah | The common method counts the interval from one onset to the next and observes the matching day/night onah. The Chabad source describing Shulchan Aruch HaRav counts from the end of bleeding (usually represented by hefsek taharah) to the next onset. It also details what to do when the exact end of bleeding was not recorded. | The event model must distinguish flow onset from bleeding cessation/hefsek and must support multiple calculation methods. | Which Chabad authority/custom is intended, fallback rules for missing cessation data, and how non-Chabad profiles treat the alternative. |
| Or Zarua | An additional onah before a primary veset is a custom/stringency, not a universal base rule. The scope can differ by veset type; some sources distinguish whether the veset is kavua. | Make Or Zarua an explicit optional rule with scope per veset type; do not turn it on automatically for all Ashkenazi users. | Which preceding onot are observed for each profile and what happens when it overlaps mikveh night. |
| Stain vs. flow | Sources distinguish a flow from a stain and explain that the minimum wait begins when niddah status is incurred, which can also occur through a qualifying stain. Not every stain automatically has that status. | A questionnaire can collect size, color, surface, source, and context; it must not decide niddah status or reset a count automatically. | Which questions to ask and how to route uncertainty to a qualified authority. |
| Fertility / early ovulation | Nishmat and PUAH describe cases where documented ovulation, hormonal treatment, and fertility concerns affect how some authorities approach veset observance. Their answers differ by authority and circumstance. | Store ovulation tests/medical data as user-entered observations and produce a clinician/halachic-consultation summary. Never automatically waive a veset or change immersion dates. | Medical thresholds, evidence requirements, and authority-specific decision rules. |

## Required data model before implementing the rule engine

The current PR adds optional civil event time, city ID, and sunset relation. The following are future requirements, not yet implemented:

- Distinguish flow_start, stain, medical_bleeding, and other event categories. A user-selected event type must not itself establish niddah status.
- Preserve both the civil date/time and the recorded local city/time-zone context.
- Store actual or unknown bleeding_stopped_at / hefsek time separately from the start of flow.
- Store the onah of onset (day, night, unknown) as a recorded fact where known; do not reconstruct it from a changed city setting.
- Store the selected halachic profile and its version with each calculation, so changing settings does not rewrite historical calculations.
- Store rule outputs as explainable results: source event IDs, rule ID/version, assumptions, uncertainty, and whether a user/authority confirmed the result.
- Keep sunset, sunrise, and tzeit as separate values. Tzeit is not a fixed universal offset from sunset; the selected calculation convention must be explicit.
- Preserve an unknown / needs review state. Missing times, ambiguous stains, or missing hefsek data must never be converted into a confident date.

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
- Yoatzot Halacha, [Shivah Neki'im](https://www.yoatzot.org/529/).
- Yoatzot Halacha, [Laws of Stains](https://www.yoatzot.org/522/).
- Din Online, [זמני הפרישה בעונה בינונית](https://din.org.il/2010/11/25/זמני-הפרישה-בעונה-בינונית/), presenting a 24-hour practice and additional stringencies.
- Din Online, [עונה בינונית](https://din.org.il/2024/09/12/עונה-בינונית/), explaining the distinction between day 30, day 31 and whether a missed check must be completed.
- Peninei Halacha, [הפרישה לווסת שאינו קבוע](https://ph.yhb.org.il/18-06-05/), overview of the three basic onot.

### Review outcome

- **Research verified:** the source matrix is sufficient to define implementation questions and negative/edge-case tests.
- **Technical approval:** date/time capture, explicit unknown states, profile versioning, and non-destructive history can be implemented independently of the halachic decisions.
- **Not approved for automatic psak:** the source pages describe differing community practices, exceptions, and individual-question cases. No universal CycleFlow profile can be inferred from them.
- **Release gate remains open:** a qualified reviewer representing the intended community must sign off on each profile row, including the exact source/authority, rule version, exceptions, and test vectors. Until then, all generated dates remain advisory and the existing engine must not be advertised as a halachic ruling.

## Implementation gate

The online sources provide enough material to build a traceable research matrix and test scenarios. They do not establish one universally applicable rule set. The engine must remain unchanged until an authorized reviewer selects and signs off on the exact profile matrix. A source citation is not a substitute for that approval.
