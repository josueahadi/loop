'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/data-table';
import { DEFAULT_PAGE_SIZE } from '@/lib/pagination';
import { useUsers } from '../hooks/useUsers';
import type { AdminUser, AdminUserRole } from '../types';

const roleLabels: Record<AdminUserRole, string> = {
  admin: 'Admin',
  cargo_owner: 'Cargo owner',
  driver: 'Driver',
};

const columns: Column<AdminUser>[] = [
  {
    header: 'User',
    cell: (u) => (
      <div className="flex flex-col">
        <span className="font-medium">{u.name}</span>
        <span className="text-xs text-muted-foreground">{u.phone}</span>
      </div>
    ),
  },
  {
    header: 'Role',
    cell: (u) => (
      <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
        {roleLabels[u.role]}
      </Badge>
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
  {
    header: '',
    // Drivers are the only verified role — jump straight to their docs. Stop
    // propagation so this doesn't also trigger the row's navigate-to-profile.
    cell: (u) =>
      u.role === 'driver' ? (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Button asChild variant="outline" size="sm">
            <Link href={`/verifications?driver=${u.id}`}>
              <FileCheck data-icon="inline-start" />
              Verifications
            </Link>
          </Button>
        </div>
      ) : null,
  },
];

export function UsersTable() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const { data, isLoading, isError } = useUsers({
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
        { label: 'Cargo owners', value: 'cargo_owner' },
        { label: 'Drivers', value: 'driver' },
        { label: 'Admins', value: 'admin' },
      ]}
      filterValue={filter}
      onFilterChange={(v) => {
        setFilter(v);
        setPage(1);
      }}
      filterLabel="All roles"
      emptyMessage="No users found."
      rowKey={(u) => u.id}
      onRowClick={(u) => router.push(`/users/${u.id}`)}
    />
  );
}
