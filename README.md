# Soma 0.6 Preview — Understand your time

A full redesign of Soma around three daily questions: **What tithi is it? When does it change? Why?** Gujarati terminology is paired with concise English teaching. The interface uses deep green, warm ivory, a calculated Moon, and five simple destinations.

## Included
- **Today:** current tithi (local noon for another date), amanta lunar month, local sunrise/sunset, tithi at sunrise, complete tithi boundaries.
- **Calendar:** month grid labelled by sunrise tithi; Ekadashi/Purnima/Amavasya highlights; local event plans with native Android calendar insertion. Calendar insertion opens a review screen; it does not silently write events.
- **Moon:** phase rendering from calculated elongation, illumination, time scrubber, moonrise/set and upcoming lunar quarters. Image is schematic, not a sky-orientation simulator.
- **Learn:** Gujarati terminology, variable-length tithis, lunar months, solar versus civil time, source links, and explicit separation of astronomy from cultural interpretation.
- **Personal:** local-only birth details, Grahan natal chart, approximate Lahiri birth nakshatra/pada, Mulank and Bhagyank with transparent digit-reduction rules.
- On-demand Android location permission; city presets and manual coordinates/IANA zones; offline calculations. No trackers or account.

## Install
The preview uses **com.soma.calendar.preview**, so it installs beside the previous Soma app without deleting its data. Android 8+ (API 26), target API 35. Enable installation from the app that opens the APK if Android requests it. It is a preview-signed APK, not a Play Store release. The previous profile is not imported; enter a new profile in Preview.

## Build
Use Node 22+, JDK 17+, Android SDK 35, Build Tools 35.0.0 and Gradle 8.9:

```sh
npm ci
npm test
cd android
gradle --no-daemon assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`. GitHub Actions builds the redesign branch and has an Android emulator smoke workflow. Canonical UI source lives in `src/redesign`; `npm run bundle` copies it and bundles the natal engine. Do not use the old Horizon transpiler or `src/app.js` for this preview.

## Computation and accuracy
Astronomy Engine 2.1.19 computes geocentric ecliptic Moon–Sun elongation. Tithi is floor(elongation/12°), with numerical searches for boundaries. Rise/set uses its standard atmospheric model at zero elevation. Times are rounded to minutes. Tithi instants are global; sunrise assignment and local clock labels depend on place and time zone.

Month naming uses amanta new-moon boundaries and solar signs with an **approximate linear Lahiri ayanamsa**. Adhik months are detected; rare kshaya month cases are not handled. There is no Vikram Samvat year display. Calendar highlights are tithi matches, **not validated festivals or fasting prescriptions**. No muhurat, hora or auspiciousness scoring in this redesign.

Birth charts reuse the existing Grahan engine; the standalone birth nakshatra uses Astronomy Engine and an approximate Lahiri offset, so boundary cases can differ. Verify a boundary-sensitive chart independently. Numerology uses single-digit reduction, without master numbers. Traditional meanings are not scientifically established predictions.

IANA zone offsets come from Android WebView. Nonexistent DST times are rejected. Ambiguous repeated times are not disambiguated; independently verify such birth/event times. GPS uses the phone's configured zone; confirm it when travelling.

## Privacy and scheduling
Birth details, coordinates and plans are in local WebView storage under a new key; Android backup is disabled. The older app's data is not migrated. Source links open externally. Native calendar export shares only the chosen plan with the selected calendar app. No background tracking, cloud sync, recurrence, reminders or automatic tithi scheduling. These are future work; current plans are fixed clock-time events.

## Validation in this change
- Passed 120 sampled 2026 tithi-boundary transitions; known new/full Moon phase fixtures; 23/25-hour DST dates; fractional-offset zones; polar no-sunrise handling; Gujarati month and numerology checks.
- Passed DOM interaction tests for all five screens, event persistence/escaping, natal SVG rendering, location/profile independence and invalid zone handling. Canvas is stubbed in DOM tests, so these are not visual tests.
- APK compiled locally with SDK tools and verified with `apksigner` (v2/v3), min/target SDK and manifest inspection. Local Gradle dependency resolution was unavailable, so local packaging used `aapt`, `javac`, `d8`, `zipalign`, and `apksigner` on the same source.
- **Visual browser and Android device/emulator testing remain pending.** Browser launch/preview connections were blocked in the build environment. CI smoke is configured, but its result must be checked separately.

## Sources and licenses
- Astronomy Engine, MIT © Don Cross: https://github.com/cosinekitty/astronomy (license retained in bundled JS).
- Grahan 1.0.1, MIT © Svarbhanu Neel: https://github.com/svarbhanu/grahan (see THIRD_PARTY_NOTICES.md).
- IMD Positional Astronomy Centre: https://packolkata.imd.gov.in/panchang/en/preface
- NASA Moon phases: https://science.nasa.gov/moon/moon-phases/
- USNO equation of time: https://aa.usno.navy.mil/faq/eqtime

Next development priorities: independently validated Gujarati calendar fixtures including intercalary/omitted months; real-device accessibility/layout testing; tithi-based recurrence and reminders; calendar sync; explicit historical DST overlap selection; one consistent sidereal engine.
