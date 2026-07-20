import 'package:latlong2/latlong.dart';

import '../enums/app_enums.dart';

class ProposalContact {
  final String name;
  final String phone;
  const ProposalContact({required this.name, required this.phone});

  factory ProposalContact.fromJson(Map<String, dynamic> j) =>
      ProposalContact(name: j['name'] as String, phone: j['phone'] as String);
}

class ProposalJob {
  final String id;
  final String cargoType;
  final String? pickupLabel;
  final String? dropOffLabel;
  final LatLng pickup;
  final LatLng dropOff;
  final int price;
  final int? estimatedPrice;
  final VehicleType reqVehicleType;
  final String status;

  const ProposalJob({
    required this.id,
    required this.cargoType,
    this.pickupLabel,
    this.dropOffLabel,
    required this.pickup,
    required this.dropOff,
    required this.price,
    this.estimatedPrice,
    required this.reqVehicleType,
    required this.status,
  });

  static LatLng _ll(Map<String, dynamic>? m) => LatLng(
    (m?['lat'] as num?)?.toDouble() ?? 0,
    (m?['lng'] as num?)?.toDouble() ?? 0,
  );

  factory ProposalJob.fromJson(Map<String, dynamic> j) => ProposalJob(
    id: j['id'] as String,
    cargoType: j['cargoType'] as String? ?? '',
    pickupLabel: j['pickupLabel'] as String?,
    dropOffLabel: j['dropOffLabel'] as String?,
    pickup: _ll(j['pickup'] as Map<String, dynamic>?),
    dropOff: _ll(j['dropOff'] as Map<String, dynamic>?),
    price: (j['price'] as num?)?.toInt() ?? 0,
    estimatedPrice: (j['estimatedPrice'] as num?)?.toInt(),
    reqVehicleType: VehicleTypeX.fromApi(j['reqVehicleType'] as String?),
    status: j['status'] as String? ?? '',
  );
}

/// A proposal, matching the API. `contact` is present ONLY when accepted.
class Proposal {
  final String id;
  final String jobId;
  final String driverId;
  final String status; // sent | accepted | declined
  final DateTime createdAt;
  final DateTime? respondedAt;
  final ProposalJob? job;
  final ProposalContact? contact;

  const Proposal({
    required this.id,
    required this.jobId,
    required this.driverId,
    required this.status,
    required this.createdAt,
    this.respondedAt,
    this.job,
    this.contact,
  });

  bool get isAccepted => status == 'accepted';

  // The proposal stays 'accepted' for the life of the job; whether the work is
  // still in-flight depends on the JOB's status. A completed/cancelled job is
  // done, not active.
  bool get isJobDone =>
      job?.status == 'completed' || job?.status == 'cancelled';

  // An active job for the driver: they accepted it and it isn't finished yet.
  bool get isActiveJob => isAccepted && !isJobDone;

  factory Proposal.fromJson(Map<String, dynamic> j) => Proposal(
    id: j['id'] as String,
    jobId: j['jobId'] as String,
    driverId: j['driverId'] as String,
    status: j['status'] as String,
    createdAt: DateTime.parse(j['createdAt'] as String),
    respondedAt: j['respondedAt'] == null
        ? null
        : DateTime.parse(j['respondedAt'] as String),
    job: j['job'] == null
        ? null
        : ProposalJob.fromJson(j['job'] as Map<String, dynamic>),
    contact: j['contact'] == null
        ? null
        : ProposalContact.fromJson(j['contact'] as Map<String, dynamic>),
  );
}
