import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../constants.dart';
import '../../core/errors/error_messages.dart';
import '../../core/repositories/payment_repository.dart';

/// Payment UI for a completed job, shown on both parties' job detail.
/// - Both see the status chip (Pending / Paid ✓ / Failed).
/// - The owner additionally gets a "Pay driver" button (and "Retry" on failure).
/// Pass-through: tapping Pay opens the provider checkout; the webhook is the
/// source of truth, so after returning we poll [PaymentRepository.forJob] for the
/// confirmed status. Paying is optional — off-platform settlement stays valid.
class PaymentSection extends StatefulWidget {
  final String jobId;
  final bool isOwner;
  final int postedPrice;

  const PaymentSection({
    super.key,
    required this.jobId,
    required this.isOwner,
    required this.postedPrice,
  });

  @override
  State<PaymentSection> createState() => _PaymentSectionState();
}

class _PaymentSectionState extends State<PaymentSection> {
  final _payments = PaymentRepository();
  PaymentInfo? _payment;
  bool _loading = true;
  bool _busy = false;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final p = await _payments.forJob(widget.jobId);
      if (mounted) setState(() => _payment = p);
    } catch (_) {
      // best-effort; the section just won't show a payment
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pay() async {
    setState(() => _busy = true);
    try {
      final url = await _payments.initiate(widget.jobId);
      final launched = await launchUrl(
        Uri.parse(url),
        mode: LaunchMode.externalApplication,
      );
      if (!launched && mounted) {
        _snack('Could not open the payment page.');
        return;
      }
      // The redirect back to the app only prompts us to poll — the webhook is the
      // real status. Poll briefly for the confirmed outcome.
      _startPolling();
    } catch (e) {
      if (mounted) _snack(friendlyErrorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  // Poll the payment status for up to ~30s after checkout (webhook confirms it).
  // A background poll must never throw — network errors (timeout/offline) are
  // swallowed; the poll just stops after the window rather than crashing.
  void _startPolling() {
    _poll?.cancel();
    var ticks = 0;
    _poll = Timer.periodic(const Duration(seconds: 3), (t) async {
      ticks++;
      try {
        final p = await _payments.forJob(widget.jobId);
        if (!mounted) return;
        setState(() => _payment = p);
        if (p != null && !p.isPending) t.cancel();
      } catch (_) {
        // network hiccup — try again next tick, don't crash the isolate
      }
      if (ticks >= 10) t.cancel();
    });
  }

  void _snack(String msg) => ScaffoldMessenger.of(
    context,
  ).showSnackBar(SnackBar(content: Text(msg)));

  @override
  Widget build(BuildContext context) {
    if (_loading) return const SizedBox.shrink();

    final p = _payment;
    final paid = p?.isSuccessful ?? false;
    final pending = p?.isPending ?? false;
    final failed = p?.isFailed ?? false;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Text('Payment', style: TextStyle(color: textGray)),
            const Spacer(),
            _statusChip(paid, pending, failed),
          ],
        ),
        if (paid && p?.paidAt != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              'Paid ${_shortDate(p!.paidAt!)}',
              style: const TextStyle(color: textGray, fontSize: 12),
            ),
          ),
        // Owner action: pay (nothing yet / no row) or retry (failed).
        if (widget.isOwner && !paid && !pending) ...[
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryGreen,
                foregroundColor: Colors.white,
              ),
              onPressed: _busy ? null : _pay,
              icon: const Icon(Icons.payments_outlined, size: 18),
              label: Text(
                failed
                    ? 'Retry payment (${widget.postedPrice} RWF)'
                    : 'Pay driver (${widget.postedPrice} RWF)',
              ),
            ),
          ),
          const Padding(
            padding: EdgeInsets.only(top: 4),
            child: Text(
              'Optional — you can also settle off-platform.',
              style: TextStyle(color: textGray, fontSize: 12),
            ),
          ),
        ],
        if (widget.isOwner && pending)
          const Padding(
            padding: EdgeInsets.only(top: 8),
            child: Text(
              'Waiting for the payment to be confirmed…',
              style: TextStyle(color: textGray, fontSize: 12),
            ),
          ),
      ],
    );
  }

  Widget _statusChip(bool paid, bool pending, bool failed) {
    late final Color color;
    late final String label;
    late final IconData icon;
    if (paid) {
      color = primaryGreen;
      label = 'Paid';
      icon = Icons.check_circle;
    } else if (pending) {
      color = Colors.orange;
      label = 'Pending';
      icon = Icons.schedule;
    } else if (failed) {
      color = Colors.red;
      label = 'Failed';
      icon = Icons.error_outline;
    } else {
      color = textGray;
      label = 'Not paid';
      icon = Icons.remove_circle_outline;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  String _shortDate(String iso) {
    final d = DateTime.tryParse(iso)?.toLocal();
    if (d == null) return '';
    return '${d.day}/${d.month} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
  }
}
