import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';

import 'package:cargo_app/core/enums/app_enums.dart';
import 'package:cargo_app/core/models/proposal.dart';
import 'package:cargo_app/features/driver/screens/driver_job_detail_screen.dart';

Proposal _proposal({int? estimatedPrice}) => Proposal(
      id: 'p1',
      jobId: 'j1',
      driverId: 'd1',
      status: 'sent',
      createdAt: DateTime(2026, 1, 1),
      job: ProposalJob(
        id: 'j1',
        cargoType: 'Furniture',
        pickup: const LatLng(-1.95, 30.06),
        dropOff: const LatLng(-1.96, 30.10),
        price: 8000,
        estimatedPrice: estimatedPrice,
        reqVehicleType: VehicleType.pickup,
        status: 'posted',
      ),
    );

void main() {
  testWidgets(
    'driver job detail shows both the estimate and the posted price',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: DriverJobDetailScreen(proposal: _proposal(estimatedPrice: 7500)),
        ),
      );

      // System estimate (informational) and the owner's posted price, both
      // clearly labelled and distinct.
      expect(find.text('Estimated cost'), findsOneWidget);
      expect(find.text('~7500 RWF'), findsOneWidget);
      expect(find.text("Owner's posted price"), findsOneWidget);
      expect(find.text('8000 RWF'), findsOneWidget);
    },
  );

  testWidgets(
    'estimate row is omitted when the job has no estimated price',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: DriverJobDetailScreen(proposal: _proposal()),
        ),
      );

      expect(find.text('Estimated cost'), findsNothing);
      expect(find.text("Owner's posted price"), findsOneWidget);
      expect(find.text('8000 RWF'), findsOneWidget);
    },
  );
}
