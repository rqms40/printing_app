export const ALLOWED_MIME_TYPES: string[] = [
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  // Documents
  'application/pdf',
  // 3D model formats
  'model/stl',
  'application/sla',
  'application/vnd.ms-pki.stl',
  'model/obj',
  'application/x-tgif',
  'model/3mf',
  'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
  // Browsers commonly fall back to this for unrecognized binary uploads
  // (.stl/.obj/.3mf typically arrive as octet-stream from Flutter web/Android)
  'application/octet-stream',
  // Some browsers send zip MIME for .3mf since it's a zipped container
  'application/zip',
];

export const THREE_D_EXTENSIONS: string[] = ['.stl', '.obj', '.3mf'];

/**
 * Extensions allowed when MIME type is a generic fallback like
 * `application/octet-stream` or `application/zip`. Must match the file's
 * `originalname` (case-insensitive). Keep in sync with the categories the
 * customer-facing forms expose.
 */
export const ALLOWED_EXTENSIONS: string[] = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.pdf',
  '.stl',
  '.obj',
  '.3mf',
];

export const PAPER_MAX_FILE_SIZE_MB = 50;
export const THREE_D_MAX_FILE_SIZE_MB = 200;

export const PAPER_MAX_FILE_SIZE_BYTES = PAPER_MAX_FILE_SIZE_MB * 1024 * 1024;
export const THREE_D_MAX_FILE_SIZE_BYTES =
  THREE_D_MAX_FILE_SIZE_MB * 1024 * 1024;

export const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'model/stl': '.stl',
  'application/sla': '.stl',
  'application/vnd.ms-pki.stl': '.stl',
  'model/obj': '.obj',
  'application/x-tgif': '.obj',
  'model/3mf': '.3mf',
  'application/vnd.ms-package.3dmanufacturing-3dmodel+xml': '.3mf',
};

export const MIME_ALLOWED_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'model/stl': ['.stl'],
  'application/sla': ['.stl'],
  'application/vnd.ms-pki.stl': ['.stl'],
  'model/obj': ['.obj'],
  'application/x-tgif': ['.obj'],
  'model/3mf': ['.3mf'],
  'application/vnd.ms-package.3dmanufacturing-3dmodel+xml': ['.3mf'],
  'application/octet-stream': ALLOWED_EXTENSIONS,
  'application/zip': ['.3mf'],
};
