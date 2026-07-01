import 'package:geolocator/geolocator.dart';

/// Thin wrapper over geolocator with permission handling. Used for the driver
/// availability toggle and the owner's nearby-drivers map.
class LocationService {
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
}
