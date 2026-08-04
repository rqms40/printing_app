import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/shared/providers/theme_provider.dart';
import 'package:printing_app/shared/services/api_client.dart';

/// Pilot Credits balance + ledger history (grant-only; no top-up).
class CreditsScreen extends ConsumerStatefulWidget {
  const CreditsScreen({super.key});

  @override
  ConsumerState<CreditsScreen> createState() => _CreditsScreenState();
}

class _CreditsScreenState extends ConsumerState<CreditsScreen> {
  bool _loading = true;
  String? _error;
  double _balance = 0;
  List<_LedgerRow> _rows = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ApiClient.instance.get('/credits/me');
      final data = res.data is Map ? res.data as Map : <String, dynamic>{};
      final balance = double.tryParse('${data['balance']}') ?? 0;
      final raw = data['transactions'];
      final rows = <_LedgerRow>[];
      if (raw is List) {
        for (final item in raw) {
          if (item is! Map) continue;
          rows.add(
            _LedgerRow(
              type: '${item['type'] ?? ''}',
              amount: double.tryParse('${item['amountCredits']}') ?? 0,
              reason: item['reason']?.toString(),
              createdAt: item['createdAt']?.toString(),
              status: item['status']?.toString(),
            ),
          );
        }
      }
      if (!mounted) return;
      setState(() {
        _balance = balance;
        _rows = rows;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      // Fall back to auth-held balance if history endpoint fails.
      final authBalance = double.tryParse(
            ref.read(authProvider).user?.credits ?? '0',
          ) ??
          0;
      setState(() {
        _balance = authBalance;
        _error = 'Could not load full history.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(themeProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;
    final authCredits = ref.watch(
      authProvider.select((s) => s.user?.credits),
    );
    final displayBalance = _loading
        ? (double.tryParse(authCredits ?? '0') ?? 0)
        : _balance;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        title: Text(
          'Pilot Credits',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        iconTheme: IconThemeData(color: colors.onBackground),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        color: colors.accent,
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.xl),
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                color: colors.surfaceVariant,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'TEST CREDITS',
                    style: AppTypography.overline.copyWith(
                      color: colors.onSurfaceDim,
                      letterSpacing: 1.4,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    displayBalance.toStringAsFixed(
                      displayBalance == displayBalance.roundToDouble() ? 0 : 2,
                    ),
                    style: AppTypography.display.copyWith(
                      color: colors.brand,
                      fontSize: 36,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Pilot Credits are free test credits for the GRID pilot. '
                    'They cannot be purchased, transferred, or withdrawn.',
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            Text(
              'History',
              style: AppTypography.bodyBold.copyWith(
                color: colors.onBackground,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            if (_loading)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
                child: Center(
                  child: CircularProgressIndicator(color: colors.accent),
                ),
              )
            else if (_error != null && _rows.isEmpty)
              Text(
                _error!,
                style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
              )
            else if (_rows.isEmpty)
              Text(
                'No Pilot Credit activity yet.',
                style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
              )
            else
              ..._rows.map((row) => _HistoryTile(row: row, colors: colors)),
          ],
        ),
      ),
    );
  }
}

class _LedgerRow {
  const _LedgerRow({
    required this.type,
    required this.amount,
    this.reason,
    this.createdAt,
    this.status,
  });

  final String type;
  final double amount;
  final String? reason;
  final String? createdAt;
  final String? status;
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({required this.row, required this.colors});

  final _LedgerRow row;
  final AppColorSet colors;

  String get _label {
    switch (row.type) {
      case 'grant':
        return 'Grant';
      case 'reserve':
        return 'Reserved';
      case 'spend':
      case 'deduction':
        return 'Spent';
      case 'release':
        return 'Released';
      case 'expire':
        return 'Expired';
      case 'manual_adjustment':
        return 'Adjustment';
      case 'top_up':
        return 'Credit';
      default:
        return row.type.isEmpty ? 'Entry' : row.type;
    }
  }

  bool get _isCredit {
    return row.type == 'grant' ||
        row.type == 'release' ||
        row.type == 'top_up' ||
        (row.type == 'manual_adjustment' && row.amount > 0);
  }

  @override
  Widget build(BuildContext context) {
    final sign = _isCredit ? '+' : '−';
    final amountColor = _isCredit ? colors.success : colors.onBackground;

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.outline.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _label,
                  style: AppTypography.bodyBold.copyWith(
                    color: colors.onBackground,
                  ),
                ),
                if (row.reason != null && row.reason!.isNotEmpty)
                  Text(
                    row.reason!,
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                    ),
                  ),
                if (row.createdAt != null)
                  Text(
                    row.createdAt!,
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                      fontSize: 10,
                    ),
                  ),
              ],
            ),
          ),
          Text(
            '$sign${row.amount.toStringAsFixed(row.amount == row.amount.roundToDouble() ? 0 : 2)}',
            style: AppTypography.bodyBold.copyWith(color: amountColor),
          ),
        ],
      ),
    );
  }
}
