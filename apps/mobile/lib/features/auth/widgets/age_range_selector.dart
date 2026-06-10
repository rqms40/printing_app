import 'package:flutter/material.dart';
import 'package:vector_math/vector_math_64.dart' show Vector3;
import 'package:flutter_svg/flutter_svg.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/models/profiling.dart';

const Map<String, String> _ageSvgs = {
  'under_18': 'assets/animations/undraw_cool-guy-avatar.svg',
  '18_24': 'assets/animations/undraw_chill-guy-avatar.svg',
  '25_34': 'assets/animations/undraw_focused.svg',
  '35_44': 'assets/animations/undraw_in-the-office.svg',
  '45_plus': 'assets/animations/undraw_professor-avatar.svg',
};

class AgeRangeSelector extends StatefulWidget {
  const AgeRangeSelector({
    super.key,
    required this.value,
    required this.onChanged,
  });

  final String? value;
  final ValueChanged<String> onChanged;

  @override
  State<AgeRangeSelector> createState() => _AgeRangeSelectorState();
}

class _AgeRangeSelectorState extends State<AgeRangeSelector> {
  late PageController _pageController;
  int _currentPage = 0;

  @override
  void initState() {
    super.initState();
    _currentPage = ageRangeOptions.indexWhere((o) => o.value == widget.value);
    if (_currentPage == -1) _currentPage = 0;
    
    _pageController = PageController(
      initialPage: _currentPage,
      viewportFraction: 0.65, // Shows peeking cards on the sides
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.onChanged(ageRangeOptions[_currentPage].value);
    });
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return Column(
      children: [
        SizedBox(
          height: 380,
          child: PageView.builder(
            controller: _pageController,
            clipBehavior: Clip.none,
            onPageChanged: (index) {
              setState(() => _currentPage = index);
              widget.onChanged(ageRangeOptions[index].value);
            },
            itemCount: ageRangeOptions.length,
            itemBuilder: (context, index) {
              return AnimatedBuilder(
                animation: _pageController,
                builder: (context, child) {
                  double value = 0.0;
                  if (_pageController.hasClients && _pageController.position.haveDimensions) {
                    value = _pageController.page! - index;
                  } else {
                    value = _currentPage.toDouble() - index;
                  }
                  
                  final clampedValue = value.clamp(-1.0, 1.0);
                  
                  // CoverFlow Perspective Effect
                  // Tilted backward on the sides
                  final angle = clampedValue * 0.2; // Steeper than 0.5, but safe for viewport
                  final scale = 1.0 - (clampedValue.abs() * 0.20); // Scale down slightly more to fit
                  
                  final transform = Matrix4.identity()
                    ..setEntry(3, 2, 0.001) // Standard perspective
                    ..rotateY(angle)
                    ..scaleByVector3(Vector3(scale, scale, 1.0));

                  final option = ageRangeOptions[index];
                  final isSelected = _currentPage == index;

                  return Center(
                    child: Transform(
                      transform: transform,
                      alignment: Alignment.center,
                      child: _AgeRangeCard(
                        value: option.value,
                        label: option.label,
                        description: option.description,
                        svgAsset: _ageSvgs[option.value] ?? '',
                        isSelected: isSelected,
                        colors: colors,
                        onTap: () {
                          _pageController.animateToPage(
                            index,
                            duration: const Duration(milliseconds: 300),
                            curve: Curves.easeInOut,
                          );
                        },
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        // Dots indicator
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (int i = 0; i < ageRangeOptions.length; i++) ...[
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: i == _currentPage ? 24 : 8,
                height: 8,
                decoration: BoxDecoration(
                  color: i == _currentPage ? colors.brand : colors.surfaceVariant,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              if (i < ageRangeOptions.length - 1)
                const SizedBox(width: AppSpacing.sm),
            ],
          ],
        ),
      ],
    );
  }
}

class _AgeRangeCard extends StatelessWidget {
  const _AgeRangeCard({
    required this.value,
    required this.label,
    required this.description,
    required this.svgAsset,
    required this.isSelected,
    required this.colors,
    required this.onTap,
  });

  final String value;
  final String label;
  final String description;
  final String svgAsset;
  final bool isSelected;
  final AppColorSet colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: 260,
        padding: const EdgeInsets.all(AppSpacing.xl),
        decoration: BoxDecoration(
          color: colors.surfaceVariant,
          borderRadius: AppRadius.borderXl,
          border: Border.all(
            color: isSelected ? colors.brand : colors.outline,
            width: isSelected ? 2 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: isSelected
                  ? colors.brand.withValues(alpha: 0.30)
                  : Colors.black.withValues(alpha: 0.04),
              blurRadius: isSelected ? 24 : 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (svgAsset.isNotEmpty)
                SvgPicture.asset(
                  svgAsset,
                  height: 180,
                ),
              const SizedBox(height: AppSpacing.md),
              Text(
                label,
                style: AppTypography.bodyBold.copyWith(color: colors.onBackground),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                description,
                style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
