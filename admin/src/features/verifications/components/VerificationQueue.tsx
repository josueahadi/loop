'use client';

import {
  usePendingVerifications,
  useReviewVerification,
} from '../hooks/useVerifications';
import { DOCUMENT_LABELS } from '../types';
import { DocumentViewer } from './DocumentViewer';
import { Badge, Button, Card, EmptyState, Spinner } from '@/components/ui';

export function VerificationQueue() {
  const { data, isLoading, isError, refetch } = usePendingVerifications();
  const review = useReviewVerification();

  if (isLoading) return <Spinner label="Loading pending verifications…" />;
  if (isError) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600">
          Could not load the verification queue.
        </p>
        <Button variant="ghost" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }
  if (!data || data.length === 0) {
    return <EmptyState message="No documents are awaiting review." />;
  }

  return (
    <div className="space-y-4">
      {data.map((record) => {
        const pending =
          review.isPending && review.variables?.id === record.id;
        return (
          <Card key={record.id} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">
                  {DOCUMENT_LABELS[record.documentType]}
                </p>
                <p className="text-xs text-black/50">
                  Driver {record.driverId.slice(0, 8)}… · submitted{' '}
                  {new Date(record.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Badge tone="amber">Pending review</Badge>
            </div>

            <DocumentViewer recordId={record.id} />

            <div className="flex gap-3 border-t border-black/5 pt-3">
              <Button
                onClick={() =>
                  review.mutate({ id: record.id, status: 'approved' })
                }
                disabled={pending}
              >
                Approve
              </Button>
              <Button
                variant="danger"
                onClick={() =>
                  review.mutate({ id: record.id, status: 'rejected' })
                }
                disabled={pending}
              >
                Reject
              </Button>
              {pending && <Spinner label="Saving…" />}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
