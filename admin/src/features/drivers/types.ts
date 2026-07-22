export type DriverAvailabilityStatus = 'online' | 'offline' | null;
export type DriverMatchabilityStatus = 'matchable' | 'blocked';

export interface AdminDriver {
  id: string;
  name: string;
  email: string;
  phone: string;
  availabilityStatus: DriverAvailabilityStatus;
  suspendedAt: string | null;
  vehicleCount: number;
  approvedDocumentCount: number;
  matchabilityStatus: DriverMatchabilityStatus;
  missing: string[];
}
