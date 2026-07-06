import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../constants.dart';
import '../../../core/repositories/rating_repository.dart';
import '../../../core/theme/ui_kit.dart';
import '../../../providers/auth_provider.dart';

/// Shows the ratings a user has received: their average, the count, and each
/// individual rating (score, who left it, comment). Read-only.
class MyRatingsScreen extends StatefulWidget {
  const MyRatingsScreen({super.key});

  @override
  State<MyRatingsScreen> createState() => _MyRatingsScreenState();
}

class _MyRatingsScreenState extends State<MyRatingsScreen> {
  final _repo = RatingRepository();
  late Future<UserRatings> _future;

  @override
  void initState() {
    super.initState();
    final uid = context.read<AuthProvider>().user?.uid ?? '';
    _future = _repo.forUser(uid);
  }

  Future<void> _refresh() async {
    final uid = context.read<AuthProvider>().user?.uid ?? '';
    final next = _repo.forUser(uid);
    setState(() {
      _future = next;
    });
    await next;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Ratings')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<UserRatings>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return ListView(
                children: const [
                  SizedBox(height: 120),
                  EmptyBlock(
                    icon: Icons.error_outline,
                    title: 'Could not load ratings',
                    subtitle: 'Pull down to try again',
                  ),
                ],
              );
            }
            final data = snap.data ?? const UserRatings(average: 0, count: 0);
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                _SummaryCard(average: data.average, count: data.count),
                const SizedBox(height: 20),
                if (data.ratings.isEmpty)
                  const EmptyBlock(
                    icon: Icons.star_border,
                    title: 'No ratings yet',
                    subtitle:
                        'Ratings appear here after a completed job is reviewed',
                  )
                else
                  ...data.ratings.map((r) => _RatingTile(rating: r)),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final double average;
  final int count;
  const _SummaryCard({required this.average, required this.count});

  @override
  Widget build(BuildContext context) {
    return AppCard(
      color: kTintGreen,
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          Text(
            average.toStringAsFixed(1),
            style: const TextStyle(
              fontSize: 40,
              fontWeight: FontWeight.bold,
              color: primaryGreen,
            ),
          ),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Stars(value: average),
              const SizedBox(height: 4),
              Text(
                '$count ${count == 1 ? 'rating' : 'ratings'} received',
                style: const TextStyle(color: textGray, fontSize: 13.5),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Stars extends StatelessWidget {
  final double value;
  const _Stars({required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (i) {
        final filled = i < value.round();
        return Icon(
          filled ? Icons.star : Icons.star_border,
          size: 20,
          color: filled ? Colors.amber : textGray,
        );
      }),
    );
  }
}

class _RatingTile extends StatelessWidget {
  final RatingItem rating;
  const _RatingTile({required this.rating});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: AppCard(
        padding: const EdgeInsets.all(14),
        child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _Stars(value: rating.score.toDouble()),
              const Spacer(),
              Text(
                _formatDate(rating.createdAt),
                style: const TextStyle(color: textGray, fontSize: 12),
              ),
            ],
          ),
          if (rating.comment != null && rating.comment!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(rating.comment!, style: const TextStyle(fontSize: 14)),
          ],
          const SizedBox(height: 6),
          Text(
            'From ${rating.fromName ?? 'a user'}',
            style: const TextStyle(color: textGray, fontSize: 12.5),
          ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime d) => '${d.day}/${d.month}/${d.year}';
}
