import 'package:flutter/material.dart';
import '../core/errors/error_messages.dart';

import '../core/enums/app_enums.dart';
import '../core/models/vehicle.dart';
import '../core/repositories/vehicle_repository.dart';

enum _CapacityUnit { kg, tonnes }

/// Driver vehicle management (M2), backed by the API (/vehicles). A driver must
/// have at least one vehicle to appear in owners' nearby-driver results.
class VehicleDetailsScreen extends StatefulWidget {
  const VehicleDetailsScreen({super.key});

  @override
  State<VehicleDetailsScreen> createState() => _VehicleDetailsScreenState();
}

class _VehicleDetailsScreenState extends State<VehicleDetailsScreen> {
  final _repo = VehicleRepository();
  final _formKey = GlobalKey<FormState>();
  final _regNoController = TextEditingController();
  final _capacityController = TextEditingController();

  VehicleType _type = VehicleType.pickup;
  _CapacityUnit _capacityUnit = _CapacityUnit.kg;
  List<Vehicle> _vehicles = [];
  String? _editingId;
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _regNoController.dispose();
    _capacityController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final vehicles = await _repo.list();
      if (!mounted) return;
      setState(() {
        _vehicles = vehicles;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = friendlyErrorMessage(e);
        _loading = false;
      });
    }
  }

  void _resetForm() {
    setState(() {
      _editingId = null;
      _type = VehicleType.pickup;
      _capacityUnit = _CapacityUnit.kg;
      _regNoController.clear();
      _capacityController.clear();
    });
  }

  void _startEdit(Vehicle v) {
    final capacityKg = v.capacityKg;
    final useTonnes =
        capacityKg != null && capacityKg >= 1000 && capacityKg % 1000 == 0;
    setState(() {
      _editingId = v.id;
      _type = v.type;
      _capacityUnit = useTonnes ? _CapacityUnit.tonnes : _CapacityUnit.kg;
      _regNoController.text = v.regNo;
      _capacityController.text = capacityKg == null
          ? ''
          : useTonnes
          ? (capacityKg / 1000).toStringAsFixed(0)
          : capacityKg.toStringAsFixed(0);
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final capacity = _capacityKgFromInput();
    final regNo = _regNoController.text.trim();
    try {
      if (_editingId == null) {
        await _repo.create(type: _type, regNo: regNo, capacityKg: capacity);
      } else {
        await _repo.update(
          _editingId!,
          type: _type,
          regNo: regNo,
          capacityKg: capacity,
        );
      }
      _resetForm();
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(friendlyErrorMessage(e)),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _delete(Vehicle v) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete vehicle?'),
        content: Text('${v.type.label} · ${v.regNo}'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await _repo.delete(v.id);
      if (_editingId == v.id) _resetForm();
      await _load();
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

  String _vehicleTypeHint(VehicleType type) {
    switch (type) {
      case VehicleType.moto:
        return 'Motorbike deliveries';
      case VehicleType.pickup:
        return 'Small loads and quick moves';
      case VehicleType.van:
        return 'Covered medium cargo';
      case VehicleType.smallTruck:
        return 'Heavier city loads';
      case VehicleType.largeTruck:
        return 'Bulk or long-haul cargo';
    }
  }

  double? _capacityKgFromInput() {
    final raw = _capacityController.text.trim();
    if (raw.isEmpty) return null;
    final value = double.tryParse(raw);
    if (value == null) return null;
    return _capacityUnit == _CapacityUnit.tonnes ? value * 1000 : value;
  }

  String _formatCapacity(double? capacityKg) {
    if (capacityKg == null) return '';
    if (capacityKg >= 1000 && capacityKg % 1000 == 0) {
      final tonnes = capacityKg / 1000;
      return ' · ${tonnes.toStringAsFixed(0)} ${tonnes == 1 ? 'tonne' : 'tonnes'}';
    }
    return ' · ${capacityKg.toStringAsFixed(0)} kg';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Vehicles')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(
                      _error!,
                      style: const TextStyle(color: Colors.red),
                    ),
                  ),
                if (_vehicles.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                      'No vehicles yet. Add one below so cargo owners can find you.',
                    ),
                  ),
                ..._vehicles.map(
                  (v) => Card(
                    child: ListTile(
                      leading: const Icon(Icons.local_shipping),
                      title: Text(v.type.label),
                      subtitle: Text(
                        '${v.regNo}${_formatCapacity(v.capacityKg)}',
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.edit),
                            onPressed: () => _startEdit(v),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_outline),
                            onPressed: () => _delete(v),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const Divider(height: 32),
                Text(
                  _editingId == null ? 'Add a vehicle' : 'Edit vehicle',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 12),
                Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      DropdownButtonFormField<VehicleType>(
                        initialValue: _type,
                        decoration: const InputDecoration(
                          labelText: 'Vehicle type',
                        ),
                        itemHeight: 64,
                        items: VehicleType.values
                            .map(
                              (t) => DropdownMenuItem(
                                value: t,
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(t.label),
                                    Text(
                                      _vehicleTypeHint(t),
                                      style: TextStyle(
                                        color: Colors.grey[600],
                                        fontSize: 12,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            )
                            .toList(),
                        selectedItemBuilder: (context) => VehicleType.values
                            .map(
                              (t) => Align(
                                alignment: Alignment.centerLeft,
                                child: Text(t.label),
                              ),
                            )
                            .toList(),
                        onChanged: (v) => setState(() => _type = v ?? _type),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _regNoController,
                        decoration: const InputDecoration(
                          labelText: 'Registration / plate number',
                        ),
                        validator: (v) => v == null || v.trim().isEmpty
                            ? 'Enter the registration number'
                            : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _capacityController,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        decoration: const InputDecoration(
                          labelText: 'Capacity',
                          hintText: 'Enter a value',
                        ),
                        validator: (v) {
                          final raw = v?.trim() ?? '';
                          if (raw.isEmpty) return null;
                          final value = double.tryParse(raw);
                          if (value == null || value <= 0) {
                            return 'Enter a valid capacity';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<_CapacityUnit>(
                        initialValue: _capacityUnit,
                        decoration: const InputDecoration(
                          labelText: 'Capacity unit',
                        ),
                        items: const [
                          DropdownMenuItem(
                            value: _CapacityUnit.kg,
                            child: Text('Kilograms (kg)'),
                          ),
                          DropdownMenuItem(
                            value: _CapacityUnit.tonnes,
                            child: Text('Tonnes'),
                          ),
                        ],
                        onChanged: (v) =>
                            setState(() => _capacityUnit = v ?? _capacityUnit),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: ElevatedButton(
                              onPressed: _saving ? null : _submit,
                              child: _saving
                                  ? const SizedBox(
                                      height: 20,
                                      width: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : Text(
                                      _editingId == null
                                          ? 'Add vehicle'
                                          : 'Save changes',
                                    ),
                            ),
                          ),
                          if (_editingId != null) ...[
                            const SizedBox(width: 12),
                            OutlinedButton(
                              onPressed: _saving ? null : _resetForm,
                              child: const Text('Cancel'),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}
