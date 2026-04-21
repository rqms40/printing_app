import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
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

enum _ViewMode { grid, list }

enum _FileFilter { all, pdf, image, document, threeD }

class MyUploadsScreen extends ConsumerStatefulWidget {
  const MyUploadsScreen({super.key});

  static const routeName = '/customer/uploads';

  @override
  ConsumerState<MyUploadsScreen> createState() => _MyUploadsScreenState();
}

class _MyUploadsScreenState extends ConsumerState<MyUploadsScreen> {
  _ViewMode _viewMode = _ViewMode.grid;
  _FileFilter _filter = _FileFilter.all;
  bool _showSearch = false;
  final _searchController = TextEditingController();
  final _searchFocus = FocusNode();
  String _searchQuery = '';

  AppColorSet _colors(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? AppColors.dark
          : AppColors.light;

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  List<UploadedFile> _applyFilters(List<UploadedFile> files) {
    var result = files;
    if (_searchQuery.isNotEmpty) {
      final q = _searchQuery.toLowerCase();
      result =
          result.where((f) => f.originalName.toLowerCase().contains(q)).toList();
    }
    switch (_filter) {
      case _FileFilter.pdf:
        result =
            result.where((f) => f.mimeType == 'application/pdf').toList();
      case _FileFilter.image:
        result = result.where((f) => f.mimeType.startsWith('image/')).toList();
      case _FileFilter.document:
        result = result
            .where((f) =>
                f.mimeType.contains('word') ||
                f.mimeType.contains('document'))
            .toList();
      case _FileFilter.threeD:
        result = result
            .where((f) =>
                f.mimeType.contains('stl') ||
                f.mimeType.contains('obj') ||
                f.mimeType.contains('3mf'))
            .toList();
      case _FileFilter.all:
        break;
    }
    return result;
  }

  void _toggleSearch() {
    setState(() {
      _showSearch = !_showSearch;
      if (!_showSearch) {
        _searchController.clear();
        _searchQuery = '';
      } else {
        Future.microtask(() => _searchFocus.requestFocus());
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final state = ref.watch(myUploadsProvider);

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _Header(
              colors: colors,
              state: state,
              viewMode: _viewMode,
              showSearch: _showSearch,
              onSearchToggle: _toggleSearch,
              onViewToggle: () => setState(() {
                _viewMode = _viewMode == _ViewMode.grid
                    ? _ViewMode.list
                    : _ViewMode.grid;
              }),
            ),
            if (_showSearch)
              _SearchBar(
                controller: _searchController,
                focusNode: _searchFocus,
                colors: colors,
                onChanged: (v) => setState(() => _searchQuery = v),
              ),
            _FilterChips(
              colors: colors,
              selected: _filter,
              onSelect: (f) => setState(() => _filter = f),
            ),
            Divider(color: colors.outline, height: 1),
            Expanded(
              child: state.when(
                loading: () => _buildShimmer(colors),
                error: (_, _) => _buildError(colors),
                data: (files) {
                  final filtered = _applyFilters(files);
                  if (files.isEmpty) return _buildEmpty(colors);
                  if (filtered.isEmpty) return _buildNoResults(colors);
                  return _viewMode == _ViewMode.grid
                      ? _buildGrid(context, filtered, colors)
                      : _buildList(context, filtered, colors);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGrid(
      BuildContext context, List<UploadedFile> files, AppColorSet colors) {
    return RefreshIndicator(
      onRefresh: () => ref.read(myUploadsProvider.notifier).fetch(),
      color: colors.accent,
      child: GridView.builder(
        padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.lg),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: AppSpacing.md,
          crossAxisSpacing: AppSpacing.md,
          childAspectRatio: 0.80,
        ),
        itemCount: files.length,
        itemBuilder: (_, i) =>
            _GridCard(file: files[i], colors: colors, index: i),
      ),
    );
  }

  Widget _buildList(
      BuildContext context, List<UploadedFile> files, AppColorSet colors) {
    return RefreshIndicator(
      onRefresh: () => ref.read(myUploadsProvider.notifier).fetch(),
      color: colors.accent,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
        itemCount: files.length,
        separatorBuilder: (_, _) => Divider(
          color: colors.outline,
          height: 1,
          indent: 76,
          endIndent: AppSpacing.lg,
        ),
        itemBuilder: (_, i) =>
            _ListRow(file: files[i], colors: colors, index: i),
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
        childAspectRatio: 0.80,
      ),
      itemCount: 6,
      itemBuilder: (_, _) => Shimmer.fromColors(
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
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                color: colors.surfaceVariant,
                borderRadius: AppRadius.borderXl,
              ),
              child: Center(
                child: HugeIcon(
                  icon: HugeIcons.strokeRoundedCloudUpload,
                  size: 40,
                  color: colors.onSurfaceDim,
                ),
              ),
            )
                .animate()
                .scale(
                  begin: const Offset(0.7, 0.7),
                  duration: 500.ms,
                  curve: Curves.elasticOut,
                ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'Your grid is empty.',
              style: AppTypography.h3.copyWith(color: colors.onBackground),
            ).animate().fadeIn(delay: 150.ms, duration: 350.ms),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Files uploaded with your print orders\nwill appear here.',
              style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
              textAlign: TextAlign.center,
            ).animate().fadeIn(delay: 250.ms, duration: 350.ms),
          ],
        ),
      ),
    );
  }

  Widget _buildNoResults(AppColorSet colors) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            HugeIcon(
              icon: HugeIcons.strokeRoundedSearch01,
              size: 48,
              color: colors.onSurfaceDim,
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'No files found',
              style: AppTypography.h3.copyWith(color: colors.onBackground),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Try a different search term or filter.',
              style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildError(AppColorSet colors) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            HugeIcon(
              icon: HugeIcons.strokeRoundedCancelCircle,
              size: 48,
              color: colors.error,
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              "Couldn't load files.",
              style: AppTypography.h3.copyWith(color: colors.onBackground),
            ),
            const SizedBox(height: AppSpacing.md),
            OutlinedButton.icon(
              onPressed: () => ref.read(myUploadsProvider.notifier).fetch(),
              icon: const Icon(Icons.refresh_rounded, size: 16),
              label: const Text('Try again'),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.lg,
                  vertical: AppSpacing.sm,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

class _Header extends StatelessWidget {
  const _Header({
    required this.colors,
    required this.state,
    required this.viewMode,
    required this.showSearch,
    required this.onSearchToggle,
    required this.onViewToggle,
  });

  final AppColorSet colors;
  final AsyncValue<List<UploadedFile>> state;
  final _ViewMode viewMode;
  final bool showSearch;
  final VoidCallback onSearchToggle;
  final VoidCallback onViewToggle;

  String _totalSize(List<UploadedFile> files) {
    final bytes = files.fold<int>(0, (s, f) => s + f.size);
    return formatFileSize(bytes);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.md, AppSpacing.md, AppSpacing.xs, AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Back
          _IconBtn(
            icon: HugeIcons.strokeRoundedArrowLeft01,
            colors: colors,
            onTap: () => context.pop(),
          ),
          const SizedBox(width: AppSpacing.sm),
          // Title block
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'THE DATA GRID',
                  style: AppTypography.overline.copyWith(
                    color: colors.brand,
                    fontSize: 10,
                    letterSpacing: 2.0,
                  ),
                ),
                const SizedBox(height: 1),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(
                      'Your Files',
                      style:
                          AppTypography.h3.copyWith(color: colors.onBackground),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    state.whenOrNull(
                          data: (files) => _FileBadge(
                            label: '${files.length}',
                            colors: colors,
                          ),
                        ) ??
                        const SizedBox.shrink(),
                  ],
                ),
                state.whenOrNull(
                      data: (files) => files.isEmpty
                          ? const SizedBox.shrink()
                          : Text(
                              '${_totalSize(files)} total',
                              style: AppTypography.caption
                                  .copyWith(color: colors.onSurfaceDim),
                            ),
                    ) ??
                    const SizedBox.shrink(),
              ],
            ),
          ),
          // Search toggle
          _IconBtn(
            icon: showSearch
                ? HugeIcons.strokeRoundedCancel01
                : HugeIcons.strokeRoundedSearch01,
            colors: colors,
            active: showSearch,
            onTap: onSearchToggle,
          ),
          // View toggle
          _IconBtn(
            icon: viewMode == _ViewMode.grid
                ? HugeIcons.strokeRoundedFilterHorizontal
                : HugeIcons.strokeRoundedDashboardSquare01,
            colors: colors,
            onTap: onViewToggle,
          ),
        ],
      ),
    );
  }
}

class _FileBadge extends StatelessWidget {
  const _FileBadge({required this.label, required this.colors});

  final String label;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: AppRadius.borderFull,
        border: Border.all(color: colors.outline),
      ),
      child: Text(
        label,
        style: AppTypography.caption.copyWith(
          color: colors.onSurface,
          fontWeight: FontWeight.w600,
          fontSize: 11,
        ),
      ),
    );
  }
}

class _IconBtn extends StatelessWidget {
  const _IconBtn({
    required this.icon,
    required this.colors,
    required this.onTap,
    this.active = false,
  });

  final dynamic icon;
  final AppColorSet colors;
  final VoidCallback onTap;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 38,
        height: 38,
        margin: const EdgeInsets.symmetric(horizontal: 2),
        decoration: BoxDecoration(
          color: active ? colors.accent : Colors.transparent,
          borderRadius: AppRadius.borderSm,
        ),
        child: Center(
          child: HugeIcon(
            icon: icon,
            size: 20,
            color: active ? colors.accentOnColor : colors.onSurface,
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Search bar
// ─────────────────────────────────────────────────────────────────────────────

class _SearchBar extends StatelessWidget {
  const _SearchBar({
    required this.controller,
    required this.focusNode,
    required this.colors,
    required this.onChanged,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final AppColorSet colors;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.sm),
      child: TextField(
        controller: controller,
        focusNode: focusNode,
        onChanged: onChanged,
        style: AppTypography.body.copyWith(color: colors.onBackground),
        decoration: InputDecoration(
          hintText: 'Search files…',
          hintStyle:
              AppTypography.body.copyWith(color: colors.onSurfaceDim),
          prefixIcon: Padding(
            padding: const EdgeInsets.only(left: 14, right: 10),
            child: HugeIcon(
              icon: HugeIcons.strokeRoundedSearch01,
              size: 18,
              color: colors.onSurfaceDim,
            ),
          ),
          prefixIconConstraints:
              const BoxConstraints(minWidth: 44, minHeight: 44),
          filled: true,
          fillColor: colors.surfaceVariant,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          border: OutlineInputBorder(
            borderSide: BorderSide.none,
            borderRadius: AppRadius.borderMd,
          ),
          enabledBorder: OutlineInputBorder(
            borderSide: BorderSide.none,
            borderRadius: AppRadius.borderMd,
          ),
          focusedBorder: OutlineInputBorder(
            borderSide: BorderSide(color: colors.accent, width: 1.5),
            borderRadius: AppRadius.borderMd,
          ),
        ),
      )
          .animate()
          .fadeIn(duration: 200.ms)
          .slideY(begin: -0.15, end: 0, duration: 200.ms, curve: Curves.easeOut),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter chips
// ─────────────────────────────────────────────────────────────────────────────

class _FilterChips extends StatelessWidget {
  const _FilterChips({
    required this.colors,
    required this.selected,
    required this.onSelect,
  });

  final AppColorSet colors;
  final _FileFilter selected;
  final ValueChanged<_FileFilter> onSelect;

  static const _chips = [
    (_FileFilter.all, 'All', HugeIcons.strokeRoundedFolder01),
    (_FileFilter.pdf, 'PDF', HugeIcons.strokeRoundedFile02),
    (_FileFilter.image, 'Images', HugeIcons.strokeRoundedImage01),
    (_FileFilter.document, 'Docs', HugeIcons.strokeRoundedDoc01),
    (_FileFilter.threeD, '3D', HugeIcons.strokeRoundedCube),
  ];

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 42,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: 5,
        ),
        itemCount: _chips.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final (filter, label, icon) = _chips[i];
          final active = selected == filter;
          return GestureDetector(
            onTap: () => onSelect(filter),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
              decoration: BoxDecoration(
                color: active ? colors.accent : colors.surfaceVariant,
                borderRadius: AppRadius.borderFull,
                border: Border.all(
                  color: active ? colors.accent : colors.outline,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  HugeIcon(
                    icon: icon,
                    size: 13,
                    color: active
                        ? colors.accentOnColor
                        : colors.onSurfaceDim,
                  ),
                  const SizedBox(width: 5),
                  Text(
                    label,
                    style: AppTypography.caption.copyWith(
                      color: active
                          ? colors.accentOnColor
                          : colors.onSurface,
                      fontWeight:
                          active ? FontWeight.w700 : FontWeight.w400,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid card
// ─────────────────────────────────────────────────────────────────────────────

class _GridCard extends StatelessWidget {
  const _GridCard({
    required this.file,
    required this.colors,
    required this.index,
  });

  final UploadedFile file;
  final AppColorSet colors;
  final int index;

  static Color _accentFor(String mime) {
    if (mime.startsWith('image/')) return Colors.blue;
    if (mime == 'application/pdf') return Colors.red;
    if (mime.contains('word') || mime.contains('document')) return const Color(0xFF1565C0);
    if (mime.contains('stl') || mime.contains('obj') || mime.contains('3mf')) return Colors.purple;
    return const Color(0xFF6B7280);
  }

  @override
  Widget build(BuildContext context) {
    final accent = _accentFor(file.mimeType);

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
          border: Border.all(color: colors.outline, width: 0.75),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Color-coded type strip
            Container(height: 3, color: accent),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Icon
                    FileTypeIcon(mimeType: file.mimeType, size: 44),
                    const Spacer(),
                    // Name
                    Text(
                      file.originalName,
                      style: AppTypography.caption.copyWith(
                        color: colors.onBackground,
                        fontWeight: FontWeight.w600,
                        height: 1.4,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    // Meta row
                    Row(
                      children: [
                        // Size pill
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: colors.surfaceVariant,
                            borderRadius: AppRadius.borderFull,
                          ),
                          child: Text(
                            formatFileSize(file.size),
                            style: AppTypography.caption.copyWith(
                              color: colors.onSurfaceDim,
                              fontSize: 10,
                            ),
                          ),
                        ),
                        const Spacer(),
                        if (_expiryLabel(file.expiresAt) case final label?)
                          _ExpiryBadge(label: label)
                        else
                          Text(
                            _shortDate(file.createdAt),
                            style: AppTypography.caption.copyWith(
                              color: colors.onSurfaceDim,
                              fontSize: 10,
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    )
        .animate(delay: Duration(milliseconds: 35 * (index % 8)))
        .fadeIn(duration: 280.ms)
        .slideY(begin: 0.06, end: 0, duration: 280.ms, curve: Curves.easeOut);
  }

  String _shortDate(DateTime dt) {
    const m = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return '${m[dt.month - 1]} ${dt.day}';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// List row
// ─────────────────────────────────────────────────────────────────────────────

class _ListRow extends StatelessWidget {
  const _ListRow({
    required this.file,
    required this.colors,
    required this.index,
  });

  final UploadedFile file;
  final AppColorSet colors;
  final int index;

  static Color _accentFor(String mime) {
    if (mime.startsWith('image/')) return Colors.blue;
    if (mime == 'application/pdf') return Colors.red;
    if (mime.contains('word') || mime.contains('document')) return const Color(0xFF1565C0);
    if (mime.contains('stl') || mime.contains('obj') || mime.contains('3mf')) return Colors.purple;
    return const Color(0xFF6B7280);
  }

  @override
  Widget build(BuildContext context) {
    final accent = _accentFor(file.mimeType);

    return InkWell(
      onTap: () => FilePreviewSheet.show(
        context,
        fileId: file.id,
        fileName: file.originalName,
        mimeType: file.mimeType,
        fileSize: file.size,
      ),
      splashColor: colors.accent.withValues(alpha: 0.06),
      highlightColor: colors.surfaceVariant.withValues(alpha: 0.5),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: 12,
        ),
        child: Row(
          children: [
            // Icon with type dot
            Stack(
              clipBehavior: Clip.none,
              children: [
                FileTypeIcon(mimeType: file.mimeType, size: 44),
                Positioned(
                  bottom: -2,
                  right: -2,
                  child: Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      color: accent,
                      shape: BoxShape.circle,
                      border:
                          Border.all(color: colors.background, width: 1.5),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(width: AppSpacing.md),
            // Name + meta
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    file.originalName,
                    style: AppTypography.body.copyWith(
                      color: colors.onBackground,
                      fontWeight: FontWeight.w600,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Text(
                        formatFileSize(file.size),
                        style: AppTypography.caption
                            .copyWith(color: colors.onSurfaceDim),
                      ),
                      Padding(
                        padding:
                            const EdgeInsets.symmetric(horizontal: 6),
                        child: Container(
                          width: 2,
                          height: 2,
                          decoration: BoxDecoration(
                            color: colors.onSurfaceDim,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                      Text(
                        _formatDate(file.createdAt),
                        style: AppTypography.caption
                            .copyWith(color: colors.onSurfaceDim),
                      ),
                    ],
                  ),
                  if (_expiryLabel(file.expiresAt) case final label?) ...[
                    const SizedBox(height: 3),
                    _ExpiryBadge(label: label),
                  ],
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            HugeIcon(
              icon: HugeIcons.strokeRoundedArrowRight01,
              size: 16,
              color: colors.onSurfaceDim,
            ),
          ],
        ),
      ),
    )
        .animate(delay: Duration(milliseconds: 25 * (index % 12)))
        .fadeIn(duration: 220.ms)
        .slideX(
            begin: -0.02, end: 0, duration: 220.ms, curve: Curves.easeOut);
  }

  String _formatDate(DateTime dt) {
    const m = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return '${m[dt.month - 1]} ${dt.day}, ${dt.year}';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Expiry helpers
// ─────────────────────────────────────────────────────────────────────────────

String? _expiryLabel(DateTime? expiresAt) {
  if (expiresAt == null) return null;
  final diff = expiresAt.difference(DateTime.now());
  if (diff.isNegative) return null;
  if (diff.inHours < 24) return 'Expires today';
  final days = diff.inDays;
  if (days <= 3) return 'Expires in $days day${days == 1 ? '' : 's'}';
  return null;
}

class _ExpiryBadge extends StatelessWidget {
  const _ExpiryBadge({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.amber.withValues(alpha: 0.15),
        borderRadius: AppRadius.borderFull,
        border: Border.all(color: Colors.amber.shade600, width: 0.75),
      ),
      child: Text(
        label,
        style: AppTypography.caption.copyWith(
          color: Colors.amber.shade700,
          fontSize: 10,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
