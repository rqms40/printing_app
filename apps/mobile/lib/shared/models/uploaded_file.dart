class UploadedFile {
  const UploadedFile({
    required this.id,
    required this.originalName,
    required this.mimeType,
    required this.size,
    required this.createdAt,
    this.expiresAt,
    this.widthMm,
    this.heightMm,
    this.colorSpace,
    this.pageCount,
  });

  final int id;
  final String originalName;
  final String mimeType;
  final int size;
  final DateTime createdAt;
  final DateTime? expiresAt;
  final double? widthMm;
  final double? heightMm;
  final String? colorSpace;
  final int? pageCount;

  factory UploadedFile.fromJson(Map<String, dynamic> json) {
    final expiresAtRaw = json['expiresAt'] ?? json['expires_at'];
    return UploadedFile(
      id: json['id'] as int,
      originalName: (json['originalName'] ?? json['original_name'] ?? '') as String,
      mimeType: (json['mimeType'] ?? json['mime_type'] ?? '') as String,
      size: (json['size'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.parse(
        (json['createdAt'] ?? json['created_at'] ?? DateTime.now().toIso8601String()) as String,
      ),
      expiresAt: expiresAtRaw != null ? DateTime.parse(expiresAtRaw as String) : null,
      widthMm: (json['widthMm'] as num?)?.toDouble(),
      heightMm: (json['heightMm'] as num?)?.toDouble(),
      colorSpace: json['colorSpace'] as String?,
      pageCount: json['pageCount'] as int?,
    );
  }
}
