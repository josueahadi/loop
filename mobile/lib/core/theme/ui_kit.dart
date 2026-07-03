import 'package:flutter/material.dart';

import '../../constants.dart';

/// Shared UI kit — one source of truth for the refined green look. Screens compose
/// these instead of hand-rolling containers, so spacing, radius, borders, and the
/// green accent stay consistent across driver and cargo-owner surfaces.

// Softer, calmer tokens layered on top of constants.dart.
const Color kSurface = Colors.white;
const Color kSubtleBorder = Color(0xFFE7EDF2);
const Color kMutedText = Color(0xFF5B6770);
const Color kTintGreen = Color(0xFFEAF7F1); // very light green fill
const double kRadius = 16;
const double kGap = 16;

/// A neutral, soft card — subtle border + gentle shadow, no loud colours.
class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? color;

  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(kGap),
    this.onTap,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final card = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? kSurface,
        borderRadius: BorderRadius.circular(kRadius),
        border: Border.all(color: kSubtleBorder),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A000000),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: child,
    );
    if (onTap == null) return card;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(kRadius),
        onTap: onTap,
        child: card,
      ),
    );
  }
}

/// A compact metric tile — uniform neutral surface with a small green-tinted icon
/// chip. Replaces the previous multi-coloured stat cards for a calmer grid.
class StatTile extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color? accent;

  const StatTile({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.accent,
  });

  @override
  Widget build(BuildContext context) {
    final a = accent ?? primaryGreen;
    return AppCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: a.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: a, size: 20),
          ),
          const SizedBox(height: 12),
          Text(
            value,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: textDark,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(fontSize: 12.5, color: kMutedText),
          ),
        ],
      ),
    );
  }
}

/// A small section header with an optional trailing action.
class SectionHeader extends StatelessWidget {
  final String title;
  final Widget? action;

  const SectionHeader({super.key, required this.title, this.action});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w800,
              color: textDark,
            ),
          ),
          const Spacer(),
          ?action,
        ],
      ),
    );
  }
}

/// A small rounded status/price pill.
class Pill extends StatelessWidget {
  final String text;
  final Color color;
  final IconData? icon;

  const Pill({super.key, required this.text, required this.color, this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: color),
            const SizedBox(width: 4),
          ],
          Text(
            text,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

/// A consistent empty-state block.
class EmptyBlock extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;

  const EmptyBlock({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 24),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: kTintGreen,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 30, color: primaryGreen),
            ),
            const SizedBox(height: 14),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: textDark,
              ),
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 4),
              Text(
                subtitle!,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: kMutedText),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
