export type SizeValidationStatus = 'match' | 'mismatch' | 'unknown';

export class SizeValidationResult {
  status: SizeValidationStatus;
  orientation?: 'portrait' | 'landscape';
  fileSizeMm?: string;
  expectedSizeMm?: string;
  message?: string;
}

export interface ModelBoundsDto {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  triangleCount: number | null;
  unit: 'mm' | 'inch' | 'unknown';
}

export interface PrinterLimitsDto {
  profileName: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  maxFileSizeMb: number;
  fits: boolean;
  overflowAxes: ('width' | 'depth' | 'height')[];
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
  modelBounds: ModelBoundsDto | null;
  printerLimits: PrinterLimitsDto | null;
  previewGlbUrl: string | null;
}
