import { api } from '@/lib/api';
import type { AuthResult, CurrentUser } from '../types';

export async function login(
  email: string,
  password: string,
): Promise<AuthResult> {
  const { data } = await api.post<AuthResult>('/auth/login', {
    email,
    password,
  });
  return data;
}

export async function fetchMe(): Promise<CurrentUser> {
  const { data } = await api.get<CurrentUser>('/me');
  return data;
}

export async function logout(refreshToken: string): Promise<void> {
  await api.post('/auth/logout', { refreshToken });
}
