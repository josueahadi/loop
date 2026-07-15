import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../features/profile/providers/profile_provider.dart';

/// The one logout entry point for every screen (DRY) — confirm, clear local
/// state, land on the welcome screen.
mixin LogoutMixin {
  Future<void> showLogoutConfirmation(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Log out?'),
        content: const Text('You can sign back in anytime.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Log out'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    await logoutAndGoToWelcome(context);
  }
}

/// Sign out and reset the navigation stack. Deliberately has no spinner and no
/// error path: [AuthProvider.signOut] is local-first and cannot fail or block,
/// so there is nothing to wait for and nothing to report. The previous version
/// awaited ~30s of network behind a `barrierDismissible: false` dialog that was
/// only ever popped on an error that could not happen — the logout hang.
Future<void> logoutAndGoToWelcome(BuildContext context) async {
  final auth = Provider.of<AuthProvider>(context, listen: false);
  final profile = Provider.of<ProfileProvider>(context, listen: false);

  await auth.signOut();
  profile.logout();

  if (!context.mounted) return;
  Navigator.of(context).pushNamedAndRemoveUntil('/', (route) => false);
}
