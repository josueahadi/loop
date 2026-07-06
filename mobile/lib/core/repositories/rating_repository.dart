import '../api/api_client.dart';

class RatingItem {
  final int score;
  final String? comment;
  final String? fromName;
  final DateTime createdAt;

  const RatingItem({
    required this.score,
    this.comment,
    this.fromName,
    required this.createdAt,
  });

  factory RatingItem.fromJson(Map<String, dynamic> j) => RatingItem(
    score: (j['score'] as num?)?.toInt() ?? 0,
    comment: j['comment'] as String?,
    fromName: j['fromName'] as String?,
    createdAt:
        DateTime.tryParse(j['createdAt'] as String? ?? '') ?? DateTime.now(),
  );
}

class UserRatings {
  final double average;
  final int count;
  final List<RatingItem> ratings;
  const UserRatings({
    required this.average,
    required this.count,
    this.ratings = const [],
  });

  factory UserRatings.fromJson(Map<String, dynamic> j) => UserRatings(
    average: (j['average'] as num?)?.toDouble() ?? 0,
    count: (j['count'] as num?)?.toInt() ?? 0,
    ratings: ((j['ratings'] as List?) ?? const [])
        .map((r) => RatingItem.fromJson(r as Map<String, dynamic>))
        .toList(),
  );
}

/// Two-way ratings against the API (M5).
class RatingRepository {
  final ApiClient _api;

  RatingRepository({ApiClient? api}) : _api = api ?? ApiClient();

  // Rate the counterparty on a completed job. Throws on 403/409 (gated server-side).
  Future<void> rate(String jobId, int score, {String? comment}) async {
    await _api.dio.post(
      '/jobs/$jobId/ratings',
      data: {
        'score': score,
        if (comment != null && comment.isNotEmpty) 'comment': comment,
      },
    );
  }

  Future<UserRatings> forUser(String userId) async {
    final res = await _api.dio.get('/users/$userId/ratings');
    return UserRatings.fromJson(res.data as Map<String, dynamic>);
  }
}
