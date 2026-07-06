'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { DirectoryParams } from '@/lib/pagination';
import { listDrivers } from '../api/drivers.api';

export function useDrivers(params: DirectoryParams) {
  return useQuery({
    queryKey: ['drivers', params],
    queryFn: () => listDrivers(params),
    placeholderData: keepPreviousData, // no flicker between pages
  });
}
