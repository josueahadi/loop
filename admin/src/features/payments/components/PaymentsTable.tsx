'use client';

import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmActionButton } from '@/features/admin-actions/ConfirmActionButton';
import {
  useCancelPayment,
  usePayments,
  useRecheckPayment,
} from '../hooks/usePayments';
import type { PaymentStatus } from '../types';

function statusVariant(status: PaymentStatus) {
  if (status === 'successful') return 'default' as const;
  if (status === 'failed' || status === 'cancelled') return 'destructive' as const;
  return 'secondary' as const; // pending
}

function formatRwf(amount: number) {
  return `${amount.toLocaleString('en-US')} RWF`;
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString();
}

export function PaymentsTable() {
  const { data, isLoading, isError } = usePayments();
  const recheck = useRecheckPayment();
  const cancel = useCancelPayment();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading payments…</p>;
  }
  if (isError) {
    return <p className="text-sm text-destructive">Could not load payments.</p>;
  }
  const payments = data ?? [];

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Created</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Payer → Payee</TableHead>
            <TableHead>Job</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-center text-sm text-muted-foreground"
              >
                No payments yet.
              </TableCell>
            </TableRow>
          )}
          {payments.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {formatWhen(p.createdAt)}
              </TableCell>
              <TableCell className="font-medium">
                {formatRwf(p.amount)}
              </TableCell>
              <TableCell>
                <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                {p.failureReason && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {p.failureReason}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-sm">{p.provider}</TableCell>
              <TableCell className="text-sm">
                {p.payerName ?? '—'} → {p.payeeName ?? '—'}
              </TableCell>
              <TableCell>
                <Button asChild variant="link" size="sm" className="px-0">
                  <Link href={`/jobs/${p.jobId}`}>View job</Link>
                </Button>
              </TableCell>
              <TableCell className="text-right">
                {p.status === 'pending' ? (
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={recheck.isPending}
                      onClick={() => recheck.mutate(p.id)}
                      title="Re-check status with the provider"
                    >
                      <RefreshCw data-icon="inline-start" />
                      Re-check
                    </Button>
                    <ConfirmActionButton
                      trigger={
                        <Button variant="destructive" size="sm">
                          Cancel
                        </Button>
                      }
                      title="Cancel this pending payment?"
                      description="This clears a stuck pending attempt so the owner can pay again. It does not assert that money moved."
                      confirmLabel="Cancel payment"
                      destructive
                      onConfirm={() => cancel.mutate(p.id)}
                      pending={cancel.isPending}
                    />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
