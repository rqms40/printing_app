import 'package:printing_app/shared/models/enums.dart';

/// Material concern categories for post-collection / delivery claims.
const reportConcernCategories = <({String value, String label})>[
  (value: 'print_defect', label: 'Print quality defect'),
  (value: 'damaged', label: 'Damaged item'),
  (value: 'wrong_item', label: 'Wrong item / specs'),
  (value: 'incomplete', label: 'Incomplete / missing pieces'),
  (value: 'delivery_issue', label: 'Delivery / packaging issue'),
  (value: 'other', label: 'Other concern'),
];

/// Whether the client can file a post-receipt material concern.
bool canReportConcern(OrderStatus status) {
  return status == OrderStatus.collectedByCustomer ||
      status == OrderStatus.issueWindowOpen ||
      status == OrderStatus.delivered;
}
