'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileCheck, PowerOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/data-table';
import { DEFAULT_PAGE_SIZE } from '@/lib/pagination';
import { ConfirmActionButton } from '@/features/admin-actions/ConfirmActionButton';
import {
  useForceDriverOffline,
  useSetUserSuspension,
} from '@/features/admin-actions/hooks';
import { useDrivers } from '../hooks/useDrivers';
import type { AdminDriver } from '../types';

export function DriversTable() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const forceOffline = useForceDriverOffline();
  const suspension = useSetUserSuspension();

  const columns: Column<AdminDriver>[] = [
    {
      header: 'Driver',
      cell: (d) => (
        <div className="flex flex-col">
          <span className="font-medium">{d.name}</span>
          <span className="text-xs text-muted-foreground">{d.email}</span>
          <span className="text-xs text-muted-foreground">{d.phone}</span>
        </div>
      ),
    },
    {
      header: 'Availability',
      cell: (d) => (
        <div className="flex flex-col gap-1">
          <Badge
            variant={d.availabilityStatus === 'online' ? 'default' : 'secondary'}
          >
            {d.availabilityStatus ?? 'offline'}
          </Badge>
          {d.suspendedAt && <Badge variant="destructive">Suspended</Badge>}
        </div>
      ),
    },
    { header: 'Vehicles', cell: (d) => d.vehicleCount },
    { header: 'Approved docs', cell: (d) => `${d.approvedDocumentCount}/3` },
    {
      header: 'Matchability',
      cell: (d) => (
        <div className="flex flex-col gap-1">
          <Badge
            variant={
              d.matchabilityStatus === 'matchable' ? 'default' : 'destructive'
            }
          >
            {d.matchabilityStatus}
          </Badge>
          {d.missing.length > 0 && (
            <span className="text-xs text-muted-foreground">
              Missing {d.missing.join(', ')}
            </span>
          )}
        </div>
      ),
    },
    {
      header: '',
      cell: (d) => (
        <div
          className="flex flex-wrap justify-end gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Button asChild variant="outline" size="sm">
            <Link href={`/verifications?driver=${d.id}`}>
              <FileCheck data-icon="inline-start" />
              Verifications
            </Link>
          </Button>
          {d.availabilityStatus === 'online' && (
            <ConfirmActionButton
              trigger={
                <Button variant="outline" size="sm">
                  <PowerOff data-icon="inline-start" />
                  Set offline
                </Button>
              }
              title="Set driver offline?"
              description={`${d.name} will be taken offline and stop appearing in matching until they go back online themselves.`}
              confirmLabel="Set offline"
              onConfirm={() => forceOffline.mutate(d.id)}
              pending={forceOffline.isPending}
            />
          )}
          <ConfirmActionButton
            trigger={
              <Button
                variant={d.suspendedAt ? 'outline' : 'destructive'}
                size="sm"
              >
                {d.suspendedAt ? 'Reactivate' : 'Suspend'}
              </Button>
            }
            title={d.suspendedAt ? 'Reactivate account?' : 'Suspend account?'}
            description={
              d.suspendedAt
                ? `${d.name} will be able to log in again.`
                : `${d.name} will be signed out of matching and blocked from logging in until reactivated.`
            }
            confirmLabel={d.suspendedAt ? 'Reactivate' : 'Suspend'}
            destructive={!d.suspendedAt}
            onConfirm={() =>
              suspension.mutate({ id: d.id, suspended: !d.suspendedAt })
            }
            pending={suspension.isPending}
          />
        </div>
      ),
    },
  ];

  const { data, isLoading, isError } = useDrivers({
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
      searchPlaceholder="Search name, email, or phone…"
      filterOptions={[
        { label: 'Matchable', value: 'matchable' },
        { label: 'Blocked', value: 'blocked' },
      ]}
      filterValue={filter}
      onFilterChange={(v) => {
        setFilter(v);
        setPage(1);
      }}
      filterLabel="All drivers"
      emptyMessage="No drivers found."
      rowKey={(d) => d.id}
      onRowClick={(d) => router.push(`/users/${d.id}`)}
    />
  );
}
