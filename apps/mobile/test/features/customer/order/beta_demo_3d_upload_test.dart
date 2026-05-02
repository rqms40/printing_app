import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/beta/models/beta_status.dart';
import 'package:printing_app/features/customer/order/beta_demo_3d_upload.dart';

void main() {
  group('beta demo 3D upload', () {
    test('activates only for globally enabled beta 3D uploads', () {
      const activeStatus = BetaStatus(
        globallyEnabled: true,
        isBetaUser: true,
        rank: 7,
      );
      const inactiveStatus = BetaStatus(
        globallyEnabled: false,
        isBetaUser: true,
        rank: 7,
      );

      expect(
        shouldUseBetaDemo3dUpload(category: '3d', betaStatus: activeStatus),
        isTrue,
      );
      expect(
        shouldUseBetaDemo3dUpload(category: 'paper', betaStatus: activeStatus),
        isFalse,
      );
      expect(
        shouldUseBetaDemo3dUpload(category: '3d', betaStatus: inactiveStatus),
        isFalse,
      );
      expect(
        shouldUseBetaDemo3dUpload(category: '3d', betaStatus: null),
        isFalse,
      );
    });

    test('uses the preloaded Pixellabs robot GLB asset metadata', () {
      expect(kBetaDemo3dFileName, 'pixellabs-robot-3332.glb');
      expect(kBetaDemo3dAssetPath, 'assets/demo/pixellabs-robot-3332.glb');
      expect(
        kBetaDemo3dWebViewerUrl,
        'assets/assets/demo/pixellabs-robot-3332.glb',
      );
      expect(kBetaDemo3dMimeType, 'model/gltf-binary');
      expect(
        kBetaDemo3dMockLoadingDuration.inMilliseconds,
        lessThanOrEqualTo(250),
      );

      final inspection = betaDemo3dInspection();

      expect(inspection['mimeType'], kBetaDemo3dMimeType);
      expect(inspection['previewGlbUrl'], kBetaDemo3dAssetPath);
      expect(inspection['modelBounds'], isA<Map<String, dynamic>>());
      expect(inspection['printerLimits'], isA<Map<String, dynamic>>());
      expect(inspection['printerLimits']['fits'], isTrue);
    });

    test('uses Flutter web public asset URL for model-viewer fetches', () {
      expect(betaDemo3dPreviewUrl(isWeb: true), kBetaDemo3dWebViewerUrl);
      expect(betaDemo3dPreviewUrl(isWeb: false), kBetaDemo3dAssetPath);

      final inspection = betaDemo3dInspection(
        previewGlbUrl: betaDemo3dPreviewUrl(isWeb: true),
      );

      expect(inspection['previewGlbUrl'], kBetaDemo3dWebViewerUrl);
    });

    test('primary action is unavailable while beta demo 3D mode is active', () {
      expect(
        uploadPrimaryActionLabel(
          isBetaDemo3dActive: true,
          modelExceedsPrinterLimits: false,
        ),
        'Unavailable for Beta Testing',
      );
      expect(
        uploadPrimaryActionLabel(
          isBetaDemo3dActive: false,
          modelExceedsPrinterLimits: true,
        ),
        'Unavailable for Beta Testing',
      );
      expect(
        uploadPrimaryActionLabel(
          isBetaDemo3dActive: false,
          modelExceedsPrinterLimits: false,
        ),
        'Continue',
      );
    });
  });
}
