'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { logout } from '../api/auth.api';
import { useSession } from '../hooks/useSession';
import { clearTokens, getRefreshToken } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';

const LINKS = [
  { href: '/metrics', label: 'Metrics' },
  { href: '/verifications', label: 'Verifications' },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useSession();

  async function onLogout() {
    const rt = getRefreshToken();
    if (rt) await logout(rt).catch(() => undefined);
    clearTokens();
    qc.clear();
    router.replace('/login');
  }

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="text-lg font-semibold">Loop Admin</span>
          <nav className="flex gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  pathname === l.href
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {user && (
            <span className="hidden text-muted-foreground sm:inline">
              {user.email}
            </span>
          )}
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={onLogout}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
