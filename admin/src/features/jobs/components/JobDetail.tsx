'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useJobDetail } from '../hooks/useJobs';
import type {
  AdminJobDetail,
  AdminJobStatus,
  JobProposal,
  JobRating,
} from '../types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, Spinner } from '@/components/ui/states';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

function date(value: string | null) {
  return value ? new Date(value).toLocaleString() : '—';
}

// Ordered lifecycle timestamps to render as a compact timeline.
const TIMELINE: { key: keyof AdminJobDetail; label: string }[] = [
  { key: 'createdAt', label: 'Created' },
  { key: 'postedAt', label: 'Posted' },
  { key: 'matchedAt', label: 'Matched' },
  { key: 'acceptedAt', label: 'Accepted' },
  { key: 'inProgressAt', label: 'In progress' },
  { key: 'completedAt', label: 'Completed' },
  { key: 'cancelledAt', label: 'Cancelled' },
];

export function JobDetail({ id }: { id: string }) {
  const { data: j, isLoading, isError, refetch } = useJobDetail(id);

  if (isLoading) return <Spinner label="Loading job…" />;
  if (isError || !j) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-destructive">Could not load this job.</p>
        <Button variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/jobs"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to jobs
      </Link>

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl">{j.cargoType}</CardTitle>
                <Badge variant={statusVariant(j.status)}>
                  {statusLabels[j.status]}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {j.pickupLabel ?? 'Pickup not labelled'} →{' '}
                {j.dropOffLabel ?? 'Drop-off not labelled'}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/users/${j.owner.id}`}>View owner</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Owner">{j.owner.name}</Stat>
            <Stat label="Vehicle">{j.requiredVehicleType}</Stat>
            <Stat label="Size">{j.size}</Stat>
            <Stat label="Weight">
              {j.weightKg != null ? `${j.weightKg} kg` : '—'}
            </Stat>
            <Stat label="Price">{money(j.price)}</Stat>
            <Stat label="Estimate">{money(j.estimatedPrice)}</Stat>
            <Stat label="Messages">{j.messageCount}</Stat>
            <Stat label="Proposals">{j.proposals.length}</Stat>
          </div>
          {(j.pickupNotes || j.dropOffNotes) && (
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {j.pickupNotes && (
                <Note label="Pickup notes">{j.pickupNotes}</Note>
              )}
              {j.dropOffNotes && (
                <Note label="Drop-off notes">{j.dropOffNotes}</Note>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline */}
      <SectionCard title="Lifecycle">
        <div className="flex flex-col gap-2">
          {TIMELINE.filter((t) => j[t.key]).map((t) => (
            <div key={t.key} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.label}</span>
              <span className="tabular-nums">{date(j[t.key] as string)}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Proposals */}
      <SectionCard title="Proposals">
        <ProposalsTable proposals={j.proposals} />
      </SectionCard>

      {/* Ratings */}
      <SectionCard title="Ratings">
        <RatingsTable ratings={j.ratings} />
      </SectionCard>
    </div>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{children}</span>
    </div>
  );
}

function Note({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{children}</p>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function proposalVariant(status: JobProposal['status']) {
  if (status === 'accepted') return 'default' as const;
  if (status === 'declined') return 'destructive' as const;
  return 'secondary' as const;
}

function ProposalsTable({ proposals }: { proposals: JobProposal[] }) {
  if (proposals.length === 0) {
    return <EmptyState message="No proposals sent for this job." />;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Driver</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Sent</TableHead>
          <TableHead>Responded</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {proposals.map((p) => (
          <TableRow key={p.id}>
            <TableCell>
              <div className="flex flex-col">
                <Link
                  href={`/users/${p.driver.id}`}
                  className="font-medium hover:underline"
                >
                  {p.driver.name}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {p.driver.phone}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={proposalVariant(p.status)}>{p.status}</Badge>
            </TableCell>
            <TableCell>{date(p.createdAt)}</TableCell>
            <TableCell>{date(p.respondedAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RatingsTable({ ratings }: { ratings: JobRating[] }) {
  if (ratings.length === 0) {
    return <EmptyState message="No ratings for this job yet." />;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Score</TableHead>
          <TableHead>From</TableHead>
          <TableHead>To</TableHead>
          <TableHead>Comment</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ratings.map((r, i) => (
          <TableRow key={i}>
            <TableCell className="tabular-nums">{r.score} / 5</TableCell>
            <TableCell>{r.fromName}</TableCell>
            <TableCell>{r.toName}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {r.comment ?? '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
