'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Cell, Label, Pie, PieChart } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { EmptyState } from '@/components/ui/states';

const PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

function prettify(key: string) {
  const s = key.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function DonutChart({
  title,
  data,
  href,
  centerLabel = 'Total',
}: {
  title: string;
  data: Record<string, number>;
  href?: string;
  centerLabel?: string;
}) {
  const rows = Object.entries(data).map(([key, count], i) => ({
    key,
    name: prettify(key),
    count,
    fill: PALETTE[i % PALETTE.length],
  }));
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  const config: ChartConfig = Object.fromEntries(
    rows.map((r, i) => [r.key, { label: r.name, color: PALETTE[i % PALETTE.length] }]),
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {href && (
            <Link
              href={href}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View all <ArrowRight className="size-3" />
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 || total === 0 ? (
          <EmptyState message="No data yet." />
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
            <ChartContainer
              config={config}
              className="mx-auto aspect-square h-52 w-52 shrink-0"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent nameKey="name" hideLabel />}
                />
                <Pie
                  data={rows}
                  dataKey="count"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={82}
                  strokeWidth={2}
                  paddingAngle={2}
                >
                  {rows.map((r) => (
                    <Cell key={r.key} fill={r.fill} />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      if (!viewBox || !('cx' in viewBox)) return null;
                      const { cx, cy } = viewBox as { cx: number; cy: number };
                      return (
                        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan
                            x={cx}
                            y={cy - 6}
                            className="fill-foreground text-2xl font-semibold tabular-nums"
                          >
                            {total}
                          </tspan>
                          <tspan
                            x={cx}
                            y={cy + 14}
                            className="fill-muted-foreground text-xs"
                          >
                            {centerLabel}
                          </tspan>
                        </text>
                      );
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>

            <ul className="flex w-full flex-col gap-2 text-sm">
              {rows
                .slice()
                .sort((a, b) => b.count - a.count)
                .map((r) => (
                  <li key={r.key} className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-[3px]"
                      style={{ backgroundColor: r.fill }}
                    />
                    <span className="flex-1 truncate text-muted-foreground">
                      {r.name}
                    </span>
                    <span className="font-medium tabular-nums">{r.count}</span>
                    <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                      {Math.round((r.count / total) * 100)}%
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
