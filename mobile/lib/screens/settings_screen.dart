import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/repositories/user_repository.dart';
import '../mixins/logout_mixin.dart';
import '../providers/auth_provider.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> with LogoutMixin {
  final UserRepository _userRepository = ApiUserRepository();

  bool _isLoading = false;
  bool _isAvailable = false;

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  Future<void> _loadUserData() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final currentUser = authProvider.user;
    if (currentUser != null) {
      setState(() => _isAvailable = currentUser.isAvailable ?? false);
    }
  }

  Future<void> _updateAvailability(bool value) async {
    setState(() {
      _isLoading = true;
    });

    try {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final currentUser = authProvider.user;

      if (currentUser == null) {
        throw Exception('No user logged in');
      }

      final updatedUser = currentUser.copyWith(
        isAvailable: value,
        updatedAt: DateTime.now(),
      );

      await _userRepository.updateUser(updatedUser);
      await authProvider.refreshUserData();

      if (mounted) {
        setState(() {
          _isAvailable = value;
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              value
                  ? 'You are now available for jobs'
                  : 'You are now unavailable for jobs',
            ),
            backgroundColor: value ? Colors.green : Colors.orange,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error updating availability: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Widget _buildSettingsTile({
    required IconData icon,
    required String title,
    String? subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
    bool enabled = true,
  }) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: SwitchListTile(
        secondary: Icon(
          icon,
          color: enabled ? Theme.of(context).primaryColor : Colors.grey,
        ),
        title: Text(
          title,
          style: TextStyle(
            fontWeight: FontWeight.w500,
            color: enabled ? Colors.black87 : Colors.grey,
          ),
        ),
        subtitle: subtitle != null
            ? Text(
                subtitle,
                style: TextStyle(
                  color: enabled ? Colors.grey[600] : Colors.grey,
                  fontSize: 12,
                ),
              )
            : null,
        value: value,
        onChanged: enabled ? onChanged : null,
      ),
    );
  }

  // Irreversible account deletion. Guarded by BOTH re-entering the password
  // (which the API also verifies) and typing DELETE, so it can't be triggered by
  // an accidental tap. On success the session is gone and we route to welcome.
  Future<void> _showDeleteAccountDialog() async {
    final passwordController = TextEditingController();
    final confirmController = TextEditingController();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            final canDelete =
                passwordController.text.isNotEmpty &&
                confirmController.text.trim().toUpperCase() == 'DELETE';
            return AlertDialog(
              title: const Text('Delete account?'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'This permanently deletes your account and the data it '
                    'owns. This cannot be undone.',
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: passwordController,
                    obscureText: true,
                    onChanged: (_) => setDialogState(() {}),
                    decoration: const InputDecoration(
                      labelText: 'Password',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: confirmController,
                    onChanged: (_) => setDialogState(() {}),
                    decoration: const InputDecoration(
                      labelText: 'Type DELETE to confirm',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(false),
                  child: const Text('Cancel'),
                ),
                TextButton(
                  onPressed: canDelete
                      ? () => Navigator.of(dialogContext).pop(true)
                      : null,
                  style: TextButton.styleFrom(foregroundColor: Colors.red),
                  child: const Text('Delete'),
                ),
              ],
            );
          },
        );
      },
    );

    if (confirmed != true || !mounted) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final ok = await authProvider.deleteAccount(passwordController.text);
    if (!mounted) return;
    if (ok) {
      Navigator.of(
        context,
      ).pushNamedAndRemoveUntil('/', (route) => false);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(authProvider.error ?? 'Could not delete account.'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Widget _buildActionTile({
    required IconData icon,
    required String title,
    String? subtitle,
    required VoidCallback onTap,
    Color? iconColor,
    Color? textColor,
  }) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(icon, color: iconColor ?? Theme.of(context).primaryColor),
        title: Text(
          title,
          style: TextStyle(
            fontWeight: FontWeight.w500,
            color: textColor ?? Colors.black87,
          ),
        ),
        subtitle: subtitle != null
            ? Text(
                subtitle,
                style: TextStyle(color: Colors.grey[600], fontSize: 12),
              )
            : null,
        trailing: const Icon(Icons.arrow_forward_ios, size: 16),
        onTap: onTap,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Driver Status Section
            const Text(
              'Driver Status',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'Control your availability to receive job requests',
              style: TextStyle(color: Colors.grey[600], fontSize: 14),
            ),
            const SizedBox(height: 16),

            _buildSettingsTile(
              icon: _isAvailable ? Icons.work : Icons.work_off,
              title: 'Available for Jobs',
              subtitle: _isAvailable
                  ? 'You will receive job notifications'
                  : 'You won\'t receive job notifications',
              value: _isAvailable,
              onChanged: _updateAvailability,
              enabled: !_isLoading,
            ),

            const SizedBox(height: 32),

            // App Settings
            const Text(
              'App',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),

            _buildActionTile(
              icon: Icons.info,
              title: 'About',
              subtitle: 'App version and information',
              onTap: () {
                showAboutDialog(
                  context: context,
                  applicationName: 'Loop Rwanda',
                  applicationVersion: '1.1.0',
                  applicationIcon: const Icon(Icons.local_shipping, size: 48),
                  children: [
                    const Text(
                      'Connecting cargo owners with reliable drivers across Rwanda.',
                    ),
                  ],
                );
              },
            ),

            const SizedBox(height: 32),

            // Danger Zone
            const Text(
              'Account Management',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.red,
              ),
            ),
            const SizedBox(height: 16),

            _buildActionTile(
              icon: Icons.logout,
              title: 'Sign Out',
              subtitle: 'Sign out of your account',
              iconColor: Colors.red,
              textColor: Colors.red,
              onTap: () => showLogoutConfirmation(context),
            ),

            _buildActionTile(
              icon: Icons.delete_forever,
              title: 'Delete Account',
              subtitle: 'Permanently delete your account and data',
              iconColor: Colors.red,
              textColor: Colors.red,
              onTap: _showDeleteAccountDialog,
            ),

            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}
