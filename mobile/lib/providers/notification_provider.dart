import 'package:flutter/foundation.dart';

import '../core/repositories/notification_repository.dart';

/// Holds the unread-notification count for the app-bar bell badge. Refreshed on
/// login, on app resume, when a foreground push arrives, and after the user
/// opens the notification centre.
class NotificationProvider with ChangeNotifier {
  NotificationProvider({NotificationRepository? repository})
    : _repo = repository ?? NotificationRepository();

  final NotificationRepository _repo;
  int _unread = 0;
  bool _disposed = false;

  int get unread => _unread;

  Future<void> refreshUnread() async {
    // A badge refresh is best-effort: never let a failed/unauthenticated call
    // bubble into the ApiClient's session-death path (that would fire a spurious
    // sign-out + re-route loop, e.g. right after logout).
    int count;
    try {
      count = await _repo.unreadCount();
    } catch (_) {
      return;
    }
    if (_disposed) return;
    if (count != _unread) {
      _unread = count;
      notifyListeners();
    }
  }

  // Optimistic local clear (e.g. after "mark all read") without a round-trip.
  void clearUnread() {
    if (_unread != 0) {
      _unread = 0;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
