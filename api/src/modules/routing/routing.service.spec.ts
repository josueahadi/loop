import { DistanceSource } from './dto/routing.dto';
import { RoutingService } from './routing.service';

// Unit tests for the OSRM routing proxy: the success parse, the great-circle
// fallback when OSRM fails, and the server-side instruction composition (so every
// client phrases a maneuver identically). The outbound fetch is mocked — no real
// network — and the PostGIS great-circle query is stubbed on the DataSource.
describe('RoutingService', () => {
  const FROM = { lat: -1.9403, lng: 30.1127 };
  const TO = { lat: -1.9397, lng: 30.0403 };

  const config = {
    get: jest.fn((k: string) => {
      if (k === 'routing.baseUrl') return 'https://osrm.test';
      if (k === 'routing.userAgent') return 'LoopTest/1.0';
      if (k === 'routing.timeoutMs') return 6000;
      return undefined;
    }),
  };

  // DataSource used only by the great-circle fallback (ST_Distance → meters).
  function dataSourceReturning(meters: number) {
    return { query: jest.fn(() => Promise.resolve([{ meters }])) };
  }

  function service(ds = dataSourceReturning(8060)) {
    return new RoutingService(config as never, ds as never);
  }

  // Minimal OSRM /route payload with two steps + arrive.
  function osrmOk() {
    return {
      code: 'Ok',
      routes: [
        {
          distance: 14968.4, // metres
          duration: 1049, // seconds
          geometry: 'abcd_encoded_polyline',
          legs: [
            {
              steps: [
                {
                  name: 'KG 11 Ave',
                  distance: 830.3,
                  duration: 75.5,
                  maneuver: {
                    type: 'depart',
                    modifier: 'right',
                    location: [30.1119, -1.9399],
                  },
                },
                {
                  name: '', // a real Kigali case: an unnamed street
                  distance: 234.9,
                  duration: 15.4,
                  maneuver: {
                    type: 'turn',
                    modifier: 'left',
                    location: [30.0975, -1.9263],
                  },
                },
                {
                  name: '',
                  distance: 0,
                  duration: 0,
                  maneuver: {
                    type: 'arrive',
                    modifier: 'right',
                    location: [30.0403, -1.9397],
                  },
                },
              ],
            },
          ],
        },
      ],
    };
  }

  function mockFetch(response: unknown, ok = true) {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok,
        status: ok ? 200 : 500,
        json: () => Promise.resolve(response),
      }),
    ) as unknown as typeof fetch;
  }

  afterEach(() => jest.restoreAllMocks());

  describe('OSRM success path', () => {
    it('parses distance (km), duration (min), polyline, and source', async () => {
      mockFetch(osrmOk());
      const r = await service().route(FROM, TO, false);
      expect(r.distance_source).toBe(DistanceSource.OSRM);
      expect(r.distance_km).toBeCloseTo(14.97, 2);
      expect(r.duration_min).toBeCloseTo(17.5, 1);
      expect(r.polyline).toBe('abcd_encoded_polyline');
    });

    it('returns ordered, server-composed instructions when steps=true', async () => {
      mockFetch(osrmOk());
      const r = await service().route(FROM, TO, true);
      const texts = (r.instructions ?? []).map((i) => i.text);
      expect(texts).toEqual([
        'Head out on KG 11 Ave',
        'Turn left', // unnamed street → no dangling "onto"
        'You have arrived — destination on your right',
      ]);
      // First step carries its metrics and maneuver point (lat from [lng,lat]).
      expect(r.instructions![0].distance_m).toBeCloseTo(830.3, 1);
      expect(r.instructions![0].lat).toBeCloseTo(-1.9399, 3);
    });

    it('omits instructions when steps=false', async () => {
      mockFetch(osrmOk());
      const r = await service().route(FROM, TO, false);
      expect(r.instructions).toBeUndefined();
    });
  });

  describe('great-circle fallback', () => {
    it('falls back when OSRM responds non-ok', async () => {
      mockFetch({}, false);
      const r = await service(dataSourceReturning(8060)).route(FROM, TO, true);
      expect(r.distance_source).toBe(DistanceSource.GREAT_CIRCLE);
      expect(r.distance_km).toBeCloseTo(8.06, 2); // 8060 m
      expect(r.duration_min).toBeNull(); // no time term on the fallback
      expect(r.polyline).toBeNull();
      expect(r.instructions).toBeUndefined();
    });

    it('falls back when OSRM returns a non-Ok code', async () => {
      mockFetch({ code: 'NoRoute', routes: [] });
      const r = await service(dataSourceReturning(1234)).route(FROM, TO, false);
      expect(r.distance_source).toBe(DistanceSource.GREAT_CIRCLE);
      expect(r.duration_min).toBeNull();
    });

    it('falls back when the fetch throws (network error / timeout)', async () => {
      global.fetch = jest.fn(() =>
        Promise.reject(new Error('timeout')),
      ) as unknown as typeof fetch;
      const r = await service(dataSourceReturning(500)).route(FROM, TO, false);
      expect(r.distance_source).toBe(DistanceSource.GREAT_CIRCLE);
      expect(r.distance_km).toBeCloseTo(0.5, 2);
    });
  });
});
