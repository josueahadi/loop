import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';

import '../../../constants.dart';
import '../../../providers/auth_provider.dart';

/// A dismissible nudge shown on the home screen when notifications are not
/// enabled — for users who missed or dismissed the OS permission prompt at
/// signup (it is easy to miss). Tapping "Enable" re-requests permission, or, if
/// the user permanently denied it, sends them to system settings. Re-checks on
/// every mount and on app resume, so it disappears the moment permission is
/// granted and the token registers.
class EnableNotificationsBanner extends StatefulWidget {
  const EnableNotificationsBanner({super.key});

  @override
  State<EnableNotificationsBanner> createState() =>
      _EnableNotificationsBannerState();
}

class _EnableNotificationsBannerState extends State<EnableNotificationsBanner>
    with WidgetsBindingObserver {
  bool _granted = true; // assume ok until checked → no flash on first frame
  bool _dismissed = false;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _check());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Returning from system settings (or granting the OS prompt) should update
    // the banner immediately.
    if (state == AppLifecycleState.resumed) _check();
  }

  Future<void> _check() async {
    final push = context.read<AuthProvider>().push;
    final granted = await push.hasPermission();
    if (!mounted) return;
    setState(() => _granted = granted);
  }

  Future<void> _enable() async {
    if (_busy) return;
    setState(() => _busy = true);
    final push = context.read<AuthProvider>().push;
    // If permanently denied, the OS won't show a prompt again — open settings.
    if (await push.isPermanentlyDenied()) {
      await openAppSettings();
    } else {
      await push.retry();
    }
    if (!mounted) return;
    await _check();
    setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_granted || _dismissed) return const SizedBox.shrink();

    const accent = Color(0xFFB57A28); // muted amber — a nudge, not an alarm
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: accent.withValues(alpha: 0.55), width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.notifications_off_outlined, color: accent),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'Turn on notifications',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: accent,
                  ),
                ),
              ),
              GestureDetector(
                onTap: () => setState(() => _dismissed = true),
                child: const Icon(Icons.close, size: 18, color: textGray),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Enable notifications so you never miss a proposal, message, or '
            'payment update.',
            style: TextStyle(fontSize: 13, height: 1.35),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: _busy ? null : _enable,
            icon: _busy
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.notifications_active_outlined, size: 18),
            label: const Text('Enable notifications'),
            style: OutlinedButton.styleFrom(
              foregroundColor: accent,
              side: const BorderSide(color: accent),
              minimumSize: const Size.fromHeight(48),
            ),
          ),
        ],
      ),
    );
  }
}
