'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from '../hooks/useSession';
import { Spinner } from '@/components/ui/states';

// Client-side guard for the dashboard. The API's RolesGuard is the real
// authorization boundary; this prevents the admin shell from flashing for an
// unauthenticated or non-admin visitor and redirects them to /login.
export function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isAdmin, hasToken, isLoading, isError } = useSession();

  const shouldRedirect = !hasToken || isError || (!isLoading && !isAdmin);

  useEffect(() => {
    if (shouldRedirect) router.replace('/login');
  }, [shouldRedirect, router]);

  if (shouldRedirect || isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Checking access…" />
      </div>
    );
  }

  return <>{children}</>;
}
