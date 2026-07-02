import { clsx } from './clsx';

// Small, shared UI primitives. Kept intentionally minimal — the admin app is an
// internal tool, so these cover cards, buttons, badges, and states without a
// component-library dependency.

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-black/10 bg-white p-5 shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Button({
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'danger' | 'ghost';
}) {
  const styles = {
    primary: 'bg-black text-white hover:bg-black/85',
    danger: 'bg-red-600 text-white hover:bg-red-500',
    ghost: 'border border-black/15 bg-white text-black hover:bg-black/5',
  }[variant];
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        styles,
        className,
      )}
      {...props}
    />
  );
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'green' | 'amber' | 'red';
  children: React.ReactNode;
}) {
  const styles = {
    neutral: 'bg-black/5 text-black/70',
    green: 'bg-green-100 text-green-800',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-800',
  }[tone];
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        styles,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-black/15 bg-black/[0.02] p-8 text-center text-sm text-black/50">
      {message}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-black/50">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black/60" />
      {label}
    </div>
  );
}
