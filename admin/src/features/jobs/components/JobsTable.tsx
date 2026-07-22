'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/data-table';
import { DEFAULT_PAGE_SIZE } from '@/lib/pagination';
import { ConfirmActionButton } from '@/features/admin-actions/ConfirmActionButton';
import { useCancelJob } from '@/features/admin-actions/hooks';
import { useJobs } from '../hooks/useJobs';
import type { AdminJob, AdminJobStatus } from '../types';

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
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const cancelJob = useCancelJob();

  const columns: Column<AdminJob>[] = [
    {
      header: 'Job',
      cell: (j) => (
        <div className="flex max-w-72 flex-col">
          <span className="font-medium">{j.cargoType}</span>
          <span className="truncate text-xs text-muted-foreground">
            {j.pickupLabel ?? 'Pickup not labelled'} →{' '}
            {j.dropOffLabel ?? 'Drop-off not labelled'}
          </span>
        </div>
      ),
    },
    {
      header: 'Owner',
      cell: (j) => (
        <div className="flex flex-col">
          <span className="font-medium">{j.owner.name}</span>
          <span className="text-xs text-muted-foreground">{j.owner.phone}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (j) => (
        <Badge variant={statusVariant(j.status)}>{statusLabels[j.status]}</Badge>
      ),
    },
    {
      header: 'Vehicle',
      cell: (j) => (
        <div className="flex flex-col">
          <span>{j.requiredVehicleType}</span>
          <span className="text-xs text-muted-foreground">{j.size}</span>
        </div>
      ),
    },
    {
      header: 'Price',
      cell: (j) => (
        <div className="flex flex-col">
          <span>{money(j.price)}</span>
          <span className="text-xs text-muted-foreground">
            Estimate {money(j.estimatedPrice)}
          </span>
        </div>
      ),
    },
    {
      header: 'Created',
      cell: (j) => new Date(j.createdAt).toLocaleDateString(),
    },
    {
      header: '',
      cell: (j) =>
        j.status !== 'completed' && j.status !== 'cancelled' ? (
          <div
            className="flex flex-wrap justify-end gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <ConfirmActionButton
              trigger={
                <Button variant="destructive" size="sm">
                  Cancel
                </Button>
              }
              title="Cancel this job?"
              description={`This job will be marked cancelled. ${j.owner.name} and any assigned driver will no longer see it as active.`}
              confirmLabel="Cancel job"
              destructive
              onConfirm={() => cancelJob.mutate(j.id)}
              pending={cancelJob.isPending}
            />
          </div>
        ) : null,
    },
  ];

  const { data, isLoading, isError } = useJobs({
    page,
    limit: DEFAULT_PAGE_SIZE,
    search,
    filter: filter === 'all' ? undefined : filter,
  });

  return (
    <DataTable
      columns={columns}
      rows={data?.data ?? []}
      total={data?.total ?? 0}
      page={page}
      limit={DEFAULT_PAGE_SIZE}
      isLoading={isLoading}
      isError={isError}
      onPageChange={setPage}
      onSearchChange={(s) => {
        setSearch(s);
        setPage(1);
      }}
      searchPlaceholder="Search cargo type or location…"
      filterOptions={[
        { label: 'Posted', value: 'posted' },
        { label: 'Matched', value: 'matched' },
        { label: 'In progress', value: 'in_progress' },
        { label: 'Completed', value: 'completed' },
        { label: 'Cancelled', value: 'cancelled' },
      ]}
      filterValue={filter}
      onFilterChange={(v) => {
        setFilter(v);
        setPage(1);
      }}
      filterLabel="All statuses"
      emptyMessage="No jobs found."
      rowKey={(j) => j.id}
      onRowClick={(j) => router.push(`/jobs/${j.id}`)}
    />
  );
}
