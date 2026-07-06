'use client';

import { useEffect, useState } from 'react';
import { Check, ExternalLink, X } from 'lucide-react';
import { getDocumentUrl } from '../api/verifications.api';
import {
  DOCUMENT_LABELS,
  type VerificationDocument,
  type VerificationGroup,
} from '../types';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/states';
import { Textarea } from '@/components/ui/textarea';

// Slide-in review panel for one driver: every pending document with its own
// large preview, approve, and reject-with-reason. Wide enough (≥ half screen)
// to read a scanned document comfortably.
export function DocumentSheet({
  group,
  open,
  onOpenChange,
  onReview,
  reviewingId,
}: {
  group: VerificationGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReview: (
    documentId: string,
    status: 'approved' | 'rejected',
    reviewNote?: string,
  ) => void;
  reviewingId?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-none md:w-1/2"
      >
        <SheetHeader className="border-b">
          <SheetTitle>{group?.driver.name ?? 'Driver'}</SheetTitle>
          <SheetDescription>
            {group
              ? `${group.driver.email}${
                  group.driver.phone ? ` · ${group.driver.phone}` : ''
                }`
              : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 p-4">
          {group?.documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onReview={onReview}
              reviewing={reviewingId === doc.id}
            />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

type Loaded =
  | { status: 'loading' }
  | { status: 'ready'; url: string; isPdf: boolean }
  | { status: 'stub' }
  | { status: 'error' };

function DocumentCard({
  document,
  onReview,
  reviewing,
}: {
  document: VerificationDocument;
  onReview: (
    documentId: string,
    status: 'approved' | 'rejected',
    reviewNote?: string,
  ) => void;
  reviewing: boolean;
}) {
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    getDocumentUrl(document.id)
      .then(({ url, stub }) => {
        if (cancelled) return;
        if (stub || !url) setLoaded({ status: 'stub' });
        else
          setLoaded({
            status: 'ready',
            url,
            isPdf: url.split('?')[0].toLowerCase().endsWith('.pdf'),
          });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [document.id]);

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <h3 className="font-medium">{DOCUMENT_LABELS[document.documentType]}</h3>

      {loaded.status === 'loading' && (
        <div className="flex h-40 items-center justify-center">
          <Spinner label="Fetching document…" />
        </div>
      )}
      {loaded.status === 'stub' && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Preview is unavailable in this environment (storage stub).
        </p>
      )}
      {loaded.status === 'error' && (
        <p className="py-6 text-center text-sm text-destructive">
          Could not load the document.
        </p>
      )}
      {loaded.status === 'ready' &&
        (loaded.isPdf ? (
          <iframe
            src={loaded.url}
            title={DOCUMENT_LABELS[document.documentType]}
            className="h-[60vh] w-full rounded-lg border"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={loaded.url}
            alt={DOCUMENT_LABELS[document.documentType]}
            className="mx-auto max-h-[60vh] w-auto rounded-lg border object-contain"
          />
        ))}
      {loaded.status === 'ready' && (
        <a
          href={loaded.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Open in new tab <ExternalLink className="size-3" />
        </a>
      )}

      {rejecting ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason for rejection (shown to the driver, e.g. 'Photo is blurry — re-upload a clear scan')"
            rows={3}
            maxLength={500}
          />
          <div className="flex gap-2">
            <Button
              variant="destructive"
              className="flex-1"
              disabled={reviewing}
              onClick={() =>
                onReview(document.id, 'rejected', note.trim() || undefined)
              }
            >
              Confirm rejection
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setRejecting(false);
                setNote('');
              }}
              disabled={reviewing}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={() => onReview(document.id, 'approved')}
            disabled={reviewing}
          >
            <Check data-icon="inline-start" />
            Approve
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => setRejecting(true)}
            disabled={reviewing}
          >
            <X data-icon="inline-start" />
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
