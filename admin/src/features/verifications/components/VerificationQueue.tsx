'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  usePendingVerifications,
  useReviewVerification,
} from '../hooks/useVerifications';
import { DOCUMENT_LABELS } from '../types';
import { DocumentSheet } from './DocumentSheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, Spinner } from '@/components/ui/states';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function VerificationQueue({
  initialDriverId,
}: {
  initialDriverId?: string;
}) {
  const { data, isLoading, isError, refetch } = usePendingVerifications();
  const review = useReviewVerification();
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const deepLinkApplied = useRef(false);
  const selectedGroup = data?.find(
    (group) => group.driver.id === selectedDriverId,
  );

  // Deep-link from the Users table: open a specific driver's docs once, when the
  // group list first arrives. Guarded so it never re-opens after the admin closes it.
  useEffect(() => {
    if (deepLinkApplied.current || !initialDriverId || !data) return;
    if (data.some((g) => g.driver.id === initialDriverId)) {
      deepLinkApplied.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedDriverId(initialDriverId);
    }
  }, [initialDriverId, data]);

  function reviewDocument(
    documentId: string,
    status: 'approved' | 'rejected',
    reviewNote?: string,
  ) {
    review.mutate({ id: documentId, status, reviewNote });
  }

  if (isLoading) return <Spinner label="Loading pending verifications…" />;
  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-destructive">
          Could not load the verification queue.
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }
  if (!data || data.length === 0) {
    return <EmptyState message="No documents are awaiting review." />;
  }

  const driverCount = data.length;
  const docCount = data.reduce((sum, g) => sum + g.documentCount, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {driverCount} {driverCount === 1 ? 'driver' : 'drivers'} · {docCount}{' '}
            {docCount === 1 ? 'document' : 'documents'}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Drivers with documents awaiting review
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw data-icon="inline-start" />
          Refresh
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Driver</TableHead>
              <TableHead>Documents pending</TableHead>
              <TableHead>Oldest submission</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((group) => {
              const oldest = group.documents.reduce(
                (min, d) => (d.createdAt < min ? d.createdAt : min),
                group.documents[0].createdAt,
              );
              return (
                <TableRow key={group.driver.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{group.driver.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {group.driver.email}
                      </span>
                      {group.driver.phone && (
                        <span className="text-xs text-muted-foreground">
                          {group.driver.phone}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {group.documents.map((doc) => (
                        <Badge key={doc.id} variant="secondary">
                          {DOCUMENT_LABELS[doc.documentType]}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(oldest).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedDriverId(group.driver.id)}
                      >
                        Review
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <DocumentSheet
        group={selectedGroup ?? null}
        open={selectedDriverId !== null}
        onOpenChange={(o) => {
          if (!o) setSelectedDriverId(null);
        }}
        onReview={reviewDocument}
        reviewingId={review.isPending ? review.variables?.id : undefined}
      />
    </div>
  );
}
