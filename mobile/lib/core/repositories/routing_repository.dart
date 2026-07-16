import 'package:flutter_polyline_points/flutter_polyline_points.dart';
import 'package:latlong2/latlong.dart';

import '../api/api_client.dart';

/// One turn instruction, already phrased server-side (so every client reads the
/// same). [point] is where the maneuver happens.
class RouteInstruction {
  final String text;
  final String maneuverType;
  final String? modifier;
  final String? street;
  final double distanceM;
  final double durationS;
  final LatLng point;

  const RouteInstruction({
    required this.text,
    required this.maneuverType,
    required this.modifier,
    required this.street,
    required this.distanceM,
    required this.durationS,
    required this.point,
  });

  factory RouteInstruction.fromJson(Map<String, dynamic> j) => RouteInstruction(
    text: j['text'] as String,
    maneuverType: j['maneuver_type'] as String,
    modifier: j['modifier'] as String?,
    street: j['street'] as String?,
    distanceM: (j['distance_m'] as num).toDouble(),
    durationS: (j['duration_s'] as num).toDouble(),
    point: LatLng(
      (j['lat'] as num).toDouble(),
      (j['lng'] as num).toDouble(),
    ),
  );
}

/// A road route from the API's OSRM proxy. On the great-circle fallback,
/// [durationMin] and [polyline] are null and [distanceSource] is 'great_circle';
/// callers fall back to a straight line and hide the ETA.
class RouteResult {
  final double distanceKm;
  final double? durationMin;
  final List<LatLng> polyline;
  final String distanceSource;
  final List<RouteInstruction> instructions;

  const RouteResult({
    required this.distanceKm,
    required this.durationMin,
    required this.polyline,
    required this.distanceSource,
    required this.instructions,
  });

  bool get isRoad => distanceSource == 'osrm';

  factory RouteResult.fromJson(Map<String, dynamic> j) {
    final encoded = j['polyline'] as String?;
    final points = encoded == null
        ? <LatLng>[]
        : PolylinePoints.decodePolyline(encoded)
              .map((p) => LatLng(p.latitude, p.longitude))
              .toList();
    final instr = (j['instructions'] as List?) ?? const [];
    return RouteResult(
      distanceKm: (j['distance_km'] as num).toDouble(),
      durationMin: (j['duration_min'] as num?)?.toDouble(),
      polyline: points,
      distanceSource: j['distance_source'] as String,
      instructions: instr
          .map((i) => RouteInstruction.fromJson(i as Map<String, dynamic>))
          .toList(),
    );
  }
}

/// Road routing via the API's OSRM proxy. Results are OSM-derived — show
/// "© OpenStreetMap contributors" where a route is displayed.
class RoutingRepository {
  final ApiClient _api;

  RoutingRepository({ApiClient? api}) : _api = api ?? ApiClient();

  Future<RouteResult> route(
    LatLng from,
    LatLng to, {
    bool steps = false,
  }) async {
    final res = await _api.dio.get(
      '/routing/route',
      queryParameters: {
        'from_lat': from.latitude,
        'from_lng': from.longitude,
        'to_lat': to.latitude,
        'to_lng': to.longitude,
        'steps': steps,
      },
    );
    return RouteResult.fromJson(res.data as Map<String, dynamic>);
  }
}
