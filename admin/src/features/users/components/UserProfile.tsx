'use client';

import Link from 'next/link';
import { ArrowLeft, FileCheck } from 'lucide-react';
import { useUserProfile } from '../hooks/useUsers';
import type {
  AdminUserProfile,
  ProfileDocument,
  ProfileJob,
  ProfileRating,
} from '../types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState, Spinner } from '@/components/ui/states';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const roleLabels: Record<AdminUserProfile['role'], string> = {
  admin: 'Admin',
  cargo_owner: 'Cargo owner',
  driver: 'Driver',
};

const docLabels: Record<ProfileDocument['documentType'], string> = {
  licence: 'Driving licence',
  national_id: 'National ID',
  vehicle_reg: 'Vehicle registration',
};

function money(value: number | null) {
  if (value == null) return 'No price';
  return `${value.toLocaleString()} RWF`;
}

function date(value: string) {
  return new Date(value).toLocaleDateString();
}

export function UserProfile({ id }: { id: string }) {
  const { data: u, isLoading, isError, refetch } = useUserProfile(id);

  if (isLoading) return <Spinner label="Loading profile…" />;
  if (isError || !u) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-destructive">Could not load this user.</p>
        <Button variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/users"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to users
      </Link>

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl">{u.name}</CardTitle>
                <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                  {roleLabels[u.role]}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{u.email}</p>
              <p className="text-sm text-muted-foreground">{u.phone}</p>
            </div>
            {u.role === 'driver' && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/verifications?driver=${u.id}`}>
                  <FileCheck data-icon="inline-start" />
                  Verifications
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Email">
              {u.emailVerifiedAt ? 'Verified' : 'Not verified'}
            </Stat>
            <Stat label="Rating">
              {Number(u.averageRating).toFixed(1)} ({u.ratingCount})
            </Stat>
            <Stat label="Joined">{date(u.createdAt)}</Stat>
            {u.role === 'driver' && (
              <Stat label="Availability">
                {u.availabilityStatus ?? 'offline'}
              </Stat>
            )}
            {u.role === 'driver' && (
              <Stat label="Licence no.">{u.licenseNumber ?? '—'}</Stat>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Driver-specific */}
      {u.role === 'driver' && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm font-medium">
                  Verification
                </CardTitle>
                <Badge
                  variant={
                    u.matchabilityStatus === 'matchable'
                      ? 'default'
                      : 'destructive'
                  }
                >
                  {u.matchabilityStatus}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {u.missing && u.missing.length > 0 && (
                <p className="mb-3 text-xs text-muted-foreground">
                  Missing: {u.missing.join(', ')}
                </p>
              )}
              <DocumentsTable documents={u.documents ?? []} />
            </CardContent>
          </Card>

          <SectionCard title="Vehicles">
            {(u.vehicles ?? []).length === 0 ? (
              <EmptyState message="No vehicles registered." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Reg. no</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(u.vehicles ?? []).map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>{v.type}</TableCell>
                      <TableCell>
                        {v.capacityKg != null ? `${v.capacityKg} kg` : '—'}
                      </TableCell>
                      <TableCell>{v.regNo}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>

          <SectionCard title="Assigned jobs">
            <JobsTable jobs={u.assignedJobs ?? []} />
          </SectionCard>
        </>
      )}

      {/* Owner-specific */}
      {u.role === 'cargo_owner' && (
        <SectionCard title="Jobs posted">
          <JobsTable jobs={u.jobs ?? []} />
        </SectionCard>
      )}

      {/* Ratings — both roles */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Ratings received">
          <RatingsTable ratings={u.ratingsReceived} counterpartKey="fromName" />
        </SectionCard>
        <SectionCard title="Ratings given">
          <RatingsTable ratings={u.ratingsGiven} counterpartKey="toName" />
        </SectionCard>
      </div>
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

function statusVariant(status: ProfileDocument['status']) {
  if (status === 'approved') return 'default' as const;
  if (status === 'rejected') return 'destructive' as const;
  return 'secondary' as const;
}

function DocumentsTable({ documents }: { documents: ProfileDocument[] }) {
  if (documents.length === 0) {
    return <EmptyState message="No documents submitted." />;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Document</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Note</TableHead>
          <TableHead>Submitted</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((d) => (
          <TableRow key={d.id}>
            <TableCell>{docLabels[d.documentType]}</TableCell>
            <TableCell>
              <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {d.reviewNote ?? '—'}
            </TableCell>
            <TableCell>{date(d.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function JobsTable({ jobs }: { jobs: ProfileJob[] }) {
  if (jobs.length === 0) {
    return <EmptyState message="No jobs." />;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cargo</TableHead>
          <TableHead>Route</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((j) => (
          <TableRow key={j.id}>
            <TableCell className="font-medium">{j.cargoType}</TableCell>
            <TableCell className="max-w-56 truncate text-xs text-muted-foreground">
              {j.pickupLabel ?? '?'} → {j.dropOffLabel ?? '?'}
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{j.status}</Badge>
            </TableCell>
            <TableCell>{money(j.price)}</TableCell>
            <TableCell>{date(j.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RatingsTable({
  ratings,
  counterpartKey,
}: {
  ratings: ProfileRating[];
  counterpartKey: 'fromName' | 'toName';
}) {
  if (ratings.length === 0) {
    return <EmptyState message="No ratings yet." />;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Score</TableHead>
          <TableHead>{counterpartKey === 'fromName' ? 'From' : 'To'}</TableHead>
          <TableHead>Comment</TableHead>
          <TableHead>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ratings.map((r, i) => (
          <TableRow key={`${r.jobId}-${i}`}>
            <TableCell className="tabular-nums">{r.score} / 5</TableCell>
            <TableCell>{r[counterpartKey] ?? '—'}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {r.comment ?? '—'}
            </TableCell>
            <TableCell>{date(r.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
