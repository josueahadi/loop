// Canonical client-side enums.
//
// M1 reconciles `UserRole` (now includes admin + API snake_case mapping) since the
// auth path needs it. The booking-surface enums below (`BookingStatus`,
// `VehicleType`, `VehicleCapacity`) are the legacy copies still consumed by the
// not-yet-migrated booking/chat screens; they are reconciled to the canonical API
// taxonomy in M2 (matching) and M3 (jobs).

enum UserRole { cargoOwner, driver, admin }

extension UserRoleX on UserRole {
  /// API uses snake_case: cargo_owner | driver | admin.
  String get api {
    switch (this) {
      case UserRole.cargoOwner:
        return 'cargo_owner';
      case UserRole.driver:
        return 'driver';
      case UserRole.admin:
        return 'admin';
    }
  }

  static UserRole fromApi(String? value) {
    switch (value) {
      case 'driver':
        return UserRole.driver;
      case 'admin':
        return UserRole.admin;
      case 'cargo_owner':
      default:
        return UserRole.cargoOwner;
    }
  }
}

/// Job size buckets — key the pricing size-multiplier lookup (used from M3).
enum JobSize { small, medium, large }

// ---- Legacy booking-surface enums (reconciled in M2/M3) ----
enum BookingStatus { pending, confirmed, inProgress, completed, cancelled }

enum VehicleType { truck, van, pickup, lorry }

enum VehicleCapacity {
  small, // Under 1 ton
  medium, // 1-3 tons
  large, // 3-5 tons
  extraLarge, // 5+ tons
}
