import 'package:printing_app/shared/services/draft_storage_service.dart';

const legacyOrderCatalogRoute = '/customer/order/new';

/// Returns `null` only when the requested historical route matches a saved
/// Paper/3D draft. Legacy screens are restoration surfaces, not new-order
/// entry points.
String? resolveLegacyOrderDraftRedirect({
  required String requestedCategory,
  required String? savedDraftCategory,
}) {
  final isLegacyCategory =
      requestedCategory == 'paper' || requestedCategory == '3d';
  if (isLegacyCategory && savedDraftCategory == requestedCategory) return null;
  return legacyOrderCatalogRoute;
}

/// Reads the persisted category at navigation time so a newly saved
/// historical draft can be restored without caching stale access authority.
String? loadSavedLegacyDraftCategory() {
  try {
    final category = DraftStorageService.loadDraft()?['category']?.toString();
    return category == 'paper' || category == '3d' ? category : null;
  } catch (_) {
    // Hive may be unavailable during startup or recovery. Fail closed.
    return null;
  }
}
