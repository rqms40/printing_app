import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/providers/order_provider.dart';
import 'package:printing_app/features/customer/order/screens/upload_screen.dart';
import 'package:printing_app/features/customer/order/widgets/spec_selector.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/paper_specs.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_text_field.dart';
import 'package:printing_app/shared/widgets/step_indicator.dart';

/// Step 2/6 -- Paper specification selection.
class PaperSpecsScreen extends ConsumerStatefulWidget {
  const PaperSpecsScreen({super.key});

  static const routeName = '/order/paper-specs';

  @override
  ConsumerState<PaperSpecsScreen> createState() => _PaperSpecsScreenState();
}

class _PaperSpecsScreenState extends ConsumerState<PaperSpecsScreen> {
  PaperSize _paperSize = PaperSize.a4;
  ColorMode _colorMode = ColorMode.blackAndWhite;
  MediaType _mediaType = MediaType.matte;
  PrintSides _printSides = PrintSides.frontOnly;
  Binding _binding = Binding.none;

  final _quantityController = TextEditingController(text: '1');
  final _pageCountController = TextEditingController(text: '1');

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  void dispose() {
    _quantityController.dispose();
    _pageCountController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        title: Text(
          'Paper Specs',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        iconTheme: IconThemeData(color: colors.onBackground),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: AppSpacing.md),
                  const StepIndicator(totalSteps: 6, currentStep: 1),
                  const SizedBox(height: AppSpacing.xl),
                  Text(
                    'Paper Specifications',
                    style:
                        AppTypography.h1.copyWith(color: colors.onBackground),
                  ).animate()
                    .fadeIn(duration: 400.ms, curve: Curves.easeOut)
                    .slideY(begin: 0.03, duration: 400.ms, curve: Curves.easeOut),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Expanded(
              child: ListView(
                padding:
                    const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                children: [
                  const SizedBox(height: AppSpacing.sm),
                  SpecSelector<PaperSize>(
                    label: 'PAPER SIZE',
                    options: PaperSize.values,
                    selected: _paperSize,
                    onChanged: (v) => setState(() => _paperSize = v),
                    displayName: (v) => v.displayName,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  SpecSelector<ColorMode>(
                    label: 'COLOR MODE',
                    options: ColorMode.values,
                    selected: _colorMode,
                    onChanged: (v) => setState(() => _colorMode = v),
                    displayName: (v) => v.displayName,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  SpecSelector<MediaType>(
                    label: 'MEDIA TYPE',
                    options: MediaType.values,
                    selected: _mediaType,
                    onChanged: (v) => setState(() => _mediaType = v),
                    displayName: (v) => v.displayName,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  SpecSelector<PrintSides>(
                    label: 'PRINT SIDES',
                    options: PrintSides.values,
                    selected: _printSides,
                    onChanged: (v) => setState(() => _printSides = v),
                    displayName: (v) => v.displayName,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  SpecSelector<Binding>(
                    label: 'BINDING',
                    options: Binding.values,
                    selected: _binding,
                    onChanged: (v) => setState(() => _binding = v),
                    displayName: (v) => v.displayName,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  AppTextField(
                    label: 'Quantity',
                    controller: _quantityController,
                    keyboardType: TextInputType.number,
                    hintText: 'Enter quantity',
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  AppTextField(
                    label: 'Page Count',
                    controller: _pageCountController,
                    keyboardType: TextInputType.number,
                    hintText: 'Number of pages',
                  ),
                  const SizedBox(height: AppSpacing.xxl),
                ],
              ),
            ).animate()
              .fadeIn(duration: 400.ms, delay: 60.ms, curve: Curves.easeOut)
              .slideY(begin: 0.02, duration: 400.ms, delay: 60.ms, curve: Curves.easeOut),
            // Sticky bottom button
            Container(
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                color: colors.surface,
                border: Border(
                  top: BorderSide(color: colors.outline, width: 0.5),
                ),
              ),
              child: AppButton(
                label: 'Continue',
                isFullWidth: true,
                onTap: _onContinue,
              ),
            ).animate()
              .fadeIn(duration: 400.ms, delay: 120.ms, curve: Curves.easeOut)
              .slideY(begin: 0.03, duration: 400.ms, delay: 120.ms, curve: Curves.easeOut),
          ],
        ),
      ),
    );
  }

  void _onContinue() {
    final quantity = int.tryParse(_quantityController.text) ?? 1;
    final pageCount = int.tryParse(_pageCountController.text) ?? 1;

    final specs = PaperSpecs(
      paperSize: _paperSize,
      colorMode: _colorMode,
      mediaType: _mediaType,
      printSides: _printSides,
      binding: _binding,
    );

    final notifier = ref.read(orderFlowProvider.notifier);
    notifier.setPaperSpecs(specs);
    notifier.setQuantity(quantity);
    notifier.setPageCount(pageCount);
    notifier.nextStep();

    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const UploadScreen()),
    );
  }
}
