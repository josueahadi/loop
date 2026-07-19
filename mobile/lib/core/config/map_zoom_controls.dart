import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';

import 'basemap.dart';

/// Stacked map controls for any flutter_map: zoom in/out, plus an optional
/// Simple↔Detailed basemap style toggle. Small white FABs, sized for a thumb tap;
/// drop into a Stack over the map. Zooming keeps the map centre fixed, so it
/// never fights a follow-me camera.
///
/// Pass [style] + [onToggleStyle] to show the style toggle (keyless CartoDB
/// Simple/Detailed — no satellite, which would need a keyed provider).
class MapZoomControls extends StatelessWidget {
  final MapController controller;
  final String heroPrefix;
  final BasemapStyle? style;
  final ValueChanged<BasemapStyle>? onToggleStyle;

  const MapZoomControls({
    super.key,
    required this.controller,
    this.heroPrefix = 'map',
    this.style,
    this.onToggleStyle,
  });

  void _zoomBy(double delta) {
    final cam = controller.camera;
    controller.move(cam.center, (cam.zoom + delta).clamp(3.0, 19.0));
  }

  @override
  Widget build(BuildContext context) {
    final showStyle = style != null && onToggleStyle != null;
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
        if (showStyle) ...[
          const SizedBox(height: 10),
          _button(
            '${heroPrefix}_style',
            style == BasemapStyle.simple ? 'Detailed map' : 'Simple map',
            Icons.layers,
            () => onToggleStyle!(
              style == BasemapStyle.simple
                  ? BasemapStyle.detailed
                  : BasemapStyle.simple,
            ),
          ),
        ],
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
