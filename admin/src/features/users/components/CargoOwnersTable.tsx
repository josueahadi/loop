'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, type Column } from '@/components/data-table';
import { DEFAULT_PAGE_SIZE } from '@/lib/pagination';
import { useUsers } from '../hooks/useUsers';
import type { AdminUser } from '../types';

const columns: Column<AdminUser>[] = [
  {
    header: 'Cargo owner',
    cell: (u) => (
      <div className="flex flex-col">
        <span className="font-medium">{u.name}</span>
        <span className="text-xs text-muted-foreground">{u.phone}</span>
      </div>
    ),
  },
  {
    header: 'Email',
    cell: (u) => (
      <div className="flex flex-col">
        <span>{u.email}</span>
        <span className="text-xs text-muted-foreground">
          {u.emailVerifiedAt ? 'Verified' : 'Not verified'}
        </span>
      </div>
    ),
  },
  {
    header: 'Rating',
    cell: (u) => `${Number(u.averageRating).toFixed(1)} (${u.ratingCount})`,
  },
  {
    header: 'Joined',
    cell: (u) => new Date(u.createdAt).toLocaleDateString(),
  },
];

export function CargoOwnersTable() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading, isError } = useUsers({
    page,
    limit: DEFAULT_PAGE_SIZE,
    search,
    filter: 'cargo_owner',
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
      emptyMessage="No cargo owners found."
      rowKey={(u) => u.id}
      onRowClick={(u) => router.push(`/users/${u.id}`)}
    />
  );
}
