import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/chat/models/chat_message.dart';
import 'package:printing_app/features/customer/chat/models/conversation.dart';
import 'package:printing_app/features/customer/chat/screens/conversation_screen.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';

/// Opens (or resumes) a direct support thread with GRIDGO ops / superadmin.
class SupplierSupportScreen extends ConsumerStatefulWidget {
  const SupplierSupportScreen({super.key});

  @override
  ConsumerState<SupplierSupportScreen> createState() =>
      _SupplierSupportScreenState();
}

class _SupplierSupportScreenState extends ConsumerState<SupplierSupportScreen> {
  Object? _error;
  Conversation? _conversation;
  bool _loading = true;

  AppColorSet _colors(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
      ? AppColors.dark
      : AppColors.light;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _openSupport());
  }

  Future<void> _openSupport() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(dioProvider);
      final res = await dio.post<Map<String, dynamic>>('/chat/support');
      final data = res.data;
      if (data == null) {
        throw StateError('Empty support conversation response');
      }
      final conv = Conversation.fromJson(data);
      if (!mounted) return;
      setState(() {
        _conversation = conv;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final conv = _conversation;

    if (!_loading && conv != null) {
      return ConversationScreen(
        conversationId: conv.id,
        conversationType: ConversationType.admin,
        currentUserRole: SenderRole.customer,
        titleOverride: 'GRIDGO Support',
        subtitleOverride: 'Ops & Superadmin',
        backFallback: '/supplier/profile',
      );
    }

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: colors.onBackground),
          onPressed: () {
            if (Navigator.of(context).canPop()) {
              Navigator.of(context).pop();
            } else {
              context.go('/supplier/profile');
            }
          },
        ),
        title: Text(
          'Support',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: _loading
              ? Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(color: colors.accent),
                    const SizedBox(height: AppSpacing.lg),
                    Text(
                      'Connecting to GRIDGO support…',
                      style: AppTypography.body.copyWith(
                        color: colors.onSurfaceDim,
                      ),
                    ),
                  ],
                )
              : Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    HugeIcon(
                      icon: HugeIcons.strokeRoundedCustomerService01,
                      size: 40,
                      color: colors.onSurfaceDim,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      'Could not open support chat',
                      style: AppTypography.bodyBold.copyWith(
                        color: colors.onBackground,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      _error is DioException
                          ? 'Check your connection and try again.'
                          : 'Something went wrong. Please try again.',
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurfaceDim,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    FilledButton(
                      onPressed: _openSupport,
                      child: const Text('Retry'),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}
