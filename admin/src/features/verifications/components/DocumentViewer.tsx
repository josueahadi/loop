'use client';

import { useState } from 'react';
import { getDocumentUrl } from '../api/verifications.api';
import { Button, Spinner } from '@/components/ui';

// Fetches a short-lived, admin-only view URL on demand and displays the document.
// When storage is the dev stub the API returns { url: null, stub: true } — we say
// so plainly rather than pretending a document is viewable.
export function DocumentViewer({ recordId }: { recordId: string }) {
  const [state, setState] = useState<
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ready'; url: string }
    | { status: 'stub' }
    | { status: 'error' }
  >({ status: 'idle' });

  async function load() {
    setState({ status: 'loading' });
    try {
      const { url, stub } = await getDocumentUrl(recordId);
      if (stub || !url) setState({ status: 'stub' });
      else setState({ status: 'ready', url });
    } catch {
      setState({ status: 'error' });
    }
  }

  if (state.status === 'idle') {
    return (
      <Button variant="ghost" onClick={load}>
        View document
      </Button>
    );
  }
  if (state.status === 'loading') return <Spinner label="Fetching document…" />;
  if (state.status === 'stub') {
    return (
      <p className="text-xs text-black/50">
        Document preview is unavailable in this environment (storage stub). Enable
        Firebase storage to view uploaded files.
      </p>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="space-y-2">
        <p className="text-xs text-red-600">Could not load the document.</p>
        <Button variant="ghost" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  // ready — an image preview with a raw link fallback (PDFs open in a new tab).
  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={state.url}
        alt="Verification document"
        className="max-h-80 w-auto rounded-lg border border-black/10 object-contain"
      />
      <a
        href={state.url}
        target="_blank"
        rel="noreferrer"
        className="text-xs font-medium text-blue-600 hover:underline"
      >
        Open in new tab ↗
      </a>
    </div>
  );
}
