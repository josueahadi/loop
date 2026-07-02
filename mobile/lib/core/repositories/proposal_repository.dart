import '../api/api_client.dart';
import '../models/proposal.dart';

/// Proposals against the API. Owner sends + reviews; driver lists incoming + responds.
class ProposalRepository {
  final ApiClient _api;

  ProposalRepository({ApiClient? api}) : _api = api ?? ApiClient();

  // Owner → driver, at the job's posted price.
  Future<Proposal> send({required String jobId, required String driverId}) async {
    final res = await _api.dio
        .post('/jobs/$jobId/proposals', data: {'driverId': driverId});
    return Proposal.fromJson(res.data as Map<String, dynamic>);
  }

  // Owner: responses on their own job (driver contact appears once accepted).
  Future<List<Proposal>> forJob(String jobId) async {
    final res = await _api.dio.get('/jobs/$jobId/proposals');
    return (res.data as List)
        .map((p) => Proposal.fromJson(p as Map<String, dynamic>))
        .toList();
  }

  // Driver: incoming proposals (owner contact appears once accepted).
  Future<List<Proposal>> incoming() async {
    final res = await _api.dio.get('/proposals');
    return (res.data as List)
        .map((p) => Proposal.fromJson(p as Map<String, dynamic>))
        .toList();
  }

  // Driver accepts or declines.
  Future<Proposal> respond(String proposalId, String status) async {
    final res =
        await _api.dio.patch('/proposals/$proposalId', data: {'status': status});
    return Proposal.fromJson(res.data as Map<String, dynamic>);
  }
}
