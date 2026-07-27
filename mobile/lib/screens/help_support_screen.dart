import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class HelpSupportScreen extends StatelessWidget {
  const HelpSupportScreen({super.key});

  static const _supportPhone = '+250789660422';
  static const _supportEmail = 'ahadihjosue@gmail.com';

  // FAQs describe only what Loop actually does today.
  static final List<_FAQItem> _faqs = [
    _FAQItem(
      question: 'How do I get started as a driver?',
      answer:
          '1. Create an account and complete your profile.\n'
          '2. Add your vehicle and upload the three required documents: '
          'driver\'s licence, national ID, and vehicle registration.\n'
          '3. Wait for an admin to review and approve them.\n'
          '4. Once approved you are set online automatically — go offline/online '
          'any time from your profile.',
    ),
    _FAQItem(
      question: 'What documents do I need to upload?',
      answer:
          'Three documents, each clear and current:\n'
          '• Driver\'s licence\n'
          '• National ID\n'
          '• Vehicle registration\n\n'
          'A driver only appears in matching once all three are approved.',
    ),
    _FAQItem(
      question: 'How does matching work?',
      answer:
          'When a cargo owner searches, the app shows nearby drivers who are '
          'online, verified, and driving the requested vehicle type, closest '
          'first. The owner sends a proposal at their posted price; the driver '
          'accepts or declines.',
    ),
    _FAQItem(
      question: 'How is the price set?',
      answer:
          'The app computes a transparent estimate from distance, time, weight, '
          'and vehicle type. It is only a reference — the cargo owner reviews it '
          'and sets the final posted price. Drivers accept or decline that price.',
    ),
    _FAQItem(
      question: 'How is payment handled?',
      answer:
          'After a job is completed the owner can pay the driver in-app through '
          'the payment provider. Loop never holds the money — it only initiates '
          'the payment and records the result. Paying in-app is optional; you '
          'can also settle off-platform.',
    ),
    _FAQItem(
      question: 'How do I coordinate a job?',
      answer:
          'Once a driver accepts, in-app chat opens between you and the other '
          'party, and you can call them directly. The driver gets in-app '
          'turn-by-turn navigation to the pickup and drop-off.',
    ),
    _FAQItem(
      question: 'How do ratings work?',
      answer:
          'After a completed job, the owner and driver rate each other from 1 '
          'to 5 stars. Your average rating and count are shown to the other '
          'party, building a reputation over time.',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Help & Support')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Contact us',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            Card(
              child: Column(
                children: [
                  ListTile(
                    leading: Icon(Icons.phone, color: Theme.of(context).primaryColor),
                    title: const Text('Call support'),
                    subtitle: const Text(_supportPhone),
                    onTap: () => _launch(context, Uri.parse('tel:$_supportPhone')),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: Icon(Icons.email, color: Theme.of(context).primaryColor),
                    title: const Text('Email us'),
                    subtitle: const Text(_supportEmail),
                    onTap: () => _launch(
                      context,
                      Uri(scheme: 'mailto', path: _supportEmail),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 28),

            const Text(
              'Frequently asked questions',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            ..._faqs.map((faq) => _FAQTile(faq: faq)),

            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Future<void> _launch(BuildContext context, Uri uri) async {
    if (!await launchUrl(uri) && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open that app.')),
      );
    }
  }
}

class _FAQTile extends StatelessWidget {
  final _FAQItem faq;
  const _FAQTile({required this.faq});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ExpansionTile(
        title: Text(
          faq.question,
          style: const TextStyle(fontWeight: FontWeight.w500),
        ),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Text(
              faq.answer,
              style: TextStyle(color: Colors.grey[700], height: 1.4),
            ),
          ),
        ],
      ),
    );
  }
}

class _FAQItem {
  final String question;
  final String answer;
  _FAQItem({required this.question, required this.answer});
}
