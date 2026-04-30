class PrinterProfile {
  const PrinterProfile({
    required this.name,
    required this.buildVolumeWidthMm,
    required this.buildVolumeDepthMm,
    required this.buildVolumeHeightMm,
    required this.maxFileSizeMb,
  });

  final String name;
  final int buildVolumeWidthMm;
  final int buildVolumeDepthMm;
  final int buildVolumeHeightMm;
  final int maxFileSizeMb;

  factory PrinterProfile.fromJson(Map<String, dynamic> json) => PrinterProfile(
        name: json['name'] as String,
        buildVolumeWidthMm: (json['buildVolumeWidthMm'] as num).toInt(),
        buildVolumeDepthMm: (json['buildVolumeDepthMm'] as num).toInt(),
        buildVolumeHeightMm: (json['buildVolumeHeightMm'] as num).toInt(),
        maxFileSizeMb: (json['maxFileSizeMb'] as num).toInt(),
      );
}
