export type SizeValidationStatus = 'match' | 'mismatch' | 'unknown';

export class SizeValidationResult {
  status: SizeValidationStatus;
  orientation?: 'portrait' | 'landscape';
  fileSizeMm?: string;
  expectedSizeMm?: string;
  message?: string;
}

export class FileInspectionDto {
  mimeType: string;
  widthMm: number | null;
  heightMm: number | null;
  widthPx: number | null;
  heightPx: number | null;
  colorSpace: string | null;
  pageCount: number | null;
  dpi: number | null;
  sizeValidation: SizeValidationResult | null;
}
