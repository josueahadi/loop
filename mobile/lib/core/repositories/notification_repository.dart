import '../api/api_client.dart';
import '../models/app_notification.dart';

class NotificationsResult {
  final int unread;
  final List<AppNotification> notifications;
  const NotificationsResult({required this.unread, required this.notifications});
}

/// The user's in-app notifications, via the API (persisted alongside push sends).
class NotificationRepository {
  final ApiClient _api;

  NotificationRepository({ApiClient? api}) : _api = api ?? ApiClient();

  Future<NotificationsResult> list() async {
    final res = await _api.dio.get('/notifications');
    final data = res.data as Map<String, dynamic>;
    return NotificationsResult(
      unread: (data['unread'] as num?)?.toInt() ?? 0,
      notifications: ((data['notifications'] as List?) ?? const [])
          .map((n) => AppNotification.fromJson(n as Map<String, dynamic>))
          .toList(),
    );
  }

  Future<int> unreadCount() async {
    try {
      final res = await _api.dio.get('/notifications/unread-count');
      return (res.data['count'] as num?)?.toInt() ?? 0;
    } catch (_) {
      return 0;
    }
  }

  Future<void> markRead(String id) async {
    try {
      await _api.dio.patch('/notifications/$id/read');
    } catch (_) {
      // best-effort
    }
  }

  Future<void> markAllRead() async {
    try {
      await _api.dio.patch('/notifications/read-all');
    } catch (_) {
      // best-effort
    }
  }
}
