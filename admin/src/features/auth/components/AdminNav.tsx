'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { logout } from '../api/auth.api';
import { useSession } from '../hooks/useSession';
import { clearTokens, getRefreshToken } from '@/lib/auth';
import { clsx } from '@/components/ui/clsx';

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
    <header className="border-b border-black/10 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="text-lg font-semibold">Loop Admin</span>
          <nav className="flex gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                  pathname === l.href
                    ? 'bg-black text-white'
                    : 'text-black/60 hover:bg-black/5',
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {user && <span className="text-black/50">{user.email}</span>}
          <button
            onClick={onLogout}
            className="rounded-lg border border-black/15 px-3 py-1.5 font-medium hover:bg-black/5"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
