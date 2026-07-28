import 'package:flutter/material.dart';

import '../../../constants.dart';
import '../data/policy.dart';

/// Full privacy policy / terms, rendered from the shared `policy.json` asset.
/// A tappable table of contents at the top jumps to any section, so a specific
/// clause can be reached directly. Unfilled `{{PLACEHOLDER}}` values render as a
/// highlighted `[TO BE COMPLETED]` so nothing looks silently blank.
class PolicyScreen extends StatefulWidget {
  const PolicyScreen({super.key});

  @override
  State<PolicyScreen> createState() => _PolicyScreenState();
}

class _PolicyScreenState extends State<PolicyScreen> {
  late final Future<Policy> _future = Policy.load();
  final Map<int, GlobalKey> _sectionKeys = {};

  Future<void> _jumpTo(int number) async {
    final key = _sectionKeys[number];
    final ctx = key?.currentContext;
    if (ctx == null) return;
    await Scrollable.ensureVisible(
      ctx,
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeInOut,
      alignment: 0.05,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Privacy & Terms')),
      body: FutureBuilder<Policy>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError || !snapshot.hasData) {
            return const Center(child: Text('Could not load the policy.'));
          }
          final policy = snapshot.data!;
          for (final s in policy.sections) {
            _sectionKeys.putIfAbsent(s.number, () => GlobalKey());
          }
          return SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _Header(policy: policy),
                const SizedBox(height: 20),
                _TableOfContents(sections: policy.sections, onTap: _jumpTo),
                const SizedBox(height: 8),
                for (final section in policy.sections)
                  _SectionView(
                    key: _sectionKeys[section.number],
                    section: section,
                    placeholders: policy.placeholders,
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _Header extends StatelessWidget {
  final Policy policy;
  const _Header({required this.policy});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Privacy Policy and Terms of Use', style: titleStyle),
        const SizedBox(height: 6),
        Text(
          'Last updated: ${policy.lastUpdated}   •   Version ${policy.version}',
          style: subtitleStyle,
        ),
      ],
    );
  }
}

class _TableOfContents extends StatelessWidget {
  final List<PolicySection> sections;
  final void Function(int number) onTap;
  const _TableOfContents({required this.sections, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: searchBg,
        borderRadius: BorderRadius.circular(cardBorderRadius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Contents',
            style: titleStyle.copyWith(fontSize: 15, color: primaryGreen),
          ),
          const SizedBox(height: 8),
          for (final s in sections)
            InkWell(
              onTap: () => onTap(s.number),
              borderRadius: BorderRadius.circular(6),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Text(
                  '${s.number}.  ${s.heading}',
                  style: const TextStyle(
                    fontSize: 14,
                    height: 1.3,
                    color: primaryGreen,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _SectionView extends StatelessWidget {
  final PolicySection section;
  final Map<String, String> placeholders;
  const _SectionView({
    super.key,
    required this.section,
    required this.placeholders,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${section.number}. ${section.heading}', style: titleStyle),
          const SizedBox(height: 10),
          for (final block in section.blocks)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _BlockView(block: block, placeholders: placeholders),
            ),
        ],
      ),
    );
  }
}

class _BlockView extends StatelessWidget {
  final PolicyBlock block;
  final Map<String, String> placeholders;
  const _BlockView({required this.block, required this.placeholders});

  static const _body = TextStyle(fontSize: 15, height: 1.55, color: textDark);

  @override
  Widget build(BuildContext context) {
    switch (block.type) {
      case PolicyBlockType.paragraph:
        return _RichLine(text: block.text ?? '', placeholders: placeholders, style: _body);
      case PolicyBlockType.list:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final item in block.items)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Padding(
                      padding: EdgeInsets.only(top: 7, right: 8),
                      child: Icon(Icons.circle, size: 6, color: textGray),
                    ),
                    Expanded(
                      child: _RichLine(
                        text: item,
                        placeholders: placeholders,
                        style: _body,
                      ),
                    ),
                  ],
                ),
              ),
          ],
        );
      case PolicyBlockType.note:
        return Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFFFF4E5),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.orange.shade300),
          ),
          child: _RichLine(
            text: block.text ?? '',
            placeholders: placeholders,
            style: _body.copyWith(color: const Color(0xFF8A5A00)),
          ),
        );
    }
  }
}

/// Renders a line of body text, resolving `**bold**` and `{{PLACEHOLDER}}` spans.
/// A filled placeholder renders its value inline; an unfilled one renders a
/// highlighted `[TO BE COMPLETED: NAME]` so gaps are obvious at a glance.
class _RichLine extends StatelessWidget {
  final String text;
  final Map<String, String> placeholders;
  final TextStyle style;
  const _RichLine({
    required this.text,
    required this.placeholders,
    required this.style,
  });

  static final _token = RegExp(r'\*\*(.+?)\*\*|\{\{([A-Z_]+)\}\}');

  @override
  Widget build(BuildContext context) {
    final spans = <InlineSpan>[];
    var index = 0;
    for (final m in _token.allMatches(text)) {
      if (m.start > index) {
        spans.add(TextSpan(text: text.substring(index, m.start)));
      }
      if (m.group(1) != null) {
        spans.add(TextSpan(
          text: m.group(1),
          style: const TextStyle(fontWeight: FontWeight.bold),
        ));
      } else {
        final name = m.group(2)!;
        final value = placeholders[name] ?? '';
        if (value.trim().isEmpty) {
          spans.add(TextSpan(
            text: '[TO BE COMPLETED: $name]',
            style: TextStyle(
              backgroundColor: Colors.orange.shade100,
              color: const Color(0xFF8A5A00),
              fontWeight: FontWeight.bold,
            ),
          ));
        } else {
          spans.add(TextSpan(text: value));
        }
      }
      index = m.end;
    }
    if (index < text.length) {
      spans.add(TextSpan(text: text.substring(index)));
    }
    return SelectableText.rich(TextSpan(style: style, children: spans));
  }
}
