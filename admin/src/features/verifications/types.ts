// Mirrors admin verification data from the API.
export type DocumentType = 'licence' | 'national_id' | 'vehicle_reg';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';

// A single document within a driver's group.
export interface VerificationDocument {
  id: string;
  documentType: DocumentType;
  status: VerificationStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

// GET /admin/verifications — one group per driver, carrying their documents at
// the requested status.
export interface VerificationGroup {
  driver: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  documents: VerificationDocument[];
  documentCount: number;
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
