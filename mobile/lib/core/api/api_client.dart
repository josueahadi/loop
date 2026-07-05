import 'package:dio/dio.dart';

import '../config/app_config.dart';
import 'token_store.dart';

/// The ONE Dio client for the whole app (DRY). Attaches the access token, and
/// transparently refreshes it once on a 401 using the stored refresh token.
class ApiClient {
  final Dio dio;
  final TokenStore _tokens;

  ApiClient({TokenStore? tokenStore, Dio? dioOverride})
    : _tokens = tokenStore ?? TokenStore(),
      dio =
          dioOverride ??
          Dio(
            BaseOptions(
              baseUrl: AppConfig.apiBaseUrl,
              connectTimeout: const Duration(seconds: 15),
              receiveTimeout: const Duration(seconds: 20),
              contentType: 'application/json',
            ),
          ) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          if (options.extra['skipAuth'] != true) {
            final token = await _tokens.accessToken;
            if (token != null) {
              options.headers['Authorization'] = 'Bearer $token';
            }
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          final response = error.response;
          final isAuthError = response?.statusCode == 401;
          final alreadyRetried = error.requestOptions.extra['retried'] == true;
          final isRefreshCall = error.requestOptions.path.contains(
            '/auth/refresh',
          );

          if (isAuthError && !alreadyRetried && !isRefreshCall) {
            final refreshed = await _tryRefresh();
            if (refreshed) {
              final opts = error.requestOptions;
              opts.extra['retried'] = true;
              final token = await _tokens.accessToken;
              opts.headers['Authorization'] = 'Bearer $token';
              try {
                final clone = await dio.fetch(opts);
                return handler.resolve(clone);
              } catch (e) {
                return handler.next(error);
              }
            }
          }
          handler.next(error);
        },
      ),
    );
  }

  Future<bool> _tryRefresh() async {
    final refresh = await _tokens.refreshToken;
    if (refresh == null) return false;
    try {
      final res = await dio.post(
        '/auth/refresh',
        data: {'refreshToken': refresh},
        options: Options(extra: {'skipAuth': true}),
      );
      await _tokens.save(
        accessToken: res.data['accessToken'] as String,
        refreshToken: res.data['refreshToken'] as String,
      );
      return true;
    } catch (_) {
      await _tokens.clear();
      return false;
    }
  }
}
