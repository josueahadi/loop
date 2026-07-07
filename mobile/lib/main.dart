import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'firebase_options.dart';
import 'services/push_messaging.dart';
import 'screens/welcome_screen.dart';
import 'screens/login_screen.dart';
import 'screens/signup_screen.dart';
import 'screens/forget_password_screen.dart';
import 'screens/splash_screen.dart';
import 'screens/password_reset_confirmation.dart';
import 'screens/email_verification_screen.dart';
import 'screens/home.dart';
import 'screens/personal_data_screen.dart';
import 'providers/auth_provider.dart';
import 'providers/notification_provider.dart';
import 'providers/onboarding_provider.dart';
import 'features/profile/providers/profile_provider.dart';
import 'core/api/api_client.dart';
import 'core/repositories/user_repository.dart';
import 'package:cargo_app/constants.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Firebase powers FCM push only. Guarded so the app still boots even if init
  // fails — push simply stays off in that case.
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  } catch (e) {
    debugPrint('Firebase init skipped (push disabled): $e');
  }

  runApp(const MyApp());
}

// Global messenger so foreground-push snackbars can be shown from anywhere.
final GlobalKey<ScaffoldMessengerState> _messengerKey =
    GlobalKey<ScaffoldMessengerState>();
final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => NotificationProvider()),
        ChangeNotifierProvider(create: (_) => ButtonProvider()),
        ProxyProvider0<UserRepository>(update: (_, __) => ApiUserRepository()),
        ChangeNotifierProxyProvider<UserRepository, ProfileProvider>(
          create: (context) => ProfileProvider(
            Provider.of<UserRepository>(context, listen: false),
          ),
          update: (context, userRepo, previous) =>
              previous ?? ProfileProvider(userRepo),
        ),
      ],
      child: Consumer<AuthProvider>(
        builder: (context, authProvider, child) {
          // Initialize auth state when the app starts
          WidgetsBinding.instance.addPostFrameCallback((_) {
            authProvider.initializeAuth();
          });

          // Seed the unread badge as soon as the user is authenticated (login or
          // session restore), not only when a home screen's bell mounts.
          final notifications = context.read<NotificationProvider>();
          if (authProvider.isAuthenticated) {
            WidgetsBinding.instance.addPostFrameCallback(
              (_) => notifications.refreshUnread(),
            );
          }

          // When the session dies unrecoverably (refresh failed), sign out and
          // route to login instead of stranding the user on a screen firing 401s.
          ApiClient.onUnauthorized = () {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              authProvider.signOut();
              _navigatorKey.currentState?.pushNamedAndRemoveUntil(
                '/',
                (route) => false,
              );
            });
          };

          // Foreground pushes: refresh the unread badge + show an in-app banner
          // (the OS shows nothing while the app is open).
          authProvider.push.onForegroundMessage = (message) {
            notifications.refreshUnread();
            final messenger = _messengerKey.currentState;
            final n = message.notification;
            if (messenger != null && n != null) {
              messenger.showSnackBar(
                SnackBar(
                  content: Text(n.title ?? n.body ?? 'New notification'),
                  backgroundColor: primaryGreen,
                  behavior: SnackBarBehavior.floating,
                ),
              );
            }
          };

          return MaterialApp(
            title: 'Loop',
            navigatorKey: _navigatorKey,
            scaffoldMessengerKey: _messengerKey,
            debugShowCheckedModeBanner: false,
            theme: ThemeData(
              fontFamily: 'Lexend',
              useMaterial3: true,
              colorScheme: ColorScheme.fromSeed(seedColor: primaryGreen),
            ),
            initialRoute: '/splash',
            routes: {
              '/splash': (context) => const SplashScreen(),
              '/': (context) => WelcomeScreen(),
              '/login': (context) => LoginScreen(),
              '/signup': (context) => SignupScreen(),
              '/forgot-password': (context) => const ForgetPasswordScreen(),
              '/password-reset-confirmation': (context) =>
                  const PasswordResetConfirmation(),
              '/email-verification': (context) =>
                  const EmailVerificationScreen(),
              '/home': (context) => const Home(),
              '/personal-data': (context) => const PersonalDataScreen(),
            },
          );
        },
      ),
    );
  }
}
