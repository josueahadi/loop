import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import 'package:map_launcher/map_launcher.dart';
import 'package:url_launcher/url_launcher.dart';

/// Navigation hand-off: opens directions to [destination] in the user's own maps
/// app (Google/Apple Maps, Waze, …) via a deep link. This is NOT in-app routing —
/// no Maps SDK, no API key. Reused by the owner job detail (M3.5) and the driver's
/// job detail after acceptance (M4).
class OpenInMaps {
  static Future<void> directions(
    BuildContext context,
    LatLng destination, {
    String? label,
  }) async {
    final coords = Coords(destination.latitude, destination.longitude);
    final title = label ?? 'Destination';

    List<AvailableMap> maps = [];
    try {
      maps = await MapLauncher.installedMaps;
    } catch (_) {
      maps = [];
    }

    if (maps.isEmpty) {
      await _fallback(context, destination);
      return;
    }
    if (maps.length == 1) {
      await maps.first.showDirections(destination: coords, destinationTitle: title);
      return;
    }
    if (!context.mounted) return;
    await showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('Open directions in',
                  style: TextStyle(fontWeight: FontWeight.bold)),
            ),
            ...maps.map((m) => ListTile(
                  leading: const Icon(Icons.map_outlined),
                  title: Text(m.mapName),
                  onTap: () {
                    Navigator.pop(ctx);
                    m.showDirections(destination: coords, destinationTitle: title);
                  },
                )),
          ],
        ),
      ),
    );
  }

  // Universal Google Maps directions URL (opens the app if installed, else browser);
  // works on both Android and iOS.
  static Future<void> _fallback(BuildContext context, LatLng d) async {
    final uri = Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=${d.latitude},${d.longitude}',
    );
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No maps app available')),
        );
      }
    }
  }
}
