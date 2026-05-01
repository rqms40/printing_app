class BetaOrderLimitException implements Exception {
  const BetaOrderLimitException();

  @override
  String toString() =>
      'BetaOrderLimitException: beta tester has already used their one order';
}
