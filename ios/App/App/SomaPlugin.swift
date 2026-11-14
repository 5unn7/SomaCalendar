import UIKit
import Capacitor
import EventKit
import EventKitUI
import WidgetKit

/// Soma's own native calls, used by src/redesign/native.js: the widget feed and add-to-calendar.
@objc(SomaPlugin)
public class SomaPlugin: CAPPlugin, CAPBridgedPlugin, EKEventEditViewDelegate {
  public let identifier = "SomaPlugin"
  public let jsName = "Soma"
  public let pluginMethods: [CAPPluginMethod] = [
    CAPPluginMethod(name: "setWidgetFeed", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "addCalendarEvent", returnType: CAPPluginReturnPromise),
  ]

  /// A week of precomputed Panchang intervals (src/redesign/widget.js), shared with the widget through the App Group.
  @objc func setWidgetFeed(_ call: CAPPluginCall) {
    let json = call.getString("json") ?? ""
    guard json.utf8.count <= 300_000, let data = json.data(using: .utf8),
          (try? JSONSerialization.jsonObject(with: data)) is [String: Any] else {
      return call.reject("Widget feed missing, too large or not JSON")
    }
    AppGroup.defaults.set(json, forKey: "feed")
    WidgetCenter.shared.reloadAllTimelines()
    call.resolve()
  }

  /// The system event editor, prefilled. On iOS 17+ it needs no calendar permission, and Soma never reads the calendar.
  @objc func addCalendarEvent(_ call: CAPPluginCall) {
    let iso = ISO8601DateFormatter()
    iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let plain = ISO8601DateFormatter()
    func date(_ key: String) -> Date? { call.getString(key).flatMap { iso.date(from: $0) ?? plain.date(from: $0) } }
    guard let start = date("start"), let end = date("end") else { return call.reject("Invalid event time") }
    DispatchQueue.main.async {
      guard let host = self.bridge?.viewController else { return call.reject("No window") }
      let store = EKEventStore()
      let event = EKEvent(eventStore: store)
      event.title = String((call.getString("title") ?? "Soma").prefix(200))
      event.startDate = start
      event.endDate = max(end, start)
      event.location = call.getString("place")
      event.notes = call.getString("notes")
      let editor = EKEventEditViewController()
      editor.eventStore = store
      editor.event = event
      editor.editViewDelegate = self
      host.present(editor, animated: true)
      call.resolve()
    }
  }

  public func eventEditViewController(_ controller: EKEventEditViewController, didCompleteWith action: EKEventEditViewAction) {
    controller.dismiss(animated: true)
  }
}
