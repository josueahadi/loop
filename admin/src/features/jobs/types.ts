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
