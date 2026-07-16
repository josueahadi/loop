import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../constants.dart';
import '../../core/navigation/open_in_maps.dart';
import '../../core/repositories/routing_repository.dart';
import 'route_follower.dart';

/// In-app turn-by-turn navigation for the driver, post-acceptance (M7). OSRM
/// route over flutter_map: follow-me camera on the live GPS stream, an
/// instruction banner with a live countdown, remaining distance + ETA, off-route
/// rerouting (guarded), and English voice guidance. Keeps the screen awake and
/// releases the location stream + wakelock on arrival, on exit, and on dispose —
/// the stream is never leaked. "Open in Maps" stays available as a fallback.
class NavigationScreen extends StatefulWidget {
  final LatLng destination;
  final String destinationLabel;

  const NavigationScreen({
    super.key,
    required this.destination,
    required this.destinationLabel,
  });

  @override
  State<NavigationScreen> createState() => _NavigationScreenState();
}

class _NavigationScreenState extends State<NavigationScreen> {
  final _routing = RoutingRepository();
  final _mapController = MapController();
  final _tts = FlutterTts();

  StreamSubscription<Position>? _posSub;
  RouteFollower? _follower;
  RouteResult? _route;
  LatLng? _current;
  FollowState? _state;

  bool _loading = true;
  String? _error;
  bool _muted = false;
  // flutter_map throws if MapController.move is called before the map's first
  // render. The GPS stream can fire first, so gate camera moves on this.
  bool _mapReady = false;
  bool _arrived = false;

  // Announce each instruction once when it becomes current, and again ~100 m out.
  int _spokenStep = -1;
  bool _spokenApproach = false;

  // Off-route: sustained > _offRouteThresholdM for _offRouteHold triggers one
  // reroute. Guarded so we don't loop while the new route is fetching.
  static const double _offRouteThresholdM = 40;
  static const Duration _offRouteHold = Duration(seconds: 5);
  static const double _approachAnnounceM = 100;
  DateTime? _offRouteSince;
  bool _rerouting = false;

  @override
  void initState() {
    super.initState();
    WakelockPlus.enable();
    _tts.setLanguage('en-US');
    _tts.setSpeechRate(0.5);
    _start();
  }

  Future<void> _start() async {
    try {
      final pos = await _acquirePosition();
      _current = LatLng(pos.latitude, pos.longitude);
      await _fetchRoute(from: _current!);
      _listenPosition();
      if (mounted) setState(() => _loading = false);
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Could not start navigation: $e';
        });
      }
    }
  }

  Future<Position> _acquirePosition() async {
    final enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) throw Exception('Location services are off');
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    if (perm == LocationPermission.denied ||
        perm == LocationPermission.deniedForever) {
      throw Exception('Location permission denied');
    }
    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
    );
  }

  Future<void> _fetchRoute({required LatLng from}) async {
    final route = await _routing.route(
      from,
      widget.destination,
      steps: true,
    );
    _route = route;
    _follower = route.instructions.isNotEmpty ? RouteFollower(route) : null;
    _spokenStep = -1;
    _spokenApproach = false;
  }

  void _listenPosition() {
    _posSub =
        Geolocator.getPositionStream(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            distanceFilter: 5,
          ),
        ).listen(
          _onPosition,
          onError: (_) {
            // GPS hiccup: keep the last-known dot and show a banner; the stream
            // usually recovers on the next fix.
            if (mounted) setState(() {});
          },
        );
  }

  Future<void> _onPosition(Position pos) async {
    final here = LatLng(pos.latitude, pos.longitude);
    _current = here;
    final follower = _follower;
    if (follower == null || _arrived) {
      if (mounted) setState(() {});
      return;
    }

    final state = follower.update(here);
    _state = state;

    _maybeSpeak(follower, state);
    _handleOffRoute(here, state);
    _maybeArrive(state);

    // Follow-me: recentre on the driver. North-up (a bearing-rotated camera is a
    // possible enhancement; kept north-up for predictable behaviour). Guarded:
    // the map must have rendered once before the controller can move.
    if (_mapReady) _mapController.move(here, 16.5);
    if (mounted) setState(() {});
  }

  void _maybeSpeak(RouteFollower follower, FollowState state) {
    final instr = follower.currentInstruction;
    if (instr == null) return;
    // Announce once when a step becomes current.
    if (state.stepIndex != _spokenStep) {
      _spokenStep = state.stepIndex;
      _spokenApproach = false;
      _speak(instr.text);
      return;
    }
    // And once more ~100 m before the maneuver.
    if (!_spokenApproach &&
        state.distanceToManeuverM <= _approachAnnounceM &&
        state.distanceToManeuverM > 0) {
      _spokenApproach = true;
      _speak('In ${_roundDistance(state.distanceToManeuverM)}, ${instr.text}');
    }
  }

  Future<void> _speak(String text) async {
    if (_muted) return;
    await _tts.stop();
    await _tts.speak(text);
  }

  void _handleOffRoute(LatLng here, FollowState state) {
    if (_rerouting) return;
    if (state.offRouteM > _offRouteThresholdM) {
      _offRouteSince ??= DateTime.now();
      final heldFor = DateTime.now().difference(_offRouteSince!);
      if (heldFor >= _offRouteHold) {
        _reroute(here);
      }
    } else {
      _offRouteSince = null;
    }
  }

  Future<void> _reroute(LatLng from) async {
    _rerouting = true;
    _offRouteSince = null;
    _speak('Rerouting');
    if (mounted) setState(() {});
    try {
      await _fetchRoute(from: from);
    } catch (_) {
      // Keep the old route if the reroute fails; we'll try again after the hold.
    } finally {
      _rerouting = false;
      if (mounted) setState(() {});
    }
  }

  void _maybeArrive(FollowState state) {
    if (_arrived) return;
    if (_follower!.isFinished && state.remainingDistanceM < 30) {
      _arrived = true;
      _speak('You have arrived');
      _stopNavigation();
    }
  }

  // Release the location stream + wakelock. Idempotent; called on arrival, on
  // exit, and on dispose so the stream is never leaked.
  Future<void> _stopNavigation() async {
    await _posSub?.cancel();
    _posSub = null;
    await WakelockPlus.disable();
  }

  @override
  void dispose() {
    _stopNavigation();
    _tts.stop();
    super.dispose();
  }

  String _roundDistance(double m) {
    if (m >= 1000) return '${(m / 1000).toStringAsFixed(1)} km';
    return '${(m / 10).round() * 10} m';
  }

  String _eta(double? remainingS) {
    if (remainingS == null) return '--';
    final min = (remainingS / 60).round();
    return min <= 0 ? '<1 min' : '$min min';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_error != null) {
      return _errorScaffold();
    }

    final route = _route!;
    final state = _state;
    final instr = _follower?.currentInstruction;

    return Scaffold(
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _current ?? widget.destination,
              initialZoom: 16.5,
              onMapReady: () {
                _mapReady = true;
                if (_current != null) _mapController.move(_current!, 16.5);
              },
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'rw.loop.app',
              ),
              if (route.polyline.isNotEmpty)
                PolylineLayer(
                  polylines: [
                    Polyline(
                      points: route.polyline,
                      strokeWidth: 6,
                      color: primaryGreen,
                    ),
                  ],
                ),
              MarkerLayer(
                markers: [
                  Marker(
                    point: widget.destination,
                    child: const Icon(Icons.flag, color: Colors.red, size: 34),
                  ),
                  if (_current != null)
                    Marker(
                      point: _current!,
                      child: const Icon(
                        Icons.navigation,
                        color: Colors.blue,
                        size: 34,
                      ),
                    ),
                ],
              ),
              const RichAttributionWidget(
                attributions: [
                  TextSourceAttribution('OpenStreetMap contributors'),
                ],
              ),
            ],
          ),

          // Top instruction banner.
          Align(
            alignment: Alignment.topCenter,
            child: SafeArea(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (instr != null) _instructionBanner(instr, state),
                  if (_rerouting) _reroutingChip(),
                  if (_posSub == null && !_arrived) _gpsLostChip(),
                ],
              ),
            ),
          ),

          // Bottom footer: remaining distance + ETA + controls.
          Align(
            alignment: Alignment.bottomCenter,
            child: SafeArea(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [_footer(state)],
              ),
            ),
          ),

          if (_arrived) _arrivedOverlay(),
        ],
      ),
    );
  }

  Widget _instructionBanner(RouteInstruction instr, FollowState? state) {
    final next = _follower?.nextInstruction;
    return Container(
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: primaryGreen,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(_maneuverIcon(instr), color: Colors.white, size: 34),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      instr.text,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    if (state != null)
                      Text(
                        'in ${_roundDistance(state.distanceToManeuverM)}',
                        style: const TextStyle(color: Colors.white70),
                      ),
                  ],
                ),
              ),
            ],
          ),
          if (next != null) ...[
            const Divider(color: Colors.white24, height: 16),
            Row(
              children: [
                const Icon(Icons.subdirectory_arrow_right,
                    color: Colors.white54, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Then: ${next.text}',
                    style: const TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _reroutingChip() => const Padding(
    padding: EdgeInsets.symmetric(horizontal: 12),
    child: Chip(
      backgroundColor: Colors.orange,
      label: Text('Rerouting…', style: TextStyle(color: Colors.white)),
    ),
  );

  Widget _gpsLostChip() => const Padding(
    padding: EdgeInsets.symmetric(horizontal: 12),
    child: Chip(
      backgroundColor: Colors.red,
      label: Text(
        'GPS signal lost — showing last position',
        style: TextStyle(color: Colors.white),
      ),
    ),
  );

  Widget _footer(FollowState? state) {
    return Container(
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 8)],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  state == null
                      ? '—'
                      : _roundDistance(state.remainingDistanceM),
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  'ETA ${_eta(state?.remainingDurationS)}',
                  style: const TextStyle(color: textGray, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: _muted ? 'Unmute voice' : 'Mute voice',
            onPressed: () => setState(() => _muted = !_muted),
            icon: Icon(_muted ? Icons.volume_off : Icons.volume_up),
          ),
          TextButton.icon(
            onPressed: () => OpenInMaps.directions(
              context,
              widget.destination,
              label: widget.destinationLabel,
            ),
            icon: const Icon(Icons.open_in_new, size: 18),
            label: const Text('Use another app'),
          ),
        ],
      ),
    );
  }

  Widget _arrivedOverlay() {
    return Positioned.fill(
      child: Container(
        color: Colors.black54,
        child: Center(
          child: Card(
            margin: const EdgeInsets.all(32),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.check_circle,
                      color: primaryGreen, size: 56),
                  const SizedBox(height: 12),
                  Text(
                    'You have arrived at ${widget.destinationLabel}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Done'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _errorScaffold() {
    return Scaffold(
      appBar: AppBar(title: const Text('Navigation')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: Colors.red, size: 48),
              const SizedBox(height: 12),
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 20),
              // OSRM/GPS failure still lets the driver navigate via their own app.
              FilledButton.icon(
                onPressed: () => OpenInMaps.directions(
                  context,
                  widget.destination,
                  label: widget.destinationLabel,
                ),
                icon: const Icon(Icons.open_in_new),
                label: const Text('Open in Maps instead'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  IconData _maneuverIcon(RouteInstruction instr) {
    final mod = instr.modifier ?? '';
    if (instr.maneuverType == 'arrive') return Icons.flag;
    if (instr.maneuverType == 'depart') return Icons.my_location;
    if (instr.maneuverType == 'roundabout' || instr.maneuverType == 'rotary') {
      return Icons.roundabout_left;
    }
    if (mod.contains('left')) return Icons.turn_left;
    if (mod.contains('right')) return Icons.turn_right;
    return Icons.straight;
  }
}
