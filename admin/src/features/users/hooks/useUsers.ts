'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { DirectoryParams } from '@/lib/pagination';
import { listUsers } from '../api/users.api';

export function useUsers(params: DirectoryParams) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => listUsers(params),
    placeholderData: keepPreviousData,
  });
}
