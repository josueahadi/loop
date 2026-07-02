// DISPLAY-ONLY formatting. These functions turn server-computed values into
// strings — they never derive a metric (no dividing counts, no averaging). A null
// rate/value is always shown as "No data yet", never as 0% or a placeholder.

export function formatRate(rate: number | null): string {
  if (rate == null) return 'No data yet';
  return `${Math.round(rate * 100)}%`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null) return 'No data yet';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return rem ? `${mins}m ${rem}s` : `${mins}m`;
}

export function formatNumber(value: number | null): string {
  return value == null ? 'No data yet' : String(value);
}
