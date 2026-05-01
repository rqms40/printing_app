class DailyGridItem {
  const DailyGridItem({
    required this.id,
    required this.title,
    this.subtitle,
    this.imageUrl,
    required this.category,
    required this.sortOrder,
    this.paperSpecs,
    this.threeDSpecs,
  });

  final int id;
  final String title;
  final String? subtitle;
  final String? imageUrl;

  /// 'paper' or '3d' — matches OrderFlowState.category
  final String category;
  final int sortOrder;
  final Map<String, dynamic>? paperSpecs;
  final Map<String, dynamic>? threeDSpecs;

  factory DailyGridItem.fromJson(Map<String, dynamic> json) {
    return DailyGridItem(
      id: (json['id'] as num).toInt(),
      title: json['title'] as String? ?? '',
      subtitle: json['subtitle'] as String?,
      imageUrl: json['imageUrl'] as String?,
      category: json['category'] as String? ?? 'paper',
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
      paperSpecs: (json['paperSpecs'] as Map?)?.cast<String, dynamic>(),
      threeDSpecs: (json['threeDSpecs'] as Map?)?.cast<String, dynamic>(),
    );
  }
}
