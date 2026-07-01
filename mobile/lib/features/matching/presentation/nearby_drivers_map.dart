import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../../constants.dart';
import '../../../core/enums/app_enums.dart';
import '../../../core/location/location_service.dart';
import '../../../core/models/nearby_driver.dart';
import '../../../core/repositories/matching_repository.dart';

/// Owner home map (M2): shows nearby available, verified drivers on an OSM map,
/// filtered by vehicle type and ordered by proximity (the API does the PostGIS
/// distance work). Tapping a driver shows their details.
class NearbyDriversMap extends StatefulWidget {
  const NearbyDriversMap({super.key});

  @override
  State<NearbyDriversMap> createState() => _NearbyDriversMapState();
}

class _NearbyDriversMapState extends State<NearbyDriversMap> {
  final _matching = MatchingRepository();
  final _location = LocationService();
  final _mapController = MapController();

  LatLng? _center;
  List<NearbyDriver> _drivers = [];
  VehicleType? _filter;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
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
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  void _showDriver(NearbyDriver d) {
    showModalBottomSheet(
      context: context,
      builder: (_) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(d.name,
                style:
                    const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            Row(children: [
              const Icon(Icons.star, size: 18, color: Colors.orange),
              const SizedBox(width: 4),
              Text(d.averageRating.toStringAsFixed(1)),
              const SizedBox(width: 16),
              const Icon(Icons.near_me, size: 18, color: primaryGreen),
              const SizedBox(width: 4),
              Text(d.distanceLabel),
            ]),
            const SizedBox(height: 12),
            Text('Vehicles: ${d.vehicles.map((v) => v.type.label).join(', ')}'),
            const SizedBox(height: 20),
            // Sending a proposal at the posted price is the M4 transaction loop.
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: null,
                child: const Text('Send proposal (coming soon)'),
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
                        initialCenter: _center ?? const LatLng(-1.9441, 30.0619),
                        initialZoom: 13,
                      ),
                      children: [
                        TileLayer(
                          urlTemplate:
                              'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                          userAgentPackageName: 'rw.loop.app',
                        ),
                        MarkerLayer(markers: _markers()),
                      ],
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
      markers.add(Marker(
        point: _center!,
        width: 40,
        height: 40,
        child: const Icon(Icons.my_location, color: Colors.blue, size: 32),
      ));
    }
    for (final d in _drivers) {
      markers.add(Marker(
        point: LatLng(d.lat, d.lng),
        width: 44,
        height: 44,
        child: GestureDetector(
          onTap: () => _showDriver(d),
          child: const Icon(Icons.local_shipping, color: primaryGreen, size: 36),
        ),
      ));
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
