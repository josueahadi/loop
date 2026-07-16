import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';

/// Single source of truth for the map basemap across every map surface (Nearby,
/// create-job, navigation). Defaults to CartoDB Positron — a muted, OSM-based
/// raster style for an Uber-like abstracted look — and stays keyless and
/// swappable via --dart-define. Raster only: no vector tiles, no SDK, no Google.
class Basemap {
  static const String tileUrl = String.fromEnvironment(
    'BASEMAP_TILE_URL',
    defaultValue:
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  );

  static const String attribution = String.fromEnvironment(
    'BASEMAP_ATTRIBUTION',
    defaultValue: '© OpenStreetMap contributors, © CARTO',
  );

  static const List<String> subdomains = ['a', 'b', 'c', 'd'];

  /// The one TileLayer every map builds from, so the basemap never drifts between
  /// screens. `{r}` resolves to "@2x" on high-DPI devices for retina tiles.
  static TileLayer tileLayer(BuildContext context) => TileLayer(
    urlTemplate: tileUrl,
    subdomains: subdomains,
    retinaMode: RetinaMode.isHighDensity(context),
    userAgentPackageName: 'rw.loop.app',
  );
}
