import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';

/// Stacked zoom in/out buttons for any flutter_map. Small white FABs, sized for a
/// thumb tap; drop into a Stack over the map. Keeps the map centre fixed and only
/// changes the zoom level, so it never fights a follow-me camera.
class MapZoomControls extends StatelessWidget {
  final MapController controller;
  final String heroPrefix;

  const MapZoomControls({
    super.key,
    required this.controller,
    this.heroPrefix = 'map',
  });

  void _zoomBy(double delta) {
    final cam = controller.camera;
    controller.move(cam.center, (cam.zoom + delta).clamp(3.0, 19.0));
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _button('${heroPrefix}_zoom_in', 'Zoom in', Icons.add, () => _zoomBy(1)),
        const SizedBox(height: 10),
        _button(
          '${heroPrefix}_zoom_out',
          'Zoom out',
          Icons.remove,
          () => _zoomBy(-1),
        ),
      ],
    );
  }

  Widget _button(String tag, String tooltip, IconData icon, VoidCallback onTap) {
    return FloatingActionButton.small(
      heroTag: tag,
      tooltip: tooltip,
      backgroundColor: Colors.white,
      foregroundColor: Colors.black87,
      onPressed: onTap,
      child: Icon(icon),
    );
  }
}
