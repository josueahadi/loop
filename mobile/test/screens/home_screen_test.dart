import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cargo_app/screens/home.dart';
import 'package:cargo_app/core/repositories/user_repository.dart';
import 'package:cargo_app/features/profile/providers/profile_provider.dart';
import 'package:cargo_app/providers/auth_provider.dart';

// Home reads the real AuthProvider + ProfileProvider types (not arbitrary
// ChangeNotifiers). This ProfileProvider stays in the loading state so we can
// assert Home renders its loading indicator.
class _LoadingProfileProvider extends ProfileProvider {
  _LoadingProfileProvider(super.userRepository);

  @override
  bool get isLoading => true;
}

void main() {
  testWidgets('Home screen shows loading indicator', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<AuthProvider>(create: (_) => AuthProvider()),
          ChangeNotifierProvider<ProfileProvider>(
            create: (_) => _LoadingProfileProvider(ApiUserRepository()),
          ),
        ],
        child: const MaterialApp(home: Home()),
      ),
    );

    expect(find.byType(CircularProgressIndicator), findsWidgets);
  });
}
