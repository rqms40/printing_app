import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/beta/models/beta_status.dart';
import 'package:printing_app/features/customer/beta/providers/beta_status_provider.dart';

void main() {
  group('BetaStatus.fromJson', () {
    test('parses all fields correctly', () {
      final status = BetaStatus.fromJson({
        'globallyEnabled': true,
        'isBetaUser': true,
        'rank': 5,
      });
      expect(status.globallyEnabled, true);
      expect(status.isBetaUser, true);
      expect(status.rank, 5);
    });

    test('parses null rank', () {
      final status = BetaStatus.fromJson({
        'globallyEnabled': false,
        'isBetaUser': false,
        'rank': null,
      });
      expect(status.rank, null);
    });
  });

  group('betaStatusProvider', () {
    test('returns null when overridden to return null', () async {
      final container = ProviderContainer(overrides: [
        betaStatusProvider.overrideWith((ref) async => null),
      ]);
      addTearDown(container.dispose);
      final result = await container.read(betaStatusProvider.future);
      expect(result, null);
    });

    test('returns BetaStatus when API succeeds', () async {
      const status = BetaStatus(
        globallyEnabled: true,
        isBetaUser: true,
        rank: 3,
      );
      final container = ProviderContainer(overrides: [
        betaStatusProvider.overrideWith((ref) async => status),
      ]);
      addTearDown(container.dispose);
      final result = await container.read(betaStatusProvider.future);
      expect(result?.isBetaUser, true);
      expect(result?.rank, 3);
    });
  });
}
