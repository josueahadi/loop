import { api } from '@/lib/api';
import type {
  DocumentUrl,
  VerificationDocument,
  VerificationGroup,
  VerificationStatus,
} from '../types';

export async function listVerifications(
  status: VerificationStatus = 'pending',
): Promise<VerificationGroup[]> {
  const { data } = await api.get<VerificationGroup[]>('/admin/verifications', {
    params: { status },
  });
  return data;
}

export async function reviewVerification(
  id: string,
  status: 'approved' | 'rejected',
  reviewNote?: string,
): Promise<VerificationDocument> {
  const { data } = await api.patch<VerificationDocument>(
    `/admin/verifications/${id}`,
    { status, ...(reviewNote ? { reviewNote } : {}) },
  );
  return data;
}

export async function getDocumentUrl(id: string): Promise<DocumentUrl> {
  const { data } = await api.get<DocumentUrl>(
    `/admin/verifications/${id}/document-url`,
  );
  return data;
}
