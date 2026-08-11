/// Shared Pickup QA checklist — must match server `pickup-qa-checklist.ts`.
class PickupQaChecklistItem {
  const PickupQaChecklistItem({
    required this.key,
    required this.label,
    required this.whatToVerify,
    this.requiresSignature = false,
  });

  final String key;
  final String label;
  final String whatToVerify;
  final bool requiresSignature;
}

const pickupQaSignOffKey = 'supplier_sign_off';

const pickupQaChecklistItems = <PickupQaChecklistItem>[
  PickupQaChecklistItem(
    key: 'quantity_match',
    label: 'Quantity match',
    whatToVerify: 'Physical count matches the order ticket quantity',
  ),
  PickupQaChecklistItem(
    key: 'specification_match',
    label: 'Specification match',
    whatToVerify: 'Item matches described size, color, material, and design',
  ),
  PickupQaChecklistItem(
    key: 'visible_defects',
    label: 'Visible defects',
    whatToVerify:
        'No tears, misprints, color shifts, cracks, or stains on inspection',
  ),
  PickupQaChecklistItem(
    key: 'packaging_integrity',
    label: 'Packaging integrity',
    whatToVerify:
        'Items are wrapped/boxed adequately for transport on a motorcycle',
  ),
  PickupQaChecklistItem(
    key: 'documentation',
    label: 'Documentation',
    whatToVerify:
        'Delivery receipt / invoice / order slip is included and matches order ID',
  ),
  PickupQaChecklistItem(
    key: pickupQaSignOffKey,
    label: 'Digital sign-off',
    whatToVerify: 'Draw your signature to confirm handoff / pickup quality check',
    requiresSignature: true,
  ),
];

List<PickupQaChecklistItem> get pickupQaCheckboxItems =>
    pickupQaChecklistItems.where((i) => !i.requiresSignature).toList();

Map<String, bool> emptyPickupQaChecklist() => {
  for (final item in pickupQaCheckboxItems) item.key: false,
};

bool allPickupQaChecksPassed(
  Map<String, bool> state, {
  String? signatureData,
}) {
  final checksOk = pickupQaCheckboxItems.every(
    (item) => state[item.key] == true,
  );
  final sigOk = signatureData != null && signatureData.trim().isNotEmpty;
  return checksOk && sigOk;
}

Map<String, dynamic> pickupQaChecklistPayload(
  Map<String, bool> state, {
  required String signatureData,
}) {
  final out = <String, dynamic>{};
  for (final item in pickupQaChecklistItems) {
    if (item.requiresSignature) {
      out[item.key] = {
        'pass': true,
        'signatureData': signatureData,
      };
    } else {
      out[item.key] = state[item.key] == true;
    }
  }
  return out;
}
