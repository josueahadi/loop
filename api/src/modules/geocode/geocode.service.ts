import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeocodeResultDto, ReverseResultDto } from './dto/geocode.dto';

// Thin OSM proxy: search via Photon, reverse via Nominatim. Kept server-side so
// the provider is swappable and OSM's usage policy (custom User-Agent, ~1 req/s,
// attribution) is honoured in one place. Only { label, lat, lng } is exposed —
// raw provider payloads never leak to clients. Results are OSM-licensed
// ("© OpenStreetMap contributors").
@Injectable()
export class GeocodeService {
  private readonly logger = new Logger('Geocode');

  constructor(private readonly config: ConfigService) {}

  private get ua(): string {
    return this.config.get<string>('geocode.userAgent')!;
  }

  private async fetchJson(url: string): Promise<any> {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': this.ua, Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`provider responded ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      this.logger.error(`Geocode provider call failed: ${url}`, err as Error);
      throw new ServiceUnavailableException('Geocoding is temporarily unavailable');
    }
  }

  async search(q: string, limit = 5): Promise<GeocodeResultDto[]> {
    const base = this.config.get<string>('geocode.searchUrl')!;
    const lat = this.config.get<number>('geocode.biasLat')!;
    const lng = this.config.get<number>('geocode.biasLng')!;
    const bbox = this.config.get<string>('geocode.bbox')!;
    const params = new URLSearchParams({
      q,
      limit: String(limit),
      lat: String(lat),
      lon: String(lng),
      bbox,
      lang: 'en',
    });
    const data = await this.fetchJson(`${base}?${params.toString()}`);
    const features: any[] = Array.isArray(data?.features) ? data.features : [];
    return features
      .map((f) => this.mapPhotonFeature(f))
      .filter((r): r is GeocodeResultDto => r != null);
  }

  async reverse(lat: number, lng: number): Promise<ReverseResultDto> {
    const base = this.config.get<string>('geocode.reverseUrl')!;
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'jsonv2',
    });
    const data = await this.fetchJson(`${base}?${params.toString()}`);
    const label =
      (typeof data?.display_name === 'string' && data.display_name) || null;
    return { label };
  }

  // Photon GeoJSON feature → { label, lat, lng }.
  private mapPhotonFeature(f: any): GeocodeResultDto | null {
    const coords = f?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const p = f.properties ?? {};
    const primary =
      p.name ??
      [p.street, p.housenumber].filter(Boolean).join(' ') ??
      p.suburb ??
      p.city;
    const label = [primary, p.suburb ?? p.district, p.city, p.state]
      .filter((x: unknown, i: number, arr: unknown[]) => x && arr.indexOf(x) === i)
      .join(', ');
    if (!label) return null;
    return { label, lat: Number(coords[1]), lng: Number(coords[0]) };
  }
}
