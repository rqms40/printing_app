class StorageSettings {
  const StorageSettings({required this.fileRetentionDays});

  final int? fileRetentionDays;

  factory StorageSettings.fromJson(Map<String, dynamic> json) {
    return StorageSettings(
      fileRetentionDays: json['fileRetentionDays'] as int?,
    );
  }
}
