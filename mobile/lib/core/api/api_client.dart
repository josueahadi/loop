import 'package:dio/dio.dart';

import '../config/app_config.dart';
import 'token_store.dart';

/// The ONE Dio client for the whole app (DRY). Attaches the access token, and
/// transparently refreshes it once on a 401 using the stored refresh token.
class ApiClient {
  final Dio dio;
  final TokenStore _tokens;

  // A single in-flight refresh shared by all concurrent 401s. The refresh token
  // is single-use (rotating) server-side, so letting each 401 refresh
  // independently would have the first rotation revoke the token and every
  // other refresh then fail — clearing the session (a spurious logout). This
  // dedupes them: the first 401 refreshes, the rest await the same result.
  Future<bool>? _refreshInFlight;

  // Shared singleton: every repository defaults to this ONE client, so the
  // refresh-dedupe above spans the whole app, not just one repo's calls (many
  // repos fire at once on a screen open). Tests can still inject overrides.
  static ApiClient? _shared;

  // Invoked once when the session is unrecoverable (refresh failed → tokens
  // cleared). The app root wires this to sign out + route to login, so the user
  // isn't stranded on a screen firing raw 401s. Static so it survives the
  // singleton and is set once at startup.
  static void Function()? onUnauthorized;

  factory ApiClient({TokenStore? tokenStore, Dio? dioOverride}) {
    if (tokenStore == null && dioOverride == null) {
      return _shared ??= ApiClient._internal();
    }
    return ApiClient._internal(tokenStore: tokenStore, dioOverride: dioOverride);
  }

  ApiClient._internal({TokenStore? tokenStore, Dio? dioOverride})
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
            // Fail fast when there is no refresh token: this is the normal
            // post-logout state (in-flight requests 401 after the store is
            // cleared), and attempting a refresh would only fire a doomed call
            // and re-trigger the session-died re-route on an already-signed-out
            // app.
            if (await _tokens.refreshToken == null) {
              return handler.next(error);
            }
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

  // Coalesce concurrent refreshes into one so the rotating refresh token is
  // spent exactly once per burst of 401s.
  Future<bool> _tryRefresh() {
    return _refreshInFlight ??= _doRefresh().whenComplete(() {
      _refreshInFlight = null;
    });
  }

  Future<bool> _doRefresh() async {
    final refresh = await _tokens.refreshToken;
    if (refresh == null) {
      _sessionDied();
      return false;
    }
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
      _sessionDied();
      return false;
    }
  }

  // Session is unrecoverable — let the app sign out + route to login so the user
  // isn't stranded firing raw 401s.
  void _sessionDied() {
    onUnauthorized?.call();
  }
}
