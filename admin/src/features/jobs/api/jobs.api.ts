import { api } from '@/lib/api';
import type { AdminJob } from '../types';

export async function listJobs(): Promise<AdminJob[]> {
  const { data } = await api.get<AdminJob[]>('/admin/jobs');
  return data;
}
