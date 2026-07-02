// Mirrors VerificationResponseDto from the API.
export type DocumentType = 'licence' | 'national_id' | 'vehicle_reg';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';

export interface VerificationRecord {
  id: string;
  driverId: string;
  documentType: DocumentType;
  status: VerificationStatus;
  reviewedAt: string | null;
  createdAt: string;
}

// GET /admin/verifications/:id/document-url
export interface DocumentUrl {
  url: string | null;
  stub: boolean;
}

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  licence: 'Driving licence',
  national_id: 'National ID',
  vehicle_reg: 'Vehicle registration',
};
