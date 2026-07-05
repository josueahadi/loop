// Canonical client-side enums, mapped to the API's snake_case taxonomy. The app
// is fully on the NestJS API (no Firestore) — `UserRole`, `JobSize`, and
// `VehicleType` mirror the API enums via their `api` / `fromApi` helpers.

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

extension JobSizeX on JobSize {
  String get api => name; // small | medium | large

  String get label {
    switch (this) {
      case JobSize.small:
        return 'Small';
      case JobSize.medium:
        return 'Medium';
      case JobSize.large:
        return 'Large';
    }
  }

  static JobSize fromApi(String? value) {
    switch (value) {
      case 'small':
        return JobSize.small;
      case 'large':
        return JobSize.large;
      case 'medium':
      default:
        return JobSize.medium;
    }
  }
}

/// Canonical vehicle taxonomy — matches the API. Single source of truth.
enum VehicleType { moto, pickup, van, smallTruck, largeTruck }

extension VehicleTypeX on VehicleType {
  /// API snake_case value.
  String get api {
    switch (this) {
      case VehicleType.moto:
        return 'moto';
      case VehicleType.pickup:
        return 'pickup';
      case VehicleType.van:
        return 'van';
      case VehicleType.smallTruck:
        return 'small_truck';
      case VehicleType.largeTruck:
        return 'large_truck';
    }
  }

  String get label {
    switch (this) {
      case VehicleType.moto:
        return 'Moto';
      case VehicleType.pickup:
        return 'Pickup';
      case VehicleType.van:
        return 'Van';
      case VehicleType.smallTruck:
        return 'Small Truck';
      case VehicleType.largeTruck:
        return 'Large Truck';
    }
  }

  static VehicleType fromApi(String? value) {
    switch (value) {
      case 'pickup':
        return VehicleType.pickup;
      case 'van':
        return VehicleType.van;
      case 'small_truck':
        return VehicleType.smallTruck;
      case 'large_truck':
        return VehicleType.largeTruck;
      case 'moto':
      default:
        return VehicleType.moto;
    }
  }
}
