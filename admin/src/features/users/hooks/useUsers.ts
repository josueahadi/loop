'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { DirectoryParams } from '@/lib/pagination';
import { getUserProfile, listUsers } from '../api/users.api';

export function useUsers(params: DirectoryParams) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => listUsers(params),
    placeholderData: keepPreviousData,
  });
}

export function useUserProfile(id: string) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () => getUserProfile(id),
  });
}
