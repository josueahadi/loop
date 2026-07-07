'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { getDocumentUrl } from '../api/verifications.api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/states';

type Loaded =
  | { status: 'ready'; url: string; isPdf: boolean }
  | { status: 'stub' }
  | { status: 'error' };

// Read-only preview of a single verification document (image or PDF) fetched via
// a short-lived signed URL. No approve/reject — that lives in the review queue.
export function DocumentPreviewDialog({
  documentId,
  title,
  open,
  onOpenChange,
}: {
  documentId: string | null;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Keyed by document id: a result only counts for its own id, so a different
  // (or freshly opened) document reads as still-loading — no synchronous
  // setState inside the effect.
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const loading = !documentId || loadedId !== documentId || loaded === null;

  useEffect(() => {
    if (!open || !documentId) return;
    let cancelled = false;
    getDocumentUrl(documentId)
      .then(({ url, stub }) => {
        if (cancelled) return;
        setLoadedId(documentId);
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
        setLoadedId(documentId);
        setLoaded({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [open, documentId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex h-40 items-center justify-center">
            <Spinner label="Fetching document…" />
          </div>
        )}
        {!loading && loaded?.status === 'stub' && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Preview is unavailable in this environment (storage stub).
          </p>
        )}
        {!loading && loaded?.status === 'error' && (
          <p className="py-6 text-center text-sm text-destructive">
            Could not load the document.
          </p>
        )}
        {!loading && loaded?.status === 'ready' && (
          <>
            {loaded.isPdf ? (
              <iframe
                src={loaded.url}
                title={title}
                className="h-[65vh] w-full rounded-lg border"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={loaded.url}
                alt={title}
                className="mx-auto max-h-[65vh] w-auto rounded-lg border object-contain"
              />
            )}
            <a
              href={loaded.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Open in new tab <ExternalLink className="size-3" />
            </a>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
