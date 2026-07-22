export type AdminUserRole = 'cargo_owner' | 'driver' | 'admin';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: AdminUserRole;
  emailVerifiedAt: string | null;
  suspendedAt: string | null;
  averageRating: string | number;
  ratingCount: number;
  createdAt: string;
}

// GET /admin/users/:id — profile + related data. Driver-only fields (vehicles,
// documents, matchability, assignedJobs) and owner-only (jobs) are optional.
export type DocumentType = 'licence' | 'national_id' | 'vehicle_reg';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';

export interface ProfileVehicle {
  id: string;
  type: string;
  capacityKg: string | number | null;
  regNo: string;
  photoUrl: string | null;
}

export interface ProfileDocument {
  id: string;
  documentType: DocumentType;
  status: VerificationStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface ProfileJob {
  id: string;
  cargoType: string;
  status: string;
  price: number | null;
  estimatedPrice: number | null;
  pickupLabel: string | null;
  dropOffLabel: string | null;
  createdAt: string;
}

export interface ProfileRating {
  score: number;
  comment: string | null;
  createdAt: string;
  jobId: string;
  fromName?: string;
  toName?: string;
}

export interface AdminUserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: AdminUserRole;
  photoUrl: string | null;
  availabilityStatus: string | null;
  licenseNumber: string | null;
  emailVerifiedAt: string | null;
  averageRating: string | number;
  ratingCount: number;
  createdAt: string;
  ratingsReceived: ProfileRating[];
  ratingsGiven: ProfileRating[];
  // driver-only
  vehicles?: ProfileVehicle[];
  documents?: ProfileDocument[];
  matchabilityStatus?: 'matchable' | 'blocked';
  missing?: string[];
  assignedJobs?: ProfileJob[];
  // owner-only
  jobs?: ProfileJob[];
}
