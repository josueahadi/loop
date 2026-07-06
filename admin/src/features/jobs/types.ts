export type AdminJobStatus =
  'draft' | 'posted' | 'matched' | 'in_progress' | 'completed' | 'cancelled';

export interface AdminJob {
  id: string;
  status: AdminJobStatus;
  cargoType: string;
  size: string;
  requiredVehicleType: string;
  price: number | null;
  estimatedPrice: number | null;
  pickupLabel: string | null;
  dropOffLabel: string | null;
  createdAt: string;
  postedAt: string | null;
  matchedAt: string | null;
  owner: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
}

// GET /admin/jobs/:id — full detail + related data.
export interface JobProposal {
  id: string;
  status: 'sent' | 'accepted' | 'declined';
  createdAt: string;
  respondedAt: string | null;
  driver: { id: string; name: string; phone: string };
}

export interface JobRating {
  score: number;
  comment: string | null;
  createdAt: string;
  fromName: string;
  toName: string;
}

export interface AdminJobDetail {
  id: string;
  cargoType: string;
  size: string;
  weightKg: string | number | null;
  price: number | null;
  estimatedPrice: number | null;
  requiredVehicleType: string;
  status: AdminJobStatus;
  pickupLabel: string | null;
  pickupNotes: string | null;
  dropOffLabel: string | null;
  dropOffNotes: string | null;
  createdAt: string;
  postedAt: string | null;
  matchedAt: string | null;
  acceptedAt: string | null;
  inProgressAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  owner: { id: string; name: string; email: string; phone: string };
  proposals: JobProposal[];
  messageCount: number;
  ratings: JobRating[];
}
