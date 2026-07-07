import 'package:flutter/material.dart';

import '../../../constants.dart';
import '../../../core/repositories/vehicle_repository.dart';
import '../../../core/repositories/verification_repository.dart';
import '../../../screens/driver_profile_edit_screen.dart';
import '../../../screens/vehicle_details_screen.dart';

/// The three mandated verification documents (API snake_case).
const _requiredDocs = ['licence', 'national_id', 'vehicle_reg'];

/// Post-signup onboarding nudge for drivers: surfaces what's still needed to
/// become matchable — a vehicle and the three approved documents — and routes to
/// the screens that actually do those (file upload + vehicle-type dropdown).
///
/// A driver only appears in matching when verification-approved AND online, so
/// this is the guided path to "approved". It hides itself once everything is done.
class DriverVerificationBanner extends StatefulWidget {
  const DriverVerificationBanner({super.key});

  @override
  State<DriverVerificationBanner> createState() =>
      _DriverVerificationBannerState();
}

class _DriverVerificationBannerState extends State<DriverVerificationBanner> {
  final _vehicles = VehicleRepository();
  final _verification = VerificationRepository();

  bool _loading = true;
  bool _hasVehicle = false;
  final Set<String> _approvedDocs = {};
  // Required doc types that have a record of ANY status (submitted at least once).
  final Set<String> _submittedDocs = {};
  bool _hasRejected = false;
  bool _hasPending = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        _vehicles.list(),
        _verification.listOwn(),
      ]);
      final vehicles = results[0] as List;
      // listOwn() returns records newest-first, so the FIRST record seen per
      // document type is the current one. A rejected doc that has since been
      // re-uploaded therefore reads as 'pending', not 'rejected'.
      final records = (results[1] as List).cast<Map<String, dynamic>>();
      final latestByType = <String, String>{};
      for (final r in records) {
        final type = r['documentType'] as String?;
        final status = r['status'] as String?;
        if (type == null || status == null || !_requiredDocs.contains(type)) {
          continue;
        }
        latestByType.putIfAbsent(type, () => status);
      }

      _approvedDocs.clear();
      _submittedDocs
        ..clear()
        ..addAll(latestByType.keys);
      _hasRejected = false;
      _hasPending = false;
      latestByType.forEach((type, status) {
        if (status == 'approved') _approvedDocs.add(type);
        if (status == 'rejected') _hasRejected = true;
        if (status == 'pending') _hasPending = true;
      });
      _hasVehicle = vehicles.isNotEmpty;
    } catch (_) {
      // On failure, show nothing rather than a misleading banner.
      _hasVehicle = true;
      _approvedDocs
        ..clear()
        ..addAll(_requiredDocs);
      _submittedDocs
        ..clear()
        ..addAll(_requiredDocs);
      _hasRejected = false;
      _hasPending = false;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool get _allApproved => _requiredDocs.every(_approvedDocs.contains);

  int get _approvedCount => _requiredDocs.where(_approvedDocs.contains).length;

  // Every required doc has been submitted at least once (any status).
  bool get _allSubmitted => _requiredDocs.every(_submittedDocs.contains);

  bool get _isComplete => _hasVehicle && _allApproved;

  @override
  Widget build(BuildContext context) {
    // Nothing to nag about while loading or once fully set up.
    if (_loading || _isComplete) return const SizedBox.shrink();

    final needsVehicle = !_hasVehicle;
    final hasRejected = _hasRejected;
    final anyPending = _hasPending;

    // Muted accents — softer than the bright Material defaults so the card reads
    // as an informative nudge, not an alarm, alongside the app's green theme.
    const rejectedAccent = Color(0xFFB4453B); // muted brick red
    const pendingAccent = Color(0xFFB57A28); // muted amber
    final (Color accent, IconData icon, String title, String body) = hasRejected
        ? (
            rejectedAccent,
            Icons.error_outline,
            'A document was rejected',
            'Re-upload the rejected document so an admin can review it again.',
          )
        : anyPending && !needsVehicle
        ? (
            pendingAccent,
            Icons.hourglass_top,
            'Verification under review',
            'Your documents are with our team. You can add or update details '
                'while you wait.',
          )
        : (
            primaryGreen,
            Icons.verified_user_outlined,
            'Finish setting up to get jobs',
            'Add your vehicle and upload your documents to be verified — '
                "you'll appear to nearby cargo owners once approved.",
          );

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: accent.withValues(alpha: 0.55), width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: accent),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: accent,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(body, style: const TextStyle(fontSize: 13, height: 1.35)),
          const SizedBox(height: 12),
          _ChecklistRow(label: 'Vehicle added', done: _hasVehicle),
          _ChecklistRow(
            label: 'Documents approved ($_approvedCount/3)',
            done: _allApproved,
          ),
          const SizedBox(height: 12),
          LayoutBuilder(
            builder: (context, constraints) {
              final buttons = [
                if (needsVehicle)
                  OutlinedButton.icon(
                    onPressed: () => _open(const VehicleDetailsScreen()),
                    icon: const Icon(Icons.directions_car, size: 18),
                    label: const Text('Add vehicle'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: accent,
                      side: BorderSide(color: accent),
                      minimumSize: const Size.fromHeight(48),
                    ),
                  ),
                // Rejected → re-upload; everything submitted & awaiting review →
                // nothing to upload, so view (a calm outlined button); otherwise
                // still uploading (a solid call-to-action).
                if (!_allApproved)
                  if (_allSubmitted && !hasRejected)
                    OutlinedButton.icon(
                      onPressed: () => _open(
                        const DriverProfileEditScreen(scrollToDocuments: true),
                      ),
                      icon: const Icon(Icons.description_outlined, size: 18),
                      label: const Text('View documents'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: accent,
                        side: BorderSide(color: accent.withValues(alpha: 0.55)),
                        minimumSize: const Size.fromHeight(48),
                      ),
                    )
                  else
                    ElevatedButton.icon(
                      onPressed: () => _open(
                        const DriverProfileEditScreen(scrollToDocuments: true),
                      ),
                      icon: const Icon(Icons.upload_file, size: 18),
                      label: Text(hasRejected ? 'Re-upload' : 'Upload docs'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: accent,
                        foregroundColor: Colors.white,
                        minimumSize: const Size.fromHeight(48),
                      ),
                    ),
              ];

              if (buttons.length == 1 || constraints.maxWidth < 420) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (var i = 0; i < buttons.length; i++) ...[
                      if (i > 0) const SizedBox(height: 10),
                      buttons[i],
                    ],
                  ],
                );
              }

              return Row(
                children: [
                  for (var i = 0; i < buttons.length; i++) ...[
                    if (i > 0) const SizedBox(width: 10),
                    Expanded(child: buttons[i]),
                  ],
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Future<void> _open(Widget screen) async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
    // Refresh status after returning — the driver may have just uploaded.
    if (mounted) _load();
  }
}

class _ChecklistRow extends StatelessWidget {
  final String label;
  final bool done;

  const _ChecklistRow({required this.label, required this.done});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Icon(
            done ? Icons.check_circle : Icons.radio_button_unchecked,
            size: 18,
            color: done ? primaryGreen : Colors.grey,
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              color: done ? Colors.black87 : Colors.black54,
              decoration: done ? TextDecoration.lineThrough : null,
            ),
          ),
        ],
      ),
    );
  }
}
