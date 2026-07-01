import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../../constants.dart';
import '../../../core/enums/app_enums.dart';
import '../../../core/models/job.dart';
import '../../../core/repositories/job_repository.dart';

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
  late Job _job = widget.job;
  bool _busy = false;

  Future<void> _cancel() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Cancel this job?'),
        content: const Text('This removes it from matching.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Keep')),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Cancel job')),
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
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          backgroundColor: Colors.red,
        ));
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
                _row('Pickup', j.pickupLabel ?? _coord(j.pickup)),
                _row('Drop-off', j.dropOffLabel ?? _coord(j.dropOff)),
                const Divider(height: 28),
                _row('Estimated cost', '~${j.estimatedPrice} RWF'),
                _row('Posted price', '${j.price} RWF', emphasize: true),
                const Divider(height: 28),
                const Text('Timeline',
                    style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                ..._timeline(j),
                const SizedBox(height: 24),
                if (j.status == 'posted' || j.status == 'draft')
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: _busy ? null : _cancel,
                      style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.red),
                      child: _busy
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(strokeWidth: 2))
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
        PolylineLayer(polylines: [
          Polyline(
              points: [j.pickup, j.dropOff],
              strokeWidth: 3,
              color: primaryGreen),
        ]),
        MarkerLayer(markers: [
          Marker(
              point: j.pickup,
              child: const Icon(Icons.trip_origin, color: primaryGreen)),
          Marker(
              point: j.dropOff,
              child: const Icon(Icons.place, color: Colors.red, size: 32)),
        ]),
      ],
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
                child: Text(label,
                    style: const TextStyle(color: textGray))),
            Expanded(
              child: Text(value,
                  style: TextStyle(
                      fontWeight:
                          emphasize ? FontWeight.bold : FontWeight.normal,
                      color: emphasize ? primaryGreen : null)),
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
            Icon(done ? Icons.check_circle : Icons.radio_button_unchecked,
                size: 18, color: done ? primaryGreen : Colors.grey),
            const SizedBox(width: 10),
            Text(e.key,
                style: TextStyle(color: done ? null : Colors.grey)),
            const Spacer(),
            if (done)
              Text(_fmt(e.value!),
                  style: const TextStyle(color: textGray, fontSize: 12)),
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
