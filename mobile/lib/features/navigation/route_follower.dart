import 'dart:math' as math;

import 'package:latlong2/latlong.dart';

import '../../core/repositories/routing_repository.dart';

/// Result of matching a live position against the route.
class FollowState {
  /// Index of the current maneuver in [RouteResult.instructions].
  final int stepIndex;

  /// Metres from the current position to the current maneuver point.
  final double distanceToManeuverM;

  /// Metres remaining to the destination along the route.
  final double remainingDistanceM;

  /// Seconds remaining, scaled from the route's total duration by progress.
  final double? remainingDurationS;

  /// Perpendicular distance from the position to the route line, in metres.
  final double offRouteM;

  const FollowState({
    required this.stepIndex,
    required this.distanceToManeuverM,
    required this.remainingDistanceM,
    required this.remainingDurationS,
    required this.offRouteM,
  });
}

/// On-device route matching: snaps a live GPS position to the fetched polyline,
/// advances the current step, and measures how far off-route the driver is.
/// Pure geometry (no I/O) so it can be unit-tested and run per-GPS-tick without a
/// server round-trip — the reroute decision lives in the screen, which calls the
/// routing API when this reports a sustained off-route.
class RouteFollower {
  RouteFollower(this._route) {
    _cumFromEnd = _buildCumulativeFromEnd(_route.polyline);
  }

  final RouteResult _route;
  final _distance = const Distance();

  // Cumulative along-route distance from each polyline vertex to the destination
  // (metres), so remaining distance is a lookup + a partial segment.
  late final List<double> _cumFromEnd;

  int _stepIndex = 0;
  int get stepIndex => _stepIndex;

  // When within this distance of the current maneuver point, advance the step.
  static const double _advanceRadiusM = 20;

  List<RouteInstruction> get instructions => _route.instructions;
  bool get isFinished => _stepIndex >= _route.instructions.length - 1;

  RouteInstruction? get currentInstruction =>
      _stepIndex < _route.instructions.length
      ? _route.instructions[_stepIndex]
      : null;

  RouteInstruction? get nextInstruction =>
      _stepIndex + 1 < _route.instructions.length
      ? _route.instructions[_stepIndex + 1]
      : null;

  /// Update against a new position; returns the derived state.
  FollowState update(LatLng pos) {
    // In OSRM, each step's maneuver point is where that step BEGINS. So the step
    // we're "on" is the one whose maneuver is next; we advance when we reach the
    // NEXT step's maneuver point. This also stops the depart step (whose point is
    // the origin) from being skipped on the very first fix. Only moves forward,
    // and never past the final (arrival) step.
    final upcoming = nextInstruction?.point;
    if (upcoming != null && !isFinished) {
      final toUpcoming = _distance.as(LengthUnit.Meter, pos, upcoming);
      if (toUpcoming <= _advanceRadiusM) {
        _stepIndex++;
      }
    }

    final snap = _snapToRoute(pos);
    final toManeuverNow = currentInstruction != null
        ? _distance.as(LengthUnit.Meter, pos, currentInstruction!.point)
        : 0.0;

    final remaining = _remainingDistanceM(snap);
    final total = _route.distanceKm * 1000;
    final totalDurS = (_route.durationMin ?? 0) * 60;
    final remDurS = totalDurS > 0 && total > 0
        ? totalDurS * (remaining / total)
        : null;

    return FollowState(
      stepIndex: _stepIndex,
      distanceToManeuverM: toManeuverNow,
      remainingDistanceM: remaining,
      remainingDurationS: remDurS,
      offRouteM: snap.perpendicularM,
    );
  }

  // --- geometry ---

  List<double> _buildCumulativeFromEnd(List<LatLng> pts) {
    final n = pts.length;
    final cum = List<double>.filled(n, 0);
    for (var i = n - 2; i >= 0; i--) {
      cum[i] =
          cum[i + 1] + _distance.as(LengthUnit.Meter, pts[i], pts[i + 1]);
    }
    return cum;
  }

  _Snap _snapToRoute(LatLng pos) {
    final pts = _route.polyline;
    if (pts.length < 2) {
      return const _Snap(segmentIndex: 0, t: 0, perpendicularM: 0);
    }
    var best = double.infinity;
    var bestSeg = 0;
    var bestT = 0.0;
    for (var i = 0; i < pts.length - 1; i++) {
      final proj = _projectToSegment(pos, pts[i], pts[i + 1]);
      if (proj.distanceM < best) {
        best = proj.distanceM;
        bestSeg = i;
        bestT = proj.t;
      }
    }
    return _Snap(segmentIndex: bestSeg, t: bestT, perpendicularM: best);
  }

  double _remainingDistanceM(_Snap snap) {
    final pts = _route.polyline;
    if (pts.length < 2) return 0;
    // Distance from the snapped point to the far end of its segment...
    final segEnd = pts[snap.segmentIndex + 1];
    final snapped = _lerp(pts[snap.segmentIndex], segEnd, snap.t);
    final toSegEnd = _distance.as(LengthUnit.Meter, snapped, segEnd);
    // ...plus the cumulative distance from that vertex to the destination.
    return toSegEnd + _cumFromEnd[snap.segmentIndex + 1];
  }

  // Project p onto segment a→b using an equirectangular approximation around a
  // (fine at street scale). Returns the clamped parameter t∈[0,1] and the
  // perpendicular distance in metres.
  _Projection _projectToSegment(LatLng p, LatLng a, LatLng b) {
    const mPerDegLat = 111320.0;
    final mPerDegLng = 111320.0 * _cosDeg(a.latitude);

    final ax = 0.0, ay = 0.0;
    final bx = (b.longitude - a.longitude) * mPerDegLng;
    final by = (b.latitude - a.latitude) * mPerDegLat;
    final px = (p.longitude - a.longitude) * mPerDegLng;
    final py = (p.latitude - a.latitude) * mPerDegLat;

    final dx = bx - ax, dy = by - ay;
    final segLenSq = dx * dx + dy * dy;
    var t = segLenSq == 0 ? 0.0 : ((px - ax) * dx + (py - ay) * dy) / segLenSq;
    t = t.clamp(0.0, 1.0);

    final projX = ax + t * dx, projY = ay + t * dy;
    final ddx = px - projX, ddy = py - projY;
    return _Projection(t: t, distanceM: _hypot(ddx, ddy));
  }

  LatLng _lerp(LatLng a, LatLng b, double t) => LatLng(
    a.latitude + (b.latitude - a.latitude) * t,
    a.longitude + (b.longitude - a.longitude) * t,
  );

  double _cosDeg(double deg) => math.cos(deg * math.pi / 180.0);

  double _hypot(double a, double b) => math.sqrt(a * a + b * b);
}

class _Snap {
  final int segmentIndex;
  final double t;
  final double perpendicularM;
  const _Snap({
    required this.segmentIndex,
    required this.t,
    required this.perpendicularM,
  });
}

class _Projection {
  final double t;
  final double distanceM;
  const _Projection({required this.t, required this.distanceM});
}
