'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchMetrics } from '../api/metrics.api';

export function useMetrics() {
  return useQuery({ queryKey: ['metrics'], queryFn: fetchMetrics });
}
