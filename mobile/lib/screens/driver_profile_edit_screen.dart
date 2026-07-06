import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/models/user_model.dart';
import '../core/repositories/user_repository.dart';
import '../core/repositories/vehicle_repository.dart';
import '../core/repositories/verification_repository.dart';
import '../providers/auth_provider.dart';
import '../mixins/image_picker_mixin.dart';
import 'vehicle_details_screen.dart';

class DriverProfileEditScreen extends StatefulWidget {
  final bool scrollToDocuments;

  const DriverProfileEditScreen({super.key, this.scrollToDocuments = false});

  @override
  State<DriverProfileEditScreen> createState() =>
      _DriverProfileEditScreenState();
}

class _DriverProfileEditScreenState extends State<DriverProfileEditScreen>
    with ImagePickerMixin {
  final _formKey = GlobalKey<FormState>();
  final _scrollController = ScrollController();
  final _documentsKey = GlobalKey();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _driverLicenseNumberController = TextEditingController();

  final UserRepository _userRepository = ApiUserRepository();
  final VehicleRepository _vehicleRepository = VehicleRepository();
  final VerificationRepository _verificationRepository =
      VerificationRepository();

  bool _isLoading = false;
  int _vehicleCount = 0;
  UserModel? _user;

  // Latest verification record per document type (licence | national_id |
  // vehicle_reg), so a rejected document can show its status + admin note.
  final Map<String, Map<String, dynamic>> _latestRecordByType = {};

  // Document files
  File? _profileImage;
  File? _driverLicenseFile;
  File? _nationalIdFile;
  File? _vehicleRegistrationFile;
  File? _vehicleImageFile;

  // Document upload states
  bool _driverLicenseUploading = false;
  bool _nationalIdUploading = false;
  bool _vehicleRegistrationUploading = false;
  final bool _vehicleImageUploading = false;

  @override
  void initState() {
    super.initState();
    _loadUserData();
    _loadVehicleCount();
    _loadVerificationStatus();
    if (widget.scrollToDocuments) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _scrollToDocuments();
      });
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _nameController.dispose();
    _phoneController.dispose();
    _driverLicenseNumberController.dispose();
    super.dispose();
  }

  void _scrollToDocuments() {
    final context = _documentsKey.currentContext;
    if (context == null) return;
    Scrollable.ensureVisible(
      context,
      duration: const Duration(milliseconds: 450),
      curve: Curves.easeOutCubic,
      alignment: 0.08,
    );
  }

  Future<void> _loadUserData() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final currentUser = authProvider.user;

    if (currentUser != null) {
      try {
        // Fetch the latest user data from the database to ensure we have all fields
        final latestUser = await _userRepository.getUserById(currentUser.uid);
        final userToUse = latestUser ?? currentUser;

        setState(() {
          _user = userToUse;
          _nameController.text = userToUse.name;
          _phoneController.text = userToUse.phoneNumber;
          // Handle migration: check both fields for license number
          _driverLicenseNumberController.text =
              userToUse.driverLicenseNumber ?? userToUse.driverLicense ?? '';
        });
      } catch (e) {
        // Fallback to cached user data if database fetch fails
        setState(() {
          _user = currentUser;
          _nameController.text = currentUser.name;
          _phoneController.text = currentUser.phoneNumber;
          // Handle migration: check both fields for license number
          _driverLicenseNumberController.text =
              currentUser.driverLicenseNumber ??
              currentUser.driverLicense ??
              '';
        });
      }
    }
  }

  Future<void> _loadVehicleCount() async {
    try {
      final vehicles = await _vehicleRepository.list();
      if (!mounted) return;
      setState(() => _vehicleCount = vehicles.length);
    } catch (_) {
      // Vehicle setup is surfaced as a shortcut here; profile editing can still
      // load even if the vehicle endpoint is temporarily unavailable.
    }
  }

  // Records come back newest-first; keep the first (latest) per document type so
  // a rejected document surfaces its status + the admin's note for re-upload.
  Future<void> _loadVerificationStatus() async {
    try {
      final records = await _verificationRepository.listOwn();
      if (!mounted) return;
      final latest = <String, Map<String, dynamic>>{};
      for (final record in records) {
        final type = record['documentType'] as String?;
        if (type != null && !latest.containsKey(type)) {
          latest[type] = record;
        }
      }
      setState(() {
        _latestRecordByType
          ..clear()
          ..addAll(latest);
      });
    } catch (_) {
      // Non-critical: the upload cards still work without status decoration.
    }
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
    });

    try {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final currentUser = authProvider.user;

      if (currentUser == null) {
        throw Exception('No user logged in');
      }

      // Upload the three mandated verification documents to the API
      // (POST /verification → private Storage → pending records for admin review).
      // Each is API-mediated; documents never live in a public bucket.
      if (_driverLicenseFile != null) {
        setState(() => _driverLicenseUploading = true);
        await authProvider.submitVerificationDocument(
          documentType: 'licence',
          file: _driverLicenseFile!,
        );
        setState(() => _driverLicenseUploading = false);
      }

      if (_nationalIdFile != null) {
        setState(() => _nationalIdUploading = true);
        await authProvider.submitVerificationDocument(
          documentType: 'national_id',
          file: _nationalIdFile!,
        );
        setState(() => _nationalIdUploading = false);
      }

      if (_vehicleRegistrationFile != null) {
        setState(() => _vehicleRegistrationUploading = true);
        await authProvider.submitVerificationDocument(
          documentType: 'vehicle_reg',
          file: _vehicleRegistrationFile!,
        );
        setState(() => _vehicleRegistrationUploading = false);
      }

      // Profile photo → POST /me/photo (API-mediated upload to Storage).
      if (_profileImage != null) {
        await authProvider.uploadProfilePhoto(_profileImage!);
      }

      // Update the editable profile fields (name/phone) via PATCH /me.
      final updatedUser = currentUser.copyWith(
        name: _nameController.text.trim(),
        phoneNumber: _phoneController.text.trim(),
        updatedAt: DateTime.now(),
      );
      await _userRepository.updateUser(updatedUser);

      // Refresh auth provider with updated user
      await authProvider.refreshUserData();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Profile updated successfully!'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error updating profile: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Widget _buildDocumentUploadCard({
    required String title,
    required String description,
    required VoidCallback onTap,
    required bool isUploading,
    String? currentUrl,
    File? selectedFile,
    String? documentType,
  }) {
    final record = documentType == null
        ? null
        : _latestRecordByType[documentType];
    final isRejected = record?['status'] == 'rejected';
    final reviewNote = record?['reviewNote'] as String?;
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  selectedFile != null || currentUrl != null
                      ? Icons.check_circle
                      : Icons.upload_file,
                  color: selectedFile != null || currentUrl != null
                      ? Colors.green
                      : Colors.grey,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                      Text(
                        description,
                        style: TextStyle(color: Colors.grey[600], fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (isRejected && selectedFile == null) ...[
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.red[50],
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.cancel, color: Colors.red[700], size: 16),
                        const SizedBox(width: 8),
                        Text(
                          'Rejected — please re-upload',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: Colors.red[700],
                          ),
                        ),
                      ],
                    ),
                    if (reviewNote != null && reviewNote.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        reviewNote,
                        style: TextStyle(fontSize: 12, color: Colors.red[900]),
                      ),
                    ],
                  ],
                ),
              ),
            ],
            if (selectedFile != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.green[50],
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.file_present,
                      color: Colors.green,
                      size: 16,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        selectedFile.path.split('/').last,
                        style: const TextStyle(fontSize: 12),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ] else if (currentUrl != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.blue[50],
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.cloud_done, color: Colors.blue, size: 16),
                    SizedBox(width: 8),
                    Text(
                      'Document uploaded',
                      style: TextStyle(fontSize: 12, color: Colors.blue),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: isUploading ? null : onTap,
                icon: isUploading
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.upload, size: 18),
                label: Text(
                  isUploading
                      ? 'Uploading...'
                      : selectedFile != null || currentUrl != null
                      ? 'Replace Document'
                      : 'Upload Document',
                  style: const TextStyle(fontSize: 14),
                ),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Edit Driver Profile'),
        actions: [
          TextButton(
            onPressed: _isLoading ? null : _saveProfile,
            child: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Save'),
          ),
        ],
      ),
      body: SingleChildScrollView(
        controller: _scrollController,
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Profile Picture Section
              Center(
                child: Column(
                  children: [
                    GestureDetector(
                      onTap: () {
                        showImagePickerDialog(
                          context,
                          onImageSelected: (file) {
                            setState(() {
                              _profileImage = file;
                            });
                          },
                        );
                      },
                      child: Container(
                        width: 120,
                        height: 120,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.grey[300]!),
                          color: Colors.grey[100],
                        ),
                        child: _profileImage != null
                            ? ClipOval(
                                child: Image.file(
                                  _profileImage!,
                                  fit: BoxFit.cover,
                                ),
                              )
                            : _user?.profileImageUrl != null
                            ? ClipOval(
                                child: Image.network(
                                  _user!.profileImageUrl!,
                                  fit: BoxFit.cover,
                                  errorBuilder: (context, error, stackTrace) {
                                    return const Icon(
                                      Icons.person,
                                      size: 60,
                                      color: Colors.grey,
                                    );
                                  },
                                ),
                              )
                            : const Icon(
                                Icons.person,
                                size: 60,
                                color: Colors.grey,
                              ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Tap to change profile photo',
                      style: TextStyle(color: Colors.grey[600], fontSize: 12),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 32),

              // Basic Information
              const Text(
                'Basic Information',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),

              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(
                  labelText: 'Full Name',
                  border: OutlineInputBorder(),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Please enter your full name';
                  }
                  return null;
                },
              ),

              const SizedBox(height: 16),

              TextFormField(
                controller: _phoneController,
                decoration: const InputDecoration(
                  labelText: 'Phone Number',
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.phone,
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Please enter your phone number';
                  }
                  return null;
                },
              ),

              const SizedBox(height: 16),

              TextFormField(
                controller: _driverLicenseNumberController,
                decoration: const InputDecoration(
                  labelText: 'Driver License Number',
                  hintText: 'Enter your license number',
                  border: OutlineInputBorder(),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Please enter your driver license number';
                  }
                  return null;
                },
              ),

              const SizedBox(height: 32),

              // Vehicle Setup
              const Text(
                'Vehicle Setup',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),

              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          Icon(
                            _vehicleCount > 0
                                ? Icons.check_circle
                                : Icons.local_shipping_outlined,
                            color: _vehicleCount > 0
                                ? Colors.green
                                : Colors.grey,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _vehicleCount > 0
                                      ? '$_vehicleCount vehicle${_vehicleCount == 1 ? '' : 's'} added'
                                      : 'No vehicles added yet',
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Vehicle type, capacity, and registration are managed in your vehicle setup.',
                                  style: TextStyle(
                                    color: Colors.grey[600],
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton(
                          onPressed: () async {
                            await Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => const VehicleDetailsScreen(),
                              ),
                            );
                            _loadVehicleCount();
                          },
                          child: const Text('Manage vehicles'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 32),

              // Document Upload Section
              Text(
                'Required Documents',
                key: _documentsKey,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Upload your verification documents to complete your driver profile',
                style: TextStyle(color: Colors.grey[600], fontSize: 14),
              ),
              const SizedBox(height: 16),

              _buildDocumentUploadCard(
                title: 'Driver\'s License',
                description:
                    'Upload a clear photo of your valid driver\'s license',
                onTap: () {
                  showDocumentPickerDialog(
                    context,
                    'Driver\'s License',
                    onDocumentSelected: (file) {
                      setState(() {
                        _driverLicenseFile = file;
                      });
                    },
                  );
                },
                isUploading: _driverLicenseUploading,
                currentUrl: _user?.driverLicense,
                selectedFile: _driverLicenseFile,
                documentType: 'licence',
              ),

              _buildDocumentUploadCard(
                title: 'National ID',
                description: 'Upload a clear photo of your national ID card',
                onTap: () {
                  showDocumentPickerDialog(
                    context,
                    'National ID',
                    onDocumentSelected: (file) {
                      setState(() {
                        _nationalIdFile = file;
                      });
                    },
                  );
                },
                isUploading: _nationalIdUploading,
                currentUrl: _user?.nationalId,
                selectedFile: _nationalIdFile,
                documentType: 'national_id',
              ),

              _buildDocumentUploadCard(
                title: 'Vehicle Registration',
                description: 'Upload your vehicle registration certificate',
                onTap: () {
                  showDocumentPickerDialog(
                    context,
                    'Vehicle Registration',
                    onDocumentSelected: (file) {
                      setState(() {
                        _vehicleRegistrationFile = file;
                      });
                    },
                  );
                },
                isUploading: _vehicleRegistrationUploading,
                currentUrl: _user?.vehicleRegistration,
                selectedFile: _vehicleRegistrationFile,
                documentType: 'vehicle_reg',
              ),

              _buildDocumentUploadCard(
                title: 'Vehicle Photo',
                description: 'Upload a clear photo of your vehicle',
                onTap: () {
                  showDocumentPickerDialog(
                    context,
                    'Vehicle Photo',
                    onDocumentSelected: (file) {
                      setState(() {
                        _vehicleImageFile = file;
                      });
                    },
                  );
                },
                isUploading: _vehicleImageUploading,
                currentUrl: _user?.vehicleImageUrl,
                selectedFile: _vehicleImageFile,
              ),

              const SizedBox(height: 32),

              // Save Button
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _saveProfile,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Theme.of(context).primaryColor,
                    foregroundColor: Colors.white,
                  ),
                  child: _isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text(
                          'Save Profile',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                ),
              ),

              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}
