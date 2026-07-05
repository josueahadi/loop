import 'dart:io';

import '../api/api_client.dart';
import '../enums/app_enums.dart';
import '../models/user_model.dart';

/// User data access, now backed by the NestJS API (`/me`) instead of Firestore.
///
/// M1 covers the self-profile path (`getUserById` → GET /me, `updateUser` →
/// PATCH /me). Methods that need endpoints not yet built — listing other users
/// (M2 matching → /drivers/nearby) and document/photo upload (driver docs go
/// through the verification endpoint; profile photo upload lands later) — are
/// present so the wider app compiles, and fail clearly until wired.
abstract class UserRepository {
  Future<UserModel?> getUserById(String uid);
  Future<void> updateUser(UserModel user);
  Future<List<UserModel>> getUsersByRole(UserRole role);
  Stream<UserModel?> userStream(String uid);
  Future<String> uploadProfileImage(String uid, File imageFile);
  Future<String> uploadDocument(
    String uid,
    File documentFile,
    String documentType,
  );
  Future<void> updateUserWithDocuments(
    String uid,
    Map<String, String> documentUrls,
  );
}

class _NotYetAvailable implements Exception {
  final String message;
  _NotYetAvailable(this.message);
  @override
  String toString() => message;
}

class ApiUserRepository implements UserRepository {
  final ApiClient _api;

  ApiUserRepository({ApiClient? api}) : _api = api ?? ApiClient();

  @override
  Future<UserModel?> getUserById(String uid) async {
    // M1: only the authenticated user is retrievable (GET /me).
    final res = await _api.dio.get('/me');
    return UserModel.fromJson(res.data as Map<String, dynamic>);
  }

  @override
  Future<void> updateUser(UserModel user) async {
    await _api.dio.patch('/me', data: user.toUpdateJson());
  }

  @override
  Future<List<UserModel>> getUsersByRole(UserRole role) async {
    // Listing drivers is the geo-matching query (GET /drivers/nearby), built in M2.
    return <UserModel>[];
  }

  @override
  Stream<UserModel?> userStream(String uid) async* {
    // No realtime user stream over REST; emit a single snapshot from GET /me.
    yield await getUserById(uid);
  }

  @override
  Future<String> uploadProfileImage(String uid, File imageFile) {
    throw _NotYetAvailable('Profile photo upload is not available yet');
  }

  @override
  Future<String> uploadDocument(
    String uid,
    File documentFile,
    String documentType,
  ) {
    // Driver verification documents now go through VerificationRepository
    // (POST /verification), not the user record.
    throw _NotYetAvailable('Use the verification screen to upload documents');
  }

  @override
  Future<void> updateUserWithDocuments(
    String uid,
    Map<String, String> documentUrls,
  ) {
    throw _NotYetAvailable('Document fields moved to verification records');
  }
}
