import { Injectable } from '@nestjs/common';
import { SizeValidationResult } from './dto/file-inspection.dto';
import { PT_TO_MM } from './files.constants';
const TOLERANCE_MM = 5;

const PAPER_SIZES_MM: Record<string, { width: number; height: number }> = {
  A1: { width: 594, height: 841 },
  A2: { width: 420, height: 594 },
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  LETTER: { width: 216, height: 279 },
  LEGAL: { width: 216, height: 356 },
};

interface DimensionInput {
  widthPt?: number | null;
  heightPt?: number | null;
  widthPx?: number | null;
  heightPx?: number | null;
  dpi?: number | null;
}

@Injectable()
export class PaperSizeValidatorService {
  validate(dims: DimensionInput, paperSize: string): SizeValidationResult {
    const target = PAPER_SIZES_MM[paperSize.toUpperCase()];
    if (!target)
      return { status: 'unknown', message: `Unknown paper size: ${paperSize}` };

    const { wMm, hMm } = this.toMm(dims);
    if (wMm === null || hMm === null) {
      return { status: 'unknown', message: 'File dimensions unavailable' };
    }

    const within = (a: number, b: number) => Math.abs(a - b) <= TOLERANCE_MM;
    const portrait = within(wMm, target.width) && within(hMm, target.height);
    const landscape = within(wMm, target.height) && within(hMm, target.width);

    if (portrait || landscape) {
      return {
        status: 'match',
        orientation: landscape ? 'landscape' : 'portrait',
      };
    }

    return {
      status: 'mismatch',
      fileSizeMm: `${Math.round(wMm)}×${Math.round(hMm)}mm`,
      expectedSizeMm: `${target.width}×${target.height}mm (${paperSize.toUpperCase()})`,
      message: `File is ${Math.round(wMm)}×${Math.round(hMm)}mm, expected ${paperSize.toUpperCase()} (${target.width}×${target.height}mm)`,
    };
  }

  private toMm(dims: DimensionInput): {
    wMm: number | null;
    hMm: number | null;
  } {
    if (dims.widthPt && dims.heightPt) {
      return { wMm: dims.widthPt * PT_TO_MM, hMm: dims.heightPt * PT_TO_MM };
    }
    if (dims.widthPx && dims.heightPx && dims.dpi && dims.dpi > 0) {
      return {
        wMm: (dims.widthPx / dims.dpi) * 25.4,
        hMm: (dims.heightPx / dims.dpi) * 25.4,
      };
    }
    return { wMm: null, hMm: null };
  }
}
