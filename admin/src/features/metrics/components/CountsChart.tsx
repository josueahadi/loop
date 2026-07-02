'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, EmptyState } from '@/components/ui';

// Renders a pre-computed count map ({ label: count }) as a bar chart. Purely a
// view over server data — no aggregation happens here. Empty map → honest empty
// state instead of a blank axis.
export function CountsChart({
  title,
  data,
  colors,
}: {
  title: string;
  data: Record<string, number>;
  colors?: string[];
}) {
  const rows = Object.entries(data).map(([name, count]) => ({ name, count }));
  const palette = colors ?? ['#111111', '#4b5563', '#9ca3af', '#d1d5db'];

  return (
    <Card className="space-y-3">
      <p className="text-sm font-medium">{title}</p>
      {rows.length === 0 ? (
        <EmptyState message="No data yet." />
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              margin={{ top: 8, right: 8, bottom: 8, left: -16 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip cursor={{ fill: '#00000008' }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {rows.map((_, i) => (
                  <Cell key={i} fill={palette[i % palette.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
