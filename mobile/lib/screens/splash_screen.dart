import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../constants.dart';
import '../providers/auth_provider.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _checkAuthState();
  }

  Future<void> _checkAuthState() async {
    // Wait for 3 seconds to show splash
    await Future.delayed(const Duration(seconds: 3));

    if (mounted) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);

      // Check if user is authenticated
      if (authProvider.isAuthenticated) {
        Navigator.pushReplacementNamed(context, '/home');
      } else {
        Navigator.pushReplacementNamed(context, '/');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFE1F3ED),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Image.asset(
                'assets/images/splash-illustration-high-res.png',
                fit: BoxFit.contain,
              ),
            ),
            const SizedBox(height: 40),
            // Two-tone "Loop" wordmark (PaytoneOne): dark "L"/"p", green "oo".
            RichText(
              text: const TextSpan(
                style: TextStyle(
                  fontFamily: 'PaytoneOne',
                  fontSize: 48,
                  letterSpacing: 0.5,
                ),
                children: [
                  TextSpan(text: 'L', style: TextStyle(color: textDark)),
                  TextSpan(text: 'oo', style: TextStyle(color: primaryGreen)),
                  TextSpan(text: 'p', style: TextStyle(color: textDark)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
