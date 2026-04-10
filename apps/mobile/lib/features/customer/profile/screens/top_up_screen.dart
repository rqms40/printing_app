import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/providers/theme_provider.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/widgets/app_button.dart';

class TopUpScreen extends ConsumerStatefulWidget {
  const TopUpScreen({super.key});

  @override
  ConsumerState<TopUpScreen> createState() => _TopUpScreenState();
}

class _TopUpScreenState extends ConsumerState<TopUpScreen> {
  final TextEditingController _amountController = TextEditingController();
  double _conversionRate = 1.0;
  bool _isLoadingRate = true;
  bool _isSubmitting = false;

  XFile? _proofImage;

  @override
  void initState() {
    super.initState();
    _fetchSettings();
  }

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _fetchSettings() async {
    try {
      final res = await ApiClient.instance.get('/credits/settings');
      if (mounted) {
        setState(() {
          _conversionRate = double.tryParse(res.data['conversionRate'].toString()) ?? 1.0;
          _isLoadingRate = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingRate = false);
      }
    }
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery);

    if (pickedFile != null) {
      setState(() {
        _proofImage = pickedFile;
      });
    }
  }

  Future<void> _submitRequest() async {
    final amountText = _amountController.text.trim();
    if (amountText.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter an amount.')),
      );
      return;
    }

    final amountPhp = double.tryParse(amountText);
    if (amountPhp == null || amountPhp <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Invalid amount.')),
      );
      return;
    }

    if (_proofImage == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please upload a proof of payment screenshot.')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      var formData;
      if (kIsWeb) {
        final bytes = await _proofImage!.readAsBytes();
        formData = FormData.fromMap({
          'file': MultipartFile.fromBytes(bytes, filename: _proofImage!.name),
        });
      } else {
        formData = FormData.fromMap({
          'file': await MultipartFile.fromFile(_proofImage!.path,
              filename: _proofImage!.name),
        });
      }

      final uploadRes = await ApiClient.instance.post(
        '/files/upload',
        data: formData,
        options: Options(contentType: 'multipart/form-data'),
      );
      
      final proofUrl = uploadRes.data['url'] as String;

      // 2. Submit top-up request
      await ApiClient.instance.post('/credits/request-topup', data: {
        'amountPhp': amountPhp,
        'proofOfPaymentUrl': proofUrl,
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Top-up request submitted successfully!')),
        );
        context.pop();
      }
    } on DioException catch (e) {
      final message = e.response?.data is Map 
        ? (e.response?.data as Map)['message']?.toString() ?? 'Failed to submit request'
        : 'Failed to submit request';
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(message)),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(themeProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;

    final enteredAmount = double.tryParse(_amountController.text) ?? 0.0;
    final expectedCredits = enteredAmount * _conversionRate;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        title: Text('Top-Up Credits', style: AppTypography.h3.copyWith(color: colors.onBackground)),
        iconTheme: IconThemeData(color: colors.onBackground),
      ),
      body: _isLoadingRate
          ? Center(child: CircularProgressIndicator(color: colors.accent))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Enter Top-Up Amount (PHP)',
                    style: AppTypography.bodyBold.copyWith(color: colors.onBackground),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextField(
                    controller: _amountController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    style: AppTypography.h2.copyWith(color: colors.onBackground),
                    decoration: InputDecoration(
                      prefixText: '₱ ',
                      prefixStyle: AppTypography.h2.copyWith(color: colors.onSurfaceDim),
                      filled: true,
                      fillColor: colors.surfaceVariant,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                    ),
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: BoxDecoration(
                      color: colors.accent.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Expected Credits:', style: AppTypography.body.copyWith(color: colors.onSurface)),
                        Text(
                          expectedCredits.toStringAsFixed(2),
                          style: AppTypography.h3.copyWith(color: colors.accent),
                        ),
                      ],
                    ),
                  ),
                  if (_conversionRate != 1.0) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'Promo Rate Applied: 1 PHP = $_conversionRate Credits',
                      style: AppTypography.caption.copyWith(color: colors.success),
                    ),
                  ],
                  const SizedBox(height: AppSpacing.xl),
                  Text(
                    'Proof of Payment',
                    style: AppTypography.bodyBold.copyWith(color: colors.onBackground),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  GestureDetector(
                    onTap: _pickImage,
                    child: Container(
                      height: 160,
                      decoration: BoxDecoration(
                        color: colors.surfaceVariant,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: colors.outlineVariant),
                      ),
                      child: _proofImage != null
                          ? ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                          child: kIsWeb 
                              ? Image.network(_proofImage!.path, fit: BoxFit.cover)
                              : Image.file(File(_proofImage!.path), fit: BoxFit.cover),
                            )
                          : Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.cloud_upload_outlined, size: 40, color: colors.onSurfaceDim),
                                const SizedBox(height: AppSpacing.sm),
                                Text(
                                  'Tap to upload screenshot',
                                  style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
                                ),
                              ],
                            ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xxl),
                  AppButton(
                    onTap: _isSubmitting ? null : _submitRequest,
                    label: _isSubmitting ? 'Submitting...' : 'Submit Request',
                    isLoading: _isSubmitting,
                    isFullWidth: true,
                  ),
                ],
              ),
            ),
    );
  }
}
