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

            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}
