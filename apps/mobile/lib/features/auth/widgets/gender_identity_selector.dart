import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:flutter_svg/flutter_svg.dart';

class GenderIdentitySelector extends StatefulWidget {
  const GenderIdentitySelector({
    super.key,
    required this.value,
    required this.onChanged,
  });

  final String? value;
  final ValueChanged<String> onChanged;

  @override
  State<GenderIdentitySelector> createState() => _GenderIdentitySelectorState();
}

class _GenderIdentitySelectorState extends State<GenderIdentitySelector> {
  late PageController _pageController;
  int _currentPage = 0;

  static const _genders = [
    (id: 'Male', label: 'Male', svg: 'assets/animations/undraw_young-man-avatar.svg'),
    (id: 'Female', label: 'Female', svg: 'assets/animations/undraw_female-avatar.svg'),
  ];

  @override
  void initState() {
    super.initState();
    _currentPage = _genders.indexWhere((g) => g.id == widget.value);
    if (_currentPage == -1) _currentPage = 0;
    
    _pageController = PageController(
      initialPage: _currentPage,
      viewportFraction: 0.65,
    );
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
              widget.onChanged(_genders[index].id);
            },
            itemCount: _genders.length,
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
                  
                  final angle = clampedValue * 0.2; 
                  final scale = 1.0 - (clampedValue.abs() * 0.20); 
                  
                  final transform = Matrix4.identity()
                    ..setEntry(3, 2, 0.001)
                    ..rotateY(angle)
                    ..scale(scale, scale, 1.0);

                  final gender = _genders[index];
                  final isSelected = widget.value == gender.id;

                  return Center(
                    child: Transform(
                      transform: transform,
                      alignment: Alignment.center,
                      child: _GenderCard(
                        label: gender.label,
                        svgAsset: gender.svg,
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
        const SizedBox(height: AppSpacing.lg),
        GestureDetector(
          onTap: () => widget.onChanged('Prefer not to say'),
          child: AnimatedDefaultTextStyle(
            duration: const Duration(milliseconds: 180),
            style: AppTypography.bodyBold.copyWith(
              color: widget.value == 'Prefer not to say'
                  ? colors.onBackground
                  : colors.onSurfaceDim,
              decoration: widget.value == 'Prefer not to say'
                  ? TextDecoration.underline
                  : TextDecoration.none,
              decorationColor: widget.value == 'Prefer not to say' ? colors.brand : null,
            ),
            child: const Text('Prefer not to say'),
          ),
        ),
      ],
    );
  }
}

class _GenderCard extends StatelessWidget {
  const _GenderCard({
    required this.label,
    required this.svgAsset,
    required this.isSelected,
    required this.colors,
    required this.onTap,
  });

  final String label;
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
              SvgPicture.asset(
                svgAsset,
                height: 200,
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                label,
                style: AppTypography.bodyBold.copyWith(color: colors.onBackground),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
