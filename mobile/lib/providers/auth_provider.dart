import 'dart:io';
import 'package:flutter/material.dart';

import '../core/enums/app_enums.dart';
import '../core/models/user_model.dart';
import '../core/repositories/verification_repository.dart';
import '../services/auth_service.dart';

/// App-wide auth state, now backed by the NestJS API (JWT) instead of FirebaseAuth.
/// Public method names are preserved so existing screens need no changes.
class AuthProvider with ChangeNotifier {
  final AuthService _authService;
  final VerificationRepository _verification;

  AuthProvider({AuthService? authService, VerificationRepository? verification})
      : _authService = authService ?? AuthService(),
        _verification = verification ?? VerificationRepository();

  UserModel? _user;
  bool _isLoading = false;
  String? _error;

  UserModel? get user => _user;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isAuthenticated => _user != null;

  /// Restore a session from the stored JWT (called on app start). Replaces the
  /// old Firebase authStateChanges listener.
  Future<void> initializeAuth() async {
    try {
      _user = await _authService.getCurrentUserData();
    } catch (e) {
      _error = e.toString();
    }
    notifyListeners();
  }

  Future<bool> signUp({
    required String email,
    required String password,
    required String name,
    required String phoneNumber,
    required UserRole role,
  }) async {
    try {
      _setLoading(true);
      _clearError();
      _user = await _authService.register(
        email: email,
        password: password,
        name: name,
        phoneNumber: phoneNumber,
        role: role,
      );
      return true;
    } catch (e) {
      _setError(_clean(e));
      return false;
    } finally {
      _setLoading(false);
    }
  }

  Future<bool> signIn({required String email, required String password}) async {
    try {
      _setLoading(true);
      _clearError();
      _user = await _authService.signInWithEmail(email: email, password: password);
      return true;
    } catch (e) {
      _setError(_clean(e));
      return false;
    } finally {
      _setLoading(false);
    }
  }

  Future<void> signOut() async {
    try {
      _setLoading(true);
      await _authService.signOut();
      _user = null;
    } catch (e) {
      _setError(_clean(e));
    } finally {
      _setLoading(false);
    }
  }

  Future<bool> sendPasswordReset(String email) async {
    try {
      _setLoading(true);
      _clearError();
      await _authService.sendPasswordResetEmail(email);
      return true;
    } catch (e) {
      _setError(_clean(e));
      return false;
    } finally {
      _setLoading(false);
    }
  }

  /// Request a fresh email-verification link. Non-blocking in the MVP.
  Future<bool> sendEmailVerification() async {
    try {
      _setLoading(true);
      _clearError();
      await _authService.requestEmailVerification();
      return true;
    } catch (e) {
      _setError(_clean(e));
      return false;
    } finally {
      _setLoading(false);
    }
  }

  Future<void> checkEmailVerification() async {
    await refreshUserData();
  }

  Future<void> refreshUserData() async {
    try {
      _user = await _authService.getCurrentUserData();
      notifyListeners();
    } catch (e) {
      _setError(_clean(e));
    }
  }

  Future<bool> updateProfile({
    String? name,
    String? phoneNumber,
    String? profileImageUrl,
  }) async {
    try {
      _setLoading(true);
      _clearError();
      _user = await _authService.updateUserProfile(
        name: name,
        phoneNumber: phoneNumber,
        profileImageUrl: profileImageUrl,
      );
      return true;
    } catch (e) {
      _setError(_clean(e));
      return false;
    } finally {
      _setLoading(false);
    }
  }

  /// Upload one verification document (licence | national_id | vehicle_reg) to the
  /// API (multipart → private Storage). [documentType] uses the API's snake_case.
  Future<bool> submitVerificationDocument({
    required String documentType,
    required File file,
  }) async {
    try {
      _setLoading(true);
      _clearError();
      await _verification.submitDocument(documentType: documentType, file: file);
      return true;
    } catch (e) {
      _setError(_clean(e));
      return false;
    } finally {
      _setLoading(false);
    }
  }

  /// Driver availability toggle. The PATCH /me/availability endpoint (with location)
  /// lands in M2; for now this updates local state only.
  Future<bool> updateDriverAvailability(bool isAvailable) async {
    if (_user != null && _user!.role == UserRole.driver) {
      _user = _user!.copyWith(isAvailable: isAvailable);
      notifyListeners();
    }
    return true;
  }

  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  void _setError(String error) {
    _error = error;
    notifyListeners();
  }

  void _clearError() {
    _error = null;
  }

  void clearError() {
    _clearError();
    notifyListeners();
  }

  String _clean(Object e) =>
      e.toString().replaceFirst('Exception: ', '');
}
