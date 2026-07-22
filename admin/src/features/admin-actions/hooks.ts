'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  cancelJob,
  forceDriverOffline,
  reopenVerification,
  setUserSuspension,
} from './api';

export function useForceDriverOffline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => forceDriverOffline(id),
    onSuccess: () => {
      toast.success('Driver set offline');
      qc.invalidateQueries({ queryKey: ['drivers'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['metrics'] });
    },
    onError: () => toast.error('Could not set the driver offline.'),
  });
}

export function useSetUserSuspension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, suspended }: { id: string; suspended: boolean }) =>
      setUserSuspension(id, suspended),
    onSuccess: (_data, { suspended }) => {
      toast.success(suspended ? 'Account suspended' : 'Account reactivated');
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['drivers'] });
      qc.invalidateQueries({ queryKey: ['user'] });
    },
    onError: () => toast.error('Could not update the account.'),
  });
}

export function useCancelJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelJob(id),
    onSuccess: () => {
      toast.success('Job cancelled');
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['metrics'] });
    },
    onError: () => toast.error('Could not cancel the job.'),
  });
}

export function useReopenVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reopenVerification(id),
    onSuccess: () => {
      toast.success('Verification re-opened for review');
      qc.invalidateQueries({ queryKey: ['verifications'] });
      qc.invalidateQueries({ queryKey: ['metrics'] });
    },
    onError: () => toast.error('Could not re-open the verification.'),
  });
}
