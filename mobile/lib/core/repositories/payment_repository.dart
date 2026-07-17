import '../api/api_client.dart';

/// One payment record for a job (pass-through). Null status fields until settled.
class PaymentInfo {
  final String paymentId;
  final String jobId;
  final int amount; // whole RWF
  final String currency;
  final String status; // pending | successful | failed | cancelled
  final String? paidAt;
  final String? failureReason;

  const PaymentInfo({
    required this.paymentId,
    required this.jobId,
    required this.amount,
    required this.currency,
    required this.status,
    required this.paidAt,
    required this.failureReason,
  });

  bool get isSuccessful => status == 'successful';
  bool get isPending => status == 'pending';
  bool get isFailed => status == 'failed' || status == 'cancelled';

  factory PaymentInfo.fromJson(Map<String, dynamic> j) => PaymentInfo(
    paymentId: j['payment_id'] as String,
    jobId: j['job_id'] as String,
    amount: (j['amount'] as num).toInt(),
    currency: j['currency'] as String? ?? 'RWF',
    status: j['status'] as String,
    paidAt: j['paid_at'] as String?,
    failureReason: j['failure_reason'] as String?,
  );
}

/// Pass-through payments against the API. Loop never holds funds — this only
/// initiates a checkout and reads back the webhook-confirmed status.
class PaymentRepository {
  final ApiClient _api;

  PaymentRepository({ApiClient? api}) : _api = api ?? ApiClient();

  /// Owner initiates payment on a completed job; returns the checkout URL to
  /// open. The amount is locked server-side to the posted price.
  Future<String> initiate(String jobId) async {
    final res = await _api.dio.post('/jobs/$jobId/payment');
    return res.data['checkout_url'] as String;
  }

  /// Current payment for a job (participants only). Null when none exists yet.
  Future<PaymentInfo?> forJob(String jobId) async {
    final res = await _api.dio.get('/jobs/$jobId/payment');
    final data = res.data;
    if (data == null) return null;
    return PaymentInfo.fromJson(data as Map<String, dynamic>);
  }
}
