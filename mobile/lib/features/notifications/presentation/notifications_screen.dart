import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../constants.dart';
import '../../../core/enums/app_enums.dart';
import '../../../core/models/app_notification.dart';
import '../../../core/repositories/job_repository.dart';
import '../../../core/repositories/notification_repository.dart';
import '../../../core/repositories/proposal_repository.dart';
import '../../../core/theme/ui_kit.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/notification_provider.dart';
import '../../../screens/driver_profile_edit_screen.dart';
import '../../driver/screens/driver_job_detail_screen.dart';
import '../../jobs/presentation/owner_job_detail_screen.dart';
import '../../proposals/presentation/driver_proposals_screen.dart';

/// The notification centre: a list of the user's notifications (proposal
/// received/accepted/declined, new message, verification decisions), newest
/// first, with unread highlighted and a "mark all read" action.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final _repo = NotificationRepository();
  late Future<NotificationsResult> _future;

  @override
  void initState() {
    super.initState();
    _future = _repo.list();
    // Opening the centre marks everything read (matches the badge clearing).
    WidgetsBinding.instance.addPostFrameCallback((_) => _markAllRead());
  }

  Future<void> _refresh() async {
    final next = _repo.list();
    setState(() {
      _future = next;
    });
    await next;
  }

  Future<void> _markAllRead() async {
    await _repo.markAllRead();
    if (!mounted) return;
    context.read<NotificationProvider>().clearUnread();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: () async {
              await _markAllRead();
              if (mounted) _refresh();
            },
            child: const Text('Mark all read'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<NotificationsResult>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            final items = snap.data?.notifications ?? const <AppNotification>[];
            if (items.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 120),
                  EmptyBlock(
                    icon: Icons.notifications_none,
                    title: 'No notifications yet',
                    subtitle:
                        "You'll see proposals, messages, and verification "
                        'updates here',
                  ),
                ],
              );
            }
            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              separatorBuilder: (context, index) => const SizedBox(height: 10),
              itemBuilder: (context, i) => _NotificationTile(item: items[i]),
            );
          },
        ),
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  final AppNotification item;
  const _NotificationTile({required this.item});

  ({IconData icon, Color color}) get _style {
    switch (item.type) {
      case 'proposal':
        return (icon: Icons.assignment_outlined, color: primaryGreen);
      case 'proposal_accepted':
        return (icon: Icons.check_circle_outline, color: primaryGreen);
      case 'proposal_declined':
        return (icon: Icons.cancel_outlined, color: Colors.red);
      case 'message':
        return (icon: Icons.chat_bubble_outline, color: primaryGreen);
      case 'verification_approved':
        return (icon: Icons.verified_outlined, color: primaryGreen);
      case 'verification_rejected':
        return (icon: Icons.error_outline, color: Colors.red);
      default:
        return (icon: Icons.notifications_none, color: textGray);
    }
  }

  String _timeAgo(DateTime d) {
    final diff = DateTime.now().difference(d);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }

  // Route to the screen where the user can act on this notification. We only
  // have {type, jobId} — not the full job/contact — so we land on the relevant
  // list rather than deep-linking a specific chat we can't reconstruct.
  // Open the thing the notification is about. Job-related types deep-link to
  // that job's detail (driver or owner variant); verification types open the
  // documents screen. Falls back gracefully if the job can't be loaded.
  Future<void> _onTap(BuildContext context) async {
    final auth = context.read<AuthProvider>();
    final isDriver = auth.user?.role == UserRole.driver;
    final jobId = item.data['jobId'] as String?;
    final nav = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);

    switch (item.type) {
      case 'verification_approved':
      case 'verification_rejected':
        nav.push(
          MaterialPageRoute(
            builder: (_) =>
                const DriverProfileEditScreen(scrollToDocuments: true),
          ),
        );
        return;
      case 'proposal':
      case 'proposal_accepted':
      case 'proposal_declined':
      case 'message':
        if (jobId == null) return;
        try {
          if (isDriver) {
            // Find the driver's proposal for this job → job-detail screen.
            final proposals = await ProposalRepository().incoming();
            final match = proposals.where((p) => p.jobId == jobId).toList();
            if (match.isEmpty) {
              nav.push(
                MaterialPageRoute(
                  builder: (_) => const DriverProposalsScreen(),
                ),
              );
              return;
            }
            nav.push(
              MaterialPageRoute(
                builder: (_) => DriverJobDetailScreen(proposal: match.first),
              ),
            );
          } else {
            final job = await JobRepository().getById(jobId);
            nav.push(
              MaterialPageRoute(
                builder: (_) => OwnerJobDetailScreen(job: job),
              ),
            );
          }
        } catch (_) {
          messenger.showSnackBar(
            const SnackBar(content: Text('Could not open this item.')),
          );
        }
        return;
      default:
        return;
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = _style;
    return InkWell(
      onTap: () => _onTap(context),
      borderRadius: BorderRadius.circular(12),
      child: AppCard(
        color: item.read ? null : kTintGreen,
        padding: const EdgeInsets.all(14),
        child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(s.icon, color: s.color, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.title,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14.5,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  item.body,
                  style: const TextStyle(fontSize: 13, color: textGray),
                ),
                const SizedBox(height: 6),
                Text(
                  _timeAgo(item.createdAt),
                  style: const TextStyle(fontSize: 11.5, color: textGray),
                ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
