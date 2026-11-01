# SOMA — Earth × Sky (Android v0.2.2)

A minimal, privacy-conscious Android Panchang, Moon and atmospheric-awareness experiment powered by [Grahan](https://github.com/svarbhanu/grahan) under the MIT license.

## Startup verification
The main Android build now runs a DOM ID contract test to detect JavaScript references to absent elements before packaging. The emulator smoke test separately verifies that the WebView successfully initializes on Android 10. Do not infer functional correctness from Gradle success alone.

## Build
A push to main runs the GitHub Actions **Build Soma debug APK** workflow. Download the `soma-debug-apk` artifact if its check succeeds.

## Implemented
- Daily sunrise-based Panchang with transition times, local sunrise/sunset, Rahu Kaal, lunar phase.
- Interactive Gregorian calendar and private notes.
- Optional birth information and natal Lagna / Rashi / Nakshatra from distinct birthplace coordinates.
- User-initiated **foreground** Android location request with approximate/precise system permissions.
- GPS telemetry: latitude, longitude, reported altitude/accuracy, **device** timezone, mean-solar/clock offset. No background location tracking. No automatic reverse geocoding; display label "Device GPS".
- Local Dinaman, daylight midpoint (not exact solar transit), next sunrise/sunset countdown.
- Approximate geocentric Moon azimuth/altitude from Grahan astronomical coordinates; NOT a topocentric/refraction-corrected compass.
- Optional on-tap weather request via HTTPS to [Open-Meteo](https://open-meteo.com/): current temperature, feels-like, humidity, dew point, cloud cover, precipitation, wind, UV, and surface pressure where provided.
- Weather and Panchang home-screen widget displays **last opened/last fetched** data.
- Contextual five-element weather groupings as symbolic presentation, without biomedical assertions.

## Privacy and data
Birth data and notes are stored in WebView localStorage and are not uploaded by Soma. Android backup is disabled. Location access must be granted by the user; a coordinate fix is requested only by tapping "Use GPS". GPS coordinates are stored locally for the chosen current location; select a manual city to switch back. Weather is fetched **only after** tapping "Get weather", which sends selected lat/lon to Open-Meteo. No analytics, ads, logins or accounts. The weather API is free for non-commercial use (attribution required); obtain a suitable commercial agreement before monetization.

## Out of scope / cautions
- Elevation and local horizon/refraction are **not** applied to Grahan sunrise/sunset or ascendant positions; no second-level precision is claimed.
- Historical timezone conversion uses IANA zones from the device for live GPS and built-in birth-city presets. GPS timezone is NOT geospatially determined; if device timezone is wrong, the results can be wrong. DST gaps/overlaps need a dedicated UI.
- Moon bearing is geocentric and compass is north-up, not tied to phone sensor heading. Moonrise/set, moon parallax, planet compass, true Sandhya twilight, Kp, audio noise, soil moisture, barometric trends, Hora, detailed Muhurta and festival rules remain for future validation.
- Atmospheric "sky clarity" based on cloud cover is a proxy, not measured optical transparency or an assertion that a star is naked-eye visible.
- Android lock-screen widget support varies by platform/launcher. Home-screen widget works on launchers that support AppWidgets and does not update autonomously in this prototype.
- Weather conditions are model-derived and may lag; availability depends on internet. Do not present these as device sensors or immediate health indicators.
- Traditional astrology is cultural/spiritual interpretation, not empirically validated prediction.

## Testing
`npm run test:fixtures` checks documented Grahan fixture behavior, `npm run bundle` generates the offline browser asset, and Gradle builds the Android debug APK. A successful compilation is not a substitute for testing location permissions, view transitions, widget on real devices, or independent astronomical comparisons.
