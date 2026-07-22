import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// A single KPI: headline value + the underlying n/denominator, always shown so a
// small sample is visible (e.g. "1 / 20 drivers") rather than hidden behind a
// smoothed percentage. When `href` is set the whole card links to the related
// directory page.
export function KpiCard({
  label,
  value,
  detail,
  hint,
  icon: Icon,
  badge,
  href,
}: {
  label: string;
  value: string;
  detail?: string;
  hint?: string;
  icon?: LucideIcon;
  badge?: string;
  href?: string;
}) {
  const noData = value === 'No data yet';
  const card = (
    <Card
      className={
        href
          ? 'h-full bg-card/95 transition-colors hover:border-primary/50 hover:bg-card'
          : 'bg-card/95'
      }
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {Icon && (
              <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon />
              </span>
            )}
            <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {label}
            </CardTitle>
          </div>
          {badge && <Badge variant="secondary">{badge}</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1">
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
            <p className="text-sm text-muted-foreground tabular-nums">
              {detail}
            </p>
          )}
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {card}
      </Link>
    );
  }
  return card;
}
