import { api } from '@/lib/api';
import {
  directoryQuery,
  type DirectoryParams,
  type Paginated,
} from '@/lib/pagination';
import type { AdminDriver } from '../types';

export async function listDrivers(
  params: DirectoryParams,
): Promise<Paginated<AdminDriver>> {
  const { data } = await api.get<Paginated<AdminDriver>>('/admin/drivers', {
    params: directoryQuery(params),
  });
  return data;
}
