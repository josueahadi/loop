import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../constants.dart';
import '../../../core/enums/app_enums.dart';
import '../../../core/models/job.dart';
import '../../../core/models/proposal.dart';
import '../../../core/navigation/open_in_maps.dart';
import '../../../core/repositories/job_repository.dart';
import '../../../core/repositories/message_repository.dart';
import '../../../core/repositories/proposal_repository.dart';
import '../../chat/presentation/job_chat_screen.dart';
import '../../matching/presentation/nearby_drivers_map.dart';
import '../../ratings/presentation/rating_screen.dart';

/// Owner-facing job detail (M3), backed by the jobs API. Shows the load profile,
/// prices (estimated cost vs posted), the pin route, and a status timeline. The owner
/// can cancel a job that hasn't been matched yet. Selecting a driver / proposals
/// is the M4 transaction loop.
class OwnerJobDetailScreen extends StatefulWidget {
  final Job job;
  const OwnerJobDetailScreen({super.key, required this.job});

  @override
  State<OwnerJobDetailScreen> createState() => _OwnerJobDetailScreenState();
}

class _OwnerJobDetailScreenState extends State<OwnerJobDetailScreen> {
  final _jobs = JobRepository();
  final _proposals = ProposalRepository();
  final _messages = MessageRepository();
  late Job _job = widget.job;
  Proposal? _accepted;
  bool _ownerRated = false;
  bool _busy = false;
  int _unread = 0;

  static const _assignedStatuses = {'matched', 'in_progress', 'completed'};

  @override
  void initState() {
    super.initState();
    _loadAccepted();
    _loadUnread();
  }

  Future<void> _loadUnread() async {
    final map = await _messages.unreadByJob();
    if (!mounted) return;
    setState(() => _unread = map[_job.id] ?? 0);
  }

  Future<void> _loadAccepted() async {
    if (!_assignedStatuses.contains(_job.status)) return;
    try {
      final accepted = (await _proposals.forJob(
        _job.id,
      )).where((p) => p.isAccepted).toList();
      if (mounted) {
        setState(() => _accepted = accepted.isNotEmpty ? accepted.first : null);
      }
    } catch (_) {
      // best-effort; contact card just won't render
    }
  }

  Future<void> _refresh() async {
    try {
      final updated = await _jobs.getById(_job.id);
      if (mounted) setState(() => _job = updated);
      await _loadAccepted();
    } catch (_) {}
  }

  Future<void> _findDrivers() async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => Scaffold(
          appBar: AppBar(title: const Text('Find a driver')),
          body: NearbyDriversMap(forJob: _job),
        ),
      ),
    );
    _refresh(); // a driver may have accepted while we were away
  }

  Future<void> _call(String phone) async =>
      launchUrl(Uri(scheme: 'tel', path: phone));

  // Owner-driven lifecycle: matched → in_progress → completed.
  Future<void> _advance(String toStatus) async {
    setState(() => _busy = true);
    try {
      final updated = await _jobs.updateStatus(_job.id, toStatus);
      if (mounted) setState(() => _job = updated);
      await _loadAccepted();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _rateDriver() async {
    final name = _accepted?.contact?.name ?? 'the driver';
    final done = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => RatingScreen(jobId: _job.id, counterpartyName: name),
      ),
    );
    if (done == true && mounted) setState(() => _ownerRated = true);
  }

  Future<void> _cancel() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Cancel this job?'),
        content: const Text('This removes it from matching.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Cancel job'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    setState(() => _busy = true);
    try {
      final updated = await _jobs.updateStatus(_job.id, 'cancelled');
      if (!mounted) return;
      setState(() => _job = updated);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final j = _job;
    return Scaffold(
      appBar: AppBar(title: const Text('Job details')),
      body: ListView(
        children: [
          SizedBox(height: 220, child: _map(j)),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _statusChip(j.status),
                const SizedBox(height: 16),
                _row('Cargo', j.cargoType),
                _row('Load size', j.size.label),
                if (j.weightKg != null)
                  _row('Weight', '${j.weightKg!.toStringAsFixed(0)} kg'),
                _row('Vehicle needed', j.reqVehicleType.label),
                const Divider(height: 28),
                _stop(
                  'Pickup',
                  j.pickupLabel ?? _coord(j.pickup),
                  j.pickupNotes,
                  j.pickup,
                ),
                const SizedBox(height: 12),
                _stop(
                  'Drop-off',
                  j.dropOffLabel ?? _coord(j.dropOff),
                  j.dropOffNotes,
                  j.dropOff,
                ),
                const Divider(height: 28),
                _row('Estimated cost', '~${j.estimatedPrice} RWF'),
                _row('Posted price', '${j.price} RWF', emphasize: true),
                const Divider(height: 28),
                const Text(
                  'Timeline',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                ..._timeline(j),
                const SizedBox(height: 24),
                // Posted → find drivers and send a proposal at the posted price.
                if (j.status == 'posted')
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: primaryGreen,
                        foregroundColor: Colors.white,
                      ),
                      onPressed: _findDrivers,
                      icon: const Icon(Icons.search),
                      label: const Text('Find drivers & send proposal'),
                    ),
                  ),
                // Once assigned, the driver's contact, call, and chat appear.
                if (_assignedStatuses.contains(j.status) &&
                    _accepted?.contact != null) ...[
                  _assignedDriver(_accepted!),
                  const SizedBox(height: 12),
                  ..._lifecycleControls(j),
                ],
                const SizedBox(height: 12),
                if (j.status == 'posted' || j.status == 'draft')
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: _busy ? null : _cancel,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.red,
                      ),
                      child: _busy
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Cancel job'),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _map(Job j) {
    final mid = LatLng(
      (j.pickup.latitude + j.dropOff.latitude) / 2,
      (j.pickup.longitude + j.dropOff.longitude) / 2,
    );
    return FlutterMap(
      options: MapOptions(initialCenter: mid, initialZoom: 12),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'rw.loop.app',
        ),
        PolylineLayer(
          polylines: [
            Polyline(
              points: [j.pickup, j.dropOff],
              strokeWidth: 3,
              color: primaryGreen,
            ),
          ],
        ),
        MarkerLayer(
          markers: [
            Marker(
              point: j.pickup,
              child: const Icon(Icons.trip_origin, color: primaryGreen),
            ),
            Marker(
              point: j.dropOff,
              child: const Icon(Icons.place, color: Colors.red, size: 32),
            ),
          ],
        ),
        RichAttributionWidget(
          attributions: [TextSourceAttribution('OpenStreetMap contributors')],
        ),
      ],
    );
  }

  // A stop (pickup / drop-off): label, optional note, and an "Open in Maps"
  // directions hand-off to the user's own maps app.
  Widget _stop(String title, String label, String? note, LatLng point) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: textGray,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 2),
              Text(label),
              if (note != null && note.isNotEmpty)
                Text(
                  'Note: $note',
                  style: const TextStyle(color: textGray, fontSize: 12),
                ),
            ],
          ),
        ),
        TextButton.icon(
          onPressed: () => OpenInMaps.directions(context, point, label: label),
          icon: const Icon(Icons.directions, size: 18),
          label: const Text('Open in Maps'),
        ),
      ],
    );
  }

  // Owner controls to move the job forward and, once completed, rate the driver.
  List<Widget> _lifecycleControls(Job j) {
    Widget btn(String text, VoidCallback? onTap) => SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryGreen,
          foregroundColor: Colors.white,
        ),
        onPressed: _busy ? null : onTap,
        child: Text(text),
      ),
    );
    if (j.status == 'matched') {
      return [
        btn('Driver started — mark in progress', () => _advance('in_progress')),
      ];
    }
    if (j.status == 'in_progress') {
      return [btn('Delivered — mark completed', () => _advance('completed'))];
    }
    if (j.status == 'completed') {
      return [
        _ownerRated
            ? const Center(child: Text('You rated this delivery ✓'))
            : btn('Rate driver', _rateDriver),
      ];
    }
    return const [];
  }

  // Shown once assigned: the accepted driver's contact + call + chat.
  Widget _assignedDriver(Proposal accepted) {
    final c = accepted.contact!;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: lightGreen,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Assigned driver',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(c.name),
          Text(c.phone, style: const TextStyle(color: textGray)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            children: [
              OutlinedButton.icon(
                onPressed: () => _call(c.phone),
                icon: const Icon(Icons.call, size: 18),
                label: const Text('Call'),
              ),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryGreen,
                  foregroundColor: Colors.white,
                ),
                onPressed: () async {
                  await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => JobChatScreen(jobId: _job.id, contact: c),
                    ),
                  );
                  _loadUnread();
                },
                icon: const Icon(Icons.chat, size: 18),
                label: Text(_unread > 0 ? 'Chat ($_unread)' : 'Chat'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _statusChip(String status) => Chip(
    label: Text(status.replaceAll('_', ' ').toUpperCase()),
    backgroundColor: lightGreen,
  );

  Widget _row(String label, String value, {bool emphasize = false}) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 130,
          child: Text(label, style: const TextStyle(color: textGray)),
        ),
        Expanded(
          child: Text(
            value,
            style: TextStyle(
              fontWeight: emphasize ? FontWeight.bold : FontWeight.normal,
              color: emphasize ? primaryGreen : null,
            ),
          ),
        ),
      ],
    ),
  );

  List<Widget> _timeline(Job j) {
    final steps = <MapEntry<String, DateTime?>>[
      MapEntry('Created', j.createdAt),
      MapEntry('Posted', j.postedAt),
      MapEntry('Matched', j.matchedAt),
      MapEntry('Accepted', j.acceptedAt),
      MapEntry('In progress', j.inProgressAt),
      MapEntry('Completed', j.completedAt),
      if (j.cancelledAt != null) MapEntry('Cancelled', j.cancelledAt),
    ];
    return steps.map((e) {
      final done = e.value != null;
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          children: [
            Icon(
              done ? Icons.check_circle : Icons.radio_button_unchecked,
              size: 18,
              color: done ? primaryGreen : Colors.grey,
            ),
            const SizedBox(width: 10),
            Text(e.key, style: TextStyle(color: done ? null : Colors.grey)),
            const Spacer(),
            if (done)
              Text(
                _fmt(e.value!),
                style: const TextStyle(color: textGray, fontSize: 12),
              ),
          ],
        ),
      );
    }).toList();
  }

  String _coord(LatLng p) =>
      '${p.latitude.toStringAsFixed(4)}, ${p.longitude.toStringAsFixed(4)}';
  String _fmt(DateTime d) =>
      '${d.day}/${d.month} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
}
