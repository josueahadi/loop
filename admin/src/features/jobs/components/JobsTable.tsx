'use client';

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
import { useJobs } from '../hooks/useJobs';
import type { AdminJobStatus } from '../types';

const statusLabels: Record<AdminJobStatus, string> = {
  draft: 'Draft',
  posted: 'Posted',
  matched: 'Matched',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function statusVariant(status: AdminJobStatus) {
  if (status === 'cancelled') return 'destructive' as const;
  if (status === 'completed') return 'outline' as const;
  if (status === 'draft') return 'secondary' as const;
  return 'default' as const;
}

function money(value: number | null) {
  if (value == null) return 'No price';
  return `${value.toLocaleString()} RWF`;
}

export function JobsTable() {
  const { data, isLoading, isError, refetch } = useJobs();

  if (isLoading) return <Spinner label="Loading jobs…" />;
  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-destructive">Could not load jobs.</p>
        <Button variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }
  if (!data || data.length === 0) {
    return <EmptyState message="No jobs found." />;
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((job) => (
            <TableRow key={job.id}>
              <TableCell>
                <div className="flex max-w-72 flex-col">
                  <span className="font-medium">{job.cargoType}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {job.pickupLabel ?? 'Pickup not labelled'} →{' '}
                    {job.dropOffLabel ?? 'Drop-off not labelled'}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{job.owner.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {job.owner.phone}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={statusVariant(job.status)}>
                  {statusLabels[job.status]}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span>{job.requiredVehicleType}</span>
                  <span className="text-xs text-muted-foreground">
                    {job.size}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span>{money(job.price)}</span>
                  <span className="text-xs text-muted-foreground">
                    Estimate {money(job.estimatedPrice)}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                {new Date(job.createdAt).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
