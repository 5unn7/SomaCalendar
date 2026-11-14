import UIKit
import Capacitor

/// Capacitor host for the shared Soma web app. Registers Soma's own plugin and paints the Kaal Chakra ground
/// (bone by day, OLED black by night) behind the web view, so there is no flash on launch or past the scroll edges.
final class SomaBridgeViewController: CAPBridgeViewController {
  static let background = UIColor { traits in
    traits.userInterfaceStyle == .dark
      ? UIColor(red: 0x05 / 255, green: 0x05 / 255, blue: 0x05 / 255, alpha: 1)
      : UIColor(red: 0xf3 / 255, green: 0xef / 255, blue: 0xe7 / 255, alpha: 1)
  }

  override var preferredStatusBarStyle: UIStatusBarStyle { .default }

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
