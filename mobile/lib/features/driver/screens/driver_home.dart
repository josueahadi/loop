import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/enums/app_enums.dart';
import '../../../core/models/proposal.dart';
import '../../../core/navigation/open_in_maps.dart';
import '../../../providers/auth_provider.dart';
import '../../../core/location/enable_location_prompt.dart';
import '../../../core/location/location_service.dart';
import '../../../core/repositories/proposal_repository.dart';
import '../../../core/repositories/message_repository.dart';
import '../../../core/repositories/vehicle_repository.dart';
import '../../../core/repositories/verification_repository.dart';
import '../../../constants.dart';
import '../../../screens/driver_profile_edit_screen.dart';
import '../../chat/presentation/job_chat_screen.dart';
import '../../proposals/presentation/driver_proposals_screen.dart';
import '../../ratings/presentation/my_ratings_screen.dart';
import '../../notifications/presentation/notification_bell.dart';
import '../../../providers/notification_provider.dart';
import 'driver_job_detail_screen.dart';
import '../../../screens/vehicle_details_screen.dart';
import '../widgets/driver_verification_banner.dart';
import '../../../core/theme/ui_kit.dart';
import 'driver_location_screen.dart';
import '../../../screens/settings_screen.dart';
import '../../../screens/help_support_screen.dart';
import '../../../features/profile/providers/profile_provider.dart';

class DriverHome extends StatefulWidget {
  const DriverHome({super.key});

  @override
  State<DriverHome> createState() => _DriverHomeState();
}

class _DriverHomeState extends State<DriverHome> with WidgetsBindingObserver {
  int _selectedIndex = 0;
  final _proposalRepository = ProposalRepository();
  final _vehicleRepository = VehicleRepository();
  final _verificationRepository = VerificationRepository();
  int _pendingProposalCount = 0;
  // Bumped whenever a proposal is answered so ALL tabs remount + refetch and the
  // header badge recounts — the three tabs otherwise hold independent futures.
  int _reloadCounter = 0;

  void _onProposalsChanged() {
    _loadProposalCount();
    setState(() => _reloadCounter++);
  }

  static const _requiredDocuments = {'licence', 'national_id', 'vehicle_reg'};

  NotificationProvider? _notifications;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
      // A new notification (e.g. a message) → remount cards so their unread
      // message counts refetch. Kept separate from the badge's own refresh.
      _notifications = context.read<NotificationProvider>()
        ..addListener(_onNotificationsChanged);
    });
  }

  void _onNotificationsChanged() {
    if (mounted) setState(() => _reloadCounter++);
  }

  @override
  void dispose() {
    _notifications?.removeListener(_onNotificationsChanged);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // On resume, recount pending proposals + unread notifications, and remount
    // tabs so anything that changed while away is reflected.
    if (state == AppLifecycleState.resumed) {
      _onProposalsChanged();
      context.read<NotificationProvider>().refreshUnread();
    }
  }

  void _loadData() {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    if (authProvider.user != null) {
      _loadProposalCount();
    }
  }

  Future<void> _loadProposalCount() async {
    try {
      final proposals = await _proposalRepository.incoming();
      if (!mounted) return;
      setState(() {
        _pendingProposalCount = proposals
            .where((proposal) => proposal.status == 'sent')
            .length;
      });
    } catch (_) {
      // Keep the badge quiet if proposals cannot be fetched.
    }
  }

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  Future<String?> _driverOnlineBlockReason() async {
    final vehicles = await _vehicleRepository.list();
    if (vehicles.isEmpty) {
      return 'Add a vehicle before going online.';
    }

    // listOwn() is newest-first: keep the latest status per document type so a
    // re-uploaded (now pending) doc no longer counts as rejected.
    final records = await _verificationRepository.listOwn();
    final latestByType = <String, String>{};
    for (final r in records) {
      final type = r['documentType'] as String?;
      final status = r['status'] as String?;
      if (type == null ||
          status == null ||
          !_requiredDocuments.contains(type)) {
        continue;
      }
      latestByType.putIfAbsent(type, () => status);
    }

    final approved = latestByType.entries
        .where((e) => e.value == 'approved')
        .map((e) => e.key)
        .toSet();
    if (approved.length == _requiredDocuments.length) return null;

    if (latestByType.values.contains('rejected')) {
      return 'A document was rejected. Please re-upload it.';
    }
    if (latestByType.values.contains('pending')) {
      return 'Your documents are still under review.';
    }

    return 'Upload all required documents before going online.';
  }

  @override
  Widget build(BuildContext context) {
    // Keying the tabs by _reloadCounter remounts them together when a proposal
    // is answered anywhere, so no tab is left showing a job in the wrong bucket.
    final List<Widget> pages = [
      _DashboardTab(
        key: ValueKey('dashboard-$_reloadCounter'),
        onNavigateToTab: _onItemTapped,
        onProposalsChanged: _onProposalsChanged,
      ),
      _AvailableJobsTab(
        key: ValueKey('available-$_reloadCounter'),
        onProposalsChanged: _onProposalsChanged,
      ),
      _MyJobsTab(
        key: ValueKey('myjobs-$_reloadCounter'),
        onProposalsChanged: _onProposalsChanged,
      ),
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
        actions: [
          Consumer<AuthProvider>(
            builder: (context, authProvider, child) {
              final isAvailable = authProvider.user?.isAvailable ?? false;
              return Switch(
                value: isAvailable,
                onChanged: authProvider.isLoading
                    ? null
                    : (value) async {
                        // Prime the location ask before going online, but only
                        // if the OS permission has not already been granted.
                        if (value) {
                          try {
                            final blockReason =
                                await _driverOnlineBlockReason();
                            if (blockReason != null) {
                              if (!context.mounted) return;
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(blockReason),
                                  backgroundColor: Colors.orange,
                                ),
                              );
                              return;
                            }
                          } catch (e) {
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  e.toString().replaceFirst('Exception: ', ''),
                                ),
                                backgroundColor: Colors.red,
                              ),
                            );
                            return;
                          }

                          final hasPermission = await LocationService()
                              .hasLocationPermission();
                          if (!hasPermission) {
                            if (!context.mounted) return;
                            final proceed = await EnableLocationPrompt.show(
                              context,
                              message:
                                  'Share your location while online so cargo owners nearby can find you and send jobs.',
                            );
                            if (!proceed) return;
                          }
                        }
                        if (!context.mounted) return;
                        final ok = await authProvider.updateDriverAvailability(
                          value,
                        );
                        if (!ok && context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                authProvider.error ??
                                    'Could not update availability',
                              ),
                              backgroundColor: Colors.red,
                            ),
                          );
                        }
                      },
                activeThumbColor: Colors.white,
                activeTrackColor: primaryGreen,
              );
            },
          ),
          const NotificationBell(),
          IconButton(
            icon: _ProposalBadge(count: _pendingProposalCount),
            tooltip: 'Proposals',
            onPressed: () async {
              await Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => const DriverProposalsScreen(),
                ),
              );
              if (mounted) _loadProposalCount();
            },
          ),
        ],
      ),
      body: pages[_selectedIndex],
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        items: const <BottomNavigationBarItem>[
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard),
            label: 'Dashboard',
          ),
          BottomNavigationBarItem(icon: Icon(Icons.work), label: 'Available'),
          BottomNavigationBarItem(
            icon: Icon(Icons.assignment),
            label: 'My Jobs',
          ),
          BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Profile'),
        ],
        currentIndex: _selectedIndex,
        selectedItemColor: primaryGreen,
        onTap: _onItemTapped,
      ),
    );
  }
}

class _ProposalBadge extends StatelessWidget {
  final int count;

  const _ProposalBadge({required this.count});

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        const Icon(Icons.inbox),
        if (count > 0)
          Positioned(
            right: -7,
            top: -7,
            child: Container(
              constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
              padding: const EdgeInsets.symmetric(horizontal: 5),
              decoration: BoxDecoration(
                color: Colors.red,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: Colors.white, width: 2),
              ),
              child: Center(
                child: Text(
                  count > 99 ? '99+' : '$count',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    height: 1,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

// Driver dashboard — data from the proposals API (Postgres), no Firestore.
// In the M4 model a driver doesn't browse a job board; owners send proposals.
// So "available" = incoming proposals still 'sent'; "active" = 'accepted'.
class _DashboardTab extends StatefulWidget {
  final Function(int) onNavigateToTab;
  // Notifies the parent so all tabs remount + the header badge recounts after a
  // proposal is answered here.
  final VoidCallback onProposalsChanged;

  const _DashboardTab({
    super.key,
    required this.onNavigateToTab,
    required this.onProposalsChanged,
  });

  @override
  State<_DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<_DashboardTab> {
  final _proposals = ProposalRepository();
  late Future<List<Proposal>> _future;

  @override
  void initState() {
    super.initState();
    _future = _proposals.incoming();
  }

  Future<void> _refresh() async {
    final next = _proposals.incoming();
    setState(() {
      _future = next;
    });
    await next;
  }

  // A proposal was answered: notify the parent so every tab remounts and the
  // header badge recounts (the parent bumps the shared reload key).
  Future<void> _onCardChanged() async {
    widget.onProposalsChanged();
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;

    return RefreshIndicator(
      onRefresh: _refresh,
      child: FutureBuilder<List<Proposal>>(
        future: _future,
        builder: (context, snap) {
          final all = snap.data ?? const <Proposal>[];
          final incoming = all.where((p) => p.status == 'sent').toList();
          final active = all.where((p) => p.isActiveJob).toList();
          final loading = snap.connectionState == ConnectionState.waiting;

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
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Welcome, ${user?.name ?? 'Driver'}!',
                              style: const TextStyle(
                                fontSize: 19,
                                fontWeight: FontWeight.w800,
                                color: textDark,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              user?.isAvailable == true
                                  ? 'You are available for jobs'
                                  : 'Go online to receive job requests',
                              style: const TextStyle(
                                fontSize: 13.5,
                                color: kMutedText,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Pill(
                        text: user?.isAvailable == true ? 'ONLINE' : 'OFFLINE',
                        color: user?.isAvailable == true
                            ? primaryGreen
                            : Colors.orange,
                        icon: Icons.circle,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: kGap),

                // Onboarding nudge — add a vehicle + upload docs; hides once verified.
                const DriverVerificationBanner(),

                // Quick Stats
                Row(
                  children: [
                    Expanded(
                      child: StatTile(
                        label: 'Completed',
                        value: '${user?.completedJobs ?? 0}',
                        icon: Icons.work_outline,
                        accent: textDark,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: StatTile(
                        label: 'Rating',
                        value: user?.rating?.toStringAsFixed(1) ?? '0.0',
                        icon: Icons.star_outline,
                        accent: Colors.orange,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: StatTile(
                        label: 'New Requests',
                        value: '${incoming.length}',
                        icon: Icons.assignment_outlined,
                        accent: primaryGreen,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: StatTile(
                        label: 'Active Jobs',
                        value: '${active.length}',
                        icon: Icons.local_shipping_outlined,
                        accent: primaryGreen,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // Incoming requests
                SectionHeader(
                  title: 'Job Requests',
                  action: TextButton(
                    onPressed: () => widget.onNavigateToTab(1),
                    child: const Text('View All'),
                  ),
                ),
                if (loading)
                  const Padding(
                    padding: EdgeInsets.only(top: 24),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (incoming.isEmpty)
                  const EmptyBlock(
                    icon: Icons.work_off_outlined,
                    title: 'No job requests',
                    subtitle:
                        'Owners will send you proposals when they match you',
                  )
                else
                  ...incoming
                      .take(3)
                      .map(
                        (p) => _ProposalCard(
                          proposal: p,
                          onChanged: _onCardChanged,
                        ),
                      ),

                // Active jobs
                const SizedBox(height: 24),
                SectionHeader(
                  title: 'My Active Jobs',
                  action: TextButton(
                    onPressed: () => widget.onNavigateToTab(2),
                    child: const Text('View All'),
                  ),
                ),
                if (active.isEmpty)
                  const EmptyBlock(
                    icon: Icons.assignment_outlined,
                    title: 'No active jobs',
                    subtitle: 'Accept a job request to get started',
                  )
                else
                  ...active
                      .take(3)
                      .map(
                        (p) => _ProposalCard(
                          proposal: p,
                          onChanged: _onCardChanged,
                        ),
                      ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// Incoming job requests (proposals still 'sent') — accept / decline.
class _AvailableJobsTab extends StatefulWidget {
  final VoidCallback onProposalsChanged;
  const _AvailableJobsTab({super.key, required this.onProposalsChanged});

  @override
  State<_AvailableJobsTab> createState() => _AvailableJobsTabState();
}

class _AvailableJobsTabState extends State<_AvailableJobsTab> {
  final _proposals = ProposalRepository();
  late Future<List<Proposal>> _future;

  @override
  void initState() {
    super.initState();
    _future = _proposals.incoming();
  }

  Future<void> _refresh() async {
    final next = _proposals.incoming();
    setState(() {
      _future = next;
    });
    await next;
  }

  @override
  Widget build(BuildContext context) {
    return _ProposalList(
      future: _future,
      filter: (p) => p.status == 'sent',
      onRefresh: _refresh,
      onCardChanged: widget.onProposalsChanged,
      emptyTitle: 'No job requests',
      emptySubtitle: 'Owners send you a proposal when they pick you for a job',
    );
  }
}

// The driver's accepted jobs (proposals 'accepted').
class _MyJobsTab extends StatefulWidget {
  final VoidCallback onProposalsChanged;
  const _MyJobsTab({super.key, required this.onProposalsChanged});

  @override
  State<_MyJobsTab> createState() => _MyJobsTabState();
}

class _MyJobsTabState extends State<_MyJobsTab> {
  final _proposals = ProposalRepository();
  late Future<List<Proposal>> _future;

  @override
  void initState() {
    super.initState();
    _future = _proposals.incoming();
  }

  Future<void> _refresh() async {
    final next = _proposals.incoming();
    setState(() {
      _future = next;
    });
    await next;
  }

  @override
  Widget build(BuildContext context) {
    return _ProposalList(
      future: _future,
      // All jobs the driver took on — active plus completed history.
      filter: (p) => p.status == 'accepted',
      onRefresh: _refresh,
      onCardChanged: widget.onProposalsChanged,
      emptyTitle: 'No jobs yet',
      emptySubtitle: 'Accept a job request and it will appear here',
    );
  }
}

// Shared list view over the driver's proposals, filtered by status.
class _ProposalList extends StatelessWidget {
  final Future<List<Proposal>> future;
  final bool Function(Proposal) filter;
  final Future<void> Function() onRefresh;
  // Pull-to-refresh reloads this list; onCardChanged fires when a proposal is
  // answered so the parent can remount all tabs + recount the badge.
  final VoidCallback onCardChanged;
  final String emptyTitle;
  final String emptySubtitle;

  const _ProposalList({
    required this.future,
    required this.filter,
    required this.onRefresh,
    required this.onCardChanged,
    required this.emptyTitle,
    required this.emptySubtitle,
  });

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: FutureBuilder<List<Proposal>>(
        future: future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return ListView(
              children: [
                const SizedBox(height: 120),
                Center(
                  child: Text(
                    snap.error.toString().replaceFirst('Exception: ', ''),
                    style: const TextStyle(color: Colors.red),
                  ),
                ),
              ],
            );
          }
          final items = (snap.data ?? const <Proposal>[])
              .where(filter)
              .toList();
          if (items.isEmpty) {
            return ListView(
              children: [
                const SizedBox(height: 100),
                EmptyBlock(
                  icon: Icons.work_off_outlined,
                  title: emptyTitle,
                  subtitle: emptySubtitle,
                ),
              ],
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            itemBuilder: (context, i) => _ProposalCard(
              proposal: items[i],
              onChanged: () async => onCardChanged(),
            ),
          );
        },
      ),
    );
  }
}

class _ProfileTab extends StatelessWidget {
  const _ProfileTab();

  @override
  Widget build(BuildContext context) {
    return Consumer2<AuthProvider, ProfileProvider>(
      builder: (context, authProvider, profileProvider, child) {
        final user = profileProvider.currentUser ?? authProvider.user;

        // Pull-to-refresh re-fetches the user (rating/jobs-done update after a
        // counterparty rates you — otherwise stale until app restart).
        return RefreshIndicator(
          onRefresh: authProvider.refreshUserData,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                // Profile Header
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: lightGreen,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    children: [
                      CircleAvatar(
                        radius: 40,
                        backgroundColor: primaryGreen,
                        child: Text(
                          user?.name.isNotEmpty == true
                              ? user!.name[0].toUpperCase()
                              : 'D',
                          style: const TextStyle(
                            fontSize: 32,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        user?.name ?? 'Driver',
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        user?.email ?? '',
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.grey.shade600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: primaryGreen,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Text(
                              'Driver',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: user?.isAvailable == true
                                  ? primaryGreen
                                  : Colors.orange,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              user?.isAvailable == true
                                  ? 'Available'
                                  : 'Offline',
                              style: const TextStyle(
                                fontSize: 12,
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              children: [
                                Text(
                                  user?.rating?.toStringAsFixed(1) ?? '0.0',
                                  style: const TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const Text(
                                  'Rating',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.grey,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Expanded(
                            child: Column(
                              children: [
                                Text(
                                  '${user?.completedJobs ?? 0}',
                                  style: const TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const Text(
                                  'Jobs Done',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.grey,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Profile Options
                _ProfileOption(
                  icon: Icons.edit,
                  title: 'Edit Profile',
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (context) => const DriverProfileEditScreen(),
                      ),
                    );
                  },
                ),
                _ProfileOption(
                  icon: Icons.star_outline,
                  title: 'My Ratings',
                  subtitle: user?.rating != null
                      ? '${user!.rating!.toStringAsFixed(1)} average'
                      : 'View ratings you received',
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (context) => const MyRatingsScreen(),
                      ),
                    );
                  },
                ),
                if (user != null) ...[
                  _ProfileOption(
                    icon: Icons.card_membership,
                    title: 'Driver License',
                    subtitle: user.driverLicense ?? 'Add license details',
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (context) => const DriverProfileEditScreen(),
                        ),
                      );
                    },
                  ),
                  _ProfileOption(
                    icon: Icons.directions_car,
                    title: 'Vehicle Details',
                    subtitle: user.primaryVehicle != null
                        ? '${user.primaryVehicle!['type']} - ${user.primaryVehicle!['capacity']}'
                        : 'Add vehicle details',
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (context) => const VehicleDetailsScreen(),
                        ),
                      );
                    },
                  ),
                  _ProfileOption(
                    icon: Icons.map_outlined,
                    title: 'My Location',
                    subtitle: 'See where cargo owners find you',
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (context) => const DriverLocationScreen(),
                        ),
                      );
                    },
                  ),
                ],
                _ProfileOption(
                  icon: Icons.settings,
                  title: 'Settings',
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (context) => const SettingsScreen(),
                      ),
                    );
                  },
                ),
                _ProfileOption(
                  icon: Icons.help,
                  title: 'Help & Support',
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (context) => const HelpSupportScreen(),
                      ),
                    );
                  },
                ),
                _ProfileOption(
                  icon: Icons.logout,
                  title: 'Logout',
                  isDestructive: true,
                  onTap: () => _showLogoutDialog(context),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showLogoutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('Logout'),
          content: const Text('Are you sure you want to log out?'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.of(context).pop();
                await _performLogout(context);
              },
              style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
              child: const Text('Logout'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _performLogout(BuildContext context) async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final profileProvider = Provider.of<ProfileProvider>(
      context,
      listen: false,
    );

    // Show loading indicator
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return const AlertDialog(
          content: Row(
            children: [
              CircularProgressIndicator(),
              SizedBox(width: 16),
              Text('Logging out...'),
            ],
          ),
        );
      },
    );

    try {
      // Perform logout
      await authProvider.signOut();

      // Clear profile data
      profileProvider.logout();

      // Navigate to login screen and clear navigation stack
      if (context.mounted) {
        Navigator.of(
          context,
        ).pushNamedAndRemoveUntil('/login', (route) => false);
      }
    } catch (e) {
      // Hide loading dialog and show error
      if (context.mounted) {
        Navigator.of(context).pop(); // Hide loading dialog
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Logout failed: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }
}

// A driver's proposal card: shows the job, accept/decline while 'sent', and
// once accepted reveals the owner contact + chat / call / directions actions.
class _ProposalCard extends StatefulWidget {
  final Proposal proposal;
  final Future<void> Function() onChanged;

  const _ProposalCard({required this.proposal, required this.onChanged});

  @override
  State<_ProposalCard> createState() => _ProposalCardState();
}

class _ProposalCardState extends State<_ProposalCard> {
  final _repo = ProposalRepository();
  final _messages = MessageRepository();
  bool _busy = false;
  int _unread = 0;

  @override
  void initState() {
    super.initState();
    if (widget.proposal.isAccepted) _loadUnread();
  }

  Future<void> _loadUnread() async {
    final map = await _messages.unreadByJob();
    if (!mounted) return;
    setState(() => _unread = map[widget.proposal.jobId] ?? 0);
  }

  Future<void> _respond(String status) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await _repo.respond(widget.proposal.id, status);
      await widget.onChanged();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _call(String phone) =>
      launchUrl(Uri(scheme: 'tel', path: phone));

  Color _statusColor(String s) {
    switch (s) {
      case 'sent':
        return Colors.orange;
      case 'accepted':
      case 'in_progress':
        return primaryGreen;
      case 'completed':
        return Colors.blueGrey;
      case 'declined':
      case 'cancelled':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  // Once accepted, the meaningful state is the JOB's lifecycle (matched →
  // in_progress → completed), not the frozen proposal status.
  String _displayStatus(Proposal p) {
    if (p.status == 'accepted') {
      final js = p.job?.status;
      if (js == 'completed') return 'completed';
      if (js == 'in_progress') return 'in_progress';
      if (js == 'cancelled') return 'cancelled';
    }
    return p.status;
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.proposal;
    final job = p.job;
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: job == null
            ? null
            : () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => DriverJobDetailScreen(proposal: p),
                ),
              ),
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
                  Builder(
                    builder: (_) {
                      final display = _displayStatus(p);
                      return Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: _statusColor(display).withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          display,
                          style: TextStyle(
                            fontSize: 12,
                            color: _statusColor(display),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      );
                    },
                  ),
                ],
              ),
              if (job != null) ...[
                const SizedBox(height: 8),
                Text(
                  '${job.pickupLabel ?? 'Pickup'} → ${job.dropOffLabel ?? 'Drop-off'}',
                  style: const TextStyle(color: textGray, fontSize: 13.5),
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
                        onPressed: _busy ? null : () => _respond('declined'),
                        child: const Text('Decline'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: primaryGreen,
                          foregroundColor: Colors.white,
                        ),
                        onPressed: _busy ? null : () => _respond('accepted'),
                        child: _busy
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
              if (p.isAccepted && p.contact != null && job != null) ...[
                const Divider(height: 20),
                Text(
                  'Cargo owner: ${p.contact!.name}',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                Text(p.contact!.phone, style: const TextStyle(color: textGray)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: primaryGreen,
                        foregroundColor: Colors.white,
                      ),
                      onPressed: () async {
                        await Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => JobChatScreen(
                              jobId: p.jobId,
                              contact: p.contact!,
                            ),
                          ),
                        );
                        // Opening the chat marks it read server-side; refresh.
                        _loadUnread();
                      },
                      icon: const Icon(Icons.chat, size: 18),
                      label: Text(_unread > 0 ? 'Chat ($_unread)' : 'Chat'),
                    ),
                    OutlinedButton.icon(
                      onPressed: () => _call(p.contact!.phone),
                      icon: const Icon(Icons.call, size: 18),
                      label: const Text('Call'),
                    ),
                    OutlinedButton.icon(
                      onPressed: () =>
                          OpenInMaps.directions(context, job.pickup),
                      icon: const Icon(Icons.navigation_outlined, size: 18),
                      label: const Text('Pickup'),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ProfileOption extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;
  final bool isDestructive;

  const _ProfileOption({
    required this.icon,
    required this.title,
    this.subtitle,
    required this.onTap,
    this.isDestructive = false,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: isDestructive ? Colors.red : null),
      title: Text(
        title,
        style: TextStyle(color: isDestructive ? Colors.red : null),
      ),
      subtitle: subtitle != null ? Text(subtitle!) : null,
      trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    );
  }
}
