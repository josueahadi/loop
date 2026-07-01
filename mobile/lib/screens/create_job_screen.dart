import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../constants.dart';
import '../core/enums/app_enums.dart';
import '../core/location/location_service.dart';
import '../core/repositories/job_repository.dart';
import '../core/repositories/pricing_repository.dart';

/// Owner create-job flow (M3): set pickup + drop-off pins on the map (current
/// location or drop-a-pin — no address search), enter the load profile, get a
/// estimated cost from the API, edit the price if desired, then post. The straight
/// line between the pins is the same great-circle the pricing uses.
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
  final _mapController = MapController();
  final _formKey = GlobalKey<FormState>();

  final _cargoTypeController = TextEditingController();
  final _weightController = TextEditingController();
  final _priceController = TextEditingController();

  LatLng? _pickup;
  LatLng? _dropOff;
  bool _settingPickup = true;
  JobSize _size = JobSize.medium;
  VehicleType _vehicleType = VehicleType.pickup;

  PriceEstimate? _estimate;
  bool _estimating = false;
  bool _posting = false;

  @override
  void initState() {
    super.initState();
    _centerOnCurrentLocation();
  }

  @override
  void dispose() {
    _cargoTypeController.dispose();
    _weightController.dispose();
    _priceController.dispose();
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

  void _onMapTap(LatLng point) {
    setState(() {
      if (_settingPickup) {
        _pickup = point;
      } else {
        _dropOff = point;
      }
      _estimate = null; // pins changed → estimate stale
    });
  }

  // Sets the currently-selected pin (pickup or drop-off) to the device location.
  Future<void> _useMyLocationForActivePin() async {
    try {
      final pos = await _location.getCurrentPosition();
      final here = LatLng(pos.latitude, pos.longitude);
      if (!mounted) return;
      setState(() {
        if (_settingPickup) {
          _pickup = here;
        } else {
          _dropOff = here;
        }
        _estimate = null;
      });
      _mapController.move(here, 14);
    } catch (e) {
      _snack(e.toString().replaceFirst('Exception: ', ''));
    }
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
      if (!mounted) return;
      setState(() {
        _estimate = est;
        _priceController.text = est.estimatedPrice.toString();
      });
    } catch (e) {
      _snack(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _estimating = false);
    }
  }

  Future<void> _post() async {
    if (!_formKey.currentState!.validate()) return;
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
        dropOff: _dropOff!,
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
      _snack(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _posting = false);
    }
  }

  void _snack(String msg, {bool ok = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: ok ? primaryGreen : Colors.red,
    ));
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
              padding: const EdgeInsets.all(16),
              child: Form(key: _formKey, child: _buildForm()),
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
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'rw.loop.app',
            ),
            if (_pickup != null && _dropOff != null)
              PolylineLayer(polylines: [
                Polyline(
                  points: [_pickup!, _dropOff!],
                  strokeWidth: 3,
                  color: primaryGreen,
                ),
              ]),
            MarkerLayer(markers: [
              if (_pickup != null)
                Marker(
                  point: _pickup!,
                  width: 40,
                  height: 40,
                  child: const Icon(Icons.trip_origin,
                      color: primaryGreen, size: 32),
                ),
              if (_dropOff != null)
                Marker(
                  point: _dropOff!,
                  width: 40,
                  height: 40,
                  child:
                      const Icon(Icons.place, color: Colors.red, size: 36),
                ),
            ]),
          ],
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
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: true, label: Text('Pickup')),
                ButtonSegment(value: false, label: Text('Drop-off')),
              ],
              selected: {_settingPickup},
              onSelectionChanged: (s) =>
                  setState(() => _settingPickup = s.first),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            _settingPickup
                ? (_pickup == null ? 'Tap map to set' : 'Set ✓')
                : (_dropOff == null ? 'Tap map to set' : 'Set ✓'),
            style: const TextStyle(color: textGray, fontSize: 12),
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
          controller: _cargoTypeController,
          decoration: const InputDecoration(
              labelText: 'Cargo type', hintText: 'e.g. Furniture, produce'),
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
                  height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.calculate_outlined),
          label: const Text('Get estimated cost'),
        ),
        if (_estimate != null) ...[
          const SizedBox(height: 16),
          Container(
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
                      color: primaryGreen),
                ),
                Text('Distance: ${_estimate!.distanceKm.toStringAsFixed(1)} km',
                    style: const TextStyle(color: textGray, fontSize: 12)),
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
                labelText: 'Price to post (RWF)', prefixText: 'RWF '),
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
                    height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : const Text('Post job'),
          ),
        ],
        const SizedBox(height: 24),
      ],
    );
  }
}
