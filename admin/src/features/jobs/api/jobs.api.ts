import { api } from '@/lib/api';
import {
  directoryQuery,
  type DirectoryParams,
  type Paginated,
} from '@/lib/pagination';
import type { AdminJob } from '../types';

export async function listJobs(
  params: DirectoryParams,
): Promise<Paginated<AdminJob>> {
  const { data } = await api.get<Paginated<AdminJob>>('/admin/jobs', {
    params: directoryQuery(params),
  });
  return data;
}
