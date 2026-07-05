import '../api/api_client.dart';
import '../enums/app_enums.dart';
import '../models/vehicle.dart';

/// Driver vehicle management against the API (/vehicles).
class VehicleRepository {
  final ApiClient _api;

  VehicleRepository({ApiClient? api}) : _api = api ?? ApiClient();

  Future<List<Vehicle>> list() async {
    final res = await _api.dio.get('/vehicles');
    return (res.data as List)
        .map((v) => Vehicle.fromJson(v as Map<String, dynamic>))
        .toList();
  }

  Future<Vehicle> create({
    required VehicleType type,
    required String regNo,
    double? capacityKg,
    String? photoUrl,
  }) async {
    final res = await _api.dio.post(
      '/vehicles',
      data: {
        'type': type.api,
        'regNo': regNo,
        if (capacityKg != null) 'capacityKg': capacityKg,
        if (photoUrl != null) 'photoUrl': photoUrl,
      },
    );
    return Vehicle.fromJson(res.data as Map<String, dynamic>);
  }

  Future<Vehicle> update(
    String id, {
    VehicleType? type,
    String? regNo,
    double? capacityKg,
    String? photoUrl,
  }) async {
    final res = await _api.dio.patch(
      '/vehicles/$id',
      data: {
        if (type != null) 'type': type.api,
        if (regNo != null) 'regNo': regNo,
        if (capacityKg != null) 'capacityKg': capacityKg,
        if (photoUrl != null) 'photoUrl': photoUrl,
      },
    );
    return Vehicle.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> delete(String id) async {
    await _api.dio.delete('/vehicles/$id');
  }
}
