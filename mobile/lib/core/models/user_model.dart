import '../enums/app_enums.dart';

/// User profile, now backed by the NestJS API (`GET /me`) instead of Firestore.
///
/// The lean `/me` payload populates the core identity fields. Driver vehicle and
/// verification-document fields remain on the model as nullable placeholders —
/// they are sourced from the `/vehicles` and `/verification` endpoints in M2+,
/// not from `/me`. Out-of-scope cargo-owner business credentials have been removed.
class UserModel {
  final String uid;
  final String name;
  final String email;
  final String phoneNumber;
  final UserRole role;

  /// Whether the user's email is verified. NOTE: this is email verification, which
  /// is non-blocking in the MVP. Driver document-approval is tracked separately via
  /// the verification records endpoint.
  final bool isVerified;
  final String? profileImageUrl;
  final DateTime createdAt;
  final DateTime updatedAt;

  // ---- Driver-only fields (sourced from /vehicles + /verification in M2+) ----
  final String? driverLicense; // document reference
  final String? driverLicenseNumber;
  final String? plateNumber;
  final String? nationalId; // document reference
  final String? vehicleRegistration; // document reference
  final String? vehicleType;
  final String? vehicleCapacity;
  final String? vehicleImageUrl;
  final bool? isAvailable;
  final double? rating;
  final int? completedJobs;

  // ---- Address fields ----
  final String? street;
  final String? city;
  final String? state;
  final String? postalCode;
  final String? country;

  UserModel({
    required this.uid,
    required this.name,
    required this.email,
    required this.phoneNumber,
    required this.role,
    this.isVerified = false,
    this.profileImageUrl,
    required this.createdAt,
    required this.updatedAt,
    this.driverLicense,
    this.driverLicenseNumber,
    this.nationalId,
    this.vehicleRegistration,
    this.vehicleType,
    this.vehicleCapacity,
    this.vehicleImageUrl,
    this.isAvailable,
    this.rating,
    this.completedJobs,
    this.plateNumber,
    this.street,
    this.city,
    this.state,
    this.postalCode,
    this.country,
  });

  /// Builds from the API `/me` response shape.
  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      uid: json['id'] as String,
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      phoneNumber: json['phone'] ?? '',
      role: UserRoleX.fromApi(json['role'] as String?),
      isVerified: json['emailVerified'] ?? false,
      profileImageUrl: json['photoUrl'],
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : DateTime.now(),
      updatedAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : DateTime.now(),
      isAvailable: json['availabilityStatus'] != null
          ? json['availabilityStatus'] == 'online'
          : null,
      rating: (json['averageRating'] as num?)?.toDouble(),
    );
  }

  /// Body for `PATCH /me` (profile edit). Only fields the API accepts.
  Map<String, dynamic> toUpdateJson() {
    return {
      'name': name,
      'phone': phoneNumber,
      if (profileImageUrl != null) 'photoUrl': profileImageUrl,
    };
  }

  UserModel copyWith({
    String? name,
    String? email,
    String? phoneNumber,
    UserRole? role,
    bool? isVerified,
    String? profileImageUrl,
    DateTime? updatedAt,
    String? driverLicense,
    String? driverLicenseNumber,
    String? nationalId,
    String? vehicleRegistration,
    String? vehicleType,
    String? vehicleCapacity,
    String? vehicleImageUrl,
    bool? isAvailable,
    double? rating,
    int? completedJobs,
    String? plateNumber,
    String? street,
    String? city,
    String? state,
    String? postalCode,
    String? country,
  }) {
    return UserModel(
      uid: uid,
      name: name ?? this.name,
      email: email ?? this.email,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      role: role ?? this.role,
      isVerified: isVerified ?? this.isVerified,
      profileImageUrl: profileImageUrl ?? this.profileImageUrl,
      createdAt: createdAt,
      updatedAt: updatedAt ?? DateTime.now(),
      driverLicense: driverLicense ?? this.driverLicense,
      driverLicenseNumber: driverLicenseNumber ?? this.driverLicenseNumber,
      nationalId: nationalId ?? this.nationalId,
      vehicleRegistration: vehicleRegistration ?? this.vehicleRegistration,
      vehicleType: vehicleType ?? this.vehicleType,
      vehicleCapacity: vehicleCapacity ?? this.vehicleCapacity,
      vehicleImageUrl: vehicleImageUrl ?? this.vehicleImageUrl,
      isAvailable: isAvailable ?? this.isAvailable,
      rating: rating ?? this.rating,
      completedJobs: completedJobs ?? this.completedJobs,
      plateNumber: plateNumber ?? this.plateNumber,
      street: street ?? this.street,
      city: city ?? this.city,
      state: state ?? this.state,
      postalCode: postalCode ?? this.postalCode,
      country: country ?? this.country,
    );
  }

  // ---- Compatibility getters used across existing screens ----
  String get firstName =>
      name.split(' ').isNotEmpty ? name.split(' ').first : '';
  String get lastName =>
      name.split(' ').length > 1 ? name.split(' ').sublist(1).join(' ') : '';
  String get fullName => name;
  String? get profilePictureUrl => profileImageUrl;
  bool get isDriver => role == UserRole.driver;
  bool get isCargoOwner => role == UserRole.cargoOwner;

  Map<String, dynamic>? get primaryVehicle => vehicleType != null
      ? {
          'type': vehicleType,
          'capacity': vehicleCapacity,
          'registration': vehicleRegistration,
        }
      : null;

  Map<String, String>? get address {
    if (street != null ||
        city != null ||
        state != null ||
        postalCode != null ||
        country != null) {
      return {
        if (street != null) 'street': street!,
        if (city != null) 'city': city!,
        if (state != null) 'state': state!,
        if (postalCode != null) 'postalCode': postalCode!,
        if (country != null) 'country': country!,
      };
    }
    return null;
  }

  String get fullAddress {
    final parts = <String>[];
    if (street?.isNotEmpty == true) parts.add(street!);
    if (city?.isNotEmpty == true) parts.add(city!);
    if (state?.isNotEmpty == true) parts.add(state!);
    if (postalCode?.isNotEmpty == true) parts.add(postalCode!);
    if (country?.isNotEmpty == true) parts.add(country!);
    return parts.join(', ');
  }
}
