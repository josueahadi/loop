import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'auth_service.dart';

/// Background isolate handler — must be a top-level function. We don't render
/// anything here (the OS shows the notification); this just satisfies the plugin
/// and could later do background work.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // No-op: display is handled by the system tray for data+notification messages.
}

/// Thin wrapper over firebase_messaging: request permission, obtain the device
/// token, register it with the API, and keep it fresh. Push is best-effort — any
/// failure here is swallowed so it never blocks the app.
class PushMessaging {
  PushMessaging({AuthService? authService})
    : _auth = authService ?? AuthService();

  final AuthService _auth;
  bool _started = false;

  /// Called when a push arrives while the app is in the foreground — the app
  /// wires this to show an in-app banner and refresh the unread badge (the OS
  /// does not display a foreground notification on its own).
  void Function(RemoteMessage message)? onForegroundMessage;

  /// Call once the user is authenticated (the API needs a JWT to store the
  /// token against the user). Safe to call more than once.
  Future<void> start() async {
    if (_started) return;
    _started = true;
    try {
      final messaging = FirebaseMessaging.instance;

      // iOS/Android 13+ ask for permission; on older Android this is a no-op.
      final settings = await messaging.requestPermission();
      debugPrint(
        'PushMessaging: permission = ${settings.authorizationStatus}',
      );

      final token = await messaging.getToken();
      debugPrint('PushMessaging: token = ${token == null ? 'null' : 'obtained'}');
      if (token != null) {
        await _auth.registerPushToken(token);
      }

      // Token can rotate; keep the server copy current.
      messaging.onTokenRefresh.listen((t) {
        _auth.registerPushToken(t);
      });

      // Foreground pushes: the OS shows nothing, so surface them in-app.
      FirebaseMessaging.onMessage.listen((message) {
        onForegroundMessage?.call(message);
      });
    } catch (e) {
      debugPrint('PushMessaging.start failed (continuing): $e');
    }
  }

  /// Clear the server-side token so a signed-out device stops receiving pushes.
  ///
  /// Returns immediately. Both steps are network calls — `deleteToken()` in
  /// particular can block for a long time on Android when connectivity is bad —
  /// and logout must never wait on either. Failing to clear the token only means
  /// the device may receive a stray push until the token rotates; that is not
  /// worth hanging the sign-out on.
  void stop() {
    _started = false;
    unawaited(_clearToken());
  }

  Future<void> _clearToken() async {
    // Tell the API to forget the token first: /me/push-token is authenticated,
    // so it has to go out before the caller clears the JWT.
    await _auth.registerPushToken('');
    try {
      await FirebaseMessaging.instance.deleteToken();
    } catch (_) {
      // ignore — best-effort
    }
  }
}
