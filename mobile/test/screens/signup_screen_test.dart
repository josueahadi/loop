import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cargo_app/screens/signup_screen.dart';
import 'package:cargo_app/providers/auth_provider.dart';

void main() {
  testWidgets('SignupScreen has input fields and buttons', (
    WidgetTester tester,
  ) async {
    // The form lives in a ListView; give the test a tall viewport so the whole
    // form (including the submit button below the fold) is laid out.
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ChangeNotifierProvider<AuthProvider>(
        create: (_) => AuthProvider(),
        child: const MaterialApp(home: SignupScreen()),
      ),
    );

    // Name, email, phone, password.
    expect(find.byType(TextFormField), findsNWidgets(4));
    // "Create account" submit button.
    expect(
      find.widgetWithText(ElevatedButton, 'Create account'),
      findsOneWidget,
    );
  });
}
