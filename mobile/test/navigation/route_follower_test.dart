import 'package:cargo_app/core/repositories/routing_repository.dart';
import 'package:cargo_app/features/navigation/route_follower.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';

// A short straight route heading east along a constant latitude, so distances are
// easy to reason about. Three maneuver points: start, midpoint, end (arrive).
RouteResult _straightRoute() {
  const lat = -1.95;
  final pts = [
    const LatLng(lat, 30.00),
    const LatLng(lat, 30.01),
    const LatLng(lat, 30.02),
  ];
  final d = const Distance();
  final total = d.as(LengthUnit.Kilometer, pts.first, pts.last);
  return RouteResult(
    distanceKm: total,
    durationMin: 6,
    polyline: pts,
    distanceSource: 'osrm',
    instructions: [
      RouteInstruction(
        text: 'Head east',
        maneuverType: 'depart',
        modifier: null,
        street: 'Test Rd',
        distanceM: 1000,
        durationS: 180,
        point: pts[0],
      ),
      RouteInstruction(
        text: 'Continue',
        maneuverType: 'continue',
        modifier: null,
        street: 'Test Rd',
        distanceM: 1000,
        durationS: 180,
        point: pts[1],
      ),
      RouteInstruction(
        text: 'You have arrived',
        maneuverType: 'arrive',
        modifier: null,
        street: null,
        distanceM: 0,
        durationS: 0,
        point: pts[2],
      ),
    ],
  );
}

void main() {
  const d = Distance();

  test('starts on step 0 and reports near-total remaining distance', () {
    final f = RouteFollower(_straightRoute());
    final s = f.update(const LatLng(-1.95, 30.00));
    expect(s.stepIndex, 0);
    // ~2.2 km for 0.02° of longitude at this latitude.
    expect(s.remainingDistanceM, greaterThan(2000));
    expect(s.offRouteM, lessThan(1));
  });

  test('advances the step when within 20 m of the maneuver point', () {
    final f = RouteFollower(_straightRoute());
    // A point ~10 m west of the midpoint maneuver (still on the line).
    final nearMid = d.offset(const LatLng(-1.95, 30.01), 10, 270);
    final s = f.update(nearMid);
    expect(s.stepIndex, 1);
  });

  test('remaining distance decreases as we move along the route', () {
    final f = RouteFollower(_straightRoute());
    final start = f.update(const LatLng(-1.95, 30.00)).remainingDistanceM;
    final mid = f.update(const LatLng(-1.95, 30.01)).remainingDistanceM;
    expect(mid, lessThan(start));
    // Roughly half remains at the midpoint (±150 m tolerance).
    expect((mid - start / 2).abs(), lessThan(150));
  });

  test('detects off-route by perpendicular distance', () {
    final f = RouteFollower(_straightRoute());
    // 60 m north of the line → should read ~60 m off-route.
    final off = d.offset(const LatLng(-1.95, 30.005), 60, 0);
    final s = f.update(off);
    expect(s.offRouteM, greaterThan(40));
  });

  test('does not advance past the final arrival step', () {
    final f = RouteFollower(_straightRoute());
    // Drive to the end and beyond.
    f.update(const LatLng(-1.95, 30.01));
    f.update(const LatLng(-1.95, 30.02));
    final s = f.update(const LatLng(-1.95, 30.03));
    expect(s.stepIndex, lessThanOrEqualTo(2));
    expect(f.isFinished, isTrue);
  });
}
