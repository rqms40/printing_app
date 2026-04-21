class UploadedFile {
  const UploadedFile({
    required this.id,
    required this.originalName,
    required this.mimeType,
    required this.size,
    required this.createdAt,
    this.expiresAt,
  });

  final int id;
  final String originalName;
  final String mimeType;
  final int size;
  final DateTime createdAt;
  final DateTime? expiresAt;

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
    );
  }
}
