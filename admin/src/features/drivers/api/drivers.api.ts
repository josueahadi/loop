import { api } from '@/lib/api';
import type { AdminDriver } from '../types';

export async function listDrivers(): Promise<AdminDriver[]> {
  const { data } = await api.get<AdminDriver[]>('/admin/drivers');
  return data;
}
