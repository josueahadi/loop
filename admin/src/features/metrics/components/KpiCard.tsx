import { Card } from '@/components/ui';

// A single KPI: headline value + the underlying n/denominator, always shown so a
// small sample is visible (e.g. "1 / 19 drivers") rather than hidden behind a
// smoothed percentage.
export function KpiCard({
  label,
  value,
  detail,
  hint,
}: {
  label: string;
  value: string;
  detail?: string;
  hint?: string;
}) {
  const noData = value === 'No data yet';
  return (
    <Card className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-black/45">
        {label}
      </p>
      <p
        className={
          noData
            ? 'text-lg font-medium text-black/40'
            : 'text-3xl font-semibold tabular-nums'
        }
      >
        {value}
      </p>
      {detail && <p className="text-sm text-black/55 tabular-nums">{detail}</p>}
      {hint && <p className="text-xs text-black/40">{hint}</p>}
    </Card>
  );
}
