import 'package:cargo_app/constants.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/enums/app_enums.dart';
import '../../../core/models/booking_model.dart';
import '../../../core/models/job.dart';
import '../../../core/models/user_model.dart';
import '../../../core/repositories/job_repository.dart';
import '../../jobs/presentation/owner_job_detail_screen.dart';
import '../../../features/booking/providers/booking_provider.dart';
import '../../../providers/auth_provider.dart';
import '../../../features/profile/providers/profile_provider.dart';
import '../../../screens/create_job_screen.dart';
import '../../../screens/job_details_screen.dart';
import '../../../screens/cargo_owner_profile_edit_screen.dart';
import '../../matching/presentation/nearby_drivers_map.dart';
import '../../../core/theme/ui_kit.dart';

class CargoOwnerHome extends StatefulWidget {
  const CargoOwnerHome({super.key});

  @override
  State<CargoOwnerHome> createState() => _CargoOwnerHomeState();
}

class _CargoOwnerHomeState extends State<CargoOwnerHome> {
  int _selectedIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadBookings();
    });
  }

  void _loadBookings() {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final bookingProvider = Provider.of<BookingProvider>(
      context,
      listen: false,
    );

    if (authProvider.user != null) {
      bookingProvider.loadCargoOwnerBookings(authProvider.user!.uid);
    }
  }

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> pages = [
      const _DashboardTab(),
      const NearbyDriversMap(),
      const _MyJobsTab(),
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
          IconButton(
            icon: const Icon(Icons.notifications),
            onPressed: () {
              // TODO: Implement notifications
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
                ).then((_) => _loadBookings());
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

class _DashboardTab extends StatelessWidget {
  const _DashboardTab();

  @override
  Widget build(BuildContext context) {
    return Consumer2<AuthProvider, BookingProvider>(
      builder: (context, authProvider, bookingProvider, child) {
        final user = authProvider.user;
        final recentBookings = bookingProvider.myBookings.take(3).toList();

        return SingleChildScrollView(
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
                      value: '${bookingProvider.myBookings.length}',
                      icon: Icons.work_outline,
                      accent: textDark,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: StatTile(
                      label: 'Completed',
                      value:
                          '${bookingProvider.myBookings.where((b) => b.status == BookingStatus.completed).length}',
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
                      label: 'Pending',
                      value:
                          '${bookingProvider.myBookings.where((b) => b.status == BookingStatus.pending).length}',
                      icon: Icons.pending_outlined,
                      accent: Colors.orange,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: StatTile(
                      label: 'In Progress',
                      value:
                          '${bookingProvider.myBookings.where((b) => b.status == BookingStatus.accepted || b.status == BookingStatus.inProgress).length}',
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

              if (bookingProvider.isLoading)
                const Center(child: CircularProgressIndicator())
              else if (recentBookings.isEmpty)
                const EmptyBlock(
                  icon: Icons.work_off_outlined,
                  title: 'No jobs yet',
                  subtitle: 'Create your first job to get started',
                )
              else
                ...recentBookings.map((booking) => _JobCard(booking: booking)),
            ],
          ),
        );
      },
    );
  }
}

// Owner's posted jobs, loaded from the jobs API (M3). The driver's booking view
// stays on Firestore until the M4 transaction loop.
class _MyJobsTab extends StatefulWidget {
  const _MyJobsTab();

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
    setState(() => _future = next);
    await next;
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

class _ProfileTab extends StatelessWidget {
  const _ProfileTab();

  @override
  Widget build(BuildContext context) {
    return Consumer2<AuthProvider, ProfileProvider>(
      builder: (context, authProvider, profileProvider, child) {
        final user =
            profileProvider.currentUser ?? authProvider.user as UserModel;

        return SingleChildScrollView(
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
                        user.name.isNotEmpty ? user.name[0].toUpperCase() : 'U',
                        style: const TextStyle(
                          fontSize: 32,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      user.name,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      user.email,
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.grey.shade600,
                      ),
                    ),
                    const SizedBox(height: 4),
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
                        'Cargo Owner',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Profile Options
              _ProfileOption(
                icon: Icons.person,
                title: 'Edit Profile',
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (context) => const CargoOwnerProfileEditScreen(),
                    ),
                  );
                },
              ),
              // Cargo owners need only an account — no business credentials (MVP scope).
              _ProfileOption(
                icon: Icons.location_on,
                title: 'Address',
                subtitle: user.fullAddress.isNotEmpty
                    ? user.fullAddress
                    : 'Add your address',
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (context) => const CargoOwnerProfileEditScreen(),
                    ),
                  );
                },
              ),
              _ProfileOption(
                icon: Icons.notifications,
                title: 'Notifications',
                onTap: () {
                  // TODO: Navigate to notifications settings
                },
              ),
              _ProfileOption(
                icon: Icons.help,
                title: 'Help & Support',
                onTap: () {
                  // TODO: Navigate to help
                },
              ),
              _ProfileOption(
                icon: Icons.info,
                title: 'About',
                onTap: () {
                  // TODO: Navigate to about
                },
              ),
              const SizedBox(height: 24),

              // Logout Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () async {
                    await authProvider.signOut();
                    if (context.mounted) {
                      Navigator.pushNamedAndRemoveUntil(
                        context,
                        '/',
                        (route) => false,
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: const Text('Logout'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _JobCard extends StatelessWidget {
  final BookingModel booking;

  const _JobCard({required this.booking});

  @override
  Widget build(BuildContext context) {
    Color statusColor;
    switch (booking.status) {
      case BookingStatus.pending:
        statusColor = Colors.orange;
        break;
      case BookingStatus.accepted:
      case BookingStatus.inProgress:
        statusColor = primaryGreen;
        break;
      case BookingStatus.completed:
        statusColor = Colors.black;
        break;
      case BookingStatus.declined:
      case BookingStatus.cancelled:
        statusColor = Colors.red;
        break;
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => JobDetailsScreen(booking: booking),
            ),
          );
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
                      booking.cargoDescription,
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
                      color: statusColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      booking.statusDisplayName,
                      style: TextStyle(
                        fontSize: 12,
                        color: statusColor,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.location_on, size: 16, color: Colors.grey),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      booking.pickupLocation,
                      style: const TextStyle(fontSize: 14),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.flag, size: 16, color: Colors.grey),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      booking.dropoffLocation,
                      style: const TextStyle(fontSize: 14),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(Icons.local_shipping, size: 16, color: Colors.grey),
                  const SizedBox(width: 4),
                  Text(
                    booking.vehicleTypeDisplayName,
                    style: const TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                  const Spacer(),
                  Text(
                    '${booking.createdAt.day}/${booking.createdAt.month}/${booking.createdAt.year}',
                    style: const TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                ],
              ),

              // Show special indicators for declined jobs
              if (booking.status == BookingStatus.declined) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.orange.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.orange.shade200),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.info_outline,
                        size: 16,
                        color: Colors.orange.shade700,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Tap to reassign to another driver',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.orange.shade700,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              // Show chat indicator for accepted jobs
              if (booking.status == BookingStatus.accepted) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: lightGreen,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: primaryGreen),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.chat, size: 16, color: appGreen),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Tap to chat with driver',
                          style: TextStyle(
                            fontSize: 12,
                            color: appGreen,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
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

  const _ProfileOption({
    required this.icon,
    required this.title,
    this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: appGreen),
      title: Text(title),
      subtitle: subtitle != null ? Text(subtitle!) : null,
      trailing: Icon(Icons.chevron_right, color: appGreen),
      onTap: onTap,
    );
  }
}
