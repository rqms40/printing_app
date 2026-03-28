import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/providers/connectivity_provider.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('ConnectivityNotifier', () {
    test('initial state defaults to true (online)', () {
      // The constructor sets super(true) before async _init runs
      final notifier = ConnectivityNotifier();
      expect(notifier.state, true);
      expect(notifier.state, isA<bool>());
      notifier.dispose();
    });
  });
}
