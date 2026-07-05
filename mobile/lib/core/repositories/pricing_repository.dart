import 'package:latlong2/latlong.dart';

import '../api/api_client.dart';
import '../enums/app_enums.dart';

class PriceEstimate {
  final int estimatedPrice;
  final double distanceKm;
  const PriceEstimate({required this.estimatedPrice, required this.distanceKm});
}

/// Pricing estimate against the API (POST /pricing/estimate).
class PricingRepository {
  final ApiClient _api;

  PricingRepository({ApiClient? api}) : _api = api ?? ApiClient();

  Future<PriceEstimate> estimate({
    required LatLng pickup,
    required LatLng dropOff,
    required VehicleType vehicleType,
    required JobSize size,
    double? weightKg,
  }) async {
    final res = await _api.dio.post(
      '/pricing/estimate',
      data: {
        'pickup': {'lat': pickup.latitude, 'lng': pickup.longitude},
        'drop_off': {'lat': dropOff.latitude, 'lng': dropOff.longitude},
        'vehicle_type': vehicleType.api,
        'size': size.api,
        if (weightKg != null) 'weight_kg': weightKg,
      },
    );
    return PriceEstimate(
      estimatedPrice: (res.data['estimated_price'] as num).toInt(),
      distanceKm: (res.data['distance_km'] as num).toDouble(),
    );
  }
}
