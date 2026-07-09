import 'dart:typed_data';

import 'package:flutter/widgets.dart';
import 'package:printing_app/features/customer/beta/services/beta_photo_save_result.dart';
import 'package:share_plus/share_plus.dart';

Future<BetaPhotoSaveResult> saveBetaShareImage(
  Uint8List bytes, {
  required String fileName,
  Rect? sharePositionOrigin,
}) async {
  await Share.shareXFiles(
    [XFile.fromData(bytes, mimeType: 'image/png', name: fileName)],
    fileNameOverrides: [fileName],
    subject: 'My GRIDGO beta print',
    text: 'Printed with GRIDGO in Davao.',
    sharePositionOrigin: sharePositionOrigin,
  );
  return BetaPhotoSaveResult.shared;
}
