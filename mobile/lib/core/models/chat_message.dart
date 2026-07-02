/// An API chat message (M4). Named ChatMessageApi to avoid clashing with the
/// legacy Firestore ChatMessage model still used by the old chat code paths.
class ChatMessageApi {
  final String id;
  final String jobId;
  final String senderId;
  final String receiverId;
  final String content;
  final DateTime sentAt;

  const ChatMessageApi({
    required this.id,
    required this.jobId,
    required this.senderId,
    required this.receiverId,
    required this.content,
    required this.sentAt,
  });

  factory ChatMessageApi.fromJson(Map<String, dynamic> j) => ChatMessageApi(
        id: j['id'] as String,
        jobId: j['jobId'] as String,
        senderId: j['senderId'] as String,
        receiverId: j['receiverId'] as String,
        content: j['content'] as String,
        sentAt: DateTime.parse(j['sentAt'] as String),
      );
}
