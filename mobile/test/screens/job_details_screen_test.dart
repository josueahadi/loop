import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cargo_app/screens/job_details_screen.dart';
import 'package:cargo_app/core/enums/app_enums.dart';
import 'package:cargo_app/core/models/booking_model.dart';
import 'package:cargo_app/core/repositories/user_repository.dart';
import 'package:cargo_app/providers/auth_provider.dart';

void main() {
  testWidgets('JobDetailsScreen renders with booking info', (
    WidgetTester tester,
  ) async {
    final booking = BookingModel(
      id: '1',
      cargoOwnerId: 'owner1',
      pickupLocation: 'A',
      dropoffLocation: 'B',
      cargoDescription: 'Boxes',
      vehicleType: VehicleType.pickup,
      status: BookingStatus.pending,
      createdAt: DateTime(2024, 1, 1),
    );

    // The screen reads AuthProvider (and, when the booking has a driver,
    // UserRepository). This booking has no driverId, so a logged-out AuthProvider
    // and a default repository are enough to render it.
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<AuthProvider>(create: (_) => AuthProvider()),
          Provider<UserRepository>(create: (_) => ApiUserRepository()),
        ],
        child: MaterialApp(home: JobDetailsScreen(booking: booking)),
      ),
    );

    expect(find.byType(Scaffold), findsOneWidget);
    expect(find.text('A'), findsOneWidget);
    expect(find.text('B'), findsOneWidget);
  });
}
