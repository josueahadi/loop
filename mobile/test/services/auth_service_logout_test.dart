import 'package:cargo_app/core/api/api_client.dart';
import 'package:cargo_app/core/api/token_store.dart';
import 'package:cargo_app/services/auth_service.dart';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

/// In-memory stand-in for the platform keystore (no method channel in tests).
class _FakeSecureStorage extends FlutterSecureStorage {
  _FakeSecureStorage(this._data) : super();

  final Map<String, String> _data;

  @override
  Future<void> write({
    required String key,
    required String? value,
    // ignore: avoid_renaming_method_parameters
    IOSOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    if (value == null) {
      _data.remove(key);
    } else {
      _data[key] = value;
    }
  }

  @override
  Future<String?> read({
    required String key,
    IOSOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
  }) async => _data[key];

  @override
  Future<void> delete({
    required String key,
    IOSOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    _data.remove(key);
  }
}

void main() {
  test(
    'signOut clears tokens without waiting for the server revoke to answer',
    () async {
      final data = {
        'loop_access_token': 'access',
        'loop_refresh_token': 'refresh',
      };
      final tokens = TokenStore(_FakeSecureStorage(data));

      // A network that accepts the request and then never answers — the MTN
      // blackhole / airplane-mode case that used to hang logout for the full
      // 15s connect timeout.
      var revokeAttempted = false;
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            revokeAttempted = true;
            // Never call handler.next/resolve/reject: the call hangs forever.
          },
        ),
      );

      final auth = AuthService(
        api: ApiClient(tokenStore: tokens, dioOverride: dio),
        tokens: tokens,
      );

      // Must complete on its own; a regression re-introducing an awaited revoke
      // would hang here until the test framework's timeout kills it.
      await auth.signOut().timeout(
        const Duration(seconds: 2),
        onTimeout: () => fail('signOut blocked on the network'),
      );

      expect(await tokens.accessToken, isNull);
      expect(await tokens.refreshToken, isNull);

      // The revoke is detached and passes through the client's auth interceptor,
      // so it reaches the wire a few event-loop turns later. Give it real time
      // before asserting it was fired and not silently dropped.
      await Future<void>.delayed(const Duration(milliseconds: 50));
      expect(
        revokeAttempted,
        isTrue,
        reason: 'the revoke should still be fired, just not awaited',
      );
    },
  );
}
