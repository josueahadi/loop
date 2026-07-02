import { api } from '@/lib/api';
import type {
  DocumentUrl,
  VerificationRecord,
  VerificationStatus,
} from '../types';

export async function listVerifications(
  status: VerificationStatus = 'pending',
): Promise<VerificationRecord[]> {
  const { data } = await api.get<VerificationRecord[]>('/admin/verifications', {
    params: { status },
  });
  return data;
}

export async function reviewVerification(
  id: string,
  status: 'approved' | 'rejected',
): Promise<VerificationRecord> {
  const { data } = await api.patch<VerificationRecord>(
    `/admin/verifications/${id}`,
    { status },
  );
  return data;
}

export async function getDocumentUrl(id: string): Promise<DocumentUrl> {
  const { data } = await api.get<DocumentUrl>(
    `/admin/verifications/${id}/document-url`,
  );
  return data;
}
