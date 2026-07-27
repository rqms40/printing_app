import Flutter
import UIKit
import GoogleMaps

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    // Prefer Info.plist GMSApiKey; fall back to compile-time env injected by CI.
    let key =
      Bundle.main.object(forInfoDictionaryKey: "GMSApiKey") as? String
      ?? ProcessInfo.processInfo.environment["GOOGLE_MAPS_API"]
      ?? ProcessInfo.processInfo.environment["GOOGLE_MAPS_API_KEY"]
      ?? ""
    if !key.isEmpty {
      GMSServices.provideAPIKey(key)
    }
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
  }
}
