// Exact shape of GET /admin/metrics. Every rate can be null (honest empty state:
// "no data yet", distinct from a real 0). The dashboard renders these verbatim —
// it performs NO arithmetic of its own.
export interface Metrics {
  time_to_match: {
    avg_seconds: number | null;
    median_seconds: number | null;
    n: number;
  };
  estimate_acceptance_rate: {
    rate: number | null;
    accepted_unchanged: number;
    total: number;
  };
  in_app_coordination_rate: {
    rate: number | null;
    with_messages: number;
    total_matched: number;
  };
  verification_completion: {
    rate: number | null;
    approved_drivers: number;
    total_drivers: number;
  };
  match_rate: {
    rate: number | null;
    matched: number;
    total_posted: number;
  };
  driver_availability: {
    rate: number | null;
    with_driver: number;
    total_posted: number;
    radius_km: number;
  };
  operational_counts: {
    users_by_role: Record<string, number>;
    jobs_by_status: Record<string, number>;
    proposals: {
      sent: number;
      accepted: number;
      acceptance_rate: number | null;
    };
    ratings: { count: number; overall_average: number | null };
    pending_verifications: number;
  };
}
