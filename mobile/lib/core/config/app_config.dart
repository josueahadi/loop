/// App-wide configuration. The API base URL can be overridden at build time:
///   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
class AppConfig {
  /// Base URL of the NestJS API (system of record).
  /// Defaults to localhost for iOS simulator / desktop; use 10.0.2.2 for Android.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );
}
