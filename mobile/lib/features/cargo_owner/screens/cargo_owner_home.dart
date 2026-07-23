import 'package:cargo_app/constants.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/enums/app_enums.dart';
import '../../../core/models/job.dart';
import '../../../core/models/user_model.dart';
import '../../../core/repositories/job_repository.dart';
import '../../jobs/presentation/owner_job_detail_screen.dart';
import '../../ratings/presentation/my_ratings_screen.dart';
import '../../notifications/presentation/notification_bell.dart';
import '../../notifications/presentation/notifications_screen.dart';
import '../../../providers/notification_provider.dart';
import '../../../providers/auth_provider.dart';
import '../../../mixins/logout_mixin.dart';
import '../../../features/profile/providers/profile_provider.dart';
import '../../../core/widgets/profile_widgets.dart';
import '../../../screens/create_job_screen.dart';
import '../../../screens/cargo_owner_profile_edit_screen.dart';
import '../../../screens/help_support_screen.dart';
import '../../matching/presentation/nearby_drivers_map.dart';
import '../../../core/theme/ui_kit.dart';

class CargoOwnerHome extends StatefulWidget {
  const CargoOwnerHome({super.key});

  @override
  State<CargoOwnerHome> createState() => _CargoOwnerHomeState();
}

class _CargoOwnerHomeState extends State<CargoOwnerHome>
    with WidgetsBindingObserver {
  int _selectedIndex = 0;
  // Bumped to remount the job-list tabs so they re-fetch: after posting a job,
  // on returning to a job tab, and when the app resumes — so a status change
  // made elsewhere (e.g. a driver accepting) is reflected without a manual pull.
  int _reloadKey = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Refetch job state + unread notifications when the owner returns.
    if (state == AppLifecycleState.resumed) {
      _reloadJobs();
      context.read<NotificationProvider>().refreshUnread();
    }
  }

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
      // Landing on the Dashboard (0) or My Jobs (2) → refetch so job statuses
      // (matched/in-progress/completed) are current.
      if (index == 0 || index == 2) _reloadKey++;
    });
  }

  void _reloadJobs() {
    setState(() => _reloadKey++);
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> pages = [
      _DashboardTab(key: ValueKey('dashboard-$_reloadKey')),
      const NearbyDriversMap(),
      _MyJobsTab(key: ValueKey('myjobs-$_reloadKey')),
      const _ProfileTab(),
    ];

    return Scaffold(
      appBar: AppBar(
        title: RichText(
          text: TextSpan(
            style: const TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 22,
              fontFamily: 'PaytoneOne',
            ),
            children: [
              const TextSpan(
                text: 'L',
                style: TextStyle(color: Colors.black),
              ),
              TextSpan(
                text: 'oo',
                style: TextStyle(color: primaryGreen),
              ),
              const TextSpan(
                text: 'p',
                style: TextStyle(color: Colors.black),
              ),
            ],
          ),
        ),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        automaticallyImplyLeading: false,
        actions: const [NotificationBell()],
      ),
      body: pages[_selectedIndex],
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        items: const <BottomNavigationBarItem>[
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard),
            label: 'Dashboard',
          ),
          BottomNavigationBarItem(icon: Icon(Icons.map), label: 'Nearby'),
          BottomNavigationBarItem(icon: Icon(Icons.work), label: 'My Jobs'),
          BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Profile'),
        ],
        currentIndex: _selectedIndex,
        selectedItemColor: primaryGreen,
        onTap: _onItemTapped,
      ),
      floatingActionButton: _selectedIndex == 0 || _selectedIndex == 2
          ? FloatingActionButton.extended(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const CreateJobScreen(),
                  ),
                ).then((_) => _reloadJobs());
              },
              backgroundColor: appGreen,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add),
              label: const Text('New Job'),
            )
          : null,
    );
  }
}

// Owner dashboard — all data from the jobs API (Postgres), no Firestore.
class _DashboardTab extends StatefulWidget {
  const _DashboardTab({super.key});

  @override
  State<_DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<_DashboardTab> {
  final _jobs = JobRepository();
  late Future<List<Job>> _future;

  @override
  void initState() {
    super.initState();
    _future = _jobs.listOwn();
  }

  Future<void> _refresh() async {
    final next = _jobs.listOwn();
    setState(() {
      _future = next;
    });
    // The FutureBuilder surfaces any error via snapshot.hasError; awaiting here
    // is only to hold the RefreshIndicator spinner, so swallow failures rather
    // than letting them become an unhandled exception.
    try {
      await next;
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;

    return RefreshIndicator(
      onRefresh: _refresh,
      child: FutureBuilder<List<Job>>(
        future: _future,
        builder: (context, snap) {
          final jobs = snap.data ?? const <Job>[];
          final loading = snap.connectionState == ConnectionState.waiting;
          bool isStatus(Job j, List<String> s) => s.contains(j.status);

          return SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Welcome Section
                AppCard(
                  color: kTintGreen,
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Welcome back, ${user?.name ?? 'User'}!',
                        style: const TextStyle(
                          fontSize: 19,
                          fontWeight: FontWeight.w800,
                          color: textDark,
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Need cargo transported? Create a new job to get started.',
                        style: TextStyle(fontSize: 13.5, color: kMutedText),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: kGap),

                // Quick Stats
                Row(
                  children: [
                    Expanded(
                      child: StatTile(
                        label: 'Total Jobs',
                        value: '${jobs.length}',
                        icon: Icons.work_outline,
                        accent: textDark,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: StatTile(
                        label: 'Completed',
                        value:
                            '${jobs.where((j) => isStatus(j, ['completed'])).length}',
                        icon: Icons.check_circle_outline,
                        accent: primaryGreen,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: StatTile(
                        label: 'Posted',
                        value:
                            '${jobs.where((j) => isStatus(j, ['posted'])).length}',
                        icon: Icons.pending_outlined,
                        accent: Colors.orange,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: StatTile(
                        label: 'In Progress',
                        value:
                            '${jobs.where((j) => isStatus(j, ['matched', 'accepted', 'in_progress'])).length}',
                        icon: Icons.local_shipping_outlined,
                        accent: primaryGreen,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // Recent Jobs Section
                SectionHeader(
                  title: 'Recent Jobs',
                  action: TextButton(
                    onPressed: () {
                      context
                          .findAncestorStateOfType<_CargoOwnerHomeState>()
                          ?._onItemTapped(2);
                    },
                    child: const Text('View All'),
                  ),
                ),

                if (loading)
                  const Padding(
                    padding: EdgeInsets.only(top: 24),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (snap.hasError)
                  const Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: Text(
                      "Couldn't load your jobs. Pull down to retry.",
                      style: TextStyle(color: textGray),
                    ),
                  )
                else if (jobs.isEmpty)
                  const EmptyBlock(
                    icon: Icons.work_off_outlined,
                    title: 'No jobs yet',
                    subtitle: 'Create your first job to get started',
                  )
                else
                  ...jobs
                      .take(3)
                      .map((j) => _OwnerJobCard(job: j, onChanged: _refresh)),
              ],
            ),
          );
        },
      ),
    );
  }
}

// Owner's posted jobs, loaded from the jobs API (M3). The driver's booking view
// stays on Firestore until the M4 transaction loop.
class _MyJobsTab extends StatefulWidget {
  const _MyJobsTab({super.key});

  @override
  State<_MyJobsTab> createState() => _MyJobsTabState();
}

class _MyJobsTabState extends State<_MyJobsTab> {
  final _jobs = JobRepository();
  late Future<List<Job>> _future;

  @override
  void initState() {
    super.initState();
    _future = _jobs.listOwn();
  }

  Future<void> _refresh() async {
    final next = _jobs.listOwn();
    setState(() {
      _future = next;
    });
    // The FutureBuilder surfaces any error via snapshot.hasError; awaiting here
    // is only to hold the RefreshIndicator spinner, so swallow failures rather
    // than letting them become an unhandled exception.
    try {
      await next;
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _refresh,
      child: FutureBuilder<List<Job>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return ListView(
              children: const [
                SizedBox(height: 120),
                Center(
                  child: Text(
                    "Couldn't load your jobs. Pull down to retry.",
                    style: TextStyle(color: textGray),
                  ),
                ),
              ],
            );
          }
          final jobs = snap.data ?? [];
          if (jobs.isEmpty) {
            return ListView(
              children: const [
                SizedBox(height: 120),
                Icon(Icons.work_off, size: 64, color: Colors.grey),
                SizedBox(height: 16),
                Center(
                  child: Text(
                    'No jobs yet',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.grey,
                    ),
                  ),
                ),
                SizedBox(height: 8),
                Center(
                  child: Text(
                    'Create your first job to get started',
                    style: TextStyle(color: Colors.grey),
                  ),
                ),
              ],
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: jobs.length,
            separatorBuilder: (context, index) => const SizedBox(height: 8),
            itemBuilder: (context, i) {
              final j = jobs[i];
              return Card(
                child: ListTile(
                  title: Text(j.cargoType),
                  subtitle: Text(
                    '${j.reqVehicleType.label} · ${j.size.label} · ${j.price} RWF',
                  ),
                  trailing: Chip(
                    label: Text(j.status.replaceAll('_', ' ')),
                    visualDensity: VisualDensity.compact,
                  ),
                  onTap: () async {
                    await Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => OwnerJobDetailScreen(job: j),
                      ),
                    );
                    await _refresh();
                  },
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _ProfileTab extends StatelessWidget with LogoutMixin {
  const _ProfileTab();

  @override
  Widget build(BuildContext context) {
    return Consumer2<AuthProvider, ProfileProvider>(
      builder: (context, authProvider, profileProvider, child) {
        final user =
            profileProvider.currentUser ?? authProvider.user as UserModel;

        // Pull-to-refresh re-fetches the user so the rating updates after a
        // driver rates this owner (otherwise stale until app restart).
        return RefreshIndicator(
          onRefresh: authProvider.refreshUserData,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
            child: Column(
              children: [
                _ProfileHeader(user: user),
                const SizedBox(height: 20),

                // Account
                ProfileGroup(
                  children: [
                    ProfileOption(
                      icon: Icons.person_outline,
                      title: 'Edit Profile',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const CargoOwnerProfileEditScreen(),
                        ),
                      ),
                    ),
                    ProfileOption(
                      icon: Icons.star_outline,
                      title: 'My Ratings',
                      subtitle: user.rating != null
                          ? '${user.rating!.toStringAsFixed(1)} average'
                          : 'View ratings you received',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const MyRatingsScreen(),
                        ),
                      ),
                    ),
                    ProfileOption(
                      icon: Icons.notifications_none,
                      title: 'Notifications',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const NotificationsScreen(),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Support
                ProfileGroup(
                  children: [
                    ProfileOption(
                      icon: Icons.help_outline,
                      title: 'Help & Support',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const HelpSupportScreen(),
                        ),
                      ),
                    ),
                    ProfileOption(
                      icon: Icons.info_outline,
                      title: 'About',
                      onTap: () => showAboutDialog(
                        context: context,
                        applicationName: 'Loop',
                        applicationVersion: '1.0.0',
                        applicationLegalese:
                            '© 2026 Habib Josue Ahadi. All rights reserved.',
                        children: const [
                          SizedBox(height: 12),
                          Text(
                            'Real-time geo-matching for cargo owners and drivers '
                            'in Rwanda.',
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Sign out
                ProfileGroup(
                  children: [
                    ProfileOption(
                      icon: Icons.logout,
                      title: 'Logout',
                      isDestructive: true,
                      onTap: () => showLogoutConfirmation(context),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

}

// Owner's job card — API Job model. Opens the API-backed OwnerJobDetailScreen.
class _OwnerJobCard extends StatelessWidget {
  final Job job;
  final Future<void> Function() onChanged;

  const _OwnerJobCard({required this.job, required this.onChanged});

  Color get _statusColor {
    switch (job.status) {
      case 'posted':
        return Colors.orange;
      case 'matched':
      case 'accepted':
      case 'in_progress':
        return primaryGreen;
      case 'completed':
        return Colors.black;
      case 'cancelled':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () async {
          await Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => OwnerJobDetailScreen(job: job)),
          );
          await onChanged();
        },
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      job.cargoType,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: _statusColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      job.status.replaceAll('_', ' '),
                      style: TextStyle(
                        fontSize: 12,
                        color: _statusColor,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              _LocationRow(
                icon: Icons.my_location,
                text: job.pickupLabel ?? 'Pickup pinned on map',
              ),
              const SizedBox(height: 4),
              _LocationRow(
                icon: Icons.flag_outlined,
                text: job.dropOffLabel ?? 'Drop-off pinned on map',
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(
                    Icons.local_shipping,
                    size: 16,
                    color: Colors.grey,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '${job.reqVehicleType.label} · ${job.size.label}',
                    style: const TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                  const Spacer(),
                  Text(
                    '${job.price} RWF',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: primaryGreen,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LocationRow extends StatelessWidget {
  final IconData icon;
  final String text;

  const _LocationRow({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: Colors.grey),
        const SizedBox(width: 4),
        Expanded(child: Text(text, style: const TextStyle(fontSize: 14))),
      ],
    );
  }
}

// Modernised profile header: avatar in a soft ring on a tinted gradient card,
// name, email, a role chip, and the rating inline when present.
class _ProfileHeader extends StatelessWidget {
  final UserModel user;
  const _ProfileHeader({required this.user});

  @override
  Widget build(BuildContext context) {
    final initial = user.name.isNotEmpty ? user.name[0].toUpperCase() : 'U';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [kTintGreen, lightGreen],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kSubtleBorder),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: primaryGreen.withValues(alpha: 0.25),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: CircleAvatar(
              radius: 40,
              backgroundColor: primaryGreen,
              child: Text(
                initial,
                style: const TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            user.name,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: textDark,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            user.email,
            style: const TextStyle(fontSize: 13.5, color: kMutedText),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              const ProfilePill(
                icon: Icons.local_shipping_outlined,
                label: 'Cargo Owner',
                filled: true,
              ),
              if (user.rating != null)
                ProfilePill(
                  icon: Icons.star,
                  label: user.rating!.toStringAsFixed(1),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
