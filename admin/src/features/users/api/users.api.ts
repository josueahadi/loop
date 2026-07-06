import { api } from '@/lib/api';
import {
  directoryQuery,
  type DirectoryParams,
  type Paginated,
} from '@/lib/pagination';
import type { AdminUser, AdminUserProfile } from '../types';

export async function listUsers(
  params: DirectoryParams,
): Promise<Paginated<AdminUser>> {
  const { data } = await api.get<Paginated<AdminUser>>('/admin/users', {
    params: directoryQuery(params),
  });
  return data;
}

export async function getUserProfile(id: string): Promise<AdminUserProfile> {
  const { data } = await api.get<AdminUserProfile>(`/admin/users/${id}`);
  return data;
}
