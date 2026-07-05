import '../api/api_client.dart';
import '../enums/app_enums.dart';
import '../models/nearby_driver.dart';

/// Owner-side geo-matching against the API (GET /drivers/nearby).
class MatchingRepository {
  final ApiClient _api;

  MatchingRepository({ApiClient? api}) : _api = api ?? ApiClient();

  Future<List<NearbyDriver>> nearby({
    required double lat,
    required double lng,
    VehicleType? vehicleType,
    double? radiusKm,
  }) async {
    final res = await _api.dio.get(
      '/drivers/nearby',
      queryParameters: {
        'lat': lat,
        'lng': lng,
        if (vehicleType != null) 'vehicle_type': vehicleType.api,
        if (radiusKm != null) 'radius': radiusKm,
      },
    );
    return (res.data as List)
        .map((d) => NearbyDriver.fromJson(d as Map<String, dynamic>))
        .toList();
  }
}
