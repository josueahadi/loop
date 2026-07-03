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
import { useDrivers } from '../hooks/useDrivers';

export function DriversTable() {
  const { data, isLoading, isError, refetch } = useDrivers();

  if (isLoading) return <Spinner label="Loading drivers…" />;
  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-destructive">Could not load drivers.</p>
        <Button variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }
  if (!data || data.length === 0) {
    return <EmptyState message="No drivers found." />;
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Driver</TableHead>
            <TableHead>Availability</TableHead>
            <TableHead>Vehicles</TableHead>
            <TableHead>Approved docs</TableHead>
            <TableHead>Matchability</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((driver) => (
            <TableRow key={driver.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{driver.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {driver.email}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {driver.phone}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    driver.availabilityStatus === 'online'
                      ? 'default'
                      : 'secondary'
                  }
                >
                  {driver.availabilityStatus ?? 'offline'}
                </Badge>
              </TableCell>
              <TableCell>{driver.vehicleCount}</TableCell>
              <TableCell>{driver.approvedDocumentCount}/3</TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <Badge
                    variant={
                      driver.matchabilityStatus === 'matchable'
                        ? 'default'
                        : 'destructive'
                    }
                  >
                    {driver.matchabilityStatus}
                  </Badge>
                  {driver.missing.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Missing {driver.missing.join(', ')}
                    </span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
