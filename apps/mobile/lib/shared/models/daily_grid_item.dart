class DailyGridItem {
  const DailyGridItem({
    required this.id,
    required this.title,
    this.subtitle,
    this.imageUrl,
    required this.category,
    required this.sortOrder,
  });

  final int id;
  final String title;
  final String? subtitle;
  final String? imageUrl;

  /// 'paper' or '3d' — matches OrderFlowState.category
  final String category;
  final int sortOrder;

  factory DailyGridItem.fromJson(Map<String, dynamic> json) {
    return DailyGridItem(
      id: (json['id'] as num).toInt(),
      title: json['title'] as String? ?? '',
      subtitle: json['subtitle'] as String?,
      imageUrl: json['imageUrl'] as String?,
      category: json['category'] as String? ?? 'paper',
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
    );
  }
}
