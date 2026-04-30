import { Injectable } from '@nestjs/common';
import { extname } from 'path';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { Model3dAnalysisService } from './model-3d-analysis.service';

export interface FileAnalysisResult {
  widthPt: number | null;
  heightPt: number | null;
  widthPx: number | null;
  heightPx: number | null;
  colorSpace: string | null;
  pageCount: number | null;
  dpi: number | null;
  model3dWidthMm: number | null;
  model3dDepthMm: number | null;
  model3dHeightMm: number | null;
  model3dTriangleCount: number | null;
}

const EMPTY: FileAnalysisResult = {
  widthPt: null,
  heightPt: null,
  widthPx: null,
  heightPx: null,
  colorSpace: null,
  pageCount: null,
  dpi: null,
  model3dWidthMm: null,
  model3dDepthMm: null,
  model3dHeightMm: null,
  model3dTriangleCount: null,
};

@Injectable()
export class FileAnalysisService {
  constructor(private readonly model3d: Model3dAnalysisService) {}

  async analyze(
    buffer: Buffer,
    mimeType: string,
    filename = '',
  ): Promise<FileAnalysisResult | null> {
    try {
      const ext = extname(filename).toLowerCase();
      if (['.stl', '.obj', '.3mf'].includes(ext)) {
        const bounds = await this.model3d.analyze(buffer, filename);
        if (!bounds) return EMPTY;
        return {
          ...EMPTY,
          model3dWidthMm: bounds.widthMm,
          model3dDepthMm: bounds.depthMm,
          model3dHeightMm: bounds.heightMm,
          model3dTriangleCount: bounds.triangleCount,
        };
      }
      if (mimeType === 'application/pdf') return this.analyzePdf(buffer);
      if (mimeType.startsWith('image/')) return this.analyzeImage(buffer);
      return null;
    } catch {
      return null;
    }
  }

  private async analyzePdf(buffer: Buffer): Promise<FileAnalysisResult | null> {
    try {
      const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const pageCount = pdf.getPageCount();
      if (pageCount === 0) return null;
      const page = pdf.getPage(0);
      const { width, height } = page.getSize();
      // Best-effort heuristic: scans raw bytes for /DeviceCMYK reference.
      // May false-positive on compressed streams; treat result as advisory.
      const hasCmyk = buffer.toString('latin1').includes('/DeviceCMYK');
      return {
        ...EMPTY,
        widthPt: width,
        heightPt: height,
        colorSpace: hasCmyk ? 'cmyk' : 'rgb',
        pageCount,
      };
    } catch {
      return null;
    }
  }

  private async analyzeImage(buffer: Buffer): Promise<FileAnalysisResult | null> {
    try {
      const meta = await sharp(buffer).metadata();
      return {
        ...EMPTY,
        widthPx: meta.width ?? null,
        heightPx: meta.height ?? null,
        colorSpace: meta.space ?? null,
        dpi: meta.density ?? null,
      };
    } catch {
      return null;
    }
  }
}
