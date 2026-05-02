import 'package:flutter/services.dart';
import 'package:printing_app/features/customer/beta/models/beta_status.dart';

const kBetaDemo3dFileName = 'pixellabs-robot-3332.glb';
const kBetaDemo3dAssetPath = 'assets/demo/pixellabs-robot-3332.glb';
const kBetaDemo3dWebViewerUrl = 'assets/$kBetaDemo3dAssetPath';
const kBetaDemo3dMimeType = 'model/gltf-binary';
const kBetaDemo3dMockLoadingDuration = Duration(milliseconds: 180);

Future<ByteData>? _preloadedBetaDemo3dFile;

bool shouldUseBetaDemo3dUpload({
  required String? category,
  required BetaStatus? betaStatus,
}) {
  return category == '3d' && betaStatus?.globallyEnabled == true;
}

Future<ByteData> preloadBetaDemo3dFile() {
  return _preloadedBetaDemo3dFile ??= rootBundle.load(kBetaDemo3dAssetPath);
}

String betaDemo3dPreviewUrl({required bool isWeb}) {
  return isWeb ? kBetaDemo3dWebViewerUrl : kBetaDemo3dAssetPath;
}

String uploadPrimaryActionLabel({
  required bool isBetaDemo3dActive,
  required bool modelExceedsPrinterLimits,
}) {
  if (isBetaDemo3dActive || modelExceedsPrinterLimits) {
    return 'Unavailable for Beta Testing';
  }
  return 'Continue';
}

Map<String, dynamic> betaDemo3dInspection({String? previewGlbUrl}) {
  return {
    'mimeType': kBetaDemo3dMimeType,
    'widthMm': null,
    'heightMm': null,
    'widthPx': null,
    'heightPx': null,
    'colorSpace': null,
    'pageCount': null,
    'dpi': null,
    'sizeValidation': null,
    'modelBounds': {
      'widthMm': 72.0,
      'depthMm': 68.0,
      'heightMm': 112.0,
      'triangleCount': null,
      'unit': 'mm',
    },
    'printerLimits': {
      'profileName': 'Beta Demo Printer',
      'widthMm': 220,
      'depthMm': 220,
      'heightMm': 250,
      'maxFileSizeMb': 200,
      'fits': true,
      'overflowAxes': const <String>[],
    },
    'previewGlbUrl': previewGlbUrl ?? kBetaDemo3dAssetPath,
  };
}
