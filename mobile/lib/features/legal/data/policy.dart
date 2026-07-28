import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;

/// The privacy policy / terms, loaded from the shared `policy.json` asset that
/// is generated from `legal/privacy-policy.md` (the single source of wording).
/// The same JSON drives the Next.js `/privacy` page, so both stay in sync.
class Policy {
  final String version;
  final String lastUpdated;
  final String contactEmail;
  final Map<String, String> placeholders;
  final List<PolicySection> sections;

  const Policy({
    required this.version,
    required this.lastUpdated,
    required this.contactEmail,
    required this.placeholders,
    required this.sections,
  });

  static Future<Policy> load() async {
    final raw = await rootBundle.loadString('assets/legal/policy.json');
    return Policy.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  factory Policy.fromJson(Map<String, dynamic> json) => Policy(
    version: json['version'] as String? ?? '',
    lastUpdated: json['lastUpdated'] as String? ?? '',
    contactEmail: json['contactEmail'] as String? ?? '',
    placeholders: (json['placeholders'] as Map<String, dynamic>? ?? {})
        .map((k, v) => MapEntry(k, (v as String?) ?? '')),
    sections: (json['sections'] as List<dynamic>? ?? [])
        .map((s) => PolicySection.fromJson(s as Map<String, dynamic>))
        .toList(),
  );
}

class PolicySection {
  final int number;
  final String heading;
  final List<PolicyBlock> blocks;

  const PolicySection({
    required this.number,
    required this.heading,
    required this.blocks,
  });

  factory PolicySection.fromJson(Map<String, dynamic> json) => PolicySection(
    number: json['number'] as int,
    heading: json['heading'] as String,
    blocks: (json['blocks'] as List<dynamic>? ?? [])
        .map((b) => PolicyBlock.fromJson(b as Map<String, dynamic>))
        .toList(),
  );
}

enum PolicyBlockType { paragraph, list, note }

class PolicyBlock {
  final PolicyBlockType type;
  final String? text;
  final List<String> items;

  const PolicyBlock({required this.type, this.text, this.items = const []});

  factory PolicyBlock.fromJson(Map<String, dynamic> json) {
    final type = switch (json['type'] as String) {
      'list' => PolicyBlockType.list,
      'note' => PolicyBlockType.note,
      _ => PolicyBlockType.paragraph,
    };
    return PolicyBlock(
      type: type,
      text: json['text'] as String?,
      items: (json['items'] as List<dynamic>? ?? [])
          .map((e) => e as String)
          .toList(),
    );
  }
}
