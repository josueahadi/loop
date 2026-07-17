import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../constants.dart';
import '../../../core/enums/app_enums.dart';
import '../../../core/models/proposal.dart';
import '../../../core/theme/ui_kit.dart';
import '../../chat/presentation/job_chat_screen.dart';
import '../../navigation/navigation_screen.dart';
import '../../payments/payment_section.dart';
import 'package:latlong2/latlong.dart';

/// Full job detail for a driver's proposal — the driver equivalent of the
/// owner's job-detail screen. Shows the load profile, both addresses, the
/// lifecycle status, and (once accepted) the owner's contact + chat / call /
/// directions to pickup and drop-off.
class DriverJobDetailScreen extends StatelessWidget {
  final Proposal proposal;
  const DriverJobDetailScreen({super.key, required this.proposal});

  // Open in-app turn-by-turn navigation to a stop. "Open in Maps" stays available
  // inside that screen as the "Use another app" fallback.
  void _navigate(BuildContext context, LatLng destination, String label) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) =>
            NavigationScreen(destination: destination, destinationLabel: label),
      ),
    );
  }

  String _displayStatus(Proposal p) {
    if (p.status == 'accepted') {
      final js = p.job?.status;
      if (js == 'completed') return 'completed';
      if (js == 'in_progress') return 'in_progress';
      if (js == 'cancelled') return 'cancelled';
    }
    return p.status;
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'sent':
        return Colors.orange;
      case 'accepted':
      case 'in_progress':
        return primaryGreen;
      case 'completed':
        return Colors.blueGrey;
      case 'declined':
      case 'cancelled':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = proposal;
    final job = p.job;
    final status = _displayStatus(p);

    return Scaffold(
      appBar: AppBar(title: Text(job?.cargoType ?? 'Job')),
      body: job == null
          ? const Center(child: Text('Job details unavailable'))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Status
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: _statusColor(status).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        status.replaceAll('_', ' '),
                        style: TextStyle(
                          color: _statusColor(status),
                          fontWeight: FontWeight.bold,
                          fontSize: 12.5,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Route
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _AddressRow(
                        icon: Icons.my_location,
                        label: 'Pickup',
                        value: job.pickupLabel ?? 'Pinned on map',
                      ),
                      const Padding(
                        padding: EdgeInsets.only(left: 10),
                        child: SizedBox(
                          height: 18,
                          child: VerticalDivider(width: 2),
                        ),
                      ),
                      _AddressRow(
                        icon: Icons.flag_outlined,
                        label: 'Drop-off',
                        value: job.dropOffLabel ?? 'Pinned on map',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),

                // Load profile
                AppCard(
                  child: Column(
                    children: [
                      _DetailRow(
                        label: 'Vehicle',
                        value: job.reqVehicleType.label,
                      ),
                      _DetailRow(
                        label: 'Price',
                        value: '${job.price} RWF',
                        emphasize: true,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Contact + actions (only after acceptance)
                if (p.isAccepted && p.contact != null) ...[
                  const Text(
                    'Cargo owner',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    p.contact!.name,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  Text(
                    p.contact!.phone,
                    style: const TextStyle(color: textGray),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: primaryGreen,
                          foregroundColor: Colors.white,
                        ),
                        onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => JobChatScreen(
                              jobId: p.jobId,
                              contact: p.contact!,
                            ),
                          ),
                        ),
                        icon: const Icon(Icons.chat, size: 18),
                        label: const Text('Chat'),
                      ),
                      OutlinedButton.icon(
                        onPressed: () => launchUrl(
                          Uri(scheme: 'tel', path: p.contact!.phone),
                        ),
                        icon: const Icon(Icons.call, size: 18),
                        label: const Text('Call'),
                      ),
                      FilledButton.icon(
                        onPressed: () => _navigate(
                          context,
                          job.pickup,
                          job.pickupLabel ?? 'Pickup',
                        ),
                        icon: const Icon(Icons.navigation, size: 18),
                        label: const Text('Pickup'),
                      ),
                      FilledButton.icon(
                        onPressed: () => _navigate(
                          context,
                          job.dropOff,
                          job.dropOffLabel ?? 'Drop-off',
                        ),
                        icon: const Icon(Icons.flag, size: 18),
                        label: const Text('Drop-off'),
                      ),
                    ],
                  ),
                  // Driver sees the payment status (read-only) once completed.
                  if (job.status == 'completed') ...[
                    const SizedBox(height: 16),
                    PaymentSection(
                      jobId: job.id,
                      isOwner: false,
                      postedPrice: job.price,
                    ),
                  ],
                ],
              ],
            ),
    );
  }
}

class _AddressRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _AddressRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: primaryGreen),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(fontSize: 11.5, color: textGray),
              ),
              Text(value, style: const TextStyle(fontSize: 14)),
            ],
          ),
        ),
      ],
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  final bool emphasize;
  const _DetailRow({
    required this.label,
    required this.value,
    this.emphasize = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: textGray)),
          Text(
            value,
            style: TextStyle(
              fontWeight: emphasize ? FontWeight.bold : FontWeight.w500,
              color: emphasize ? primaryGreen : null,
            ),
          ),
        ],
      ),
    );
  }
}
