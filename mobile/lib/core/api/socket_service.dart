import 'dart:async';

import 'package:socket_io_client/socket_io_client.dart' as io;

import '../config/app_config.dart';
import '../models/chat_message.dart';
import 'token_store.dart';

/// Socket.IO client for live chat delivery (M4). Authenticates with the same JWT
/// as REST (handshake auth), joins a per-job room, and streams incoming messages.
/// The message REST GET is the fallback when the socket isn't connected.
class SocketService {
  final TokenStore _tokens;
  io.Socket? _socket;
  final _controller = StreamController<ChatMessageApi>.broadcast();

  SocketService({TokenStore? tokenStore})
      : _tokens = tokenStore ?? TokenStore();

  Stream<ChatMessageApi> get messages => _controller.stream;
  bool get isConnected => _socket?.connected ?? false;

  Future<void> connect() async {
    if (_socket != null) return;
    final token = await _tokens.accessToken;
    if (token == null) return;
    final socket = io.io(
      AppConfig.apiBaseUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .setAuth({'token': token})
          .build(),
    );
    socket.on('message', (data) {
      if (data is Map) {
        _controller.add(ChatMessageApi.fromJson(Map<String, dynamic>.from(data)));
      }
    });
    socket.connect();
    _socket = socket;
  }

  void join(String jobId) => _socket?.emit('join', {'jobId': jobId});
  void leave(String jobId) => _socket?.emit('leave', {'jobId': jobId});

  void dispose() {
    _socket?.dispose();
    _socket = null;
    _controller.close();
  }
}
