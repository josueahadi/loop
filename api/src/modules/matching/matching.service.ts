import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NearbyDriverDto } from './dto/nearby-driver.dto';
import { NearbyQueryDto } from './dto/nearby-query.dto';

// Geo-matching lives in PostGIS. A driver appears only when:
//   role=driver AND availability=online AND has a stored location
//   AND fully verification-approved (all 3 required docs approved)
//   AND owns a vehicle (of the requested type, if a filter is given)
//   AND is within the search radius.
// Results are ordered by straight-line (great-circle) distance.
@Injectable()
export class MatchingService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async findNearbyDrivers(query: NearbyQueryDto): Promise<NearbyDriverDto[]> {
    const radiusKm =
      query.radius ?? this.config.get<number>('matching.defaultRadiusKm') ?? 10;
    const radiusMeters = radiusKm * 1000;
    const vehicleType = query.vehicle_type ?? null;

    const rows = await this.dataSource.query(
      `
      WITH ref AS (
        SELECT ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography AS g
      )
      SELECT
        u.id,
        u.name,
        u.average_rating AS "averageRating",
        ST_Y(u.location::geometry) AS lat,
        ST_X(u.location::geometry) AS lng,
        ST_Distance(u.location, ref.g) AS "distanceM",
        json_agg(
          json_build_object(
            'id', v.id,
            'type', v.type,
            'capacityKg', v.capacity_kg,
            'regNo', v.reg_no,
            'photoUrl', v.photo_url
          )
        ) AS vehicles
      FROM users u
      CROSS JOIN ref
      JOIN vehicles v
        ON v.driver_id = u.id
       AND ($3::vehicle_type IS NULL OR v.type = $3::vehicle_type)
      WHERE u.role = 'driver'
        AND u.availability_status = 'online'
        AND u.location IS NOT NULL
        AND ST_DWithin(u.location, ref.g, $4)
        AND u.id IN (
          SELECT driver_id
          FROM verification_records
          WHERE status = 'approved'
          GROUP BY driver_id
          HAVING COUNT(DISTINCT document_type) = 3
        )
      GROUP BY u.id, ref.g
      ORDER BY "distanceM" ASC
      `,
      [query.lat, query.lng, vehicleType, radiusMeters],
    );

    return rows.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      name: r.name as string,
      averageRating: Number(r.averageRating),
      lat: Number(r.lat),
      lng: Number(r.lng),
      distanceM: Math.round(Number(r.distanceM)),
      vehicles: (r.vehicles as Array<Record<string, unknown>>).map((v) => ({
        id: v.id as string,
        type: v.type as NearbyDriverDto['vehicles'][number]['type'],
        capacityKg: v.capacityKg != null ? Number(v.capacityKg) : null,
        regNo: v.regNo as string,
        photoUrl: (v.photoUrl as string) ?? null,
      })),
    }));
  }
}
