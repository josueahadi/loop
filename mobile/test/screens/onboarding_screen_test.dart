import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:cargo_app/screens/onboardingScreen.dart';

void main() {
  testWidgets('Onboarding screen shows text and button', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: Onboarding()));
    // "Onboarding" appears in both the app-bar title and the body.
    expect(find.text('Onboarding'), findsWidgets);
    expect(find.byType(ElevatedButton), findsOneWidget);
  });
}
