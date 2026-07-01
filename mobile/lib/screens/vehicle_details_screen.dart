import 'package:flutter/material.dart';

import '../core/enums/app_enums.dart';
import '../core/models/vehicle.dart';
import '../core/repositories/vehicle_repository.dart';

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
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  void _resetForm() {
    setState(() {
      _editingId = null;
      _type = VehicleType.pickup;
      _regNoController.clear();
      _capacityController.clear();
    });
  }

  void _startEdit(Vehicle v) {
    setState(() {
      _editingId = v.id;
      _type = v.type;
      _regNoController.text = v.regNo;
      _capacityController.text = v.capacityKg?.toStringAsFixed(0) ?? '';
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final capacity = double.tryParse(_capacityController.text.trim());
    final regNo = _regNoController.text.trim();
    try {
      if (_editingId == null) {
        await _repo.create(type: _type, regNo: regNo, capacityKg: capacity);
      } else {
        await _repo.update(_editingId!,
            type: _type, regNo: regNo, capacityKg: capacity);
      }
      _resetForm();
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          backgroundColor: Colors.red,
        ));
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
              child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Delete')),
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
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          backgroundColor: Colors.red,
        ));
      }
    }
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
                    child: Text(_error!,
                        style: const TextStyle(color: Colors.red)),
                  ),
                if (_vehicles.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                        'No vehicles yet. Add one below so cargo owners can find you.'),
                  ),
                ..._vehicles.map((v) => Card(
                      child: ListTile(
                        leading: const Icon(Icons.local_shipping),
                        title: Text(v.type.label),
                        subtitle: Text(
                          '${v.regNo}${v.capacityKg != null ? ' · ${v.capacityKg!.toStringAsFixed(0)} kg' : ''}',
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                                icon: const Icon(Icons.edit),
                                onPressed: () => _startEdit(v)),
                            IconButton(
                                icon: const Icon(Icons.delete_outline),
                                onPressed: () => _delete(v)),
                          ],
                        ),
                      ),
                    )),
                const Divider(height: 32),
                Text(_editingId == null ? 'Add a vehicle' : 'Edit vehicle',
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 12),
                Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      DropdownButtonFormField<VehicleType>(
                        initialValue: _type,
                        decoration:
                            const InputDecoration(labelText: 'Vehicle type'),
                        items: VehicleType.values
                            .map((t) => DropdownMenuItem(
                                value: t, child: Text(t.label)))
                            .toList(),
                        onChanged: (v) => setState(() => _type = v ?? _type),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _regNoController,
                        decoration: const InputDecoration(
                            labelText: 'Registration / plate number'),
                        validator: (v) => v == null || v.trim().isEmpty
                            ? 'Enter the registration number'
                            : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _capacityController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                            labelText: 'Capacity (kg, optional)'),
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
                                          strokeWidth: 2))
                                  : Text(_editingId == null
                                      ? 'Add vehicle'
                                      : 'Save changes'),
                            ),
                          ),
                          if (_editingId != null) ...[
                            const SizedBox(width: 12),
                            OutlinedButton(
                                onPressed: _saving ? null : _resetForm,
                                child: const Text('Cancel')),
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
