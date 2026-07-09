import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/beta/models/beta_status.dart';
import 'package:printing_app/features/customer/beta/providers/beta_status_provider.dart';
import 'package:printing_app/shared/services/api_client.dart';

import '../../../helpers/test_setup.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    TestSetup.stubSecureStorage();
    TestSetup.initApiClient();
  });

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
    test(
      'uses only the public status endpoint while unauthenticated',
      () async {
        final requestedPaths = <String>[];
        final interceptor = InterceptorsWrapper(
          onRequest: (options, handler) {
            requestedPaths.add(options.path);
            handler.resolve(
              Response<Map<String, dynamic>>(
                requestOptions: options,
                statusCode: 200,
                data: options.path == '/beta-mode/me'
                    ? {
                        'globallyEnabled': true,
                        'isBetaUser': false,
                        'rank': null,
                      }
                    : {'isEnabled': true},
              ),
            );
          },
        );
        ApiClient.instance.dio.interceptors.add(interceptor);
        addTearDown(
          () => ApiClient.instance.dio.interceptors.remove(interceptor),
        );

        final container = ProviderContainer(
          overrides: [authProvider.overrideWith((ref) => AuthNotifier())],
        );
        addTearDown(container.dispose);

        final result = await container.read(betaStatusProvider.future);

        expect(requestedPaths, ['/beta-mode/status']);
        expect(result?.globallyEnabled, isTrue);
        expect(result?.isBetaUser, isFalse);
      },
    );

    test('returns null when overridden to return null', () async {
      final container = ProviderContainer(
        overrides: [betaStatusProvider.overrideWith((ref) async => null)],
      );
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
      final container = ProviderContainer(
        overrides: [betaStatusProvider.overrideWith((ref) async => status)],
      );
      addTearDown(container.dispose);
      final result = await container.read(betaStatusProvider.future);
      expect(result?.isBetaUser, true);
      expect(result?.rank, 3);
    });
  });
}
