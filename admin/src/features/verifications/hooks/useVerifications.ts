'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
    onSuccess: (_data, { status }) => {
      toast.success(
        status === 'approved' ? 'Document approved' : 'Document rejected',
      );
      qc.invalidateQueries({ queryKey: ['verifications'] });
      // Verification completion feeds a dashboard metric — refresh it too.
      qc.invalidateQueries({ queryKey: ['metrics'] });
      qc.invalidateQueries({ queryKey: ['drivers'] });
    },
    onError: () => {
      toast.error('Could not update the document. Please try again.');
    },
  });
}
