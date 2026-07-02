import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// A single KPI: headline value + the underlying n/denominator, always shown so a
// small sample is visible (e.g. "1 / 20 drivers") rather than hidden behind a
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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p
          className={
            noData
              ? 'text-lg font-medium text-muted-foreground'
              : 'text-3xl font-semibold tabular-nums'
          }
        >
          {value}
        </p>
        {detail && (
          <p className="text-sm text-muted-foreground tabular-nums">{detail}</p>
        )}
        {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}
      </CardContent>
    </Card>
  );
}
