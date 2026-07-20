/// Rwanda phone helpers — accept a number however a Rwandan naturally writes it
/// and normalise to the E.164 form the API requires (`^\+250\d{9}$`).
///
/// A Rwandan mobile MSISDN is 9 national digits beginning `7` (07x locally),
/// with the second digit in {2,3,8,9} for the active MTN/Airtel ranges. Users
/// commonly type `0788…`, `788…`, `250788…` or `+250788…` — all mean the same
/// number, so we canonicalise rather than reject.
class RwandaPhone {
  /// The nine national digits after country code, e.g. `788555555`.
  static final RegExp _national = RegExp(r'^7[2389]\d{7}$');

  /// Strip a raw input to digits, dropping a leading `+`, spaces, dashes, etc.
  static String _digits(String raw) => raw.replaceAll(RegExp(r'\D'), '');

  /// Reduce any accepted local/international form to the 9 national digits,
  /// or return null if the input can't be a Rwandan mobile number.
  static String? _toNational(String raw) {
    var d = _digits(raw);
    if (d.startsWith('250')) d = d.substring(3); // 250788… / +250788…
    if (d.length == 10 && d.startsWith('0')) d = d.substring(1); // 0788…
    return _national.hasMatch(d) ? d : null;
  }

  /// Canonical E.164 (`+250788555555`) or null if the input isn't valid.
  static String? toE164(String raw) {
    final n = _toNational(raw);
    return n == null ? null : '+250$n';
  }

  /// Form validator: null when valid, else a human message.
  static String? validate(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Please enter your phone number';
    }
    return toE164(value) == null
        ? 'Enter a Rwandan mobile number, e.g. 0788 123 456'
        : null;
  }
}
