import '../api/api_client.dart';
import '../models/chat_message.dart';

/// Chat messages against the API (Postgres source of truth). Live delivery comes
/// over the socket (see SocketService); this is the load + send + polling fallback.
class MessageRepository {
  final ApiClient _api;

  MessageRepository({ApiClient? api}) : _api = api ?? ApiClient();

  Future<List<ChatMessageApi>> list(String jobId) async {
    final res = await _api.dio.get('/jobs/$jobId/messages');
    return (res.data as List)
        .map((m) => ChatMessageApi.fromJson(m as Map<String, dynamic>))
        .toList();
  }

  Future<ChatMessageApi> send(String jobId, String content) async {
    final res = await _api.dio.post(
      '/jobs/$jobId/messages',
      data: {'content': content},
    );
    return ChatMessageApi.fromJson(res.data as Map<String, dynamic>);
  }
}
