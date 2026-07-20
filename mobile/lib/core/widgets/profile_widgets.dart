import 'package:flutter/material.dart';

import '../../constants.dart';
import '../theme/ui_kit.dart';

class ProfileGroup extends StatelessWidget {
  final List<Widget> children;
  const ProfileGroup({super.key, required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kSubtleBorder),
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: kSurface,
        child: Column(
          children: [
            for (var i = 0; i < children.length; i++) ...[
              children[i],
              if (i < children.length - 1)
                const Divider(height: 1, thickness: 1, color: kSubtleBorder),
            ],
          ],
        ),
      ),
    );
  }
}

class ProfileOption extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;
  final bool isDestructive;

  const ProfileOption({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    required this.onTap,
    this.isDestructive = false,
  });

  @override
  Widget build(BuildContext context) {
    final color = isDestructive ? Colors.red : primaryGreen;
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      leading: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: color, size: 20),
      ),
      title: Text(
        title,
        style: TextStyle(
          fontWeight: FontWeight.w600,
          color: isDestructive ? Colors.red : textDark,
        ),
      ),
      subtitle: subtitle != null
          ? Text(subtitle!, style: const TextStyle(color: kMutedText))
          : null,
      trailing: isDestructive
          ? null
          : const Icon(Icons.chevron_right, color: kMutedText, size: 20),
      onTap: onTap,
    );
  }
}

/// A small pill (role / status / rating) used in profile headers.
class ProfilePill extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool filled;
  final Color? fillColor;

  const ProfilePill({
    super.key,
    required this.icon,
    required this.label,
    this.filled = false,
    this.fillColor,
  });

  @override
  Widget build(BuildContext context) {
    final bg = fillColor ?? primaryGreen;
    final fg = filled ? Colors.white : bg;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: filled ? bg : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: filled ? null : Border.all(color: kSubtleBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: fg),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: fg,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
