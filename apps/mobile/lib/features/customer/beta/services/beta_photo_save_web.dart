import 'dart:typed_data';

import 'package:flutter/widgets.dart';
import 'package:printing_app/features/customer/beta/services/beta_photo_save_result.dart';
import 'package:web/web.dart';

Future<BetaPhotoSaveResult> saveBetaShareImage(
  Uint8List bytes, {
  required String fileName,
  Rect? sharePositionOrigin,
}) async {
  final anchor = document.createElement('a') as HTMLAnchorElement
    ..href = Uri.dataFromBytes(bytes, mimeType: 'image/png').toString()
    ..download = fileName
    ..style.display = 'none';
  document.body?.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return BetaPhotoSaveResult.downloaded;
}
