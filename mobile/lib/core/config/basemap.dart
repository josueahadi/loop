import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';

/// A selectable map style. Both are keyless, OSM-based CartoDB raster basemaps —
/// no vector tiles, no SDK, no Google, no API key. "Simple" is the muted
/// Uber-like look; "Detailed" shows streets, labels, and POIs in colour, closer
/// to a Google-Maps feel.
enum BasemapStyle {
  simple('Simple', 'light_all'),
  detailed('Detailed', 'voyager');

  const BasemapStyle(this.label, this._cartoStyle);

  final String label;
  final String _cartoStyle;

  String get tileUrl =>
      'https://{s}.basemaps.cartocdn.com/$_cartoStyle/{z}/{x}/{y}{r}.png';
}

/// Single source of truth for the map basemap across every map surface. Defaults
/// to the muted "Simple" style; the user can switch to "Detailed" at runtime.
class Basemap {
  static const BasemapStyle defaultStyle = BasemapStyle.simple;

  static const String attribution = String.fromEnvironment(
    'BASEMAP_ATTRIBUTION',
    defaultValue: '© OpenStreetMap contributors, © CARTO',
  );

  static const List<String> subdomains = ['a', 'b', 'c', 'd'];

  /// The one TileLayer every map builds from. `{r}` resolves to "@2x" on
  /// high-DPI devices for retina tiles.
  static TileLayer tileLayer(BuildContext context, [BasemapStyle? style]) =>
      TileLayer(
        urlTemplate: (style ?? defaultStyle).tileUrl,
        subdomains: subdomains,
        retinaMode: RetinaMode.isHighDensity(context),
        userAgentPackageName: 'rw.loop.app',
      );
}
