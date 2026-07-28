import 'package:flutter_test/flutter_test.dart';
import 'package:cargo_app/features/legal/data/policy.dart';

void main() {
  // Loading the bundled policy.json needs the asset bundle available.
  TestWidgetsFlutterBinding.ensureInitialized();

  group('shared privacy policy content', () {
    late Policy policy;

    setUpAll(() async {
      policy = await Policy.load();
    });

    test('loads with meta present', () {
      expect(policy.version, isNotEmpty);
      expect(policy.lastUpdated, isNotEmpty);
      expect(policy.contactEmail, contains('@'));
    });

    test('has all eleven sections, numbered 1..11 in order', () {
      expect(
        policy.sections.map((s) => s.number).toList(),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      );
    });

    test('every section has a heading and at least one block', () {
      for (final s in policy.sections) {
        expect(s.heading, isNotEmpty);
        expect(s.blocks, isNotEmpty);
      }
    });

    test('exposes the retention/deletion placeholders', () {
      for (final key in const [
        'RETENTION_ACCOUNT',
        'RETENTION_VERIFICATION',
        'RETENTION_LOCATION',
        'RETENTION_MESSAGES',
        'RETENTION_JOBS',
        'RETENTION_PAYMENTS',
        'DELETION_PROCESS',
      ]) {
        expect(policy.placeholders.containsKey(key), isTrue,
            reason: 'missing placeholder $key');
      }
    });
  });
}
