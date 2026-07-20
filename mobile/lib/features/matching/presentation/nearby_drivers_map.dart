import 'dart:async';

import 'package:flutter/material.dart';
import '../../../core/config/basemap.dart';
import '../../../core/config/map_markers.dart';
import '../../../core/config/map_zoom_controls.dart';
import '../../../core/errors/error_messages.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../../../constants.dart';
import '../../../core/enums/app_enums.dart';
import '../../../core/location/enable_location_prompt.dart';
import '../../../core/location/location_service.dart';
import '../../../core/models/job.dart';
import '../../../core/models/nearby_driver.dart';
import '../../../core/repositories/job_repository.dart';
import '../../../core/repositories/matching_repository.dart';
import '../../../core/repositories/proposal_repository.dart';

/// Owner home map (M2): nearby available, verified drivers on an OSM map, filtered
/// by vehicle type, ordered by proximity. When opened for a specific posted job
/// ([forJob]), tapping a driver lets the owner send a proposal at the posted price
/// (M4) — otherwise it's the browse-only home tab.
class NearbyDriversMap extends StatefulWidget {
  final Job? forJob;
  const NearbyDriversMap({super.key, this.forJob});

  @override
  State<NearbyDriversMap> createState() => _NearbyDriversMapState();
}

class _NearbyDriversMapState extends State<NearbyDriversMap> {
  final _matching = MatchingRepository();
  final _location = LocationService();
  final _jobs = JobRepository();
  final _proposals = ProposalRepository();
  final _mapController = MapController();
  BasemapStyle _style = Basemap.defaultStyle;

  LatLng? _center;
  List<NearbyDriver> _drivers = [];
  List<Job> _postedJobs = [];
  VehicleType? _filter;
  Job? _selectedJob;
  bool _loading = true;
  bool _jobsLoading = false;
  String? _error;
  StreamSubscription<Position>? _selfTracking;

  @override
  void initState() {
    super.initState();
    // Pre-filter to the job's required vehicle type when proposing.
    _filter = widget.forJob?.reqVehicleType;
    _selectedJob = widget.forJob;
    WidgetsBinding.instance.addPostFrameCallback((_) => _primeThenLoad());
  }

  @override
  void dispose() {
    _selfTracking?.cancel();
    _mapController.dispose();
    super.dispose();
  }

  // Follow the owner's own position live so their marker tracks them as they move.
  // Only the owner's dot streams; driver dots refresh on demand (live driver
  // tracking is deferred stretch work). Safe to call repeatedly.
  Future<void> _startTrackingSelf() async {
    if (_selfTracking != null) return;
    try {
      final stream = await _location.positionStream();
      _selfTracking = stream.listen((pos) {
        if (!mounted) return;
        setState(() => _center = LatLng(pos.latitude, pos.longitude));
      });
    } catch (_) {
      // Best-effort — the one-shot position already centred the map.
    }
  }

  // Prime the location ask (design 04) before the OS prompt fires.
  Future<void> _primeThenLoad() async {
    final hasPermission = await _location.hasLocationPermission();
    if (!hasPermission) {
      if (!mounted) return;
      final proceed = await EnableLocationPrompt.show(
        context,
        message: 'See available drivers around you and set your pickup point.',
      );
      if (!proceed) {
        if (mounted) {
          setState(() {
            _loading = false;
            _error = 'Location off. Enable it to see nearby drivers.';
          });
        }
        return;
      }
    }
    await _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      if (widget.forJob == null) {
        await _loadPostedJobs();
      }
      final pos = await _location.getCurrentPosition();
      final center = LatLng(pos.latitude, pos.longitude);
      final drivers = await _matching.nearby(
        lat: pos.latitude,
        lng: pos.longitude,
        vehicleType: _filter,
      );
      if (!mounted) return;
      setState(() {
        _center = center;
        _drivers = drivers;
        _loading = false;
      });
      _mapController.move(center, 14);
      // Now that we have permission + a fix, follow the owner live.
      _startTrackingSelf();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = friendlyErrorMessage(e);
        _loading = false;
      });
    }
  }

  Future<void> _loadPostedJobs() async {
    if (_jobsLoading) return;
    _jobsLoading = true;
    try {
      final jobs = await _jobs.listOwn();
      final posted = jobs.where((j) => j.status == 'posted').toList();
      if (!mounted) return;
      setState(() {
        _postedJobs = posted;
        if (_selectedJob == null ||
            !posted.any((j) => j.id == _selectedJob!.id)) {
          _selectedJob = posted.isEmpty ? null : posted.first;
        }
        if (_selectedJob != null) {
          _filter = _selectedJob!.reqVehicleType;
        }
      });
    } finally {
      _jobsLoading = false;
    }
  }

  Future<void> _sendProposal(NearbyDriver d) async {
    final job = _selectedJob;
    if (job == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Create or select a posted job first.'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }
    try {
      await _proposals.send(jobId: job.id, driverId: d.id);
      if (!mounted) return;
      Navigator.pop(context); // close the driver sheet
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Proposal sent to ${d.name}. You\'ll be notified when they '
            'accept — track it under this job in My Jobs.',
          ),
          backgroundColor: primaryGreen,
          duration: const Duration(seconds: 4),
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(friendlyErrorMessage(e)),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _showDriver(NearbyDriver d) {
    final selectedJob = _selectedJob;
    showModalBottomSheet(
      context: context,
      builder: (_) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              d.name,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(Icons.star, size: 18, color: Colors.orange),
                const SizedBox(width: 4),
                Text(
                  d.ratingCount == 0
                      ? 'No ratings yet'
                      : '${d.averageRating.toStringAsFixed(1)} (${d.ratingCount})',
                ),
                const SizedBox(width: 16),
                const Icon(Icons.near_me, size: 18, color: primaryGreen),
                const SizedBox(width: 4),
                Text(d.distanceLabel),
              ],
            ),
            const SizedBox(height: 12),
            Text('Vehicles: ${d.vehicles.map((v) => v.type.label).join(', ')}'),
            const SizedBox(height: 20),
            if (widget.forJob == null) ...[
              if (_postedJobs.isEmpty)
                const Text(
                  'No open posted jobs. Post a job first, then send a proposal.',
                  style: TextStyle(color: textGray),
                )
              else
                DropdownButtonFormField<Job>(
                  initialValue: selectedJob,
                  decoration: const InputDecoration(labelText: 'Propose for'),
                  items: _postedJobs
                      .map(
                        (j) => DropdownMenuItem<Job>(
                          value: j,
                          child: Text(
                            '${j.cargoType} · ${j.reqVehicleType.label} · ${j.price} RWF',
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: (job) {
                    if (job == null) return;
                    setState(() {
                      _selectedJob = job;
                      _filter = job.reqVehicleType;
                    });
                    Navigator.pop(context);
                    _load();
                  },
                ),
              const SizedBox(height: 12),
            ],
            SizedBox(
              width: double.infinity,
              child: selectedJob == null
                  ? const OutlinedButton(
                      onPressed: null,
                      child: Text('Post a job first'),
                    )
                  : ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: primaryGreen,
                        foregroundColor: Colors.white,
                      ),
                      onPressed: () => _sendProposal(d),
                      child: Text('Send proposal · ${selectedJob.price} RWF'),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _FilterBar(
          value: _filter,
          count: _drivers.length,
          onChanged: (v) {
            setState(() => _filter = v);
            _load();
          },
          onRefresh: _load,
        ),
        Expanded(
          child: _error != null
              ? _ErrorView(message: _error!, onRetry: _load)
              : Stack(
                  children: [
                    FlutterMap(
                      mapController: _mapController,
                      options: MapOptions(
                        initialCenter:
                            _center ?? const LatLng(-1.9441, 30.0619),
                        initialZoom: 13,
                      ),
                      children: [
                        Basemap.tileLayer(context, _style),
                        MarkerLayer(markers: _markers()),
                        RichAttributionWidget(
                          alignment: AttributionAlignment.bottomLeft,
                          attributions: [
                            TextSourceAttribution(Basemap.attribution),
                          ],
                        ),
                      ],
                    ),
                    Positioned(
                      right: 12,
                      top: 12,
                      child: MapZoomControls(
                        controller: _mapController,
                        heroPrefix: 'nearby',
                        style: _style,
                        onToggleStyle: (s) => setState(() => _style = s),
                      ),
                    ),
                    if (_loading)
                      const Center(child: CircularProgressIndicator()),
                    if (!_loading && _drivers.isEmpty)
                      const Positioned(
                        bottom: 24,
                        left: 24,
                        right: 24,
                        child: _NoDriversBanner(),
                      ),
                  ],
                ),
        ),
      ],
    );
  }

  List<Marker> _markers() {
    final markers = <Marker>[];
    if (_center != null) {
      markers.add(MapMarkers.youDot(_center!));
    }
    for (final d in _drivers) {
      markers.add(
        MapMarkers.vehiclePin(LatLng(d.lat, d.lng), onTap: () => _showDriver(d)),
      );
    }
    return markers;
  }
}

class _FilterBar extends StatelessWidget {
  final VehicleType? value;
  final int count;
  final ValueChanged<VehicleType?> onChanged;
  final VoidCallback onRefresh;

  const _FilterBar({
    required this.value,
    required this.count,
    required this.onChanged,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        children: [
          const Icon(Icons.filter_list, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: DropdownButton<VehicleType?>(
              isExpanded: true,
              value: value,
              hint: const Text('All vehicle types'),
              items: [
                const DropdownMenuItem<VehicleType?>(
                  value: null,
                  child: Text('All vehicle types'),
                ),
                ...VehicleType.values.map(
                  (t) => DropdownMenuItem<VehicleType?>(
                    value: t,
                    child: Text(t.label),
                  ),
                ),
              ],
              onChanged: onChanged,
            ),
          ),
          Text('$count nearby'),
          IconButton(icon: const Icon(Icons.refresh), onPressed: onRefresh),
        ],
      ),
    );
  }
}

class _NoDriversBanner extends StatelessWidget {
  const _NoDriversBanner();

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: const [
            Icon(Icons.info_outline, color: primaryGreen),
            SizedBox(width: 12),
            Expanded(
              child: Text(
                'No available drivers nearby right now. Try again shortly or widen your search.',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.location_off, size: 48, color: Colors.grey),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}
