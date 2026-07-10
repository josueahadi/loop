import 'package:dio/dio.dart';

/// Turns an exception into a short, human-friendly message for the UI.
///
/// The goal is that a user never sees a raw `DioException`, a stack trace, or a
/// backend stack/500 body. Network and server conditions map to plain language
/// ("You're offline", "The service is temporarily unavailable"); a 4xx with a
/// message from the API's error envelope is shown as-is (those are written for
/// users), and anything unrecognised falls back to a generic line.
String friendlyErrorMessage(Object? error) {
  if (error is DioException) return _fromDio(error);

  // Non-Dio exceptions: strip the "Exception: " prefix Dart adds.
  final text = error?.toString() ?? '';
  final cleaned = text.replaceFirst('Exception: ', '').trim();
  return cleaned.isEmpty ? _generic : cleaned;
}

String _fromDio(DioException e) {
  switch (e.type) {
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.sendTimeout:
    case DioExceptionType.receiveTimeout:
      return 'The connection timed out. Please check your network and try again.';
    case DioExceptionType.connectionError:
      return "Can't reach the server. Check your internet connection and try again.";
    case DioExceptionType.badCertificate:
      return 'A secure connection could not be established.';
    case DioExceptionType.cancel:
      return 'The request was cancelled.';
    case DioExceptionType.badResponse:
      return _fromStatus(e);
    case DioExceptionType.unknown:
      // A null response usually means the request never reached the server.
      return e.response == null
          ? "Can't reach the server. Check your internet connection and try again."
          : _fromStatus(e);
    default:
      // Covers any Dio type not enumerated above (e.g. transformTimeout).
      return e.response == null ? _generic : _fromStatus(e);
  }
}

String _fromStatus(DioException e) {
  final status = e.response?.statusCode ?? 0;

  // Server-side failures: never surface the raw body (it may be a stack trace).
  if (status >= 500) {
    return status == 503
        ? 'The service is temporarily unavailable. Please try again shortly.'
        : 'Something went wrong on our side. Please try again shortly.';
  }

  // Client-side (4xx): the API's error envelope carries a user-facing message.
  final data = e.response?.data;
  if (data is Map && data['message'] != null) {
    final msg = data['message'];
    final text = (msg is List ? msg.join(', ') : msg.toString()).trim();
    if (text.isNotEmpty) return text;
  }
  if (status == 401) return 'Your session has expired. Please sign in again.';
  if (status == 403) return "You don't have permission to do that.";
  if (status == 404) return 'That was not found.';
  return _generic;
}

const _generic = 'Something went wrong. Please try again.';
