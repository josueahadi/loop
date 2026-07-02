'use client';

import { FormEvent, useState } from 'react';
import { useLogin } from '../hooks/useLogin';
import { Button, Card } from '@/components/ui';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { mutate, isPending, error } = useLogin();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    mutate({ email, password });
  }

  return (
    <Card className="w-full max-w-sm space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Loop Admin</h1>
        <p className="text-sm text-black/50">
          Sign in with your administrator account.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </Card>
  );
}
