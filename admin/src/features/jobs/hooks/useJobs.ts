'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { DirectoryParams } from '@/lib/pagination';
import { listJobs } from '../api/jobs.api';

export function useJobs(params: DirectoryParams) {
  return useQuery({
    queryKey: ['jobs', params],
    queryFn: () => listJobs(params),
    placeholderData: keepPreviousData,
  });
}
