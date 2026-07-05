'use client';

import { useQuery } from '@tanstack/react-query';
import { listDrivers } from '../api/drivers.api';

export function useDrivers() {
  return useQuery({ queryKey: ['drivers'], queryFn: listDrivers });
}
