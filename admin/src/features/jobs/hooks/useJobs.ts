'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { DirectoryParams } from '@/lib/pagination';
import { getJobDetail, listJobs } from '../api/jobs.api';

export function useJobs(params: DirectoryParams) {
  return useQuery({
    queryKey: ['jobs', params],
    queryFn: () => listJobs(params),
    placeholderData: keepPreviousData,
  });
}

export function useJobDetail(id: string) {
  return useQuery({
    queryKey: ['job', id],
    queryFn: () => getJobDetail(id),
  });
}
