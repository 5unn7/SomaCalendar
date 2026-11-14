import UIKit
import UserNotifications

@main
final class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {
  func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    UNUserNotificationCenter.current().delegate = self
    return true
  }

  func application(_ application: UIApplication, configurationForConnecting session: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
    UISceneConfiguration(name: "Default", sessionRole: session.role)
  }

  /// Show vrat, parana and Rahu Kaal reminders even while Soma is open.
  func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
    [.banner, .list, .sound]
  }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
    guard let scene = scene as? UIWindowScene else { return }
    let window = UIWindow(windowScene: scene)
    window.rootViewController = WebViewController()
    window.makeKeyAndVisible()
    self.window = window
  }
}

/// The App Group shared with the widget; its id is `group.<bundle id>`, written into Info.plist at build time.
enum AppGroup {
  static var id: String { Bundle.main.object(forInfoDictionaryKey: "SomaAppGroup") as? String ?? "group.app.soma.calendar" }
  static var defaults: UserDefaults { UserDefaults(suiteName: id) ?? .standard }
}
