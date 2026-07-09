import 'dart:typed_data';

import 'package:flutter/widgets.dart';
import 'package:printing_app/features/customer/beta/services/beta_photo_save_result.dart';

Future<BetaPhotoSaveResult> saveBetaShareImage(
  Uint8List bytes, {
  required String fileName,
  Rect? sharePositionOrigin,
}) {
  throw UnsupportedError('Saving beta share images is not supported here.');
}
