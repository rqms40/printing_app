import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shimmer/shimmer.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/uploads/providers/my_uploads_provider.dart';
import 'package:printing_app/shared/models/uploaded_file.dart';
import 'package:printing_app/shared/widgets/file_preview_sheet.dart';
import 'package:printing_app/shared/widgets/file_type_icon.dart';
import 'package:printing_app/utils/formatters.dart';

/// Shows all files the current user has uploaded, in a 2-column grid.
class MyUploadsScreen extends ConsumerWidget {
  const MyUploadsScreen({super.key});

  static const routeName = '/customer/uploads';

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = _colors(context);
    final state = ref.watch(myUploadsProvider);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        title: Text(
          'My Uploads',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        iconTheme: IconThemeData(color: colors.onBackground),
      ),
      body: state.when(
        loading: () => _buildShimmer(colors),
        error: (e, _) => _buildError(ref, colors),
        data: (files) => files.isEmpty
            ? _buildEmpty(colors)
            : _buildGrid(context, files, colors, ref),
      ),
    );
  }

  Widget _buildGrid(
    BuildContext context,
    List<UploadedFile> files,
    AppColorSet colors,
    WidgetRef ref,
  ) {
    return RefreshIndicator(
      onRefresh: () => ref.read(myUploadsProvider.notifier).fetch(),
      child: GridView.builder(
        padding: const EdgeInsets.all(AppSpacing.lg),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: AppSpacing.md,
          crossAxisSpacing: AppSpacing.md,
          childAspectRatio: 0.85,
        ),
        itemCount: files.length,
        itemBuilder: (ctx, index) =>
            _UploadCard(file: files[index], colors: colors),
      ),
    );
  }

  Widget _buildShimmer(AppColorSet colors) {
    return GridView.builder(
      padding: const EdgeInsets.all(AppSpacing.lg),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: AppSpacing.md,
        crossAxisSpacing: AppSpacing.md,
        childAspectRatio: 0.85,
      ),
      itemCount: 6,
      itemBuilder: (context, _) => Shimmer.fromColors(
        baseColor: colors.surfaceVariant,
        highlightColor: colors.surface,
        child: Container(
          decoration: BoxDecoration(
            color: colors.surfaceVariant,
            borderRadius: AppRadius.borderMd,
          ),
        ),
      ),
    );
  }

  Widget _buildEmpty(AppColorSet colors) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.folder_outlined, size: 64, color: colors.onSurfaceDim),
          const SizedBox(height: AppSpacing.lg),
          Text(
            "You haven't uploaded any files yet.",
            style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildError(WidgetRef ref, AppColorSet colors) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            "Couldn't load uploads.",
            style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
          ),
          const SizedBox(height: AppSpacing.md),
          TextButton(
            onPressed: () => ref.read(myUploadsProvider.notifier).fetch(),
            child: Text(
              'Retry',
              style: AppTypography.bodyBold.copyWith(color: colors.accent),
            ),
          ),
        ],
      ),
    );
  }
}

class _UploadCard extends StatelessWidget {
  const _UploadCard({required this.file, required this.colors});

  final UploadedFile file;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => FilePreviewSheet.show(
        context,
        fileId: file.id,
        fileName: file.originalName,
        mimeType: file.mimeType,
        fileSize: file.size,
      ),
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: AppRadius.borderMd,
          border: Border.all(color: colors.outline, width: 0.5),
        ),
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: FileTypeIcon(mimeType: file.mimeType, size: 56),
            ),
            const Spacer(),
            Text(
              file.originalName,
              style: AppTypography.caption
                  .copyWith(color: colors.onBackground, fontWeight: FontWeight.w600),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              formatFileSize(file.size),
              style:
                  AppTypography.caption.copyWith(color: colors.onSurfaceDim),
            ),
            Text(
              _formatDate(file.createdAt),
              style:
                  AppTypography.caption.copyWith(color: colors.onSurfaceDim),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime dt) {
    return '${_month(dt.month)} ${dt.day}, ${dt.year}';
  }

  String _month(int m) => const [
        '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ][m];
}
