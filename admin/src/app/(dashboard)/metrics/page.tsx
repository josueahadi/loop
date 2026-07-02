import { MetricsDashboard } from '@/features/metrics/components/MetricsDashboard';

export default function MetricsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Metrics</h1>
        <p className="text-sm text-black/50">
          Computed server-side. Every figure shows its sample size — small samples
          are shown honestly, not smoothed.
        </p>
      </div>
      <MetricsDashboard />
    </div>
  );
}
