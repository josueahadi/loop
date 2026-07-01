import 'package:latlong2/latlong.dart';

import '../enums/app_enums.dart';

/// A job, matching the API `/jobs` shape (pins as {lat,lng}).
class Job {
  final String id;
  final String ownerId;
  final String? pickupLabel;
  final LatLng pickup;
  final String? dropOffLabel;
  final LatLng dropOff;
  final String cargoType;
  final JobSize size;
  final double? weightKg;
  final int suggestedPrice;
  final int price;
  final VehicleType reqVehicleType;
  final String status;
  final DateTime createdAt;
  final DateTime? postedAt;
  final DateTime? matchedAt;
  final DateTime? acceptedAt;
  final DateTime? inProgressAt;
  final DateTime? completedAt;
  final DateTime? cancelledAt;

  const Job({
    required this.id,
    required this.ownerId,
    this.pickupLabel,
    required this.pickup,
    this.dropOffLabel,
    required this.dropOff,
    required this.cargoType,
    required this.size,
    this.weightKg,
    required this.suggestedPrice,
    required this.price,
    required this.reqVehicleType,
    required this.status,
    required this.createdAt,
    this.postedAt,
    this.matchedAt,
    this.acceptedAt,
    this.inProgressAt,
    this.completedAt,
    this.cancelledAt,
  });

  static LatLng _latLng(Map<String, dynamic> m) =>
      LatLng((m['lat'] as num).toDouble(), (m['lng'] as num).toDouble());
  static DateTime? _date(dynamic v) =>
      v == null ? null : DateTime.parse(v as String);

  factory Job.fromJson(Map<String, dynamic> json) {
    return Job(
      id: json['id'] as String,
      ownerId: json['ownerId'] as String? ?? '',
      pickupLabel: json['pickupLabel'] as String?,
      pickup: _latLng(json['pickup'] as Map<String, dynamic>),
      dropOffLabel: json['dropOffLabel'] as String?,
      dropOff: _latLng(json['dropOff'] as Map<String, dynamic>),
      cargoType: json['cargoType'] as String? ?? '',
      size: JobSizeX.fromApi(json['size'] as String?),
      weightKg: (json['weightKg'] as num?)?.toDouble(),
      suggestedPrice: (json['suggestedPrice'] as num?)?.toInt() ?? 0,
      price: (json['price'] as num?)?.toInt() ?? 0,
      reqVehicleType: VehicleTypeX.fromApi(json['reqVehicleType'] as String?),
      status: json['status'] as String? ?? 'draft',
      createdAt: _date(json['createdAt']) ?? DateTime.now(),
      postedAt: _date(json['postedAt']),
      matchedAt: _date(json['matchedAt']),
      acceptedAt: _date(json['acceptedAt']),
      inProgressAt: _date(json['inProgressAt']),
      completedAt: _date(json['completedAt']),
      cancelledAt: _date(json['cancelledAt']),
    );
  }
}
