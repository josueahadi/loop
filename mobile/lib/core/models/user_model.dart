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
      driverLicenseNumber: json['licenseNumber'] as String?,
    );
  }

  /// Body for `PATCH /me` (profile edit). Only fields the API accepts.
  Map<String, dynamic> toUpdateJson() {
    return {
      'name': name,
      'phone': phoneNumber,
      if (profileImageUrl != null) 'photoUrl': profileImageUrl,
      if (driverLicenseNumber != null && driverLicenseNumber!.isNotEmpty)
        'licenseNumber': driverLicenseNumber,
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

}
