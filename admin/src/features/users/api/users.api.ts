import { api } from '@/lib/api';
import type { AdminUser } from '../types';

export async function listUsers(): Promise<AdminUser[]> {
  const { data } = await api.get<AdminUser[]>('/admin/users');
  return data;
}
