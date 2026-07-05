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
import { useUsers } from '../hooks/useUsers';

const roleLabels = {
  admin: 'Admin',
  cargo_owner: 'Cargo owner',
  driver: 'Driver',
};

export function UsersTable() {
  const { data, isLoading, isError, refetch } = useUsers();

  if (isLoading) return <Spinner label="Loading users…" />;
  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-destructive">Could not load users.</p>
        <Button variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }
  if (!data || data.length === 0) {
    return <EmptyState message="No users found." />;
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Rating</TableHead>
            <TableHead>Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{user.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {user.phone}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant={user.role === 'admin' ? 'default' : 'secondary'}
                >
                  {roleLabels[user.role]}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span>{user.email}</span>
                  <span className="text-xs text-muted-foreground">
                    {user.emailVerifiedAt ? 'Verified' : 'Not verified'}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                {Number(user.averageRating).toFixed(1)} ({user.ratingCount})
              </TableCell>
              <TableCell>
                {new Date(user.createdAt).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
