'use client';

import { useEffect, useState } from 'react';
import { Check, ExternalLink, X } from 'lucide-react';
import { getDocumentUrl } from '../api/verifications.api';
import { DOCUMENT_LABELS, type VerificationRecord } from '../types';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/states';

type Loaded =
  | { status: 'ready'; url: string; isPdf: boolean }
  | { status: 'stub' }
  | { status: 'error' };

// Slide-in document preview. Fetches a short-lived signed view URL for the
// selected verification record and shows the image/PDF large, with approve /
// reject inline. When storage is the dev stub the API returns { stub: true } and
// we say so rather than faking a preview.
export function DocumentSheet({
  record,
  open,
  onOpenChange,
  onReview,
  reviewing,
}: {
  record: VerificationRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReview: (
    record: VerificationRecord,
    status: 'approved' | 'rejected',
  ) => void;
  reviewing: boolean;
}) {
  // Keyed by record id: `loaded` only holds a result for `loadedId`. Any other
  // (open) record reads as still-loading — no synchronous setState in the effect.
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const state: { status: 'loading' } | Loaded =
    record && loadedId === record.id && loaded ? loaded : { status: 'loading' };

  useEffect(() => {
    if (!open || !record) return;
    let cancelled = false;
    getDocumentUrl(record.id)
      .then(({ url, stub }) => {
        if (cancelled) return;
        setLoadedId(record.id);
        if (stub || !url) setLoaded({ status: 'stub' });
        else
          setLoaded({
            status: 'ready',
            url,
            isPdf: url.split('?')[0].toLowerCase().endsWith('.pdf'),
          });
      })
      .catch(() => {
        if (cancelled) return;
        setLoadedId(record.id);
        setLoaded({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [open, record]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 sm:max-w-xl"
      >
        <SheetHeader>
          <SheetTitle>
            {record ? DOCUMENT_LABELS[record.documentType] : 'Document'}
          </SheetTitle>
          <SheetDescription>
            {record?.driver?.name ??
              (record ? `Driver ${record.driverId.slice(0, 8)}` : '')}
          </SheetDescription>
        </SheetHeader>

        {/* Preview */}
        <div className="flex-1 overflow-auto px-4 py-2">
          {state.status === 'loading' && (
            <div className="flex h-full items-center justify-center">
              <Spinner label="Fetching document…" />
            </div>
          )}
          {state.status === 'stub' && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Preview is unavailable in this environment (storage stub). Enable
              Firebase storage to view uploaded files.
            </p>
          )}
          {state.status === 'error' && (
            <p className="py-8 text-center text-sm text-destructive">
              Could not load the document.
            </p>
          )}
          {state.status === 'ready' &&
            (state.isPdf ? (
              <iframe
                src={state.url}
                title="Verification document"
                className="h-[70vh] w-full rounded-lg border"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={state.url}
                alt="Verification document"
                className="mx-auto max-h-[70vh] w-auto rounded-lg border object-contain"
              />
            ))}
          {state.status === 'ready' && (
            <a
              href={state.url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Open in new tab <ExternalLink className="size-3" />
            </a>
          )}
        </div>

        {/* Actions */}
        {record && record.status === 'pending' && (
          <div className="flex gap-2 border-t p-4">
            <Button
              className="flex-1"
              onClick={() => onReview(record, 'approved')}
              disabled={reviewing}
            >
              <Check data-icon="inline-start" />
              Approve
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => onReview(record, 'rejected')}
              disabled={reviewing}
            >
              <X data-icon="inline-start" />
              Reject
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
