import 'package:latlong2/latlong.dart';

import '../api/api_client.dart';
import '../enums/app_enums.dart';
import '../models/job.dart';

/// Owner-side jobs against the API (/jobs).
class JobRepository {
  final ApiClient _api;

  JobRepository({ApiClient? api}) : _api = api ?? ApiClient();

  Future<Job> create({
    required LatLng pickup,
    String? pickupLabel,
    required LatLng dropOff,
    String? dropOffLabel,
    required String cargoType,
    required JobSize size,
    double? weightKg,
    required VehicleType reqVehicleType,
    required int estimatedPrice,
    required int price,
  }) async {
    final res = await _api.dio.post('/jobs', data: {
      'pickup': {'lat': pickup.latitude, 'lng': pickup.longitude},
      if (pickupLabel != null) 'pickupLabel': pickupLabel,
      'dropOff': {'lat': dropOff.latitude, 'lng': dropOff.longitude},
      if (dropOffLabel != null) 'dropOffLabel': dropOffLabel,
      'cargoType': cargoType,
      'size': size.api,
      if (weightKg != null) 'weightKg': weightKg,
      'reqVehicleType': reqVehicleType.api,
      'estimatedPrice': estimatedPrice,
      'price': price,
    });
    return Job.fromJson(res.data as Map<String, dynamic>);
  }

  Future<List<Job>> listOwn() async {
    final res = await _api.dio.get('/jobs');
    return (res.data as List)
        .map((j) => Job.fromJson(j as Map<String, dynamic>))
        .toList();
  }

  Future<Job> getById(String id) async {
    final res = await _api.dio.get('/jobs/$id');
    return Job.fromJson(res.data as Map<String, dynamic>);
  }

  Future<Job> updateStatus(String id, String status) async {
    final res = await _api.dio.patch('/jobs/$id', data: {'status': status});
    return Job.fromJson(res.data as Map<String, dynamic>);
  }
}
