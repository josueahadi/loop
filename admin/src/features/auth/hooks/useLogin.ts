'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { fetchMe, login } from '../api/auth.api';
import { clearTokens, setTokens } from '@/lib/auth';

// Logs in against the SAME NestJS API, then confirms the account is an admin.
// A non-admin who authenticates successfully is rejected here AND would be
// blocked by the API's RolesGuard anyway — this just fails fast with a message.
export function useLogin() {
  const router = useRouter();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (vars: { email: string; password: string }) => {
      const result = await login(vars.email, vars.password);
      setTokens(result.accessToken, result.refreshToken);
      // Re-fetch via the client so the token is attached and confirmed valid.
      const me = await fetchMe();
      if (me.role !== 'admin') {
        clearTokens();
        throw new Error('This account is not an administrator.');
      }
      qc.setQueryData(['me'], me);
      return me;
    },
    onError: (e: unknown) => {
      const message =
        e instanceof Error && e.message.includes('administrator')
          ? e.message
          : 'Invalid email or password.';
      setError(message);
    },
    onSuccess: () => {
      setError(null);
      router.replace('/metrics');
    },
  });

  return { ...mutation, error };
}
