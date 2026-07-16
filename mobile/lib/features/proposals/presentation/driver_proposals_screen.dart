import 'package:flutter/material.dart';
import '../../../core/errors/error_messages.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../constants.dart';
import '../../../core/enums/app_enums.dart';
import '../../../core/models/proposal.dart';
import '../../driver/widgets/driver_job_actions.dart';
import '../../../core/repositories/proposal_repository.dart';
import '../../chat/presentation/job_chat_screen.dart';
import '../../ratings/presentation/rating_screen.dart';

/// Driver's incoming proposals (M4): accept / decline. Once accepted, the owner's
/// contact, a call button, Open in Maps, and chat appear — never before.
class DriverProposalsScreen extends StatefulWidget {
  const DriverProposalsScreen({super.key});

  @override
  State<DriverProposalsScreen> createState() => _DriverProposalsScreenState();
}

class _DriverProposalsScreenState extends State<DriverProposalsScreen> {
  final _repo = ProposalRepository();
  final _rated = <String>{}; // jobIds the driver has rated this session
  final _responding = <String>{};
  late Future<List<Proposal>> _future;

  @override
  void initState() {
    super.initState();
    _future = _repo.incoming();
  }

  Future<void> _refresh() async {
    final next = _repo.incoming();
    setState(() {
      _future = next;
    });
    await next;
  }

  Future<void> _respond(Proposal p, String status) async {
    if (_responding.contains(p.id)) return;
    setState(() => _responding.add(p.id));
    try {
      await _repo.respond(p.id, status);
      await _refresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(friendlyErrorMessage(e)),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _responding.remove(p.id));
    }
  }

  Future<void> _call(String phone) async =>
      launchUrl(Uri(scheme: 'tel', path: phone));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Proposals')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<List<Proposal>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            final items = snap.data ?? [];
            if (items.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 120),
                  Center(child: Text('No proposals yet')),
                ],
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              separatorBuilder: (context, index) => const SizedBox(height: 10),
              itemBuilder: (_, i) => _card(items[i]),
            );
          },
        ),
      ),
    );
  }

  Widget _card(Proposal p) {
    final job = p.job;
    final responding = _responding.contains(p.id);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    job?.cargoType ?? 'Job',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                ),
                _statusChip(p.status),
              ],
            ),
            const SizedBox(height: 6),
            if (job != null) ...[
              Text(
                '${job.pickupLabel ?? 'Pickup'} → ${job.dropOffLabel ?? 'Drop-off'}',
                style: const TextStyle(color: textGray),
              ),
              const SizedBox(height: 4),
              Text(
                '${job.reqVehicleType.label} · ${job.price} RWF',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ],
            const SizedBox(height: 12),
            if (p.status == 'sent')
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: responding
                          ? null
                          : () => _respond(p, 'declined'),
                      child: responding
                          ? const Text('Working...')
                          : const Text('Decline'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: primaryGreen,
                        foregroundColor: Colors.white,
                      ),
                      onPressed: responding
                          ? null
                          : () => _respond(p, 'accepted'),
                      child: responding
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Accept'),
                    ),
                  ),
                ],
              ),
            // Contact + actions ONLY once accepted (contact is null otherwise).
            if (p.isAccepted && p.contact != null && job != null)
              _acceptedActions(p, job),
          ],
        ),
      ),
    );
  }

  Widget _acceptedActions(Proposal p, ProposalJob job) {
    final c = p.contact!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Divider(),
        Text(
          'Owner: ${c.name}',
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        Text(c.phone, style: const TextStyle(color: textGray)),
        const SizedBox(height: 8),
        DriverJobActions(
          pickup: job.pickup,
          pickupLabel: job.pickupLabel,
          ownerPhone: c.phone,
          isCompleted: job.status == 'completed',
          alreadyRated: _rated.contains(p.jobId),
          onChat: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => JobChatScreen(jobId: p.jobId, contact: c),
            ),
          ),
          onCall: () => _call(c.phone),
          onRate: () => _rate(p.jobId, c.name),
        ),
      ],
    );
  }

  Future<void> _rate(String jobId, String name) async {
    final done = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => RatingScreen(jobId: jobId, counterpartyName: name),
      ),
    );
    if (done == true && mounted) setState(() => _rated.add(jobId));
  }

  Widget _statusChip(String s) => Chip(
    label: Text(s, style: const TextStyle(fontSize: 12)),
    visualDensity: VisualDensity.compact,
    backgroundColor: s == 'accepted'
        ? lightGreen
        : s == 'declined'
        ? const Color(0xFFF1F1F1)
        : searchBg,
  );
}
