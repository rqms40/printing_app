/// Allowed file extensions for document/poster uploads.
const _allowedDocumentExtensions = {
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'tif',
  'tiff',
  'bmp',
  'svg',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'ai',
  'psd',
  'eps',
};

/// Allowed file extensions for 3D print uploads.
const _allowed3DExtensions = {'stl', 'obj', '3mf', 'glb', 'gltf'};

/// Maximum file size in bytes (50 MB).
const maxFileSizeBytes = 50 * 1024 * 1024;

/// Checks whether the given [fileName] has an allowed file extension.
///
/// If [is3D] is true, checks against 3D file formats (STL, OBJ, 3MF).
/// Otherwise checks against document/poster formats.
bool isValidFileType(String fileName, {bool is3D = false}) {
  final extension = getFileExtension(fileName).toLowerCase();
  if (extension.isEmpty) return false;
  final allowed = is3D ? _allowed3DExtensions : _allowedDocumentExtensions;
  return allowed.contains(extension);
}

/// Checks whether the given file size in bytes is within the allowed limit.
bool isValidFileSize(int bytes, {int maxBytes = maxFileSizeBytes}) {
  return bytes > 0 && bytes <= maxBytes;
}

/// Returns the MIME type to send for an upload extension.
String mimeTypeForExtension(String extension) {
  switch (extension.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'tif':
    case 'tiff':
      return 'image/tiff';
    case 'pdf':
      return 'application/pdf';
    case 'stl':
      return 'model/stl';
    case 'obj':
      return 'model/obj';
    case '3mf':
      return 'model/3mf';
    case 'glb':
      return 'model/gltf-binary';
    case 'gltf':
      return 'model/gltf+json';
    default:
      return 'application/octet-stream';
  }
}

/// Extracts the file extension from a [fileName], without the leading dot.
///
/// Returns an empty string if no extension is found.
String getFileExtension(String fileName) {
  final dotIndex = fileName.lastIndexOf('.');
  if (dotIndex == -1 || dotIndex == fileName.length - 1) {
    return '';
  }
  return fileName.substring(dotIndex + 1);
}
