import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';

/// Displays a colored icon square representing a file type.
///
/// Used in file upload cards and My Uploads grid cells.
class FileTypeIcon extends StatelessWidget {
  const FileTypeIcon({
    super.key,
    required this.mimeType,
    this.size = 52,
  });

  final String? mimeType;
  final double size;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final (iconData, bgColor) = _resolve(mimeType, colors);

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: bgColor.withValues(alpha: 0.15),
        borderRadius: AppRadius.borderSm,
        border: Border.all(color: bgColor.withValues(alpha: 0.3)),
      ),
      child: Center(
        child: HugeIcon(icon: iconData, size: size * 0.5, color: bgColor),
      ),
    );
  }

  static (dynamic, Color) _resolve(String? mimeType, AppColorSet colors) {
    if (mimeType == null) {
      return (HugeIcons.strokeRoundedFile01, colors.onSurfaceDim);
    }
    if (mimeType.startsWith('image/')) {
      return (HugeIcons.strokeRoundedImage01, Colors.blue);
    }
    if (mimeType == 'application/pdf') {
      return (HugeIcons.strokeRoundedFile02, Colors.red);
    }
    if (mimeType.contains('word') || mimeType.contains('document')) {
      return (HugeIcons.strokeRoundedDoc01, Colors.blue.shade700);
    }
    if (mimeType.contains('stl') ||
        mimeType.contains('obj') ||
        mimeType.contains('3mf') ||
        mimeType.contains('gltf') ||
        mimeType.contains('glb') ||
        mimeType.contains('model/')) {
      return (HugeIcons.strokeRoundedCube, Colors.purple);
    }
    return (HugeIcons.strokeRoundedFile01, colors.onSurfaceDim);
  }
}
