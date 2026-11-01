# SOMA — Cosmic Calendar

An early, minimal, offline-first Android app uniting Gregorian dates with the Vedic Panchang, Moon phases, optional personal birth-chart calculations, private notes and a home-screen widget.

## Build an APK
GitHub Actions builds automatically on push to `main`, or via **Actions → Build Soma debug APK → Run workflow**.
When the workflow succeeds, download the artifact named `soma-debug-apk`, extract it, and install `app-debug.apk` on an Android phone.

Build yourself using Node 22+, JDK 17, Gradle 8.9 and Android SDK platform 35:
```sh
npm install
npm run test:fixtures
npm run bundle
cd android
gradle assembleDebug
```
The JavaScript bundle is generated into `android/app/src/main/assets/app.js` before compilation.

## What works in this prototype
- Grahan `panchangAtSunrise()` for tithi, nakshatra, yoga, karana, sunrise, sunset and Rahu Kaal
- Real lunar phase and illumination, calendar month navigation
- Personal birth chart (`kundali`, `kundaliSvg`) with selected city preset
- Private notes and birth details stored on the device only
- Native Android widget with **last displayed** Panchang data (tap widget to open app and refresh)
- No INTERNET, location, analytics, ad, account or cloud-storage permissions.

## What is not finished
- **No festivals yet**: festival dates require verified region-specific rules, not simplistic lunar phase assumptions.
- The widget is not self-refreshing. It displays the last calculated data with a "last opened" label.
- City centre coordinates are approximate. Birth times around daylight-saving changes can be ambiguous.
- The first GitHub Actions run is the integration test; a passing workflow must be confirmed before claiming an APK exists.
- Traditional astrological interpretations are not scientific predictions.
- This is a debug prototype, not a production-ready release or security audit.

## License and attribution
Application prototype: MIT. Grahan core and Vedic packages: MIT © Svarbhanu Neel — https://github.com/svarbhanu/grahan.
No Grahan source is vendored. Dependencies are installed from npm at build time.
