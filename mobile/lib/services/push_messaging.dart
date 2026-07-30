import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'auth_service.dart';

// One high-importance channel so notifications actually pop as heads-up banners
// on Android 8+. Its id must match the manifest's default_notification_channel_id
// so FCM-rendered (background) notifications use the same channel.
const _channel = AndroidNotificationChannel(
  'loop_default',
  'Loop notifications',
  description: 'Proposals, messages, and verification updates',
  importance: Importance.high,
);

final FlutterLocalNotificationsPlugin _localNotifications =
    FlutterLocalNotificationsPlugin();

/// Background isolate handler — must be a top-level function. firebase_messaging
/// renders `notification`-payload messages via the system tray when the app is
/// backgrounded, so this only needs to exist for the plugin's contract.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {}

/// Thin wrapper over firebase_messaging: request permission, obtain the device
/// token, register it with the API, and keep it fresh. Push is best-effort — any
/// failure here is swallowed so it never blocks the app.
class PushMessaging {
  PushMessaging({AuthService? authService})
    : _auth = authService ?? AuthService();

  final AuthService _auth;
  // Latches only once a real token has been registered — so a later call (e.g.
  // after signup) still runs if an earlier attempt got no token.
  bool _tokenRegistered = false;
  bool _running = false;

  /// Called when a push arrives while the app is in the foreground — the app
  /// wires this to show an in-app banner and refresh the unread badge (the OS
  /// does not display a foreground notification on its own).
  void Function(RemoteMessage message)? onForegroundMessage;

  bool _listenersAttached = false;

  /// Call once the user is authenticated (the API needs a JWT to store the
  /// token against the user). Safe to call more than once.
  Future<void> start() async {
    // Attach the durable listeners BEFORE the permission await below: on a fresh
    // signup the token may only arrive once the user answers the permission
    // dialog, and onTokenRefresh is what catches it if the awaited getToken()
    // path is interrupted by navigation. This was the new-user "no token" bug.
    _attachListeners();

    // A previous run that finished WITHOUT a token must not latch — a later call
    // (e.g. right after signup) is allowed through to try again.
    if (_tokenRegistered || _running) return;
    _running = true;
    try {
      await _initLocalNotifications();

      final messaging = FirebaseMessaging.instance;

      // iOS/Android 13+ ask for permission; on older Android this is a no-op.
      final settings = await messaging.requestPermission();
      debugPrint(
        'PushMessaging: permission = ${settings.authorizationStatus}',
      );

      // On a fresh install/signup FCM may not have provisioned the token yet, so
      // retry a few times before giving up (onTokenRefresh is the fallback).
      // Only ever register a real token — never overwrite a good one with ''.
      var token = await messaging.getToken();
      for (var attempt = 0; (token == null || token.isEmpty) && attempt < 5; attempt++) {
        await Future<void>.delayed(const Duration(seconds: 2));
        token = await messaging.getToken();
      }
      debugPrint(
        'PushMessaging: token = ${token == null || token.isEmpty ? 'EMPTY/null after retries (relying on onTokenRefresh)' : 'obtained (${token.length} chars)'}',
      );
      if (token != null && token.isNotEmpty) {
        await _auth.registerPushToken(token);
        _tokenRegistered = true;
      }
    } catch (e) {
      debugPrint('PushMessaging.start failed (continuing): $e');
    } finally {
      _running = false;
    }
  }

  /// Whether the OS notification permission is currently granted. Drives the
  /// "turn on notifications" banner: a user who dismissed or missed the initial
  /// prompt shows up as not-authorized here, so we can nudge them.
  Future<bool> hasPermission() async {
    final settings =
        await FirebaseMessaging.instance.getNotificationSettings();
    return settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
  }

  /// Whether the OS has permanently denied notifications (user tapped "Don't
  /// allow"). On this state a fresh requestPermission() no longer shows a
  /// dialog, so the banner must send the user to system settings instead.
  Future<bool> isPermanentlyDenied() async {
    final settings =
        await FirebaseMessaging.instance.getNotificationSettings();
    return settings.authorizationStatus == AuthorizationStatus.denied;
  }

  /// Re-run permission + token registration on demand (from the banner's
  /// "Enable" action). Clears the latch so a previously tokenless run retries.
  Future<void> retry() async {
    _tokenRegistered = false;
    await start();
  }

  // Idempotent — re-adding these on every start() would stack duplicate listeners.
  void _attachListeners() {
    if (_listenersAttached) return;
    _listenersAttached = true;

    final messaging = FirebaseMessaging.instance;

    // Token can arrive late (after a signup permission grant, or on rotation);
    // register it whenever it does. Primary path for new users.
    messaging.onTokenRefresh.listen((t) {
      if (t.isNotEmpty) {
        _auth.registerPushToken(t);
        _tokenRegistered = true;
      }
    });

    // Foreground pushes: the OS shows nothing on its own, so render a real
    // notification here (and let the app refresh its in-app badge/banner).
    FirebaseMessaging.onMessage.listen((message) {
      _showForeground(message);
      onForegroundMessage?.call(message);
    });
  }

  Future<void> _initLocalNotifications() async {
    await _localNotifications.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
    );
    await _localNotifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(_channel);
  }

  // Display a received message as a real OS notification. FCM suppresses its own
  // notification while the app is foregrounded, so without this a foreground push
  // is invisible.
  void _showForeground(RemoteMessage message) {
    final n = message.notification;
    if (n == null) return;
    _localNotifications.show(
      id: n.hashCode,
      title: n.title,
      body: n.body,
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          _channel.id,
          _channel.name,
          channelDescription: _channel.description,
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: const DarwinNotificationDetails(),
      ),
    );
  }

  /// Clear the server-side token so a signed-out device stops receiving pushes.
  ///
  /// Returns immediately. Both steps are network calls — `deleteToken()` in
  /// particular can block for a long time on Android when connectivity is bad —
  /// and logout must never wait on either. Failing to clear the token only means
  /// the device may receive a stray push until the token rotates; that is not
  /// worth hanging the sign-out on.
  void stop() {
    _tokenRegistered = false;
    _running = false;
    unawaited(_clearToken());
  }

  Future<void> _clearToken() async {
    // Tell the API to forget this device's token so a signed-out account stops
    // receiving pushes. /me/push-token is authenticated, so it must go out before
    // the caller clears the JWT. We deliberately do NOT call deleteToken() here:
    // deleting the device token forces Firebase to regenerate one on the next
    // login, which is slow and can yield an empty token on emulators — leaving
    // the account with no push. Clearing the server copy is enough; the same
    // device token is re-registered on the next start().
    await _auth.registerPushToken('');
  }
}
