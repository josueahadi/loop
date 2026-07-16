import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../constants.dart';

/// Consistent custom markers for every map surface, so the "you" dot, vehicle
/// pins, and pickup/drop-off pins look and read the same on Nearby, create-job,
/// and navigation. Swap a style here and it changes everywhere.
class MapMarkers {
  /// Current-position dot: a blue disc with a white ring, and an optional heading
  /// arrow rotated to [headingDeg] (degrees clockwise from north). Pass null for
  /// no heading (a plain dot).
  static Marker youDot(LatLng point, {double? headingDeg}) => Marker(
    point: point,
    width: 44,
    height: 44,
    child: _YouDot(headingDeg: headingDeg),
  );

  static Marker vehiclePin(LatLng point, {VoidCallback? onTap}) => Marker(
    point: point,
    width: 44,
    height: 44,
    child: GestureDetector(
      onTap: onTap,
      child: const Icon(Icons.local_shipping, color: primaryGreen, size: 36),
    ),
  );

  static Marker pickupPin(LatLng point) => Marker(
    point: point,
    width: 40,
    height: 40,
    child: const Icon(Icons.flag, color: primaryGreen, size: 34),
  );

  static Marker dropOffPin(LatLng point) => Marker(
    point: point,
    width: 40,
    height: 40,
    child: const Icon(Icons.flag, color: Colors.red, size: 34),
  );
}

class _YouDot extends StatelessWidget {
  final double? headingDeg;
  const _YouDot({this.headingDeg});

  @override
  Widget build(BuildContext context) {
    final dot = Container(
      width: 18,
      height: 18,
      decoration: BoxDecoration(
        color: Colors.blue,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 3),
        boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 4)],
      ),
    );
    if (headingDeg == null) return Center(child: dot);
    return Stack(
      alignment: Alignment.center,
      children: [
        Transform.rotate(
          angle: headingDeg! * math.pi / 180,
          child: const Icon(Icons.navigation, color: Colors.blue, size: 40),
        ),
        dot,
      ],
    );
  }
}
