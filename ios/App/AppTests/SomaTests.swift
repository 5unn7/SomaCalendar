import XCTest
import WebKit
import Capacitor
@testable import App

/// Runs on the iOS Simulator in CI against the real launched app: the Capacitor bridge loads the bundled Soma page,
/// native.js installs window.SomaNative, and a widget feed built by the page's widget.js decodes the way the widget reads it.
private struct NoWindow: Error {}

@MainActor
final class SomaTests: XCTestCase {

  private func bridgeController() async throws -> SomaBridgeViewController {
    let deadline = Date().addingTimeInterval(20)
    while Date() < deadline {
      let root = UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.windows.first?.rootViewController }.first
      if let vc = root as? SomaBridgeViewController, vc.webView != nil { return vc }
      try await Task.sleep(nanoseconds: 200_000_000)
    }
    XCTFail("App window never appeared")
    throw NoWindow()
  }

  private func js(_ source: String) async throws -> Any? {
    let controller = try await bridgeController()
    let web = try XCTUnwrap(controller.webView)
    // The completion-handler form copes with null/undefined results; the async overload does not.
    return try await withCheckedThrowingContinuation { done in
      web.evaluateJavaScript(source) { value, error in
        if let error { done.resume(throwing: error) } else { done.resume(returning: value) }
      }
    }
  }

  /// Polls until app.js has rendered (or fails after 30 s).
  private func waitForApp() async throws -> [String: Any] {
    let deadline = Date().addingTimeInterval(30)
    while Date() < deadline {
      if let text = try? await js("JSON.stringify(window.SomaPrototype && window.SomaPrototype.health ? window.SomaPrototype.health() : null)") as? String,
         let health = (try? JSONSerialization.jsonObject(with: Data(text.utf8))) as? [String: Any] {
        return health
      }
      try await Task.sleep(nanoseconds: 250_000_000)
    }
    let body = (try? await js("document.body ? document.body.innerText.slice(0, 400) : 'no body'")) as? String ?? "?"
    XCTFail("Soma page never became ready. Page text: \(body)")
    return [:]
  }

  func testPageLoadsThroughCapacitorAndIsHealthy() async throws {
    let health = try await waitForApp()
    XCTAssertEqual(health["ready"] as? Bool, true)
    XCTAssertFalse((health["tithi"] as? String ?? "").isEmpty, "tithi label missing")
    let platform = try await js("window.SomaNative && window.SomaNative.platform") as? String
    XCTAssertEqual(platform, "ios", "native.js did not install SomaNative")
    let nav = try await js("document.querySelectorAll('#nav button').length") as? Int ?? 0
    XCTAssertGreaterThan(nav, 0, "bottom navigation did not render")
  }

  func testSomaPluginIsRegistered() async throws {
    _ = try await waitForApp()
    let controller = try await bridgeController()
    let plugin = controller.bridge?.plugin(withName: "Soma")
    XCTAssertNotNil(plugin, "SomaPlugin not registered with the bridge")
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
    for m in marks.prefix(30) { XCTAssertNotNil(feed.snapshot(at: m.addingTimeInterval(1))) }
    XCTAssertGreaterThan(feed.coveredUntil.timeIntervalSince(now), 5 * 86_400, "feed should cover about a week")
  }

  func testWidgetFeedReachesAppGroup() async throws {
    _ = try await waitForApp()
    // app.js pushes the feed through native.js → SomaPlugin shortly after rendering.
    let deadline = Date().addingTimeInterval(15)
    while Date() < deadline {
      if WidgetFeed.decode(AppGroup.defaults.string(forKey: "feed")) != nil { return }
      try await Task.sleep(nanoseconds: 250_000_000)
    }
    XCTFail("the page never handed the widget feed to SomaPlugin")
  }
}
