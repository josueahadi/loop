import 'package:flutter/material.dart';
import '../../../core/errors/error_messages.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../../constants.dart';
import '../../../core/config/basemap.dart';
import '../../../core/config/map_zoom_controls.dart';
import '../../../core/location/location_service.dart';
import '../../../core/theme/ui_kit.dart';

/// Read-only "My location" map for drivers. Shows the driver's current GPS
/// position — the point cargo owners see when the driver is online and matching.
/// It does NOT let the driver pick a location: matchability uses live GPS, so
/// showing (not editing) the real position is the honest thing here.
class DriverLocationScreen extends StatefulWidget {
  const DriverLocationScreen({super.key});

  @override
  State<DriverLocationScreen> createState() => _DriverLocationScreenState();
}

class _DriverLocationScreenState extends State<DriverLocationScreen> {
  final _location = LocationService();
  final _mapController = MapController();
  BasemapStyle _style = Basemap.defaultStyle;

  LatLng? _me;
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
      final me = LatLng(pos.latitude, pos.longitude);
      if (!mounted) return;
      setState(() {
        _me = me;
        _loading = false;
      });
      _mapController.move(me, 15);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = friendlyErrorMessage(e);
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Location'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.my_location),
            onPressed: _loading ? null : _load,
          ),
        ],
      ),
      body: _error != null
          ? Padding(
              padding: const EdgeInsets.all(24),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.location_off,
                      size: 56,
                      color: Colors.grey,
                    ),
                    const SizedBox(height: 12),
                    Text(_error!, textAlign: TextAlign.center),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: _load,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: primaryGreen,
                        foregroundColor: Colors.white,
                      ),
                      child: const Text('Try again'),
                    ),
                  ],
                ),
              ),
            )
          : Stack(
              children: [
                FlutterMap(
                  mapController: _mapController,
                  options: const MapOptions(
                    initialCenter: LatLng(-1.9441, 30.0619), // Kigali
                    initialZoom: 13,
                  ),
                  children: [
                    Basemap.tileLayer(context, _style),
                    if (_me != null)
                      MarkerLayer(
                        markers: [
                          Marker(
                            point: _me!,
                            width: 44,
                            height: 44,
                            child: const _MeMarker(),
                          ),
                        ],
                      ),
                    RichAttributionWidget(
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
                    heroPrefix: 'driverloc',
                    style: _style,
                    onToggleStyle: (s) => setState(() => _style = s),
                  ),
                ),
                if (_loading) const Center(child: CircularProgressIndicator()),
                // Explainer so the driver understands this is what owners see.
                Positioned(
                  left: 16,
                  right: 16,
                  bottom: 16,
                  child: AppCard(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.info_outline,
                          color: primaryGreen,
                          size: 20,
                        ),
                        const SizedBox(width: 10),
                        const Expanded(
                          child: Text(
                            'This is where nearby cargo owners see you while you '
                            'are online. It updates from your device location.',
                            style: TextStyle(fontSize: 12.5, color: kMutedText),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}

class _MeMarker extends StatelessWidget {
  const _MeMarker();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: primaryGreen.withValues(alpha: 0.25),
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Container(
          width: 18,
          height: 18,
          decoration: BoxDecoration(
            color: primaryGreen,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 3),
          ),
        ),
      ),
    );
  }
}
