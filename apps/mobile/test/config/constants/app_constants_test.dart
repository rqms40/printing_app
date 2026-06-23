import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/config/constants/app_constants.dart';

void main() {
  test('provides a configured GRID Community URL', () {
    expect(AppConstants.defaultCommunityUrl, 'https://m.me/GRIDGOPrintPH');
    expect(AppConstants.communityUrl, AppConstants.defaultCommunityUrl);
    expect(AppConstants.hasCommunityUrl, isTrue);
  });
}
