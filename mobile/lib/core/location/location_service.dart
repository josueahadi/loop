import 'package:geolocator/geolocator.dart';

/// Thin wrapper over geolocator with permission handling. Used for the driver
/// availability toggle and the owner's nearby-drivers map.
class LocationService {
  /// Returns whether the app already has OS location permission. This is a
  /// non-mutating check: it never triggers the platform permission prompt.
  Future<bool> hasLocationPermission() async {
    final permission = await Geolocator.checkPermission();
    return permission == LocationPermission.whileInUse ||
        permission == LocationPermission.always;
  }

  /// Ensures location services + permission are granted, then returns the
  /// current position. Throws a readable message if unavailable/denied.
  Future<Position> getCurrentPosition() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw Exception('Location services are disabled. Enable them to continue.');
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied) {
      throw Exception('Location permission denied.');
    }
    if (permission == LocationPermission.deniedForever) {
      throw Exception(
        'Location permission permanently denied. Enable it in Settings.',
      );
    }

    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
    );
  }

  /// Ensures permission, then streams position updates. Emits only after the
  /// device moves [distanceFilterMeters] so the map's own dot follows the user
  /// without a flood of updates. Throws (same messages as above) if unavailable.
  Future<Stream<Position>> positionStream({
    int distanceFilterMeters = 25,
  }) async {
    // Reuse the permission/service checks; discard the returned fix.
    await getCurrentPosition();
    return Geolocator.getPositionStream(
      locationSettings: LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: distanceFilterMeters,
      ),
    );
  }
}
