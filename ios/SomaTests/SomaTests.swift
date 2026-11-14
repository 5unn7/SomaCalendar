import XCTest
import WebKit
@testable import Soma

/// Runs on the iOS Simulator in CI: loads the real bundled Soma page, checks it reports healthy,
/// builds a widget feed with the page's own widget.js and decodes it the way the widget does.
@MainActor
final class SomaTests: XCTestCase {
  private var controller: WebViewController!

  override func setUp() async throws {
    controller = WebViewController()
    controller.loadViewIfNeeded()
  }

  private func js(_ source: String) async throws -> Any? {
    // The completion-handler form copes with null/undefined results; the async overload does not.
    try await withCheckedThrowingContinuation { done in
      controller.webView.evaluateJavaScript(source) { value, error in
        if let error { done.resume(throwing: error) } else { done.resume(returning: value) }
      }
    }
  }

  /// Polls until the page's app.js has rendered (or fails after 30 s).
  private func waitForApp() async throws -> [String: Any] {
    let deadline = Date().addingTimeInterval(30)
    while Date() < deadline {
      if let text = try? await js("JSON.stringify(window.SomaPrototype && window.SomaPrototype.health ? window.SomaPrototype.health() : null)") as? String,
         let data = text.data(using: .utf8),
         let health = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
        return health
      }
      try await Task.sleep(nanoseconds: 250_000_000)
    }
    let body = (try? await js("document.body ? document.body.innerText.slice(0, 400) : 'no body'")) as? String ?? "?"
    XCTFail("Soma page never became ready. Page text: \(body)")
    return [:]
  }

  func testPageLoadsFromBundleAndIsHealthy() async throws {
    let health = try await waitForApp()
    XCTAssertEqual(health["ready"] as? Bool, true)
    XCTAssertFalse((health["tithi"] as? String ?? "").isEmpty, "tithi label missing")
    let native = try await js("window.SomaNative && window.SomaNative.platform") as? String
    XCTAssertEqual(native, "ios", "SomaNative shim not installed")
    let nav = try await js("document.querySelectorAll('#nav button').length") as? Int ?? 0
    XCTAssertGreaterThan(nav, 0, "bottom navigation did not render")
  }

  func testWidgetFeedFromPageDecodesAndCoversNow() async throws {
    _ = try await waitForApp()
    let json = try await js("JSON.stringify(SomaWidgetFeed.build({name:'Ahmedabad',lat:23.0225,lon:72.5714,zone:'Asia/Kolkata'}, new Date(), []))") as? String
    let feed = try XCTUnwrap(WidgetFeed.decode(json), "widget feed did not decode")
    XCTAssertEqual(feed.zone, "Asia/Kolkata")
    let now = Date()
    let snap = try XCTUnwrap(feed.snapshot(at: now), "feed does not cover now")
    XCTAssertFalse(snap.tithi.isEmpty)
    XCTAssertFalse(snap.chog.isEmpty)
    XCTAssertTrue(["good", "ok", "bad"].contains(snap.chogQuality))
    let marks = feed.boundaries(from: now)
    XCTAssertGreaterThan(marks.count, 10, "a day has at least 16 Choghadiya boundaries")
    XCTAssertEqual(marks, marks.sorted())
    // Every timeline entry the widget would show has content.
    for m in marks.prefix(30) { XCTAssertNotNil(feed.snapshot(at: m.addingTimeInterval(1))) }
    XCTAssertGreaterThan(feed.coveredUntil.timeIntervalSince(now), 5 * 86_400, "feed should cover about a week")
  }

  func testReminderPlanKeepsSoonestFutureUniqueItems() {
    let now = Date(timeIntervalSince1970: 1_800_000_000)
    let base = now.timeIntervalSince1970 * 1000
    var items: [[String: Any]] = [
      ["id": "past", "at": base - 1000, "title": "old", "body": ""],
      ["id": "dup", "at": base + 5000, "title": "a", "body": ""],
      ["id": "dup", "at": base + 6000, "title": "b", "body": ""],
    ]
    for i in 0..<100 { items.append(["id": "d\(i)", "at": base + Double(200 - i) * 60_000, "title": "t", "body": "b"]) }
    let json = String(data: try! JSONSerialization.data(withJSONObject: items), encoding: .utf8)!
    let plan = Reminders.plan(json: json, now: now)
    XCTAssertEqual(plan.count, Reminders.limit)
    XCTAssertFalse(plan.contains { $0.id == "past" })
    XCTAssertEqual(plan.filter { $0.id == "dup" }.count, 1)
    XCTAssertEqual(plan.map(\.at), plan.map(\.at).sorted())
    XCTAssertEqual(plan.first?.id, "dup")
    XCTAssertTrue(Reminders.plan(json: "not json").isEmpty)
  }

  func testMimeTypes() {
    XCTAssertTrue(BundleSchemeHandler.mime("js").hasPrefix("application/javascript"))
    XCTAssertTrue(BundleSchemeHandler.mime("HTML").hasPrefix("text/html"))
    XCTAssertEqual(BundleSchemeHandler.mime("exe"), "application/octet-stream")
  }
}
