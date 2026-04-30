export interface PrinterProfile {
  id: number;
  name: string;
  buildVolumeWidthMm: number;
  buildVolumeDepthMm: number;
  buildVolumeHeightMm: number;
  maxFileSizeMb: number;
  updatedAt: string;
}

export interface ManualStatusPayload {
  note: string | null;
  estimatedCompletionAt: string | null;
}
