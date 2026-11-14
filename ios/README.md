# Soma for iOS

A small native Swift app around the same HTML/JS as Android. The UI lives in `src/redesign`; `npm run bundle`
writes it to `android/app/src/main/assets`, and that folder is copied into the iOS app as `assets/`.

| Piece | File |
| --- | --- |
| WKWebView, `soma://` bundle loader, navigation rules | `Soma/WebViewController.swift` |
| `window.SomaNative` shim and native calls (location, weather, place search, calendar, haptics) | `Soma/NativeBridge.swift` |
| Local reminders (iOS keeps at most 64; the soonest 60 are scheduled) | `Soma/Reminders.swift` |
| Home Screen and Lock Screen widget | `SomaWidget/SomaWidget.swift`, `Shared/WidgetFeed.swift` |
| Simulator tests that load the real page | `SomaTests/SomaTests.swift` |

Minimum iOS 17. Bundle ID `app.soma.calendar` (change `SOMA_BUNDLE_ID` in `project.yml` before the first upload; it is permanent after).
The widget and app share data through the App Group `group.<bundle id>`.

## Build on a Mac

```sh
npm ci && npm run bundle
brew install xcodegen
cd ios && xcodegen generate && open Soma.xcodeproj
```

## CI

- `.github/workflows/ios.yml` builds every PR that touches the app, runs the simulator tests and saves a screenshot.
- `.github/workflows/ios-release.yml` runs on a `v*` tag and uploads a signed build to TestFlight. It needs repository
  secrets `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID` and `ASC_KEY_P8` (an App Store Connect API key with the App Manager role).
  It never submits for App Review.

## Bridge calls

Same names as Android's `MainActivity.Bridge`: `appReady`, `appFailure`, `requestLocation` → `somaReceiveLocation`,
`fetchWeather` → `somaReceiveWeather`, `searchBirthplaces` → `somaReceiveBirthplaces`, `addCalendarEvent`,
`scheduleReminders`, `requestNotifications`, `updateWidgetFeed`. iOS adds `SomaNative.platform === 'ios'` and
`SomaNative.haptic('light' | 'select' | 'success' | 'warning')` for the redesign to use.
