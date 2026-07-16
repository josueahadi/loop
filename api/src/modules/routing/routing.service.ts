import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PricingService } from '../pricing/pricing.service';
import {
  DistanceSource,
  RouteInstructionDto,
  RouteResponseDto,
} from './dto/routing.dto';

type LatLng = { lat: number; lng: number };

// The subset of the OSRM `route` service response we actually read. Kept local
// so the raw provider shape stays contained in this module.
interface OsrmManeuver {
  type?: string;
  modifier?: string;
  exit?: number;
  location?: [number, number]; // [lng, lat]
}
interface OsrmStep {
  name?: string;
  distance?: number;
  duration?: number;
  maneuver?: OsrmManeuver;
}
interface OsrmRoute {
  distance: number;
  duration: number;
  geometry?: string;
  legs?: { steps?: OsrmStep[] }[];
}
interface OsrmResponse {
  code?: string;
  routes?: OsrmRoute[];
}

// Thin OSRM proxy, mirroring the geocode proxy: kept server-side so the provider
// is swappable (base URL is config → self-hosted Rwanda extract later), the
// User-Agent courtesy is applied in one place, and raw OSRM payloads never reach
// clients. Instruction text is composed here so every client phrases a maneuver
// identically. On any OSRM failure this falls back to the PostGIS great-circle
// distance (duration null, distance_source flagged) so pricing never blocks.
@Injectable()
export class RoutingService {
  private readonly logger = new Logger('Routing');

  constructor(
    private readonly config: ConfigService,
    private readonly pricing: PricingService,
  ) {}

  async route(
    from: LatLng,
    to: LatLng,
    steps: boolean,
  ): Promise<RouteResponseDto> {
    try {
      return await this.fetchOsrmRoute(from, to, steps);
    } catch (err) {
      this.logger.warn(
        `OSRM unavailable, falling back to great-circle: ${(err as Error).message}`,
      );
      return this.greatCircleFallback(from, to);
    }
  }

  private async fetchOsrmRoute(
    from: LatLng,
    to: LatLng,
    steps: boolean,
  ): Promise<RouteResponseDto> {
    const base = this.config.get<string>('routing.baseUrl')!;
    const ua = this.config.get<string>('routing.userAgent')!;
    const timeoutMs = this.config.get<number>('routing.timeoutMs')!;

    // OSRM wants lng,lat order in the path.
    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const params = new URLSearchParams({
      overview: 'full',
      geometries: 'polyline',
      steps: steps ? 'true' : 'false',
      annotations: 'false',
    });
    const url = `${base}/route/v1/driving/${coords}?${params.toString()}`;

    const res = await fetch(url, {
      headers: { 'User-Agent': ua, Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`provider responded ${res.status}`);
    }
    const data = (await res.json()) as OsrmResponse;
    if (data?.code !== 'Ok' || !data.routes?.[0]) {
      throw new Error(`provider returned code ${data?.code ?? 'unknown'}`);
    }

    const route = data.routes[0];
    const response: RouteResponseDto = {
      distance_km: this.round(route.distance / 1000, 2),
      duration_min: this.round(route.duration / 60, 1),
      polyline: typeof route.geometry === 'string' ? route.geometry : null,
      distance_source: DistanceSource.OSRM,
    };

    if (steps) {
      const osrmSteps: OsrmStep[] =
        route.legs?.flatMap((l) => l.steps ?? []) ?? [];
      response.instructions = osrmSteps.map((s) => this.mapStep(s));
    }
    return response;
  }

  private async greatCircleFallback(
    from: LatLng,
    to: LatLng,
  ): Promise<RouteResponseDto> {
    const distanceKm = await this.pricing.distanceKm(from, to);
    return {
      distance_km: this.round(distanceKm, 2),
      duration_min: null,
      polyline: null,
      distance_source: DistanceSource.GREAT_CIRCLE,
    };
  }

  // One OSRM step → our instruction DTO, with human-readable text composed here.
  private mapStep(step: OsrmStep): RouteInstructionDto {
    const m = step.maneuver ?? {};
    const street: string | null = step.name ? String(step.name) : null;
    const type: string = m.type ?? 'continue';
    const modifier: string | null = m.modifier ? String(m.modifier) : null;
    // OSRM location is [lng, lat].
    const loc: [number, number] = m.location ?? [0, 0];

    return {
      text: this.composeInstruction(type, modifier, street, m.exit),
      maneuver_type: type,
      modifier,
      street,
      distance_m: this.round(step.distance ?? 0, 1),
      duration_s: this.round(step.duration ?? 0, 1),
      lat: Number(loc[1]),
      lng: Number(loc[0]),
    };
  }

  // Compose a consistent English instruction from OSRM's maneuver primitives.
  // OSRM leaves the phrasing to the client; we centralise it so all clients match.
  private composeInstruction(
    type: string,
    modifier: string | null,
    street: string | null,
    exit?: number,
  ): string {
    const onto = street ? ` onto ${street}` : '';
    const dir = modifier ? this.humanModifier(modifier) : null;

    switch (type) {
      case 'depart':
        return street ? `Head out on ${street}` : 'Start driving';
      case 'arrive':
        return modifier === 'left'
          ? 'You have arrived — destination on your left'
          : modifier === 'right'
            ? 'You have arrived — destination on your right'
            : 'You have arrived at your destination';
      case 'turn':
        return dir ? `Turn ${dir}${onto}` : `Continue${onto}`;
      case 'end of road':
        return dir
          ? `At the end of the road, turn ${dir}${onto}`
          : `Continue${onto}`;
      case 'fork':
        return dir ? `Keep ${dir}${onto}` : `Keep going${onto}`;
      case 'merge':
        return dir ? `Merge ${dir}${onto}` : `Merge${onto}`;
      case 'on ramp':
        return `Take the ramp${onto}`;
      case 'off ramp':
        return dir ? `Take the exit ${dir}${onto}` : `Take the exit${onto}`;
      case 'roundabout':
      case 'rotary': {
        const nth = exit ? this.ordinal(exit) : null;
        return nth
          ? `At the roundabout, take the ${nth} exit${onto}`
          : `At the roundabout, continue${onto}`;
      }
      case 'new name':
        return street ? `Continue onto ${street}` : 'Continue straight';
      case 'continue':
        return dir ? `Continue ${dir}${onto}` : `Continue${onto}`;
      default:
        return dir ? `${this.capitalise(dir)}${onto}` : `Continue${onto}`;
    }
  }

  // "slight left" reads fine as-is; keep OSRM's phrasing for the modifier.
  private humanModifier(modifier: string): string {
    return modifier; // e.g. "left", "slight right", "sharp left"
  }

  private ordinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
  }

  private capitalise(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private round(n: number, dp: number): number {
    const f = 10 ** dp;
    return Math.round(n * f) / f;
  }
}
