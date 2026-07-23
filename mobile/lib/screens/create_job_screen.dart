import 'dart:async';

import 'package:flutter/material.dart';
import '../core/errors/error_messages.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_map_dragmarker/flutter_map_dragmarker.dart';
import 'package:latlong2/latlong.dart';

import '../constants.dart';
import '../core/enums/app_enums.dart';
import '../core/location/location_service.dart';
import '../core/repositories/geocode_repository.dart';
import '../core/repositories/job_repository.dart';
import '../core/repositories/pricing_repository.dart';
import '../core/config/basemap.dart';
import '../core/config/map_zoom_controls.dart';
import '../core/repositories/routing_repository.dart';

/// Owner create-job flow (M3/M3.5): set pickup + drop-off by place/landmark
/// search, current location, or dropping/dragging a pin; pins carry a
/// reverse-geocoded label + optional note. Enter the load profile, get the
/// estimated cost from the API, edit the price, then post. The straight line
/// between the pins is the same great-circle the pricing uses.
class CreateJobScreen extends StatefulWidget {
  const CreateJobScreen({super.key});

  @override
  State<CreateJobScreen> createState() => _CreateJobScreenState();
}

class _CreateJobScreenState extends State<CreateJobScreen> {
  static const _kigali = LatLng(-1.9441, 30.0619);

  final _location = LocationService();
  final _pricing = PricingRepository();
  final _jobs = JobRepository();
  final _geocode = GeocodeRepository();
  final _mapController = MapController();
  BasemapStyle _style = Basemap.defaultStyle;
  final _formKey = GlobalKey<FormState>();

  final _cargoTypeController = TextEditingController();
  final _weightController = TextEditingController();
  final _priceController = TextEditingController();
  final _searchController = TextEditingController();
  final _pickupNotesController = TextEditingController();
  final _dropOffNotesController = TextEditingController();

  LatLng? _pickup;
  LatLng? _dropOff;
  String? _pickupLabel;
  String? _dropOffLabel;
  bool _settingPickup = true;
  JobSize _size = JobSize.medium;
  VehicleType _vehicleType = VehicleType.pickup;

  Timer? _debounce;
  List<GeoResult> _suggestions = [];
  bool _searching = false;

  PriceEstimate? _estimate;
  bool _estimating = false;
  bool _posting = false;
  // Off until the first failed submit, then always — so validation errors stay
  // visible on the fields the user must fix, instead of the post failing silently.
  AutovalidateMode _autovalidate = AutovalidateMode.disabled;

  // Scroll the form to the estimate once it arrives — it renders below the
  // fold, so without this the result is invisible and the tap looks like a no-op.
  final _scrollController = ScrollController();
  final _estimateKey = GlobalKey();

  // Road route drawn between the pins once an estimate is fetched. Empty until
  // then, or when only the great-circle fallback is available (we keep the
  // straight line in that case).
  final _routing = RoutingRepository();
  List<LatLng> _routePolyline = const [];
  Timer? _routeDebounce;

  @override
  void initState() {
    super.initState();
    _centerOnCurrentLocation();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _routeDebounce?.cancel();
    _cargoTypeController.dispose();
    _weightController.dispose();
    _priceController.dispose();
    _searchController.dispose();
    _pickupNotesController.dispose();
    _dropOffNotesController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _centerOnCurrentLocation() async {
    try {
      final pos = await _location.getCurrentPosition();
      final here = LatLng(pos.latitude, pos.longitude);
      if (!mounted) return;
      _mapController.move(here, 14);
      setState(() => _pickup ??= here);
    } catch (_) {
      // Fall back to the default centre; the owner can still drop pins.
    }
  }

  // Sets the active pin (pickup/drop-off) to a point. If a label is given (from
  // search) it's used directly; otherwise the pin is reverse-geocoded so it shows
  // a readable place instead of raw coordinates.
  void _setActivePin(LatLng point, {String? label, bool move = false}) {
    setState(() {
      if (_settingPickup) {
        _pickup = point;
        _pickupLabel = label;
      } else {
        _dropOff = point;
        _dropOffLabel = label;
      }
      _estimate = null; // pins changed → estimate stale
      _routePolyline = const [];
    });
    if (move) _mapController.move(point, 15);
    if (label == null) _reverseActivePin(point, _settingPickup);
    _refreshRoutePreview();
  }

  // Draw the road route between the pins as soon as both are set, so the owner
  // sees the actual road path (not a straight line) before asking for a price.
  // Debounced and best-effort: a failure just leaves the straight-line fallback.
  void _refreshRoutePreview() {
    _routeDebounce?.cancel();
    if (_pickup == null || _dropOff == null) return;
    final from = _pickup!, to = _dropOff!;
    _routeDebounce = Timer(const Duration(milliseconds: 400), () async {
      try {
        final r = await _routing.route(from, to);
        if (!mounted) return;
        // Ignore if the pins moved again while this was in flight.
        if (_pickup == from && _dropOff == to) {
          setState(() => _routePolyline = r.polyline);
        }
      } catch (_) {
        // keep the straight line
      }
    });
  }

  Future<void> _reverseActivePin(LatLng point, bool forPickup) async {
    try {
      final label = await _geocode.reverse(point);
      if (!mounted || label == null) return;
      setState(() {
        if (forPickup) {
          _pickupLabel = label;
        } else {
          _dropOffLabel = label;
        }
      });
    } catch (_) {
      // Reverse geocode is best-effort; the pin still works without a label.
    }
  }

  void _onMapTap(LatLng point) => _setActivePin(point);

  // Fired once when a pin drag settles — a single reverse-geocode call, not per frame.
  void _onPinDragEnd(LatLng point, bool isPickup) {
    setState(() {
      if (isPickup) {
        _pickup = point;
        _pickupLabel = null;
      } else {
        _dropOff = point;
        _dropOffLabel = null;
      }
      _estimate = null;
      _routePolyline = const [];
    });
    _reverseActivePin(point, isPickup);
    _refreshRoutePreview();
  }

  Future<void> _useMyLocationForActivePin() async {
    try {
      final pos = await _location.getCurrentPosition();
      if (!mounted) return;
      _setActivePin(LatLng(pos.latitude, pos.longitude), move: true);
    } catch (e) {
      _snack(friendlyErrorMessage(e));
    }
  }

  void _onSearchChanged(String q) {
    _debounce?.cancel();
    if (q.trim().length < 2) {
      setState(() => _suggestions = []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      setState(() => _searching = true);
      try {
        final results = await _geocode.search(q);
        if (mounted) setState(() => _suggestions = results);
      } catch (_) {
        if (mounted) setState(() => _suggestions = []);
      } finally {
        if (mounted) setState(() => _searching = false);
      }
    });
  }

  void _selectSuggestion(GeoResult r) {
    _searchController.clear();
    FocusScope.of(context).unfocus();
    setState(() => _suggestions = []);
    _setActivePin(r.point, label: r.label, move: true);
  }

  Future<void> _getEstimate() async {
    if (_pickup == null || _dropOff == null) {
      _snack('Set both a pickup and a drop-off pin first.');
      return;
    }
    setState(() => _estimating = true);
    try {
      final est = await _pricing.estimate(
        pickup: _pickup!,
        dropOff: _dropOff!,
        vehicleType: _vehicleType,
        size: _size,
        weightKg: double.tryParse(_weightController.text.trim()),
      );
      // Fetch the road geometry to draw (best-effort — a failure here just
      // leaves the straight line; the estimate already succeeded).
      List<LatLng> poly = const [];
      try {
        final r = await _routing.route(_pickup!, _dropOff!);
        poly = r.polyline;
      } catch (_) {
        // keep the straight line
      }
      if (!mounted) return;
      setState(() {
        _estimate = est;
        _routePolyline = poly;
        _priceController.text = est.estimatedPrice.toString();
      });
      // Reveal the just-rendered estimate — it sits below the fold, so bring it
      // into view once this frame has laid it out.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final ctx = _estimateKey.currentContext;
        if (ctx != null) {
          Scrollable.ensureVisible(
            ctx,
            duration: const Duration(milliseconds: 350),
            curve: Curves.easeInOut,
            alignment: 0.1,
          );
        }
      });
    } catch (e) {
      _snack(friendlyErrorMessage(e));
    } finally {
      if (mounted) setState(() => _estimating = false);
    }
  }

  Future<void> _post() async {
    if (!_formKey.currentState!.validate()) {
      // Reveal the errors and bring the failing fields into view rather than
      // failing silently in the background.
      setState(() => _autovalidate = AutovalidateMode.always);
      _scrollController.animateTo(
        0,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
      _snack('Please fill in the highlighted fields.');
      return;
    }
    if (_pickup == null || _dropOff == null || _estimate == null) {
      _snack('Get a price estimate before posting.');
      return;
    }
    final price = int.tryParse(_priceController.text.trim());
    if (price == null || price < 0) {
      _snack('Enter a valid price.');
      return;
    }
    setState(() => _posting = true);
    try {
      await _jobs.create(
        pickup: _pickup!,
        pickupLabel: _pickupLabel,
        pickupNotes: _emptyToNull(_pickupNotesController.text),
        dropOff: _dropOff!,
        dropOffLabel: _dropOffLabel,
        dropOffNotes: _emptyToNull(_dropOffNotesController.text),
        cargoType: _cargoTypeController.text.trim(),
        size: _size,
        weightKg: double.tryParse(_weightController.text.trim()),
        reqVehicleType: _vehicleType,
        estimatedPrice: _estimate!.estimatedPrice,
        price: price,
      );
      if (!mounted) return;
      _snack('Job posted', ok: true);
      Navigator.pop(context, true);
    } catch (e) {
      _snack(friendlyErrorMessage(e));
    } finally {
      if (mounted) setState(() => _posting = false);
    }
  }

  String? _emptyToNull(String s) => s.trim().isEmpty ? null : s.trim();

  void _snack(String msg, {bool ok = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: ok ? primaryGreen : Colors.red,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('New Job')),
      body: Column(
        children: [
          SizedBox(height: 280, child: _buildMap()),
          _buildPinToggle(),
          Expanded(
            child: SingleChildScrollView(
              controller: _scrollController,
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                autovalidateMode: _autovalidate,
                child: _buildForm(),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMap() {
    return Stack(
      children: [
        FlutterMap(
          mapController: _mapController,
          options: MapOptions(
            initialCenter: _pickup ?? _kigali,
            initialZoom: 13,
            onTap: (_, point) => _onMapTap(point),
          ),
          children: [
            Basemap.tileLayer(context, _style),
            // Prefer the OSRM road geometry; fall back to a straight line
            // between the pins until a route is fetched (or on OSRM fallback).
            if (_pickup != null && _dropOff != null)
              PolylineLayer(
                polylines: [
                  Polyline(
                    points: _routePolyline.isNotEmpty
                        ? _routePolyline
                        : [_pickup!, _dropOff!],
                    strokeWidth: _routePolyline.isNotEmpty ? 4 : 3,
                    color: primaryGreen,
                  ),
                ],
              ),
            // Draggable pins: drag to reposition; the label is reverse-geocoded
            // once on drag-END (not per frame), so the shared OSM instance isn't
            // hammered while dragging.
            DragMarkers(
              markers: [
                if (_pickup != null)
                  DragMarker(
                    key: const ValueKey('pickup'),
                    point: _pickup!,
                    size: const Size(40, 40),
                    builder: (_, _, _) =>
                        const Icon(Icons.flag, color: primaryGreen, size: 34),
                    onDragEnd: (_, point) => _onPinDragEnd(point, true),
                  ),
                if (_dropOff != null)
                  DragMarker(
                    key: const ValueKey('dropoff'),
                    point: _dropOff!,
                    size: const Size(40, 40),
                    builder: (_, _, _) =>
                        const Icon(Icons.flag, color: Colors.red, size: 34),
                    onDragEnd: (_, point) => _onPinDragEnd(point, false),
                  ),
              ],
            ),
            RichAttributionWidget(
              alignment: AttributionAlignment.bottomLeft,
              attributions: [TextSourceAttribution(Basemap.attribution)],
            ),
          ],
        ),
        Positioned(
          right: 12,
          top: 12,
          child: MapZoomControls(
            controller: _mapController,
            heroPrefix: 'createjob',
            style: _style,
            onToggleStyle: (s) => setState(() => _style = s),
          ),
        ),
        Positioned(
          right: 12,
          bottom: 12,
          child: FloatingActionButton.extended(
            heroTag: 'myloc',
            onPressed: _useMyLocationForActivePin,
            backgroundColor: Colors.white,
            foregroundColor: primaryGreen,
            icon: const Icon(Icons.my_location),
            label: Text(
              _settingPickup ? 'Pickup: my location' : 'Drop-off: my location',
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPinToggle() {
    final activeLabel = _settingPickup ? _pickupLabel : _dropOffLabel;
    final activeSet = _settingPickup ? _pickup != null : _dropOff != null;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SegmentedButton<bool>(
            segments: const [
              ButtonSegment(value: true, label: Text('Pickup')),
              ButtonSegment(value: false, label: Text('Drop-off')),
            ],
            selected: {_settingPickup},
            onSelectionChanged: (s) => setState(() {
              _settingPickup = s.first;
              _suggestions = [];
              _searchController.clear();
            }),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _searchController,
            onChanged: _onSearchChanged,
            decoration: InputDecoration(
              isDense: true,
              prefixIcon: const Icon(Icons.search),
              suffixIcon: _searching
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: SizedBox(
                        height: 16,
                        width: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    )
                  : null,
              hintText: _settingPickup
                  ? 'Search a pickup place'
                  : 'Search a drop-off place',
              border: const OutlineInputBorder(),
            ),
          ),
          if (_suggestions.isNotEmpty)
            Container(
              constraints: const BoxConstraints(maxHeight: 180),
              margin: const EdgeInsets.only(top: 4),
              decoration: BoxDecoration(
                border: Border.all(color: borderGray),
                borderRadius: BorderRadius.circular(8),
              ),
              child: ListView(
                shrinkWrap: true,
                children: [
                  ..._suggestions.map(
                    (r) => ListTile(
                      dense: true,
                      leading: const Icon(Icons.place_outlined, size: 20),
                      title: Text(
                        r.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      onTap: () => _selectSuggestion(r),
                    ),
                  ),
                  const Padding(
                    padding: EdgeInsets.all(6),
                    child: Text(
                      '© OpenStreetMap contributors',
                      style: TextStyle(fontSize: 10, color: textGray),
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 4),
          Text(
            activeSet
                ? (activeLabel ?? 'Pin set ✓')
                : 'Search, use my location, or tap the map',
            style: const TextStyle(color: textGray, fontSize: 12),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextFormField(
          controller: _pickupNotesController,
          decoration: const InputDecoration(
            labelText: 'Pickup note (optional)',
            hintText: 'e.g. blue gate, call on arrival',
          ),
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _dropOffNotesController,
          decoration: const InputDecoration(
            labelText: 'Drop-off note (optional)',
            hintText: 'e.g. 2nd house, ask for Alice',
          ),
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _cargoTypeController,
          decoration: const InputDecoration(
            labelText: 'Cargo type',
            hintText: 'e.g. Furniture, produce',
          ),
          validator: (v) =>
              v == null || v.trim().isEmpty ? 'Describe the cargo' : null,
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<JobSize>(
          initialValue: _size,
          decoration: const InputDecoration(labelText: 'Load size'),
          items: JobSize.values
              .map((s) => DropdownMenuItem(value: s, child: Text(s.label)))
              .toList(),
          onChanged: (v) => setState(() {
            _size = v ?? _size;
            _estimate = null;
          }),
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _weightController,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Weight (kg, optional)'),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<VehicleType>(
          initialValue: _vehicleType,
          decoration: const InputDecoration(labelText: 'Required vehicle type'),
          items: VehicleType.values
              .map((t) => DropdownMenuItem(value: t, child: Text(t.label)))
              .toList(),
          onChanged: (v) => setState(() {
            _vehicleType = v ?? _vehicleType;
            _estimate = null;
          }),
        ),
        const SizedBox(height: 20),
        OutlinedButton.icon(
          onPressed: _estimating ? null : _getEstimate,
          icon: _estimating
              ? const SizedBox(
                  height: 18,
                  width: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.calculate_outlined),
          label: const Text('Get estimated cost'),
        ),
        if (_estimate != null) ...[
          const SizedBox(height: 16),
          Container(
            key: _estimateKey,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: searchBg,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Estimated cost: ~${_estimate!.estimatedPrice} RWF',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: primaryGreen,
                  ),
                ),
                Text(
                  _estimate!.durationMin != null
                      ? 'Distance: ${_estimate!.distanceKm.toStringAsFixed(1)} km  ·  ~${_estimate!.durationMin!.round()} min by road'
                      : 'Distance: ${_estimate!.distanceKm.toStringAsFixed(1)} km (straight-line)',
                  style: const TextStyle(color: textGray, fontSize: 12),
                ),
                const SizedBox(height: 6),
                const Text(
                  'This is a reference estimate — you set the price you post.',
                  style: TextStyle(color: textGray, fontSize: 12),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _priceController,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'Price to post (RWF)',
              prefixText: 'RWF ',
            ),
            validator: (v) => v == null || int.tryParse(v.trim()) == null
                ? 'Enter a valid whole-franc price'
                : null,
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: primaryGreen,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            onPressed: _posting ? null : _post,
            child: _posting
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 2,
                    ),
                  )
                : const Text('Post job'),
          ),
        ],
        const SizedBox(height: 24),
      ],
    );
  }
}
