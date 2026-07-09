import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/beta/models/beta_locked_info.dart';

void main() {
  test('uses a clean fallback when beta held response has a blank name', () {
    final info = BetaLockedInfo.fromJson({
      'user': {'fullName': '   ', 'email': 'tester@example.com'},
      'betaPhotoUploaded': false,
      'betaSharedOnSocial': false,
    });

    expect(info.fullName, 'Beta Tester');
  });

  test('preserves a nonblank beta tester name', () {
    final info = BetaLockedInfo.fromJson({
      'user': {'fullName': 'Mark Prado', 'email': 'mark@example.com'},
      'betaPhotoUploaded': true,
      'betaSharedOnSocial': true,
    });

    expect(info.fullName, 'Mark Prado');
  });
}
