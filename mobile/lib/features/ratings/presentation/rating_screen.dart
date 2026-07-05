import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';

import '../../../constants.dart';
import '../../../core/repositories/rating_repository.dart';

/// Rate the counterparty after a completed job (M5). Stars + optional comment.
/// (The design's "tips" section is intentionally omitted — payments are out of
/// scope.) Submits once; the server enforces one-per-party.
class RatingScreen extends StatefulWidget {
  final String jobId;
  final String counterpartyName;
  const RatingScreen({
    super.key,
    required this.jobId,
    required this.counterpartyName,
  });

  @override
  State<RatingScreen> createState() => _RatingScreenState();
}

class _RatingScreenState extends State<RatingScreen> {
  final _repo = RatingRepository();
  final _comment = TextEditingController();
  double _score = 5;
  bool _submitting = false;

  static const _labels = {
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Very good',
    5: 'Excellent',
  };

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      await _repo.rate(
        widget.jobId,
        _score.round(),
        comment: _comment.text.trim(),
      );
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (e) {
      final msg = e.toString().replaceFirst('Exception: ', '');
      if (mounted) {
        // Already rated (409) is a terminal, expected outcome — treat as done.
        final alreadyRated = msg.toLowerCase().contains('already rated');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              alreadyRated ? 'You have already rated this job' : msg,
            ),
            backgroundColor: alreadyRated ? primaryGreen : Colors.red,
          ),
        );
        if (alreadyRated) Navigator.pop(context, true);
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final label = _labels[_score.round()] ?? '';
    return Scaffold(
      appBar: AppBar(title: const Text('Rate')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 12),
            Center(
              child: RatingBar.builder(
                initialRating: _score,
                minRating: 1,
                allowHalfRating: false,
                itemCount: 5,
                itemSize: 44,
                itemBuilder: (_, __) =>
                    const Icon(Icons.star, color: Colors.amber),
                onRatingUpdate: (r) => setState(() => _score = r),
              ),
            ),
            const SizedBox(height: 12),
            Center(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: primaryGreen,
                ),
              ),
            ),
            const SizedBox(height: 4),
            Center(
              child: Text(
                'You rated ${widget.counterpartyName} ${_score.round()} star${_score.round() == 1 ? '' : 's'}',
                style: const TextStyle(color: textGray),
              ),
            ),
            const SizedBox(height: 24),
            TextField(
              controller: _comment,
              maxLines: 4,
              decoration: const InputDecoration(
                hintText: 'Write your feedback (optional)',
                border: OutlineInputBorder(),
              ),
            ),
            const Spacer(),
            SizedBox(
              height: 50,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryGreen,
                  foregroundColor: Colors.white,
                ),
                onPressed: _submitting ? null : _submit,
                child: _submitting
                    ? const SizedBox(
                        height: 22,
                        width: 22,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : const Text('Submit'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
