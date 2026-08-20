import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/supplier/models/supplier_job.dart';
import 'package:printing_app/features/supplier/providers/supplier_jobs_provider.dart';
import 'package:printing_app/features/supplier/widgets/supplier_payment_gate_banner.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/pickup_qa_checklist.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:printing_app/shared/widgets/app_text_field.dart';
import 'package:printing_app/shared/widgets/pickup_qa_checklist.dart';
import 'package:printing_app/shared/widgets/signature_pad.dart';
import 'package:printing_app/shared/widgets/status_badge.dart';
import 'package:printing_app/utils/formatters.dart';
import 'package:url_launcher/url_launcher.dart';

/// Full supplier job workspace: accept/decline, payment gate, production,
/// self-QC upload, and ready-for-pickup.
class SupplierJobDetailScreen extends ConsumerStatefulWidget {
  const SupplierJobDetailScreen({super.key, required this.jobId});

  final int jobId;

  @override
  ConsumerState<SupplierJobDetailScreen> createState() =>
      _SupplierJobDetailScreenState();
}

class _SupplierJobDetailScreenState
    extends ConsumerState<SupplierJobDetailScreen> {
  final _priceController = TextEditingController();
  final _declineReasonController = TextEditingController();
  final _prodNotesController = TextEditingController();
  final _selfQcNotesController = TextEditingController();

  DateTime? _promisedDate;
  ProductionMilestone _milestone = ProductionMilestone.materialsSetup;
  PlatformFile? _selfQcFile;
  Map<String, bool> _pickupQa = emptyPickupQaChecklist();
  String? _pickupQaSignature;
  final _signaturePadKey = GlobalKey<SignaturePadState>();
  bool _seededPrice = false;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  void dispose() {
    _priceController.dispose();
    _declineReasonController.dispose();
    _prodNotesController.dispose();
    _selfQcNotesController.dispose();
    super.dispose();
  }

  void _seedPriceIfNeeded(SupplierJobDetail detail) {
    if (_seededPrice) return;
    _seededPrice = true;
    if (detail.quotedPriceMinor != null) {
      _priceController.text =
          (detail.quotedPriceMinor! / 100.0).toStringAsFixed(2);
    } else if (detail.finalPriceMinor != null) {
      _priceController.text =
          (detail.finalPriceMinor! / 100.0).toStringAsFixed(2);
    } else if (detail.totalPrice > 0) {
      _priceController.text = detail.totalPrice.toStringAsFixed(2);
    }
    if (detail.quotedPromisedDate != null) {
      _promisedDate = detail.quotedPromisedDate;
    } else if (detail.promisedDate != null) {
      _promisedDate = detail.promisedDate;
    }
  }

  void _showSnack(String message, {bool isError = false}) {
    if (!mounted) return;
    final colors = _colors(context);
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: isError ? colors.error : null,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: AppRadius.borderMd),
        ),
      );
  }

  Future<void> _pickPromisedDate() async {
    final now = DateTime.now();
    final initial = _promisedDate ?? now.add(const Duration(days: 2));
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: initial.isBefore(now) ? now : initial,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (pickedDate == null) return;

    if (!mounted) return;

    final initialTime = _promisedDate != null
        ? TimeOfDay.fromDateTime(_promisedDate!)
        : const TimeOfDay(hour: 17, minute: 0);

    final pickedTime = await showTimePicker(
      context: context,
      initialTime: initialTime,
    );
    if (pickedTime == null) return;

    setState(() {
      _promisedDate = DateTime(
        pickedDate.year,
        pickedDate.month,
        pickedDate.day,
        pickedTime.hour,
        pickedTime.minute,
      );
    });
  }

  Future<void> _onQuote() async {
    final pesos = double.tryParse(_priceController.text.trim());
    if (pesos == null || pesos <= 0) {
      _showSnack('Enter a valid final price in pesos', isError: true);
      return;
    }
    if (_promisedDate == null) {
      _showSnack('Pick a promised completion date', isError: true);
      return;
    }
    final detail = ref.read(supplierJobDetailProvider(widget.jobId)).detail;
    final deadline = detail?.acceptanceDeadline;
    if (deadline != null && deadline.isBefore(DateTime.now())) {
      _showSnack('Acceptance window has expired', isError: true);
      return;
    }

    final ok = await ref
        .read(supplierJobDetailProvider(widget.jobId).notifier)
        .quote(
          finalPriceMinor: pesosToMinor(pesos),
          promisedDate: _promisedDate!,
        );
    final state = ref.read(supplierJobDetailProvider(widget.jobId));
    if (ok) {
      _showSnack(
        state.actionMessage ??
            'Final price sent. Waiting for the customer to confirm.',
      );
      // ignore: discarded_futures
      ref.read(supplierJobsProvider.notifier).refresh(silent: true);
    } else {
      _showSnack(state.errorMessage ?? 'Could not send the price', isError: true);
    }
  }

  Future<void> _onAccept() async {
    final pesos = double.tryParse(_priceController.text.trim());
    if (pesos == null || pesos <= 0) {
      _showSnack('Enter a valid final price in pesos', isError: true);
      return;
    }
    if (_promisedDate == null) {
      _showSnack('Pick a promised completion date', isError: true);
      return;
    }
    final detail = ref.read(supplierJobDetailProvider(widget.jobId)).detail;
    final deadline = detail?.acceptanceDeadline;
    if (deadline != null && deadline.isBefore(DateTime.now())) {
      _showSnack('Acceptance window has expired', isError: true);
      return;
    }

    final ok = await ref
        .read(supplierJobDetailProvider(widget.jobId).notifier)
        .accept(
          finalPriceMinor: pesosToMinor(pesos),
          promisedDate: _promisedDate!,
        );
    final state = ref.read(supplierJobDetailProvider(widget.jobId));
    if (ok) {
      _showSnack(state.actionMessage ?? 'Job accepted');
      // ignore: discarded_futures
      ref.read(supplierJobsProvider.notifier).refresh(silent: true);
    } else {
      _showSnack(state.errorMessage ?? 'Accept failed', isError: true);
    }
  }

  Future<void> _onDecline() async {
    final reason = _declineReasonController.text.trim();
    if (reason.isEmpty) {
      _showSnack('Enter a decline reason', isError: true);
      return;
    }
    final ok = await ref
        .read(supplierJobDetailProvider(widget.jobId).notifier)
        .decline(reason: reason);
    final state = ref.read(supplierJobDetailProvider(widget.jobId));
    if (ok) {
      _showSnack(state.actionMessage ?? 'Job declined');
      // ignore: discarded_futures
      ref.read(supplierJobsProvider.notifier).refresh(silent: true);
      if (mounted) Navigator.of(context).pop();
    } else {
      _showSnack(state.errorMessage ?? 'Decline failed', isError: true);
    }
  }

  Future<void> _onProduction([ProductionMilestone? forceMilestone]) async {
    final detail = ref.read(supplierJobDetailProvider(widget.jobId)).detail;
    final available = detail?.availableMilestones ?? ProductionMilestone.values;
    var target = forceMilestone ?? _milestone;
    if (!available.contains(target)) {
      if (available.isEmpty) {
        _showSnack('All production milestones are already complete');
        return;
      }
      target = available.first;
    }
    final ok = await ref
        .read(supplierJobDetailProvider(widget.jobId).notifier)
        .updateProduction(
          milestone: target,
          notes: _prodNotesController.text,
        );
    final state = ref.read(supplierJobDetailProvider(widget.jobId));
    if (ok) {
      _showSnack(state.actionMessage ?? 'Production updated');
      // ignore: discarded_futures
      ref.read(supplierJobsProvider.notifier).refresh(silent: true);
    } else {
      _showSnack(state.errorMessage ?? 'Update failed', isError: true);
    }
  }

  Future<void> _pickSelfQcFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['jpg', 'jpeg', 'png', 'pdf', 'webp'],
      withData: true,
    );
    if (result == null || result.files.isEmpty) return;
    final picked = result.files.first;
    final bytes = picked.bytes;
    if (bytes == null || bytes.isEmpty) {
      _showSnack(
        'Could not read the selected file. Try another file.',
        isError: true,
      );
      return;
    }
    setState(() => _selfQcFile = picked);
  }

  Future<void> _onSelfQc() async {
    final file = _selfQcFile;
    final bytes = file?.bytes;
    if (file == null || bytes == null || bytes.isEmpty) {
      _showSnack('Self-QC evidence file is required', isError: true);
      return;
    }
    if (!allPickupQaChecksPassed(
      _pickupQa,
      signatureData: _pickupQaSignature,
    )) {
      _showSnack(
        'Complete every checklist line and draw your digital signature',
        isError: true,
      );
      return;
    }
    final ok = await ref
        .read(supplierJobDetailProvider(widget.jobId).notifier)
        .submitSelfQc(
          notes: _selfQcNotesController.text,
          fileBytes: bytes,
          fileName: file.name,
          checklist: pickupQaChecklistPayload(
            _pickupQa,
            signatureData: _pickupQaSignature!,
          ),
        );
    final state = ref.read(supplierJobDetailProvider(widget.jobId));
    if (ok) {
      setState(() {
        _selfQcFile = null;
        _pickupQa = emptyPickupQaChecklist();
        _pickupQaSignature = null;
      });
      _signaturePadKey.currentState?.clear();
      _selfQcNotesController.clear();
      _showSnack(state.actionMessage ?? 'Pickup QA submitted');
      // ignore: discarded_futures
      ref.read(supplierJobsProvider.notifier).refresh(silent: true);
    } else {
      _showSnack(state.errorMessage ?? 'Pickup QA failed', isError: true);
    }
  }

  Future<void> _openArtwork(String? signedUrl) async {
    if (signedUrl == null || signedUrl.trim().isEmpty) return;
    final uri = Uri.tryParse(signedUrl);
    if (uri == null) {
      _showSnack('Invalid artwork link', isError: true);
      return;
    }
    final launched = await launchUrl(
      uri,
      mode: LaunchMode.externalApplication,
    );
    if (!launched && mounted) {
      _showSnack('Could not open artwork', isError: true);
    }
  }

  Future<void> _onReadyForPickup() async {
    final ok = await ref
        .read(supplierJobDetailProvider(widget.jobId).notifier)
        .readyForPickup();
    final state = ref.read(supplierJobDetailProvider(widget.jobId));
    if (ok) {
      _showSnack(state.actionMessage ?? 'Marked ready for pickup');
      // ignore: discarded_futures
      ref.read(supplierJobsProvider.notifier).refresh(silent: true);
    } else {
      _showSnack(state.errorMessage ?? 'Ready-for-pickup failed', isError: true);
    }
  }

  bool _decisionWindowOpen(SupplierJobDetail detail) {
    final deadline = detail.acceptanceDeadline;
    if (deadline == null) return true;
    return deadline.isAfter(DateTime.now());
  }

  String? _deadlineLabel(SupplierJobDetail detail) {
    final deadline = detail.acceptanceDeadline;
    if (deadline == null || (!detail.canQuote && !detail.canAccept)) {
      return null;
    }
    final remaining = deadline.difference(DateTime.now());
    if (remaining.isNegative) return 'Acceptance window expired';
    final hours = remaining.inHours;
    final mins = remaining.inMinutes.remainder(60);
    if (hours > 0) return 'Respond within ${hours}h ${mins}m';
    return 'Respond within ${mins}m';
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final state = ref.watch(supplierJobDetailProvider(widget.jobId));
    final detail = state.detail;
    if (detail != null) _seedPriceIfNeeded(detail);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.surface,
        title: Text(
          detail?.orderPublicId ?? 'Job',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: state.isLoading || state.isSubmitting
                ? null
                : () => ref
                    .read(supplierJobDetailProvider(widget.jobId).notifier)
                    .load(),
            icon: HugeIcon(
              icon: HugeIcons.strokeRoundedRefresh,
              color: colors.onBackground,
              size: 20,
            ),
          ),
        ],
      ),
      body: state.isLoading && detail == null
          ? const Center(child: CircularProgressIndicator())
          : detail == null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpacing.xl),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          state.errorMessage ?? 'Job not found',
                          textAlign: TextAlign.center,
                          style: AppTypography.body.copyWith(
                            color: colors.onSurfaceDim,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        AppButton(
                          label: 'Retry',
                          onTap: () => ref
                              .read(
                                supplierJobDetailProvider(widget.jobId)
                                    .notifier,
                              )
                              .load(),
                        ),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  color: colors.accent,
                  onRefresh: () => ref
                      .read(supplierJobDetailProvider(widget.jobId).notifier)
                      .load(),
                  child: ListView(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    children: [
                      _HeaderCard(detail: detail, colors: colors),
                      if (_deadlineLabel(detail) != null) ...[
                        const SizedBox(height: AppSpacing.md),
                        _InfoBanner(
                          colors: colors,
                          tone: detail.acceptanceDeadline != null &&
                                  detail.acceptanceDeadline!
                                      .isBefore(DateTime.now())
                              ? _BannerTone.warning
                              : _BannerTone.info,
                          icon: HugeIcons.strokeRoundedClock01,
                          title: _deadlineLabel(detail)!,
                          body: detail.acceptanceDeadline == null
                              ? null
                              : 'Deadline: ${formatDateTime(detail.acceptanceDeadline!)}',
                        ),
                      ],
                      if (detail.isWaitingPaymentAuthorization) ...[
                        const SizedBox(height: AppSpacing.md),
                        SupplierPaymentGateBanner(
                          orderStatusLabel: detail.orderStatus.displayName,
                        ),
                      ],
                      if (state.errorMessage != null) ...[
                        const SizedBox(height: AppSpacing.md),
                        Text(
                          state.errorMessage!,
                          style: AppTypography.caption.copyWith(
                            color: colors.error,
                          ),
                        ),
                      ],
                      if (state.actionMessage != null) ...[
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          state.actionMessage!,
                          style: AppTypography.caption.copyWith(
                            color: colors.success,
                          ),
                        ),
                      ],
                      const SizedBox(height: AppSpacing.lg),
                      _SpecsSection(detail: detail, colors: colors),
                      if (detail.artworkFileName != null ||
                          detail.artworkSignedUrl != null) ...[
                        const SizedBox(height: AppSpacing.lg),
                        _ArtworkSection(
                          detail: detail,
                          colors: colors,
                          onOpen: () => _openArtwork(detail.artworkSignedUrl),
                        ),
                      ],
                      if (detail.canQuote ||
                          detail.canAccept ||
                          detail.canDecline) ...[
                        const SizedBox(height: AppSpacing.lg),
                        _AcceptDeclineSection(
                          detail: detail,
                          colors: colors,
                          priceController: _priceController,
                          declineReasonController: _declineReasonController,
                          promisedDate: _promisedDate,
                          isSubmitting: state.isSubmitting,
                          decisionWindowOpen: _decisionWindowOpen(detail),
                          onPickDate: _pickPromisedDate,
                          onQuote: _onQuote,
                          onAccept: _onAccept,
                          onDecline: _onDecline,
                        ),
                      ],
                      if (detail.canProduction) ...[
                        const SizedBox(height: AppSpacing.lg),
                        _ProductionSection(
                          colors: colors,
                          milestone: _milestone,
                          availableMilestones: detail.availableMilestones,
                          reachedMilestones: detail.productionMilestones,
                          notesController: _prodNotesController,
                          isSubmitting: state.isSubmitting,
                          onMilestoneChanged: (m) =>
                              setState(() => _milestone = m),
                          onSubmit: (m) => _onProduction(m),
                        ),
                      ],
                      if (detail.canSelfQc) ...[
                        const SizedBox(height: AppSpacing.lg),
                        _SelfQcSection(
                          colors: colors,
                          notesController: _selfQcNotesController,
                          file: _selfQcFile,
                          pickupQa: _pickupQa,
                          signaturePadKey: _signaturePadKey,
                          isSubmitting: state.isSubmitting,
                          onPickupQaChanged: (next) =>
                              setState(() => _pickupQa = next),
                          onSignatureChanged: (sig) =>
                              setState(() => _pickupQaSignature = sig),
                          onPickFile: _pickSelfQcFile,
                          onClearFile: () => setState(() => _selfQcFile = null),
                          onSubmit: _onSelfQc,
                        ),
                      ],
                      if (detail.canReadyForPickup) ...[
                        const SizedBox(height: AppSpacing.lg),
                        AppCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                'Ready for pickup',
                                style: AppTypography.bodyBold.copyWith(
                                  color: colors.onBackground,
                                ),
                              ),
                              const SizedBox(height: AppSpacing.xs),
                              Text(
                                'Mark this job ready so dispatch can schedule rider pickup.',
                                style: AppTypography.caption.copyWith(
                                  color: colors.onSurfaceDim,
                                ),
                              ),
                              const SizedBox(height: AppSpacing.md),
                              AppButton(
                                label: 'Mark ready for pickup',
                                isFullWidth: true,
                                isLoading: state.isSubmitting,
                                icon: HugeIcons.strokeRoundedCheckmarkCircle02,
                                onTap: state.isSubmitting
                                    ? null
                                    : _onReadyForPickup,
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: AppSpacing.xxl),
                    ],
                  ),
                ),
    );
  }
}

enum _BannerTone { info, warning }

class _InfoBanner extends StatelessWidget {
  const _InfoBanner({
    required this.colors,
    required this.tone,
    required this.icon,
    required this.title,
    this.body,
  });

  final AppColorSet colors;
  final _BannerTone tone;
  final dynamic icon;
  final String title;
  final String? body;

  @override
  Widget build(BuildContext context) {
    final accent = tone == _BannerTone.warning ? colors.warning : colors.info;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.12),
        borderRadius: AppRadius.borderMd,
        border: Border.all(color: accent.withValues(alpha: 0.35)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          HugeIcon(icon: icon, color: accent, size: 18),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTypography.caption.copyWith(
                    color: colors.onBackground,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (body != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    body!,
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({required this.detail, required this.colors});

  final SupplierJobDetail detail;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  detail.orderPublicId,
                  style: AppTypography.h2.copyWith(
                    color: colors.onBackground,
                  ),
                ),
              ),
              StatusBadge(
                label: detail.orderStatus.displayName,
                variant: StatusBadgeVariant.info,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            '${detail.category} · qty ${detail.quantity}',
            style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
          ),
          if (detail.finalPriceMinor != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Committed: ${formatMinorAsCurrency(detail.finalPriceMinor)}',
              style: AppTypography.bodyBold.copyWith(
                color: colors.onBackground,
              ),
            ),
          ],
          if (detail.promisedDate != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Promised: ${formatDateTime(detail.promisedDate!)}',
              style: AppTypography.caption.copyWith(
                color: colors.onSurfaceDim,
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Decision: ${detail.decision}'
            '${detail.decisionReason != null && detail.decisionReason!.isNotEmpty ? ' — ${detail.decisionReason}' : ''}',
            style: AppTypography.caption.copyWith(
              color: colors.onSurfaceDim,
            ),
          ),
        ],
      ),
    );
  }
}

class _SpecsSection extends StatelessWidget {
  const _SpecsSection({required this.detail, required this.colors});

  final SupplierJobDetail detail;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Job specs',
            style: AppTypography.bodyBold.copyWith(
              color: colors.onBackground,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          if (detail.items.isEmpty)
            Text(
              'No line-item specs returned for this job.',
              style: AppTypography.caption.copyWith(
                color: colors.onSurfaceDim,
              ),
            )
          else
            ...detail.items.map((item) {
              return Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${item.title} · qty ${item.quantity}',
                      style: AppTypography.caption.copyWith(
                        color: colors.onBackground,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (item.specialInstructions != null &&
                        item.specialInstructions!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          item.specialInstructions!,
                          style: AppTypography.caption.copyWith(
                            color: colors.onSurfaceDim,
                          ),
                        ),
                      ),
                    ...item.specs.map(
                      (spec) => Padding(
                        padding: const EdgeInsets.only(top: AppSpacing.xs),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              flex: 2,
                              child: Text(
                                spec.label,
                                style: AppTypography.caption.copyWith(
                                  color: colors.onSurfaceDim,
                                ),
                              ),
                            ),
                            Expanded(
                              flex: 3,
                              child: Text(
                                spec.shownValue,
                                style: AppTypography.caption.copyWith(
                                  color: colors.onBackground,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}

class _ArtworkSection extends StatelessWidget {
  const _ArtworkSection({
    required this.detail,
    required this.colors,
    required this.onOpen,
  });

  final SupplierJobDetail detail;
  final AppColorSet colors;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final canOpen = detail.artworkSignedUrl != null &&
        detail.artworkSignedUrl!.trim().isNotEmpty;
    return AppCard(
      onTap: canOpen ? onOpen : null,
      child: Row(
        children: [
          HugeIcon(
            icon: HugeIcons.strokeRoundedFile01,
            color: colors.accent,
            size: 22,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Artwork',
                  style: AppTypography.bodyBold.copyWith(
                    color: colors.onBackground,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  detail.artworkFileName ?? 'Attached file',
                  style: AppTypography.caption.copyWith(
                    color: canOpen ? colors.accent : colors.onSurfaceDim,
                    decoration: canOpen ? TextDecoration.underline : null,
                  ),
                ),
              ],
            ),
          ),
          if (canOpen)
            HugeIcon(
              icon: HugeIcons.strokeRoundedLinkSquare02,
              color: colors.accent,
              size: 18,
            ),
        ],
      ),
    );
  }
}

class _AcceptDeclineSection extends StatelessWidget {
  const _AcceptDeclineSection({
    required this.detail,
    required this.colors,
    required this.priceController,
    required this.declineReasonController,
    required this.promisedDate,
    required this.isSubmitting,
    required this.decisionWindowOpen,
    required this.onPickDate,
    required this.onQuote,
    required this.onAccept,
    required this.onDecline,
  });

  final SupplierJobDetail detail;
  final AppColorSet colors;
  final TextEditingController priceController;
  final TextEditingController declineReasonController;
  final DateTime? promisedDate;
  final bool isSubmitting;
  final bool decisionWindowOpen;
  final VoidCallback onPickDate;
  final VoidCallback onQuote;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  @override
  Widget build(BuildContext context) {
    final canEditQuote = detail.canQuote && decisionWindowOpen;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Quote, accept, or decline',
            style: AppTypography.bodyBold.copyWith(
              color: colors.onBackground,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Send your final price first. You can accept only after the '
            'customer places the order again.',
            style: AppTypography.caption.copyWith(
              color: colors.onSurfaceDim,
            ),
          ),
          if (detail.canQuote || detail.canAccept) ...[
            const SizedBox(height: AppSpacing.md),
            AppTextField(
              label: 'Final price (₱)',
              hintText: 'e.g. 450.00',
              controller: priceController,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              enabled: canEditQuote && !isSubmitting,
            ),
            const SizedBox(height: AppSpacing.md),
            InkWell(
              onTap: canEditQuote && !isSubmitting ? onPickDate : null,
              borderRadius: AppRadius.borderMd,
              child: InputDecorator(
                decoration: InputDecoration(
                  labelText: 'Promised date',
                  border: const UnderlineInputBorder(),
                  enabled: canEditQuote && !isSubmitting,
                ),
                child: Text(
                  promisedDate == null
                      ? 'Select date and time'
                      : formatDateTime(promisedDate!),
                  style: AppTypography.body.copyWith(
                    color: promisedDate == null
                        ? colors.onSurfaceDim
                        : colors.onBackground,
                  ),
                ),
              ),
            ),
            if (detail.awaitingCustomerConfirm) ...[
              const SizedBox(height: AppSpacing.md),
              Text(
                'Waiting for the customer to place the order again.',
                style: AppTypography.caption.copyWith(
                  color: colors.warning,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
            if (detail.canQuote) ...[
              const SizedBox(height: AppSpacing.md),
              AppButton(
                label: decisionWindowOpen
                    ? 'Send final price'
                    : 'Window expired',
                isFullWidth: true,
                isLoading: isSubmitting,
                isDisabled: !canEditQuote,
                onTap: canEditQuote && !isSubmitting ? onQuote : null,
              ),
            ],
            if (detail.canAccept) ...[
              const SizedBox(height: AppSpacing.md),
              AppButton(
                label: decisionWindowOpen ? 'Accept job' : 'Window expired',
                isFullWidth: true,
                isLoading: isSubmitting,
                isDisabled: !decisionWindowOpen,
                icon: HugeIcons.strokeRoundedCheckmarkCircle02,
                onTap: decisionWindowOpen && !isSubmitting ? onAccept : null,
              ),
            ],
          ],
          if (detail.canDecline) ...[
            const SizedBox(height: AppSpacing.lg),
            AppTextField(
              label: 'Decline reason',
              hintText: 'Why are you declining?',
              controller: declineReasonController,
              maxLines: 3,
              enabled: !isSubmitting,
            ),
            const SizedBox(height: AppSpacing.md),
            AppButton(
              label: 'Decline job',
              variant: AppButtonVariant.secondary,
              isFullWidth: true,
              isLoading: isSubmitting,
              icon: HugeIcons.strokeRoundedCancel01,
              onTap: isSubmitting ? null : onDecline,
            ),
          ],
        ],
      ),
    );
  }
}

class _ProductionSection extends StatelessWidget {
  const _ProductionSection({
    required this.colors,
    required this.milestone,
    required this.availableMilestones,
    required this.reachedMilestones,
    required this.notesController,
    required this.isSubmitting,
    required this.onMilestoneChanged,
    required this.onSubmit,
  });

  final AppColorSet colors;
  final ProductionMilestone milestone;
  final List<ProductionMilestone> availableMilestones;
  final List<String> reachedMilestones;
  final TextEditingController notesController;
  final bool isSubmitting;
  final ValueChanged<ProductionMilestone> onMilestoneChanged;
  final ValueChanged<ProductionMilestone> onSubmit;

  @override
  Widget build(BuildContext context) {
    final selectable = availableMilestones;
    final selected = selectable.contains(milestone)
        ? milestone
        : (selectable.isNotEmpty ? selectable.first : null);
    final allDone = selectable.isEmpty;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Production milestones',
            style: AppTypography.bodyBold.copyWith(
              color: colors.onBackground,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            allDone
                ? 'All milestones are complete and locked.'
                : 'Complete steps in order. Future steps are locked until the current one is done.',
            style: AppTypography.caption.copyWith(
              color: colors.onSurfaceDim,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          ...ProductionMilestone.values.map((m) {
            final reached = reachedMilestones.contains(m.apiValue);
            final isSelectable = selectable.contains(m);
            final isSelected = !reached && selected == m;
            final dimColor = colors.onSurfaceDim.withValues(alpha: 0.55);
            final cardBg = reached
                ? colors.surfaceVariant.withValues(alpha: 0.45)
                : isSelected
                    ? colors.accent.withValues(alpha: 0.12)
                    : colors.surfaceVariant;
            final borderColor = reached
                ? colors.outline.withValues(alpha: 0.5)
                : isSelected
                    ? colors.accent
                    : colors.outline;

            return Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: Opacity(
                opacity: (reached || !isSelectable) && !isSelected ? 0.55 : 1,
                child: InkWell(
                  onTap: (isSubmitting || reached || !isSelectable)
                      ? null
                      : () => onMilestoneChanged(m),
                  borderRadius: AppRadius.borderMd,
                  child: Container(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: BoxDecoration(
                      color: cardBg,
                      borderRadius: AppRadius.borderMd,
                      border: Border.all(color: borderColor),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          reached
                              ? Icons.check_circle
                              : isSelected
                                  ? Icons.radio_button_checked
                                  : Icons.radio_button_off,
                          size: 20,
                          color: reached
                              ? colors.success.withValues(alpha: 0.7)
                              : isSelected
                                  ? colors.accent
                                  : colors.onSurfaceDim.withValues(alpha: isSelectable ? 1 : 0.5),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      m.label,
                                      style: AppTypography.caption.copyWith(
                                        color: reached
                                            ? dimColor
                                            : colors.onBackground,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                  if (reached)
                                    Text(
                                      'Done',
                                      style: AppTypography.caption.copyWith(
                                        color: colors.success
                                            .withValues(alpha: 0.85),
                                        fontWeight: FontWeight.w700,
                                        fontSize: 11,
                                      ),
                                    ),
                                ],
                              ),
                              Text(
                                m.description,
                                style: AppTypography.caption.copyWith(
                                  color: reached
                                      ? dimColor
                                      : colors.onSurfaceDim,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          }),
          if (allDone)
            Text(
              'Proceed to Pickup QA when ready.',
              style: AppTypography.caption.copyWith(
                color: colors.onSurfaceDim,
              ),
            )
          else ...[
            AppTextField(
              label: 'Notes (optional)',
              controller: notesController,
              maxLines: 2,
              enabled: !isSubmitting,
            ),
            const SizedBox(height: AppSpacing.md),
            AppButton(
              label: 'Update production status',
              isFullWidth: true,
              isLoading: isSubmitting,
              icon: HugeIcons.strokeRoundedFactory01,
              onTap: isSubmitting || selected == null
                  ? null
                  : () {
                      final chosen = selected;
                      onMilestoneChanged(chosen);
                      onSubmit(chosen);
                    },
            ),
          ],
        ],
      ),
    );
  }
}

class _SelfQcSection extends StatelessWidget {
  const _SelfQcSection({
    required this.colors,
    required this.notesController,
    required this.file,
    required this.pickupQa,
    required this.signaturePadKey,
    required this.isSubmitting,
    required this.onPickupQaChanged,
    required this.onSignatureChanged,
    required this.onPickFile,
    required this.onClearFile,
    required this.onSubmit,
  });

  final AppColorSet colors;
  final TextEditingController notesController;
  final PlatformFile? file;
  final Map<String, bool> pickupQa;
  final GlobalKey<SignaturePadState> signaturePadKey;
  final bool isSubmitting;
  final ValueChanged<Map<String, bool>> onPickupQaChanged;
  final ValueChanged<String?> onSignatureChanged;
  final VoidCallback onPickFile;
  final VoidCallback onClearFile;
  final VoidCallback onSubmit;

  bool get _hasEvidence {
    final bytes = file?.bytes;
    return file != null && bytes != null && bytes.isNotEmpty;
  }

  @override
  Widget build(BuildContext context) {
    // Signature validity is enforced in the parent submit handler via state.
    final canSubmit = _hasEvidence &&
        pickupQaCheckboxItems.every((i) => pickupQa[i.key] == true);
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Pickup QA + proof of fulfillment',
            style: AppTypography.bodyBold.copyWith(
              color: colors.onBackground,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'After production is complete, pass every checklist line, sign, and upload evidence. Then you can mark ready for pickup.',
            style: AppTypography.caption.copyWith(
              color: colors.onSurfaceDim,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          PickupQaChecklistWidget(
            value: pickupQa,
            onChanged: onPickupQaChanged,
            onSignatureChanged: onSignatureChanged,
            signaturePadKey: signaturePadKey,
            enabled: !isSubmitting,
          ),
          const SizedBox(height: AppSpacing.md),
          if (file != null)
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: colors.surfaceVariant,
                borderRadius: AppRadius.borderMd,
              ),
              child: Row(
                children: [
                  HugeIcon(
                    icon: HugeIcons.strokeRoundedFile01,
                    color: colors.accent,
                    size: 18,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      file!.name,
                      style: AppTypography.caption.copyWith(
                        color: colors.onBackground,
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  IconButton(
                    tooltip: 'Remove file',
                    onPressed: isSubmitting ? null : onClearFile,
                    icon: Icon(Icons.close, size: 18, color: colors.error),
                  ),
                ],
              ),
            )
          else
            AppButton(
              label: 'Pick evidence file',
              variant: AppButtonVariant.secondary,
              isFullWidth: true,
              icon: HugeIcons.strokeRoundedUpload01,
              onTap: isSubmitting ? null : onPickFile,
            ),
          const SizedBox(height: AppSpacing.md),
          AppTextField(
            label: 'Notes (optional)',
            controller: notesController,
            maxLines: 2,
            enabled: !isSubmitting,
          ),
          const SizedBox(height: AppSpacing.md),
          AppButton(
            label: 'Submit Pickup QA',
            isFullWidth: true,
            isLoading: isSubmitting,
            icon: HugeIcons.strokeRoundedCheckmarkCircle02,
            onTap: (isSubmitting || !canSubmit) ? null : onSubmit,
          ),
        ],
      ),
    );
  }
}
