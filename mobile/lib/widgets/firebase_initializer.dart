import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import '../firebase_options.dart';

/// Initializes the Firebase core app only — used for FCM push (M4) and document
/// Storage. Identity is handled by the NestJS API (JWT), NOT Firebase Auth, so no
/// Firebase Auth configuration happens here. Auth/session is owned by AuthProvider
/// (wired in main.dart).
class FirebaseInitializer extends StatelessWidget {
  final Widget child;

  const FirebaseInitializer({super.key, required this.child});

  Future<void> _initializeFirebase() async {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: _initializeFirebase(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.done) {
          return child;
        }
        return const MaterialApp(
          debugShowCheckedModeBanner: false,
          home: Scaffold(body: Center(child: CircularProgressIndicator())),
        );
      },
    );
  }
}
