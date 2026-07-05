import 'vehicle.dart';

/// A nearby available driver returned by GET /drivers/nearby.
class NearbyDriver {
  final String id;
  final String name;
  final double averageRating;
  final int ratingCount;
  final double lat;
  final double lng;
  final int distanceM;
  final List<Vehicle> vehicles;

  const NearbyDriver({
    required this.id,
    required this.name,
    required this.averageRating,
    required this.ratingCount,
    required this.lat,
    required this.lng,
    required this.distanceM,
    required this.vehicles,
  });

  factory NearbyDriver.fromJson(Map<String, dynamic> json) {
    return NearbyDriver(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      averageRating: (json['averageRating'] as num?)?.toDouble() ?? 0,
      ratingCount: (json['ratingCount'] as num?)?.toInt() ?? 0,
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
      distanceM: (json['distanceM'] as num?)?.toInt() ?? 0,
      vehicles: ((json['vehicles'] as List?) ?? [])
          .map((v) => Vehicle.fromJson(v as Map<String, dynamic>))
          .toList(),
    );
  }

  String get distanceLabel => distanceM < 1000
      ? '$distanceM m'
      : '${(distanceM / 1000).toStringAsFixed(1)} km';
}
