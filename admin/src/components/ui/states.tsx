import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Small shared states shadcn doesn't ship. Both use theme tokens so they read
// correctly in light and dark.

export function Spinner({
  label = 'Loading…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 text-sm text-muted-foreground',
        className,
      )}
    >
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
