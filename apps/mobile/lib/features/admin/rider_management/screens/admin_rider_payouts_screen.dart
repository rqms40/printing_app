import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/widgets/empty_state.dart';
import 'package:printing_app/utils/file_helpers.dart';
import 'package:printing_app/utils/formatters.dart';
import 'package:url_launcher/url_launcher.dart';

class _RiderOption {
  const _RiderOption({required this.id, required this.label});
  final int id;
  final String label;
}

class _PayoutItem {
  const _PayoutItem({
    required this.assignmentId,
    required this.orderRef,
    required this.amountMinor,
    required this.status,
    this.deliveredAt,
    this.adminReceiptUrl,
  });

  final int assignmentId;
  final String orderRef;
  final String amountMinor;
  final String status;
  final DateTime? deliveredAt;
  final String? adminReceiptUrl;

  double get amountPesos => (num.tryParse(amountMinor) ?? 0) / 100.0;
}

/// Ops/super rider payouts — QR + receipt per completed delivery.
class AdminRiderPayoutsScreen extends ConsumerStatefulWidget {
  const AdminRiderPayoutsScreen({super.key, this.initialRiderId});

  final String? initialRiderId;

  @override
  ConsumerState<AdminRiderPayoutsScreen> createState() =>
      _AdminRiderPayoutsScreenState();
}

class _AdminRiderPayoutsScreenState
    extends ConsumerState<AdminRiderPayoutsScreen> {
  List<_RiderOption> _riders = const [];
  int? _riderId;
  String? _payoutQrUrl;
  List<_PayoutItem> _items = const [];
  var _loadingRiders = true;
  var _loadingPayouts = false;
  String? _error;
  int? _uploadingAssignmentId;

  @override
  void initState() {
    super.initState();
    // ignore: discarded_futures
    _loadRiders();
  }

  Future<void> _loadRiders() async {
    setState(() {
      _loadingRiders = true;
      _error = null;
    });
    try {
      final res = await ApiClient.instance.get('/admin/riders');
      final list = (res.data as List? ?? [])
          .whereType<Map>()
          .map((raw) {
            final json = Map<String, dynamic>.from(raw);
            final idRaw = json['id'];
            final id = idRaw is int
                ? idRaw
                : int.tryParse(idRaw?.toString() ?? '') ?? 0;
            final name = (json['full_name'] ??
                    json['fullName'] ??
                    json['email'] ??
                    'Rider #$id')
                .toString();
            return _RiderOption(id: id, label: name);
          })
          .where((rider) => rider.id > 0)
          .toList();
      final requested = int.tryParse(widget.initialRiderId ?? '');
      final selected = list.any((rider) => rider.id == requested)
          ? requested
          : list.isEmpty
              ? null
              : list.first.id;
      setState(() {
        _riders = list;
        _riderId = selected;
        _loadingRiders = false;
      });
      if (selected != null) {
        await _loadPayouts(selected);
      }
    } catch (e) {
      setState(() {
        _loadingRiders = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _loadPayouts(int riderId) async {
    setState(() {
      _loadingPayouts = true;
      _error = null;
    });
    try {
      final res = await ApiClient.instance.get('/admin/riders/$riderId/payouts');
      final data = res.data is Map
          ? Map<String, dynamic>.from(res.data as Map)
          : <String, dynamic>{};
      final itemsRaw = data['items'];
      final items = <_PayoutItem>[];
      if (itemsRaw is List) {
        for (final row in itemsRaw.whereType<Map>()) {
          final json = Map<String, dynamic>.from(row);
          final assignmentRaw = json['assignmentId'] ?? json['assignment_id'];
          final assignmentId = assignmentRaw is int
              ? assignmentRaw
              : int.tryParse(assignmentRaw?.toString() ?? '') ?? 0;
          if (assignmentId <= 0) continue;
          items.add(
            _PayoutItem(
              assignmentId: assignmentId,
              orderRef: (json['orderRef'] ?? json['order_ref'] ?? assignmentId)
                  .toString(),
              amountMinor:
                  '${json['amountMinor'] ?? json['amount_minor'] ?? '0'}',
              status: '${json['status'] ?? 'unpaid'}',
              deliveredAt: json['deliveredAt'] != null
                  ? DateTime.tryParse(json['deliveredAt'].toString())
                  : json['delivered_at'] != null
                      ? DateTime.tryParse(json['delivered_at'].toString())
                      : null,
              adminReceiptUrl: json['adminReceiptUrl']?.toString() ??
                  json['admin_receipt_url']?.toString(),
            ),
          );
        }
      }
      setState(() {
        _payoutQrUrl = data['payoutQrUrl']?.toString() ??
            data['payout_qr_url']?.toString();
        _items = items;
        _loadingPayouts = false;
      });
    } catch (e) {
      setState(() {
        _loadingPayouts = false;
        _error = e.toString();
        _items = const [];
        _payoutQrUrl = null;
      });
    }
  }

  Future<void> _uploadReceipt(int assignmentId) async {
    if (_riderId == null) return;
    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
      maxWidth: 1600,
    );
    if (picked == null) return;
    setState(() => _uploadingAssignmentId = assignmentId);
    try {
      final filename =
          picked.name.trim().isEmpty ? 'payout-receipt.jpg' : picked.name;
      final mime = DioMediaType.parse(
        mimeTypeForExtension(getFileExtension(filename)),
      );
      final FormData form;
      if (kIsWeb) {
        form = FormData.fromMap({
          'purpose': 'payout_receipt',
          'file': MultipartFile.fromBytes(
            await picked.readAsBytes(),
            filename: filename,
            contentType: mime,
          ),
        });
      } else {
        form = FormData.fromMap({
          'purpose': 'payout_receipt',
          'file': await MultipartFile.fromFile(
            picked.path,
            filename: filename,
            contentType: mime,
          ),
        });
      }
      final uploadRes = await ApiClient.instance.post(
        '/files/upload',
        data: form,
        options: Options(contentType: 'multipart/form-data'),
      );
      final idRaw =
          uploadRes.data is Map ? (uploadRes.data as Map)['id'] : null;
      final receiptFileId =
          idRaw is int ? idRaw : int.tryParse(idRaw?.toString() ?? '');
      if (receiptFileId == null || receiptFileId <= 0) {
        throw StateError('Upload did not return a file id');
      }
      await ApiClient.instance.post(
        '/admin/riders/$_riderId/payouts',
        data: {
          'assignmentId': assignmentId,
          'receiptFileId': receiptFileId,
        },
      );
      await _loadPayouts(_riderId!);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Receipt recorded — rider payout marked paid')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to record payout receipt')),
      );
    } finally {
      if (mounted) setState(() => _uploadingAssignmentId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.surface,
        title: Text(
          'Rider payouts',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
      ),
      body: SafeArea(
        child: _loadingRiders
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: () async {
                  if (_riderId != null) await _loadPayouts(_riderId!);
                },
                child: ListView(
                  padding: const EdgeInsets.all(AppSpacing.xl),
                  children: [
                    if (_error != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.md),
                        child: Text(
                          _error!,
                          style: AppTypography.body
                              .copyWith(color: colors.warning),
                        ),
                      ),
                    Text(
                      'Pay the rider for completed deliveries. Scan their QR, then upload the GRIDGO receipt.',
                      style: AppTypography.body
                          .copyWith(color: colors.onSurfaceDim),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    if (_riders.isEmpty)
                      const EmptyState(
                        heading: 'No riders',
                        body: 'Rider payouts appear after a rider is assigned.',
                      )
                    else
                      InputDecorator(
                        decoration: const InputDecoration(
                          labelText: 'Rider',
                          border: OutlineInputBorder(),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<int>(
                            value: _riderId,
                            isExpanded: true,
                            items: [
                              for (final rider in _riders)
                                DropdownMenuItem(
                                  value: rider.id,
                                  child: Text(rider.label),
                                ),
                            ],
                            onChanged: (value) {
                              if (value == null) return;
                              setState(() => _riderId = value);
                              // ignore: discarded_futures
                              _loadPayouts(value);
                            },
                          ),
                        ),
                      ),
                    const SizedBox(height: AppSpacing.lg),
                    if (_loadingPayouts)
                      const Center(child: CircularProgressIndicator())
                    else ...[
                      if (_payoutQrUrl != null && _payoutQrUrl!.isNotEmpty) ...[
                        ClipRRect(
                          borderRadius: AppRadius.borderMd,
                          child: Image.network(
                            _payoutQrUrl!,
                            height: 180,
                            fit: BoxFit.contain,
                          ),
                        ),
                        TextButton.icon(
                          onPressed: () async {
                            final uri = Uri.tryParse(_payoutQrUrl!);
                            if (uri == null) return;
                            await launchUrl(
                              uri,
                              mode: LaunchMode.externalApplication,
                            );
                          },
                          icon: const Icon(Icons.download_outlined, size: 18),
                          label: const Text('Download QR'),
                        ),
                      ] else if (_riderId != null)
                        Text(
                          'This rider has not uploaded a payout QR yet.',
                          style: AppTypography.body
                              .copyWith(color: colors.warning),
                        ),
                      const SizedBox(height: AppSpacing.md),
                      if (_items.isEmpty)
                        Text(
                          'No completed deliveries for this rider.',
                          style: AppTypography.body
                              .copyWith(color: colors.onSurfaceDim),
                        )
                      else
                        for (final item in _items) ...[
                          _AdminPayoutTile(
                            item: item,
                            colors: colors,
                            qrReady: _payoutQrUrl != null &&
                                _payoutQrUrl!.isNotEmpty,
                            uploading:
                                _uploadingAssignmentId == item.assignmentId,
                            onUpload: () => _uploadReceipt(item.assignmentId),
                          ),
                          const SizedBox(height: AppSpacing.md),
                        ],
                    ],
                  ],
                ),
              ),
      ),
    );
  }
}

class _AdminPayoutTile extends StatelessWidget {
  const _AdminPayoutTile({
    required this.item,
    required this.colors,
    required this.qrReady,
    required this.uploading,
    required this.onUpload,
  });

  final _PayoutItem item;
  final AppColorSet colors;
  final bool qrReady;
  final bool uploading;
  final VoidCallback onUpload;

  @override
  Widget build(BuildContext context) {
    final paid = item.status == 'paid';
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.borderMd,
        border: Border.all(color: colors.outline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            item.orderRef,
            style: AppTypography.bodyBold.copyWith(color: colors.onBackground),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            '${formatCurrency(item.amountPesos)} · ${paid ? 'Paid' : 'Unpaid'}',
            style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
          ),
          if (item.adminReceiptUrl != null &&
              item.adminReceiptUrl!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            ClipRRect(
              borderRadius: AppRadius.borderMd,
              child: Image.network(
                item.adminReceiptUrl!,
                height: 96,
                width: double.infinity,
                fit: BoxFit.cover,
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          OutlinedButton.icon(
            onPressed: !qrReady || uploading ? null : onUpload,
            icon: uploading
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.upload_file, size: 18),
            label: Text(paid ? 'Replace receipt' : 'Upload receipt'),
          ),
        ],
      ),
    );
  }
}
