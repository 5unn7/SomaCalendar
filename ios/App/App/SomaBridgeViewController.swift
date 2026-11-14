import UIKit
import Capacitor

/// Capacitor host for the shared Soma web app. Registers Soma's own plugin and matches the night-sky background,
/// so there is no white flash on launch or when scrolling past the edges.
final class SomaBridgeViewController: CAPBridgeViewController {
  static let background = UIColor(red: 0x10 / 255, green: 0x1c / 255, blue: 0x1a / 255, alpha: 1)

  override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

  override func capacitorDidLoad() {
    bridge?.registerPluginInstance(SomaPlugin())
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = Self.background
    webView?.isOpaque = false
    webView?.backgroundColor = Self.background
    webView?.scrollView.backgroundColor = Self.background
    webView?.allowsLinkPreview = false
  }
}
