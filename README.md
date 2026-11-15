# Soma 0.8 Preview — your daily panchang, in your language

Know the right time, keep every vrat. Soma is an offline, private panchang for Android that speaks from inside the tradition: what today is, what it is good for, when the shubh times are, and which vrat or festival is coming, computed for your own city.

## Included
- **Today:** tithi, nakshatra, vaar and lunar month with Vikram Samvat; a one-line verdict (good for, avoid, Rahu Kaal); today's festival or vrat with Ekadashi parana; the next festivals and vrats; current Choghadiya and Hora with the next good window; practice chips (Puja, Japa, Daan, Vrat, Start work, Travel, Buy) that show the best times today with the deity and mantra of the day; Abhijit, Brahma muhurat, Rahu Kaal, Yamaganda, Gulika; the five limbs at sunrise with end times, deity and meaning.
- **Calendar:** month grid with tithi and festival names; filters for Gujarati, Pan-Indian, International and Vrat days (defaults come from your location); personally favourable days underlined; local plans with a muhurat check.
- **Muhurat:** day and night Choghadiya, 24 Horas, inauspicious periods, and a muhurat finder for griha pravesh, vehicle, business, property, vidyarambh, travel and mundan (skips Kharmas, and Chaturmas where it applies).
- **Moon:** phase, tithi, nakshatra and rashi at any time, moonrise and moonset.
- **Me:** janma rashi and nakshatra, daily Chandrabalam and Tarabalam, your favourable days this month, janma kundali, Mulank and Bhagyank.
- **Gyan:** short lessons on tithi, nakshatra, Choghadiya and Hora, Ekadashi and parana, amanta and purnimanta, grahan and sutak, and how Soma calculates.
- **Settings:** English, ગુજરાતી or हिन्दी labels; amanta or purnimanta month names; festival sets; local reminders the evening before each vrat or festival, at parana time, a daily panchang at sunrise and Rahu Kaal.

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

Output: `android/app/build/outputs/apk/debug/app-debug.apk`. GitHub Actions builds the redesign branch and has an Android emulator smoke workflow. Canonical UI source lives in `src/redesign`; `npm run bundle` copies it and bundles the natal engine.

## Computation and accuracy
Astronomy Engine 2.1.19 computes geocentric ecliptic Moon–Sun elongation. Tithi is floor(elongation/12°), with numerical searches for boundaries. Rise/set uses its standard atmospheric model at zero elevation. Times are rounded to minutes. Tithi instants are global; sunrise assignment and local clock labels depend on place and time zone.

Month naming uses amanta new-moon boundaries and solar signs with the Lahiri ayanamsa (linear approximation); purnimanta naming moves the Krishna paksha to the next month. Adhik months are detected and carry no festivals (their Padmini and Parama Ekadashis are kept); rare kshaya months are not handled.

Festivals are computed, not looked up: each rule names an amanta month, a tithi and the moment at which it must prevail (udaya/sunrise for most, pradosh for Diwali, Dhanteras, Holika Dahan and Pradosh, nishita for Shivratri, Janmashtami and Kali Chaudas, madhyahna for Ram Navami and Ganesh Chaturthi, aparahna for Dussehra, moonrise for Sankashti and Karwa Chauth), with fallbacks for kshaya tithis. Fourteen 2026 dates for Ahmedabad are pinned in `tests/panchang.mjs`. Families and sampradayas sometimes follow a different rule, so a date can differ by a day from a local almanac. Ekadashi parana follows the sunrise rule and Hari Vasara. Eclipses are listed only when visible from your city, with sutak start.

Birth charts reuse the existing Grahan engine; the standalone birth nakshatra uses Astronomy Engine and the same Lahiri offset, so boundary cases can differ. Numerology uses single-digit reduction, without master numbers.

IANA zone offsets come from Android WebView. Nonexistent DST times are rejected. Ambiguous repeated times are not disambiguated; independently verify such birth/event times. GPS uses the phone's configured zone; confirm it when travelling.

## Privacy and scheduling
Birth details, coordinates and plans are in local WebView storage under a new key; Android backup is disabled. The older app's data is not migrated. Source links open externally. Native calendar export shares only the chosen plan with the selected calendar app. Reminders are scheduled on the phone with AlarmManager from a 30-day plan the app computes; they survive reboots and need notification permission on Android 13+. No background tracking or cloud sync.

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
