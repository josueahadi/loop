import 'package:latlong2/latlong.dart';

import '../api/api_client.dart';

class GeoResult {
  final String label;
  final LatLng point;
  const GeoResult({required this.label, required this.point});
}

/// Place search + reverse geocoding via the API's OSM proxy. Results are
/// OSM-licensed — show "© OpenStreetMap contributors" where they appear.
class GeocodeRepository {
  final ApiClient _api;

  GeocodeRepository({ApiClient? api}) : _api = api ?? ApiClient();

  Future<List<GeoResult>> search(String query, {int limit = 5}) async {
    if (query.trim().length < 2) return [];
    final res = await _api.dio.get('/geocode/search', queryParameters: {
      'q': query,
      'limit': limit,
    });
    return (res.data as List)
        .map((r) => GeoResult(
              label: r['label'] as String,
              point: LatLng((r['lat'] as num).toDouble(), (r['lng'] as num).toDouble()),
            ))
        .toList();
  }

  Future<String?> reverse(LatLng point) async {
    final res = await _api.dio.get('/geocode/reverse', queryParameters: {
      'lat': point.latitude,
      'lng': point.longitude,
    });
    return res.data['label'] as String?;
  }
}
