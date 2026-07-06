'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listVerifications,
  reviewVerification,
} from '../api/verifications.api';

// Pending queue. On approve/reject we refetch so the reviewed record drops out
// of the pending list — the list always reflects real server state.
export function usePendingVerifications() {
  return useQuery({
    queryKey: ['verifications', 'pending'],
    queryFn: () => listVerifications('pending'),
  });
}

export function useReviewVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      reviewNote,
    }: {
      id: string;
      status: 'approved' | 'rejected';
      reviewNote?: string;
    }) => reviewVerification(id, status, reviewNote),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['verifications'] });
      // Verification completion feeds a dashboard metric — refresh it too.
      qc.invalidateQueries({ queryKey: ['metrics'] });
      qc.invalidateQueries({ queryKey: ['drivers'] });
    },
  });
}
