import { api } from '@/lib/api';
import {
  directoryQuery,
  type DirectoryParams,
  type Paginated,
} from '@/lib/pagination';
import type { AdminUser } from '../types';

export async function listUsers(
  params: DirectoryParams,
): Promise<Paginated<AdminUser>> {
  const { data } = await api.get<Paginated<AdminUser>>('/admin/users', {
    params: directoryQuery(params),
  });
  return data;
}
