import 'dart:io';
import 'package:dio/dio.dart';

import '../api/api_client.dart';

/// Driver verification documents, via the API (multipart → private Storage bucket).
/// Replaces the previous direct Firebase Storage upload — documents are now
/// API-mediated and never land in a public bucket.
class VerificationRepository {
  final ApiClient _api;

  VerificationRepository({ApiClient? api}) : _api = api ?? ApiClient();

  /// POST /verification — uploads one document of the given type.
  /// [documentType] uses the API's snake_case: licence | national_id | vehicle_reg.
  Future<void> submitDocument({
    required String documentType,
    required File file,
  }) async {
    final form = FormData.fromMap({
      'documentType': documentType,
      'file': await MultipartFile.fromFile(
        file.path,
        filename: file.path.split('/').last,
      ),
    });
    await _api.dio.post('/verification', data: form);
  }

  /// GET /verification — the driver's own records (status pending/approved/rejected).
  Future<List<Map<String, dynamic>>> listOwn() async {
    final res = await _api.dio.get('/verification');
    return (res.data as List).cast<Map<String, dynamic>>();
  }
}
