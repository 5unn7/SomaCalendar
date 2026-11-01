# SOMA v0.5 — Horizon with Intention

A minimal, designed-for-daily-use Vedic lunar calendar for Android, combining real Grahan 1.0.1 astronomical calculations, local sunrise and lunar transitions, a 24-hour Hora/Rahu Kaal/Abhijit timeline, Vikram Samvat regional year conventions, and optional personalized sidereal natal charts.

## Birthplace search (not hardcoded)
Go to **My Sky → Birthplace → Search**. Online search uses the Open-Meteo geocoding API to return place names, approximate coordinates, elevation (when available) and IANA timezone. Select a result. Or enter exact coordinates and IANA timezone manually, **even without internet**. Birth date/time are never sent to the search service, but your typed place name is transmitted on request. Online search is subject to the provider's fair-use and commercial terms.

The application maintains separate observation coordinates (presets or explicit GPS) and private natal birth coordinates. Moving your observation location never changes your saved natal chart. GeoLookup returns approximate city-centre coordinates. Historical IANA zone offsets are applied by Intl for the birth instant; historical timezone errors and DST overlap ambiguity are not exhaustively resolved. Confirm ambiguous records. Birth details stored locally; Android backup disabled.

## Other features
- Today: current astronomical Moon phase, tithi, upcoming local time event, optional intention.
- Horizon: 24-hour interactive time scrubber, local sunrise/sunset, Rahu Kaal and Abhijit intervals, selected Hora and Tithi at time.
- Calendar: seven-day cycle and North Indian / Gujarati Vikram Samvat year toggle (reference boundaries only 2026–2028; do not use as a validated festival calendar).
- My Sky: local natal chart in North or South Indian style, transit-Moon context, Five Panchang limbs in the Observatory.
- Explicitly requested device-location permission, optional nearby weather by Open-Meteo, and a simple Android home-screen widget showing the last time the app was opened.
- Fully packaged HTML, CSS, JavaScript and Grahan calculations: no CDNs, login, advertisements or tracking.

## How to build
GitHub Actions → **Build Soma debug APK** → download artifact `soma-debug-apk`. The Android emulator workflow checks that Soma starts and produces real health data. Users installing a separately signed debug APK may need to uninstall the older version, which deletes local birth details.

## Precision / limitations
This prototype does **not** apply precise terrain-horizon or atmospheric refraction corrections, Swiss Ephemeris, full regional festival algorithms, independent historical DST verification, automatic widget refresh or full planetary transit rectification. The sunrise calculations use Grahan's conventional refracted horizon. IANA time zone handling depends on OS timezone data.

Astronomical position and calendar facts are distinct from traditional cultural interpretations; the app does not assert that a time period guarantees outcomes or affects medical conditions.

## Licenses
Grahan 1.0.1: MIT © Svarbhanu Neel (bundled license notice in the HTML), https://github.com/svarbhanu/grahan. Open-Meteo geocoding and forecast APIs have separate terms, see https://open-meteo.com/en/terms. Swiss Ephemeris is **not included** because distribution requires AGPL compliance or a professional license.
