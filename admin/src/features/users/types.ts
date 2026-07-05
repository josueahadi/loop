export type AdminUserRole = 'cargo_owner' | 'driver' | 'admin';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: AdminUserRole;
  emailVerifiedAt: string | null;
  averageRating: string | number;
  ratingCount: number;
  createdAt: string;
}
