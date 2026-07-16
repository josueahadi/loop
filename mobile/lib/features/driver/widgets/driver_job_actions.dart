import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

import '../../../constants.dart';
import '../../navigation/navigation_screen.dart';

/// The one action row for a driver's accepted job (DRY): Chat, Call, in-app
/// Navigate-to-pickup, and — once completed — Rate. Used by both the My Jobs tab
/// and the proposals screen so the buttons, order, and behaviour never drift.
/// The two screens previously each rendered their own slightly different row.
class DriverJobActions extends StatelessWidget {
  final LatLng pickup;
  final String? pickupLabel;
  final String ownerPhone;
  final int unreadCount;
  final bool isCompleted;
  final bool alreadyRated;
  final VoidCallback onChat;
  final VoidCallback onCall;
  final VoidCallback? onRate;

  const DriverJobActions({
    super.key,
    required this.pickup,
    required this.pickupLabel,
    required this.ownerPhone,
    required this.onChat,
    required this.onCall,
    this.unreadCount = 0,
    this.isCompleted = false,
    this.alreadyRated = false,
    this.onRate,
  });

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        ElevatedButton.icon(
          style: ElevatedButton.styleFrom(
            backgroundColor: primaryGreen,
            foregroundColor: Colors.white,
          ),
          onPressed: onChat,
          icon: const Icon(Icons.chat, size: 18),
          label: Text(unreadCount > 0 ? 'Chat ($unreadCount)' : 'Chat'),
        ),
        OutlinedButton.icon(
          onPressed: onCall,
          icon: const Icon(Icons.call, size: 18),
          label: const Text('Call'),
        ),
        FilledButton.icon(
          onPressed: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => NavigationScreen(
                destination: pickup,
                destinationLabel: pickupLabel ?? 'Pickup',
              ),
            ),
          ),
          icon: const Icon(Icons.navigation, size: 18),
          label: const Text('Pickup'),
        ),
        if (isCompleted)
          alreadyRated
              ? const Chip(label: Text('Rated ✓'))
              : OutlinedButton.icon(
                  onPressed: onRate,
                  icon: const Icon(Icons.star_border, size: 18),
                  label: const Text('Rate owner'),
                ),
      ],
    );
  }
}
