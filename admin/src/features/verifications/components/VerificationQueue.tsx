'use client';

import { useState } from 'react';
import { Check, Eye, RefreshCw, X } from 'lucide-react';
import {
  usePendingVerifications,
  useReviewVerification,
} from '../hooks/useVerifications';
import { DOCUMENT_LABELS, type VerificationRecord } from '../types';
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

export function VerificationQueue() {
  const { data, isLoading, isError, refetch } = usePendingVerifications();
  const review = useReviewVerification();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRecord = data?.find((record) => record.id === selectedId);

  function reviewDocument(
    record: VerificationRecord,
    status: 'approved' | 'rejected',
  ) {
    review.mutate(
      { id: record.id, status },
      {
        onSuccess: () => {
          if (selectedId === record.id) setSelectedId(null);
        },
      },
    );
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{data.length} pending</Badge>
          <span className="text-sm text-muted-foreground">
            Driver documents awaiting admin decision
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
              <TableHead>Document</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((record) => {
              const pending =
                review.isPending && review.variables?.id === record.id;
              const driverLabel =
                record.driver?.name ?? `Driver ${record.driverId.slice(0, 8)}`;

              return (
                <TableRow key={record.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{driverLabel}</span>
                      <span className="text-xs text-muted-foreground">
                        {record.driver?.email ?? record.driverId}
                      </span>
                      {record.driver?.phone && (
                        <span className="text-xs text-muted-foreground">
                          {record.driver.phone}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{DOCUMENT_LABELS[record.documentType]}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">Pending</Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(record.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedId(record.id)}
                      >
                        <Eye data-icon="inline-start" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => reviewDocument(record, 'approved')}
                        disabled={pending}
                      >
                        <Check data-icon="inline-start" />
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => reviewDocument(record, 'rejected')}
                        disabled={pending}
                      >
                        <X data-icon="inline-start" />
                        Reject
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
        record={selectedRecord ?? null}
        open={selectedId !== null}
        onOpenChange={(o) => {
          if (!o) setSelectedId(null);
        }}
        onReview={reviewDocument}
        reviewing={
          review.isPending && review.variables?.id === selectedRecord?.id
        }
      />
    </div>
  );
}
