// Canonical domain enums — single source of truth shared by entities and DTOs.

export enum UserRole {
  CARGO_OWNER = 'cargo_owner',
  DRIVER = 'driver',
  ADMIN = 'admin',
}

export enum AvailabilityStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
}

// Canonical vehicle taxonomy (locked decision #8).
export enum VehicleType {
  MOTO = 'moto',
  PICKUP = 'pickup',
  VAN = 'van',
  SMALL_TRUCK = 'small_truck',
  LARGE_TRUCK = 'large_truck',
}

export enum JobStatus {
  DRAFT = 'draft',
  POSTED = 'posted',
  MATCHED = 'matched',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

// M8 pass-through payment lifecycle. Only the verified provider webhook moves a
// payment to a terminal state (successful | failed | cancelled).
export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESSFUL = 'successful',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum JobSize {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
}

export enum ProposalStatus {
  SENT = 'sent',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
}

export enum DocumentType {
  LICENCE = 'licence',
  NATIONAL_ID = 'national_id',
  VEHICLE_REG = 'vehicle_reg',
}

export enum VerificationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum ActionTokenType {
  PASSWORD_RESET = 'password_reset',
  EMAIL_VERIFY = 'email_verify',
}
