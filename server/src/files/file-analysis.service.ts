import { Injectable } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

export interface FileAnalysisResult {
  widthPt: number | null;
  heightPt: number | null;
  widthPx: number | null;
  heightPx: number | null;
  colorSpace: string | null;
  pageCount: number | null;
  dpi: number | null;
}

@Injectable()
export class FileAnalysisService {
  async analyze(
    buffer: Buffer,
    mimeType: string,
  ): Promise<FileAnalysisResult | null> {
    try {
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
        widthPt: width,
        heightPt: height,
        widthPx: null,
        heightPx: null,
        colorSpace: hasCmyk ? 'cmyk' : 'rgb',
        pageCount,
        dpi: null,
      };
    } catch {
      return null;
    }
  }

  private async analyzeImage(buffer: Buffer): Promise<FileAnalysisResult | null> {
    try {
      const meta = await sharp(buffer).metadata();
      return {
        widthPt: null,
        heightPt: null,
        widthPx: meta.width ?? null,
        heightPx: meta.height ?? null,
        colorSpace: meta.space ?? null,
        pageCount: null,
        dpi: meta.density ?? null,
      };
    } catch {
      return null;
    }
  }
}
