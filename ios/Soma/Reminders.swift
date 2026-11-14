import Foundation
import UserNotifications

/// Local vrat, parana, daily panchang and Rahu Kaal reminders. The web layer computes the next 30 days
/// (`reminderPlan()` in app.js) and hands them over as JSON [{id, at (epoch ms), title, body}].
/// iOS keeps at most 64 pending notifications per app, so the soonest `limit` are scheduled;
/// the page re-sends the plan on every launch and day change, which tops the queue back up. Nothing leaves the phone.
enum Reminders {
  static let limit = 60
  static let prefix = "soma."

  struct Item: Decodable { let id: String; let at: Double; let title: String?; let body: String? }

  /// Pure part, unit-tested: future, de-duplicated, soonest first, capped.
  static func plan(json: String, now: Date = Date()) -> [Item] {
    guard let data = json.data(using: .utf8), let items = try? JSONDecoder().decode([Item].self, from: data) else { return [] }
    var seen = Set<String>()
    return items
      .filter { !$0.id.isEmpty && $0.at > now.timeIntervalSince1970 * 1000 && seen.insert($0.id).inserted }
      .sorted { $0.at < $1.at }
      .prefix(limit)
      .map { $0 }
  }

  static func schedule(json: String) {
    let items = plan(json: json)
    let center = UNUserNotificationCenter.current()
    center.getPendingNotificationRequests { pending in
      center.removePendingNotificationRequests(withIdentifiers: pending.map(\.identifier).filter { $0.hasPrefix(prefix) })
      for item in items {
        let content = UNMutableNotificationContent()
        content.title = String((item.title ?? "Soma").prefix(120))
        content.body = String((item.body ?? "").prefix(300))
        content.sound = .default
        content.threadIdentifier = item.id.components(separatedBy: "-").first ?? "soma"
        let date = Date(timeIntervalSince1970: item.at / 1000)
        let parts = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
        let trigger = UNCalendarNotificationTrigger(dateMatching: parts, repeats: false)
        center.add(UNNotificationRequest(identifier: prefix + item.id, content: content, trigger: trigger))
      }
    }
  }

  static func requestPermission() {
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
  }
}
