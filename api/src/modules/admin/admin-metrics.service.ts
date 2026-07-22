import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { AppConfig } from '../../config/configuration';

// Rate over a denominator; null when there's nothing to divide (honest empty state,
// distinct from a real 0%). The dashboard renders null as "No data yet".
const rate = (num: number, den: number): number | null =>
  den > 0 ? num / den : null;
const round = (x: number | null): number | null =>
  x == null ? null : Math.round(x);
const round1 = (x: number | null): number | null =>
  x == null ? null : Math.round(x * 10) / 10;

// All evaluation metrics are computed HERE (server-side) so the dashboard only
// renders — one source of truth, the same numbers that feed the results chapter.
// Every metric carries its n / totals so small-n is visible (never smoothed/hidden).
@Injectable()
export class AdminMetricsService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async getMetrics() {
    const [ttm] = await this.ds.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (matched_at - posted_at)))::float AS avg,
              PERCENTILE_CONT(0.5) WITHIN GROUP
                (ORDER BY EXTRACT(EPOCH FROM (matched_at - posted_at)))::float AS median,
              COUNT(*)::int AS n
       FROM jobs WHERE matched_at IS NOT NULL AND posted_at IS NOT NULL`,
    );

    const [est] = await this.ds.query(
      `SELECT COUNT(*) FILTER (WHERE price = estimated_price)::int AS accepted,
              COUNT(*)::int AS total
       FROM jobs WHERE estimated_price IS NOT NULL`,
    );

    const [coord] = await this.ds.query(
      `SELECT COUNT(*) FILTER
                (WHERE EXISTS (SELECT 1 FROM messages m WHERE m.job_id = j.id))::int
                AS with_messages,
              COUNT(*)::int AS total
       FROM jobs j WHERE j.matched_at IS NOT NULL`,
    );

    const [vc] = await this.ds.query(
      `SELECT (SELECT COUNT(*) FROM users WHERE role = 'driver')::int AS total,
              (SELECT COUNT(*) FROM (
                 SELECT driver_id FROM verification_records
                 WHERE status = 'approved'
                 GROUP BY driver_id HAVING COUNT(DISTINCT document_type) = 3
               ) a)::int AS approved`,
    );

    const [mr] = await this.ds.query(
      `SELECT COUNT(*) FILTER (WHERE matched_at IS NOT NULL)::int AS matched,
              COUNT(*)::int AS total
       FROM jobs WHERE posted_at IS NOT NULL`,
    );

    const radiusMeters =
      (this.config.get('matching.defaultRadiusKm', { infer: true }) ?? 10) *
      1000;
    const [avail] = await this.ds.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM users u
                WHERE u.role = 'driver'
                  AND u.availability_status = 'online'
                  AND u.location IS NOT NULL
                  AND ST_DWithin(u.location, j.pickup_location, $1)
                  AND u.id IN (
                    SELECT driver_id FROM verification_records
                    WHERE status = 'approved'
                    GROUP BY driver_id
                    HAVING COUNT(DISTINCT document_type) = 3
                  )
              ))::int AS with_driver
       FROM jobs j
       WHERE j.posted_at IS NOT NULL AND j.pickup_location IS NOT NULL`,
      [radiusMeters],
    );

    const usersByRole = await this.ds.query(
      `SELECT role, COUNT(*)::int AS count FROM users GROUP BY role`,
    );
    const jobsByStatus = await this.ds.query(
      `SELECT status, COUNT(*)::int AS count FROM jobs GROUP BY status`,
    );
    const [prop] = await this.ds.query(
      `SELECT COUNT(*)::int AS sent,
              COUNT(*) FILTER (WHERE status = 'accepted')::int AS accepted
       FROM proposals`,
    );
    const [rat] = await this.ds.query(
      `SELECT COUNT(*)::int AS count, AVG(score)::float AS avg FROM ratings`,
    );
    const [pv] = await this.ds.query(
      `SELECT COUNT(*)::int AS n FROM verification_records WHERE status = 'pending'`,
    );

    const toMap = (rows: Array<{ [k: string]: any }>, key: string) =>
      Object.fromEntries(rows.map((r) => [r[key], r.count]));

    return {
      time_to_match: {
        avg_seconds: round(ttm.avg),
        median_seconds: round(ttm.median),
        n: ttm.n,
      },
      estimate_acceptance_rate: {
        rate: rate(est.accepted, est.total),
        accepted_unchanged: est.accepted,
        total: est.total,
      },
      in_app_coordination_rate: {
        rate: rate(coord.with_messages, coord.total),
        with_messages: coord.with_messages,
        total_matched: coord.total,
      },
      verification_completion: {
        rate: rate(vc.approved, vc.total),
        approved_drivers: vc.approved,
        total_drivers: vc.total,
      },
      match_rate: {
        rate: rate(mr.matched, mr.total),
        matched: mr.matched,
        total_posted: mr.total,
      },
      driver_availability: {
        rate: rate(avail.with_driver, avail.total),
        with_driver: avail.with_driver,
        total_posted: avail.total,
        radius_km: radiusMeters / 1000,
      },
      operational_counts: {
        users_by_role: toMap(usersByRole, 'role'),
        jobs_by_status: toMap(jobsByStatus, 'status'),
        proposals: {
          sent: prop.sent,
          accepted: prop.accepted,
          acceptance_rate: rate(prop.accepted, prop.sent),
        },
        ratings: { count: rat.count, overall_average: round1(rat.avg) },
        pending_verifications: pv.n,
      },
    };
  }
}
