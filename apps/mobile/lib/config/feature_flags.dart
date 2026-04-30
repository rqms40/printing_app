class FeatureFlags {
  const FeatureFlags({Map<String, String> env = const {}}) : _env = env;

  final Map<String, String> _env;

  bool get checkoutV2 =>
      const bool.fromEnvironment('CHECKOUT_V2', defaultValue: false) ||
      (_env['CHECKOUT_V2']?.toLowerCase() == 'true');
}
