import { api } from '@/lib/api';
import type { Metrics } from '../types';

export async function fetchMetrics(): Promise<Metrics> {
  const { data } = await api.get<Metrics>('/admin/metrics');
  return data;
}
