import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../constants.dart';
import '../../../core/api/socket_service.dart';
import '../../../core/models/chat_message.dart';
import '../../../core/models/proposal.dart';
import '../../../core/repositories/message_repository.dart';
import '../../../providers/auth_provider.dart';

/// In-app chat for a matched job (M4), backed by the API (Postgres) with live
/// delivery over the Socket.IO gateway; REST load is the fallback. The header
/// exposes a tel: call button — the phone is only present post-acceptance.
class JobChatScreen extends StatefulWidget {
  final String jobId;
  final ProposalContact contact;
  const JobChatScreen({super.key, required this.jobId, required this.contact});

  @override
  State<JobChatScreen> createState() => _JobChatScreenState();
}

class _JobChatScreenState extends State<JobChatScreen> {
  final _messages = MessageRepository();
  final _socket = SocketService();
  final _input = TextEditingController();
  final _scroll = ScrollController();
  StreamSubscription? _sub;

  final _byId = <String, ChatMessageApi>{};
  bool _loading = true;
  String? _myId;

  @override
  void initState() {
    super.initState();
    _myId = context.read<AuthProvider>().user?.uid;
    _init();
  }

  Future<void> _init() async {
    try {
      final history = await _messages.list(widget.jobId);
      for (final m in history) {
        _byId[m.id] = m;
      }
    } catch (_) {
      // gate/permission errors surface as empty; keep going
    }
    await _socket.connect();
    _socket.join(widget.jobId);
    _sub = _socket.messages.listen((m) {
      if (m.jobId != widget.jobId) return;
      setState(() => _byId[m.id] = m);
      _scrollToEnd();
    });
    if (mounted) setState(() => _loading = false);
    _scrollToEnd();
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty) return;
    _input.clear();
    try {
      final m = await _messages.send(widget.jobId, text);
      // The socket echoes to the room too; the id map de-dupes.
      setState(() => _byId[m.id] = m);
      _scrollToEnd();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.jumpTo(_scroll.position.maxScrollExtent);
      }
    });
  }

  Future<void> _call() async {
    final uri = Uri(scheme: 'tel', path: widget.contact.phone);
    await launchUrl(uri);
  }

  @override
  void dispose() {
    _sub?.cancel();
    _socket.leave(widget.jobId);
    _socket.dispose();
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final msgs = _byId.values.toList()
      ..sort((a, b) => a.sentAt.compareTo(b.sentAt));
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.contact.name),
        actions: [
          IconButton(
            icon: const Icon(Icons.call),
            tooltip: 'Call ${widget.contact.phone}',
            onPressed: _call,
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    controller: _scroll,
                    padding: const EdgeInsets.all(12),
                    itemCount: msgs.length,
                    itemBuilder: (_, i) {
                      final m = msgs[i];
                      final mine = m.senderId == _myId;
                      return Align(
                        alignment: mine
                            ? Alignment.centerRight
                            : Alignment.centerLeft,
                        child: Container(
                          margin: const EdgeInsets.symmetric(vertical: 4),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          constraints: const BoxConstraints(maxWidth: 280),
                          decoration: BoxDecoration(
                            color: mine ? primaryGreen : searchBg,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Text(
                            m.content,
                            style: TextStyle(
                              color: mine ? Colors.white : textDark,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _input,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _send(),
                      decoration: const InputDecoration(
                        hintText: 'Message',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.send, color: primaryGreen),
                    onPressed: _send,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
