import 'package:flutter/material.dart';

import '../../constants.dart';

/// The "Enable your location" priming sheet (design 04), shown BEFORE the OS
/// permission prompt so the ask has context. Returns true if the user chose
/// "Use my location", false if they skipped. Reused by the driver go-online flow
/// and the owner Nearby map with role-appropriate [message] copy.
class EnableLocationPrompt {
  static Future<bool> show(
    BuildContext context, {
    required String message,
  }) async {
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 28, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 96,
              height: 96,
              decoration: const BoxDecoration(
                color: lightGreen,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.location_on,
                size: 44,
                color: primaryGreen,
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Enable your location',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: textGray, fontSize: 14),
            ),
            const SizedBox(height: 28),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryGreen,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Use my location'),
              ),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text(
                'Skip for now',
                style: TextStyle(color: textGray),
              ),
            ),
          ],
        ),
      ),
    );
    return result ?? false;
  }
}
