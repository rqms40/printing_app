enum TutorialKey {
  onboarding,
  pipeline,
  homeFeatures,
  checkoutFeatures,
  tracking;

  static TutorialKey? fromString(String value) {
    for (final key in TutorialKey.values) {
      if (key.name == value) return key;
    }
    return null;
  }
}
