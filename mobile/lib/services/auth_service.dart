import 'dart:io';
import 'package:dio/dio.dart';

import '../core/api/api_client.dart';
import '../core/api/token_store.dart';
import '../core/enums/app_enums.dart';
import '../core/models/user_model.dart';

/// Auth against the NestJS API (JWT). Replaces the previous FirebaseAuth +
/// Firestore implementation. Tokens are persisted in [TokenStore].
class AuthService {
  final ApiClient _api;
  final TokenStore _tokens;

  AuthService({ApiClient? api, TokenStore? tokens})
      : _tokens = tokens ?? TokenStore(),
        _api = api ?? ApiClient(tokenStore: tokens);

  Dio get _dio => _api.dio;

  Future<bool> get hasSession => _tokens.hasSession;

  Future<void> _saveTokens(Map<String, dynamic> data) async {
    await _tokens.save(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
    );
  }

  /// Fetch the current user via GET /me. Returns null if unauthenticated.
  Future<UserModel?> getCurrentUserData() async {
    if (!await _tokens.hasSession) return null;
    try {
      final res = await _dio.get('/me');
      return UserModel.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return null;
      throw _mapError(e);
    }
  }

  Future<UserModel> register({
    required String email,
    required String password,
    required String name,
    required String phoneNumber,
    required UserRole role,
  }) async {
    try {
      final res = await _dio.post(
        '/auth/register',
        data: {
          'name': name,
          'email': email,
          'phone': phoneNumber,
          'password': password,
          'role': role.api,
        },
        options: Options(extra: {'skipAuth': true}),
      );
      await _saveTokens(res.data as Map<String, dynamic>);
      return UserModel.fromJson(res.data['user'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<UserModel> signInWithEmail({
    required String email,
    required String password,
  }) async {
    try {
      final res = await _dio.post(
        '/auth/login',
        data: {'email': email, 'password': password},
        options: Options(extra: {'skipAuth': true}),
      );
      await _saveTokens(res.data as Map<String, dynamic>);
      return UserModel.fromJson(res.data['user'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> signOut() async {
    final refresh = await _tokens.refreshToken;
    if (refresh != null) {
      try {
        await _dio.post(
          '/auth/logout',
          data: {'refreshToken': refresh},
          options: Options(extra: {'skipAuth': true}),
        );
      } catch (_) {
        // best-effort server-side revoke; always clear locally below
      }
    }
    await _tokens.clear();
  }

  Future<void> sendPasswordResetEmail(String email) async {
    try {
      await _dio.post(
        '/auth/password-reset/request',
        data: {'email': email},
        options: Options(extra: {'skipAuth': true}),
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> requestEmailVerification() async {
    try {
      await _dio.post('/auth/email/verify/request');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<UserModel> updateUserProfile({
    String? name,
    String? phoneNumber,
    String? profileImageUrl,
  }) async {
    try {
      final res = await _dio.patch('/me', data: {
        if (name != null) 'name': name,
        if (phoneNumber != null) 'phone': phoneNumber,
        if (profileImageUrl != null) 'photoUrl': profileImageUrl,
      });
      return UserModel.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// PATCH /me/availability — driver online/offline + current location.
  Future<UserModel> updateAvailability({
    required bool online,
    double? lat,
    double? lng,
  }) async {
    try {
      final res = await _dio.patch('/me/availability', data: {
        'status': online ? 'online' : 'offline',
        if (lat != null) 'lat': lat,
        if (lng != null) 'lng': lng,
      });
      return UserModel.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// POST /me/photo — multipart upload; server stores the reference on the user.
  Future<UserModel> uploadProfilePhoto(File file) async {
    try {
      final form = FormData.fromMap({
        'file': await MultipartFile.fromFile(
          file.path,
          filename: file.path.split('/').last,
        ),
      });
      final res = await _dio.post('/me/photo', data: form);
      return UserModel.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Maps a Dio error to a readable message from the API's error envelope.
  Exception _mapError(DioException e) {
    final data = e.response?.data;
    if (data is Map && data['message'] != null) {
      final msg = data['message'];
      return Exception(msg is List ? msg.join(', ') : msg.toString());
    }
    return Exception(e.message ?? 'Network error');
  }
}
