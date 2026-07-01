import '../enums/app_enums.dart';

/// A driver-owned vehicle, matching the API `/vehicles` shape.
class Vehicle {
  final String id;
  final String driverId;
  final VehicleType type;
  final double? capacityKg;
  final String regNo;
  final String? photoUrl;

  const Vehicle({
    required this.id,
    required this.driverId,
    required this.type,
    this.capacityKg,
    required this.regNo,
    this.photoUrl,
  });

  factory Vehicle.fromJson(Map<String, dynamic> json) {
    return Vehicle(
      id: json['id'] as String,
      driverId: json['driverId'] as String? ?? '',
      type: VehicleTypeX.fromApi(json['type'] as String?),
      capacityKg: (json['capacityKg'] as num?)?.toDouble(),
      regNo: json['regNo'] as String? ?? '',
      photoUrl: json['photoUrl'] as String?,
    );
  }

  Map<String, dynamic> toCreateJson() => {
        'type': type.api,
        if (capacityKg != null) 'capacityKg': capacityKg,
        'regNo': regNo,
        if (photoUrl != null) 'photoUrl': photoUrl,
      };
}
