import 'dart:typed_data';

import 'package:flutter/widgets.dart';
import 'package:printing_app/features/customer/beta/services/beta_photo_save_result.dart';
import 'package:printing_app/features/customer/beta/services/beta_photo_save_stub.dart'
    if (dart.library.io) 'package:printing_app/features/customer/beta/services/beta_photo_save_native.dart'
    if (dart.library.js_interop) 'package:printing_app/features/customer/beta/services/beta_photo_save_web.dart'
    as platform;

export 'package:printing_app/features/customer/beta/services/beta_photo_save_result.dart';

Future<BetaPhotoSaveResult> saveBetaShareImage(
  Uint8List bytes, {
  required String fileName,
  Rect? sharePositionOrigin,
}) {
  return platform.saveBetaShareImage(
    bytes,
    fileName: fileName,
    sharePositionOrigin: sharePositionOrigin,
  );
}
