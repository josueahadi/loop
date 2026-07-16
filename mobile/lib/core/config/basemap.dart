import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';

/// A selectable map style. Both are keyless, OSM-based CartoDB raster basemaps —
/// no vector tiles, no SDK, no Google, no API key. "Simple" is the muted
/// Uber-like look; "Detailed" shows streets, labels, and POIs in colour, closer
/// to a Google-Maps feel.
enum BasemapStyle {
  // Positron lives at the root path; Voyager is under rastertiles/ — CARTO uses
  // different path prefixes per style, so the full path segment is stored here.
  simple('Simple', 'light_all'),
  detailed('Detailed', 'rastertiles/voyager');

  const BasemapStyle(this.label, this._cartoPath);

  final String label;
  final String _cartoPath;

  String get tileUrl =>
      'https://{s}.basemaps.cartocdn.com/$_cartoPath/{z}/{x}/{y}{r}.png';
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
  /// high-DPI devices for retina tiles. The ValueKey ties the layer's identity to
  /// the style so switching styles rebuilds it fresh — without it, flutter_map
  /// keeps the previous provider's tiles until the map is next moved.
  static TileLayer tileLayer(BuildContext context, [BasemapStyle? style]) {
    final s = style ?? defaultStyle;
    return TileLayer(
      key: ValueKey(s),
      urlTemplate: s.tileUrl,
      subdomains: subdomains,
      retinaMode: RetinaMode.isHighDensity(context),
      userAgentPackageName: 'rw.loop.app',
    );
  }
}
