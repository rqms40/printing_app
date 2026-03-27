import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/customer/order/providers/order_provider.dart';
import 'package:printing_app/features/customer/order/widgets/spec_selector.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/three_d_specs.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_text_field.dart';
import 'package:printing_app/shared/widgets/step_indicator.dart';

/// Step 2/6 -- 3D print specification selection.
class ThreeDSpecsScreen extends ConsumerStatefulWidget {
  const ThreeDSpecsScreen({super.key});

  static const routeName = '/order/3d-specs';

  @override
  ConsumerState<ThreeDSpecsScreen> createState() => _ThreeDSpecsScreenState();
}

class _ThreeDSpecsScreenState extends ConsumerState<ThreeDSpecsScreen> {
  FileFormat3D _fileFormat = FileFormat3D.stl;
  Material3D _material = Material3D.pla;
  String _color = 'White';
  int _infill = 20;
  double _layerHeight = 0.2;
  bool _supports = false;

  final _quantityController = TextEditingController(text: '1');
  final _colorController = TextEditingController(text: 'White');
  final _notesController = TextEditingController();

  static const _infillOptions = [10, 20, 50, 100];
  static const _layerOptions = [0.1, 0.2, 0.3];

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  void dispose() {
    _quantityController.dispose();
    _colorController.dispose();
    _notesController.dispose();
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
          '3D Specs',
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
                    '3D Print Specifications',
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
                  SpecSelector<FileFormat3D>(
                    label: 'FILE FORMAT',
                    options: FileFormat3D.values,
                    selected: _fileFormat,
                    onChanged: (v) => setState(() => _fileFormat = v),
                    displayName: (v) => v.displayName,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  SpecSelector<Material3D>(
                    label: 'MATERIAL',
                    options: Material3D.values,
                    selected: _material,
                    onChanged: (v) => setState(() => _material = v),
                    displayName: (v) => v.displayName,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  AppTextField(
                    label: 'Color',
                    controller: _colorController,
                    hintText: 'e.g. Red, White, Black',
                    onChanged: (v) => _color = v,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  SpecSelector<int>(
                    label: 'INFILL PERCENTAGE',
                    options: _infillOptions,
                    selected: _infill,
                    onChanged: (v) => setState(() => _infill = v),
                    displayName: (v) => '$v%',
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  SpecSelector<double>(
                    label: 'LAYER HEIGHT',
                    options: _layerOptions,
                    selected: _layerHeight,
                    onChanged: (v) => setState(() => _layerHeight = v),
                    displayName: (v) => '${v}mm',
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  SpecSelector<bool>(
                    label: 'SUPPORTS',
                    options: const [true, false],
                    selected: _supports,
                    onChanged: (v) => setState(() => _supports = v),
                    displayName: (v) => v ? 'Yes' : 'No',
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
                    label: 'Notes',
                    controller: _notesController,
                    maxLines: 3,
                    hintText: 'Any special instructions...',
                  ),
                  const SizedBox(height: AppSpacing.xxl),
                ],
              ),
            ).animate()
              .fadeIn(duration: 400.ms, delay: 60.ms, curve: Curves.easeOut)
              .slideY(begin: 0.02, duration: 400.ms, delay: 60.ms, curve: Curves.easeOut),
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
    final notes = _notesController.text.trim();

    final specs = ThreeDSpecs(
      fileFormat: _fileFormat,
      material: _material,
      color: _color,
      infillPercentage: _infill,
      layerHeight: _layerHeight,
      supports: _supports,
      notes: notes.isNotEmpty ? notes : null,
    );

    final notifier = ref.read(orderFlowProvider.notifier);
    notifier.setThreeDSpecs(specs);
    notifier.setQuantity(quantity);
    notifier.nextStep();

    context.push('/customer/order/upload');
  }
}
