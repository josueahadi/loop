'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchMe } from '../api/auth.api';
import { isAuthenticated } from '@/lib/auth';

// Resolves the current user from the API (the real authorization check happens
// server-side; this drives the client-side redirect + "who am I" header).
export function useSession() {
  const enabled = isAuthenticated();
  const query = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled,
    retry: false,
  });

  return {
    ...query,
    user: query.data ?? null,
    isAdmin: query.data?.role === 'admin',
    // "not signed in at all" vs "signed in but query still resolving"
    hasToken: enabled,
  };
}
