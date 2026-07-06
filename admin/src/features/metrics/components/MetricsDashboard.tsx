'use client';

import Link from 'next/link';
import {
  ClipboardCheck,
  Clock3,
  MessageSquareText,
  Percent,
  Star,
  Target,
  Users,
} from 'lucide-react';
import { useMetrics } from '../hooks/useMetrics';
import { CountsChart } from './CountsChart';
import { formatDuration, formatNumber, formatRate } from './format';
import { KpiCard } from './KpiCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/states';

export function MetricsDashboard() {
  const { data: m, isLoading, isError, refetch } = useMetrics();

  if (isLoading) return <Spinner label="Computing metrics…" />;
  if (isError || !m) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-destructive">Could not load metrics.</p>
        <Button variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const oc = m.operational_counts;

  return (
    <div className="flex flex-col gap-8">
      <Card className="bg-muted/30">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <CardTitle>Operational health</CardTitle>
              <CardDescription>
                Server-computed MVP metrics for matching, trust, and
                coordination.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Link
              href="/verifications"
              className="flex flex-col gap-1 rounded-lg border bg-background p-4 transition-colors hover:border-primary/50"
            >
              <span className="text-xs text-muted-foreground">
                Pending review
              </span>
              <span className="text-2xl font-semibold tabular-nums">
                {formatNumber(oc.pending_verifications)}
              </span>
            </Link>
            <div className="flex flex-col gap-1 rounded-lg border bg-background p-4">
              <span className="text-xs text-muted-foreground">
                Active signal
              </span>
              <span className="text-2xl font-semibold tabular-nums">
                {formatRate(m.match_rate.rate)}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border bg-background p-4">
              <span className="text-xs text-muted-foreground">
                Data quality
              </span>
              <span className="text-2xl font-semibold">
                {m.time_to_match.n > 0 ? 'Live' : 'Collecting'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Core evaluation KPIs — each shows its underlying n / denominator. */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Time to match (median)"
          value={formatDuration(m.time_to_match.median_seconds)}
          detail={
            m.time_to_match.n > 0
              ? `avg ${formatDuration(m.time_to_match.avg_seconds)} · n=${m.time_to_match.n}`
              : undefined
          }
          hint="From posted to matched"
          icon={Clock3}
          badge={`n=${m.time_to_match.n}`}
        />
        <KpiCard
          label="Estimate accepted unchanged"
          value={formatRate(m.estimate_acceptance_rate.rate)}
          detail={`${m.estimate_acceptance_rate.accepted_unchanged} / ${m.estimate_acceptance_rate.total} jobs`}
          hint="Posted price == suggested estimate"
          icon={Target}
        />
        <KpiCard
          label="In-app coordination"
          value={formatRate(m.in_app_coordination_rate.rate)}
          detail={`${m.in_app_coordination_rate.with_messages} / ${m.in_app_coordination_rate.total_matched} matched jobs`}
          hint="Matched jobs with ≥1 message"
          icon={MessageSquareText}
        />
        <KpiCard
          label="Verification completion"
          value={formatRate(m.verification_completion.rate)}
          detail={`${m.verification_completion.approved_drivers} / ${m.verification_completion.total_drivers} drivers`}
          hint="All 3 documents approved"
          icon={ClipboardCheck}
          href="/drivers"
        />
        <KpiCard
          label="Match rate (proxy)"
          value={formatRate(m.match_rate.rate)}
          detail={`${m.match_rate.matched} / ${m.match_rate.total_posted} posted jobs`}
          hint="Proxy — not true driver availability"
          icon={Percent}
        />
        <KpiCard
          label="Proposal acceptance"
          value={formatRate(oc.proposals.acceptance_rate)}
          detail={`${oc.proposals.accepted} / ${oc.proposals.sent} proposals`}
          hint="Accepted of sent"
          icon={Users}
          href="/jobs"
        />
      </section>

      {/* Operational breakdowns — rendered straight from the server's count maps. */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CountsChart
          title="Users by role"
          data={oc.users_by_role}
          href="/users"
        />
        <CountsChart
          title="Jobs by status"
          data={oc.jobs_by_status}
          href="/jobs"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Ratings collected"
          value={formatNumber(oc.ratings.count)}
          detail={
            oc.ratings.overall_average != null
              ? `avg ${oc.ratings.overall_average} / 5`
              : undefined
          }
          icon={Star}
        />
        <KpiCard
          label="Pending verifications"
          value={formatNumber(oc.pending_verifications)}
          icon={ClipboardCheck}
          href="/verifications"
        />
        <KpiCard
          label="Proposals sent"
          value={formatNumber(oc.proposals.sent)}
          icon={MessageSquareText}
        />
        <KpiCard
          label="Proposals accepted"
          value={formatNumber(oc.proposals.accepted)}
          icon={Target}
        />
      </section>

      {/* Survey-only metrics: collected off-platform. Shown as pending, never
          fabricated with a number. */}
      <section>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm font-medium">
                Survey metrics
              </CardTitle>
              <Badge variant="secondary">Off-platform</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                {m.survey_metrics.note}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs tracking-wide text-muted-foreground uppercase">
                    Trust perception change
                  </p>
                  <p className="text-lg font-medium text-muted-foreground">
                    {m.survey_metrics.trust_perception_change ??
                      'Awaiting survey'}
                  </p>
                </div>
                <div>
                  <p className="text-xs tracking-wide text-muted-foreground uppercase">
                    Empty-trip change
                  </p>
                  <p className="text-lg font-medium text-muted-foreground">
                    {m.survey_metrics.empty_trip_change ?? 'Awaiting survey'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
