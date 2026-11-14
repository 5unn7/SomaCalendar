import UIKit
import WebKit
import CoreLocation
import EventKit
import EventKitUI
import UserNotifications
import WidgetKit
import os

/// iOS side of `window.SomaNative`. Same method names and callbacks as the Android `MainActivity.Bridge`,
/// so src/redesign/app.js runs unchanged on both platforms.
final class NativeBridge: NSObject, WKScriptMessageHandler, CLLocationManagerDelegate, EKEventEditViewDelegate {
  static let handlerName = "soma"

  /// Defines `window.SomaNative` before any page script runs. Each call posts {m, a} to the native handler.
  static let shim = """
  (function(){
    var h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.soma;
    if (!h) return;
    function call(m) { return function(){ h.postMessage({ m: m, a: Array.prototype.slice.call(arguments) }); }; }
    var api = { platform: 'ios' };
    ['addCalendarEvent','appReady','appFailure','updateWidget','updateWidgetFeed','updateAtmosphere','searchBirthplaces',
     'scheduleReminders','requestNotifications','requestLocation','fetchWeather','haptic'].forEach(function(m){ api[m] = call(m); });
    Object.defineProperty(window, 'SomaNative', { value: Object.freeze(api), writable: false, configurable: false });
  })();
  """

  private weak var host: WebViewController?
  private let location = CLLocationManager()
  private var wantsLocation = false
  private let log = Logger(subsystem: "app.soma.calendar", category: "SomaJS")
  private let session: URLSession = {
    let c = URLSessionConfiguration.ephemeral // no cookies, no cache on disk
    c.timeoutIntervalForRequest = 12
    c.httpAdditionalHeaders = ["User-Agent": "SomaCalendar/0.7 (iOS; Open-Meteo attribution in app)"]
    return URLSession(configuration: c)
  }()

  func attach(to host: WebViewController) {
    self.host = host
    location.delegate = self
    location.desiredAccuracy = kCLLocationAccuracyKilometer
  }

  func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
    guard message.frameInfo.isMainFrame, message.frameInfo.request.url?.scheme == WebViewController.scheme,
          let body = message.body as? [String: Any], let method = body["m"] as? String else { return }
    let a = body["a"] as? [Any] ?? []
    func s(_ i: Int) -> String { i < a.count ? (a[i] as? String ?? (a[i] as? NSNumber)?.stringValue ?? "") : "" }
    func d(_ i: Int) -> Double { i < a.count ? ((a[i] as? NSNumber)?.doubleValue ?? Double(s(i)) ?? .nan) : .nan }

    switch method {
    case "appReady": host?.pageReady()
    case "appFailure": host?.pageFailed(String(s(0).prefix(500)))
    case "updateWidgetFeed": saveWidgetFeed(s(0))
    case "updateWidget", "updateAtmosphere": break // older widget fields; the iOS widget reads the full feed only
    case "scheduleReminders": Reminders.schedule(json: s(0))
    case "requestNotifications": Reminders.requestPermission()
    case "requestLocation": requestLocation()
    case "fetchWeather": fetchWeather(lat: d(0), lon: d(1))
    case "searchBirthplaces": searchBirthplaces(s(0))
    case "addCalendarEvent": addCalendarEvent(title: s(0), start: s(1), end: s(2), place: s(3), notes: s(4))
    case "haptic": haptic(s(0))
    default: log.warning("Unknown bridge call \(method, privacy: .public)")
    }
  }

  // MARK: Widget

  /// A week of precomputed Panchang intervals (src/redesign/widget.js), shared with the widget through the App Group.
  private func saveWidgetFeed(_ json: String) {
    guard json.utf8.count <= 300_000, let data = json.data(using: .utf8),
          (try? JSONSerialization.jsonObject(with: data)) is [String: Any] else {
      log.warning("Rejected widget feed"); return
    }
    AppGroup.defaults.set(json, forKey: "feed")
    WidgetCenter.shared.reloadAllTimelines()
  }

  // MARK: Location: when-in-use only, about 1 km accuracy.

  private func requestLocation() {
    wantsLocation = true
    switch location.authorizationStatus {
    case .notDetermined: location.requestWhenInUseAuthorization()
    case .denied, .restricted:
      wantsLocation = false
      locationError("Location permission denied. Manual city selection still works.")
    default: location.requestLocation()
    }
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    guard wantsLocation else { return }
    switch manager.authorizationStatus {
    case .authorizedWhenInUse, .authorizedAlways: manager.requestLocation()
    case .denied, .restricted:
      wantsLocation = false
      locationError("Location permission denied. Manual city selection still works.")
    default: break
    }
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard wantsLocation, let loc = locations.last else { return }
    wantsLocation = false
    let j: [String: Any] = [
      "lat": loc.coordinate.latitude, "lon": loc.coordinate.longitude,
      "accuracy": loc.horizontalAccuracy >= 0 ? loc.horizontalAccuracy : NSNull(),
      "altitude": loc.verticalAccuracy >= 0 ? loc.altitude : NSNull(),
      "zone": TimeZone.current.identifier,
    ]
    host?.send("somaReceiveLocation", Self.json(j))
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    guard wantsLocation else { return }
    wantsLocation = false
    let denied = (error as? CLError)?.code == .denied
    locationError(denied ? "Location permission denied. Manual city selection still works." : "No location fix received. Try again.")
  }

  private func locationError(_ message: String) { host?.send("somaReceiveLocation", Self.json(["error": message])) }

  // MARK: Opt-in network lookups (Open-Meteo). Only the rounded coordinates or the typed place name leave the phone.

  private func fetchWeather(lat: Double, lon: Double) {
    guard lat.isFinite, lon.isFinite, abs(lat) <= 90, abs(lon) <= 180 else {
      return host?.send("somaReceiveWeather", "ERROR: Coordinates out of range.") ?? ()
    }
    let params = "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,uv_index,dew_point_2m,weather_code,is_day"
    // Two decimals (about 1 km) is plenty for weather and keeps the location coarse.
    let url = URL(string: String(format: "https://api.open-meteo.com/v1/forecast?latitude=%.2f&longitude=%.2f&current=%@&timezone=auto", locale: Locale(identifier: "en_US_POSIX"), lat, lon, params))!
    get(url, limit: 40_000) { [weak self] text in
      guard let text, let obj = Self.object(text), obj["current"] != nil else {
        return self?.host?.send("somaReceiveWeather", "ERROR: Weather unavailable. Try again later.") ?? ()
      }
      self?.host?.send("somaReceiveWeather", Self.json(obj))
    }
  }

  private func searchBirthplaces(_ query: String) {
    let term = query.trimmingCharacters(in: .whitespacesAndNewlines)
    guard (3...100).contains(term.count) else { return placeError("Search for a place using at least three letters.") }
    var c = URLComponents(string: "https://geocoding-api.open-meteo.com/v1/search")!
    c.queryItems = [.init(name: "name", value: term), .init(name: "count", value: "8"), .init(name: "language", value: "en")]
    get(c.url!, limit: 60_000) { [weak self] text in
      guard let self else { return }
      guard let text, let obj = Self.object(text) else { return self.placeError("Online place search failed. Use manual coordinates or try again.") }
      let rows = (obj["results"] as? [[String: Any]] ?? []).prefix(8)
      let results: [[String: Any]] = rows.compactMap { row in
        guard let lat = (row["latitude"] as? NSNumber)?.doubleValue, let lon = (row["longitude"] as? NSNumber)?.doubleValue,
              let zone = row["timezone"] as? String else { return nil }
        let name = [row["name"] as? String ?? "Place", row["admin1"] as? String ?? "", row["country"] as? String ?? ""]
          .filter { !$0.isEmpty }.joined(separator: ", ")
        var o: [String: Any] = ["name": name, "lat": lat, "lon": lon, "zone": zone]
        if let e = (row["elevation"] as? NSNumber)?.doubleValue { o["elevation"] = e }
        return o
      }
      self.host?.send("somaReceiveBirthplaces", Self.json(["results": results]))
    }
  }

  private func placeError(_ message: String) { host?.send("somaReceiveBirthplaces", Self.json(["error": message])) }

  /// HTTPS GET with no redirects followed and a response size cap, like the Android shell.
  private func get(_ url: URL, limit: Int, done: @escaping (String?) -> Void) {
    var req = URLRequest(url: url)
    req.httpMethod = "GET"
    session.dataTask(with: req) { data, response, _ in
      guard let http = response as? HTTPURLResponse, http.statusCode == 200, http.url?.host == url.host,
            let data, data.count <= limit else { return done(nil) }
      done(String(data: data, encoding: .utf8))
    }.resume()
  }

  // MARK: Calendar: the system editor; iOS 17 needs no calendar permission for it, and Soma never reads the calendar.

  private func addCalendarEvent(title: String, start: String, end: String, place: String, notes: String) {
    let iso = ISO8601DateFormatter()
    iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let plain = ISO8601DateFormatter()
    guard let host, let s = iso.date(from: start) ?? plain.date(from: start), let e = iso.date(from: end) ?? plain.date(from: end) else { return }
    let store = EKEventStore()
    let event = EKEvent(eventStore: store)
    event.title = String(title.prefix(200))
    event.startDate = s
    event.endDate = max(e, s)
    event.location = place
    event.notes = notes
    let editor = EKEventEditViewController()
    editor.eventStore = store
    editor.event = event
    editor.editViewDelegate = self
    host.present(editor, animated: true)
  }

  func eventEditViewController(_ controller: EKEventEditViewController, didCompleteWith action: EKEventEditViewAction) {
    controller.dismiss(animated: true)
  }

  // MARK: Haptics, for the redesign to call on chips and toggles.

  private func haptic(_ kind: String) {
    switch kind {
    case "success": UINotificationFeedbackGenerator().notificationOccurred(.success)
    case "warning": UINotificationFeedbackGenerator().notificationOccurred(.warning)
    case "select": UISelectionFeedbackGenerator().selectionChanged()
    default: UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
  }

  // MARK: JSON helpers

  static func json(_ obj: Any) -> String {
    guard let data = try? JSONSerialization.data(withJSONObject: obj), let s = String(data: data, encoding: .utf8) else { return "{}" }
    return s
  }

  static func object(_ text: String) -> [String: Any]? {
    guard let data = text.data(using: .utf8) else { return nil }
    return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
  }
}
