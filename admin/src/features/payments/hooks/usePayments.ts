'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  cancelPayment,
  listPayments,
  recheckPayment,
} from '../api/payments.api';

export function usePayments() {
  return useQuery({
    queryKey: ['payments'],
    queryFn: listPayments,
  });
}

export function useRecheckPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recheckPayment(id),
    onSuccess: (result) => {
      if (result.notFound) {
        toast.info('The provider has no record of this transaction yet.');
      } else if (result.changed) {
        toast.success(`Payment resolved: ${result.status}`);
      } else {
        toast.info(`No change — still ${result.status}.`);
      }
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['metrics'] });
    },
    onError: () => toast.error('Could not re-check the payment.'),
  });
}

export function useCancelPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelPayment(id),
    onSuccess: () => {
      toast.success('Pending payment cancelled');
      qc.invalidateQueries({ queryKey: ['payments'] });
    },
    onError: () => toast.error('Could not cancel the payment.'),
  });
}
