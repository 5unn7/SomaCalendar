import UIKit
import WebKit
import os

/// Hosts the shared Soma HTML/JS (the same files Android ships) in a WKWebView.
/// Files are served from the app bundle over the private `soma://` scheme; the page cannot load anything from the network.
/// Native features are reached through `window.SomaNative`, the same object the Android shell provides.
final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
  static let scheme = "soma"
  static let startURL = URL(string: "soma://app/index.html")!
  static let background = UIColor(red: 0x10 / 255, green: 0x1c / 255, blue: 0x1a / 255, alpha: 1)

  private(set) var webView: WKWebView!
  private var bridge: NativeBridge!
  private let log = Logger(subsystem: "app.soma.calendar", category: "SomaJS")
  /// Set when the page reports it is ready; used by tests and logging.
  var onReady: (() -> Void)?

  override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

  override func loadView() {
    let config = WKWebViewConfiguration()
    config.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: Self.scheme)
    config.websiteDataStore = .default() // keeps localStorage (profile, plans, settings) between launches
    config.defaultWebpagePreferences.allowsContentJavaScript = true
    config.preferences.javaScriptCanOpenWindowsAutomatically = false
    config.dataDetectorTypes = []
    config.allowsInlineMediaPlayback = false

    bridge = NativeBridge()
    config.userContentController.addUserScript(WKUserScript(source: NativeBridge.shim, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    config.userContentController.add(WeakMessageHandler(bridge), name: NativeBridge.handlerName)

    webView = WKWebView(frame: .zero, configuration: config)
    webView.navigationDelegate = self
    webView.uiDelegate = self
    webView.isOpaque = false
    webView.backgroundColor = Self.background
    webView.scrollView.backgroundColor = Self.background
    webView.allowsLinkPreview = false
    webView.allowsBackForwardNavigationGestures = false
    #if DEBUG
    if #available(iOS 16.4, *) { webView.isInspectable = true }
    #endif

    // The page is not yet edge-to-edge aware, so keep it inside the safe area; the root colour fills behind the notch and home bar.
    let root = UIView()
    root.backgroundColor = Self.background
    root.addSubview(webView)
    webView.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      webView.topAnchor.constraint(equalTo: root.safeAreaLayoutGuide.topAnchor),
      webView.bottomAnchor.constraint(equalTo: root.safeAreaLayoutGuide.bottomAnchor),
      webView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
      webView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
    ])
    view = root
    bridge.attach(to: self)
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    webView.load(URLRequest(url: Self.startURL))
  }

  /// Calls `window.<function>(payload)` with the payload as a JSON string, the way MainActivity.send does on Android.
  func send(_ function: String, _ payload: String) {
    guard function.range(of: "^[A-Za-z]+$", options: .regularExpression) != nil,
          let quoted = try? JSONSerialization.data(withJSONObject: payload, options: .fragmentsAllowed),
          let arg = String(data: quoted, encoding: .utf8) else { return }
    DispatchQueue.main.async {
      self.webView?.evaluateJavaScript("window.\(function) && window.\(function)(\(arg))")
    }
  }

  func pageReady() {
    log.info("Astronomical app initialised")
    onReady?()
  }

  func pageFailed(_ detail: String) { log.error("App initialisation error: \(detail, privacy: .public)") }

  // MARK: Navigation: only bundled files load inside Soma; https links open in Safari.

  func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
    guard let url = action.request.url else { return .cancel }
    if url.scheme == Self.scheme { return .allow }
    if url.scheme == "https", action.navigationType == .linkActivated || action.targetFrame == nil {
      _ = await UIApplication.shared.open(url)
    }
    return .cancel
  }

  /// `target=_blank` links: open in Safari instead of a new web view.
  func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
    if let url = action.request.url, url.scheme == "https" { UIApplication.shared.open(url) }
    return nil
  }

  /// If iOS ends the web content process (memory pressure), reload instead of showing a blank screen.
  func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.load(URLRequest(url: Self.startURL)) }

  // Native confirm/alert for any page dialog, so nothing silently fails.
  func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo) async {
    await withCheckedContinuation { done in
      let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
      alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in done.resume() })
      present(alert, animated: true)
    }
  }
}

/// Serves `soma://app/<path>` from the bundled `assets` folder (built by `npm run bundle`). Anything else is refused.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
  private let root = Bundle.main.resourceURL!.appendingPathComponent("assets", isDirectory: true).standardizedFileURL

  func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
    guard let url = task.request.url, url.host == "app" else { return fail(task) }
    let path = url.path.isEmpty || url.path == "/" ? "/index.html" : url.path
    let file = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
    guard file.path.hasPrefix(root.path + "/"), let data = try? Data(contentsOf: file) else { return fail(task) }
    let headers = [
      "Content-Type": Self.mime(file.pathExtension),
      "Content-Length": String(data.count),
      "Cache-Control": "no-cache",
      // Offline by design: no network access from the page; native code does the two opt-in lookups.
      "Content-Security-Policy": "default-src soma: 'unsafe-inline' data: blob:; connect-src 'none'",
    ]
    let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!
    task.didReceive(response)
    task.didReceive(data)
    task.didFinish()
  }

  func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

  private func fail(_ task: WKURLSchemeTask) {
    task.didFailWithError(NSError(domain: NSURLErrorDomain, code: NSURLErrorFileDoesNotExist))
  }

  static func mime(_ ext: String) -> String {
    switch ext.lowercased() {
    case "html": return "text/html; charset=utf-8"
    case "css": return "text/css; charset=utf-8"
    case "js": return "application/javascript; charset=utf-8"
    case "json": return "application/json"
    case "txt", "md": return "text/plain; charset=utf-8"
    case "svg": return "image/svg+xml"
    case "png": return "image/png"
    case "woff2": return "font/woff2"
    default: return "application/octet-stream"
    }
  }
}

/// WKUserContentController retains its handlers; this breaks the cycle with the bridge.
final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
  private weak var target: WKScriptMessageHandler?
  init(_ target: WKScriptMessageHandler) { self.target = target }
  func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
    target?.userContentController(c, didReceive: message)
  }
}
