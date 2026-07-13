/// Release metadata shown in role-specific profile screens.
///
/// Keep this in sync with `pubspec.yaml`; `test/shared/app_version_test.dart`
/// fails when the release version changes without updating this value.
abstract final class AppVersion {
  static const version = '1.6.0';
  static const buildNumber = '17';
  static const display = 'Version $version';
}
