// Mirrors the NestJS UserResponseDto + AuthResult contract. The API is the source
// of truth for these shapes (generated types are a later DRY improvement).
export type UserRole = 'cargo_owner' | 'driver' | 'admin';

export interface CurrentUser {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  photoUrl: string | null;
  emailVerified: boolean;
  averageRating: number;
  ratingCount: number;
  createdAt: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: CurrentUser;
}
