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

  test('advances by along-route progress even when GPS jumps past a maneuver', () {
    // Coarse fixes: jump straight from the start to near the end, never within
    // 20 m of the midpoint maneuver. Progress-based advancement must still move
    // the step forward (proximity-only advancement would get stuck on step 0).
    final f = RouteFollower(_straightRoute());
    final s = f.update(const LatLng(-1.95, 30.019)); // ~90% along, one big jump
    expect(s.stepIndex, greaterThanOrEqualTo(1));
  });

  test('split() divides the route into traveled + remaining at the position', () {
    final f = RouteFollower(_straightRoute());
    // ~halfway along the straight route.
    final s = f.split(const LatLng(-1.95, 30.01));
    // Both parts are non-empty and share the projected point at the seam.
    expect(s.traveled, isNotEmpty);
    expect(s.remaining, isNotEmpty);
    expect(s.traveled.last.longitude, closeTo(s.remaining.first.longitude, 1e-9));
    expect(s.traveled.last.latitude, closeTo(s.remaining.first.latitude, 1e-9));
    // Traveled ends near the midpoint; remaining ends at the destination.
    expect(s.traveled.last.longitude, closeTo(30.01, 1e-3));
    expect(s.remaining.last.longitude, closeTo(30.02, 1e-9));
  });

  test('split() near the start leaves almost the whole route remaining', () {
    final f = RouteFollower(_straightRoute());
    final s = f.split(const LatLng(-1.95, 30.0));
    final d = const Distance();
    final travelledM = s.traveled.length < 2
        ? 0.0
        : d.as(LengthUnit.Meter, s.traveled.first, s.traveled.last);
    expect(travelledM, lessThan(50));
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
