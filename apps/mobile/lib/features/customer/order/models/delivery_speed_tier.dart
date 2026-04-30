enum DeliverySpeedTier {
  priority,
  standard,
  saver,
  scheduled;

  String toApi() => name;

  static DeliverySpeedTier fromApi(String? value) {
    for (final tier in DeliverySpeedTier.values) {
      if (tier.name == value) return tier;
    }
    return DeliverySpeedTier.standard;
  }
}
