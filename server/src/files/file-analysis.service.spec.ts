import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { FileAnalysisService } from './file-analysis.service';
import { Model3dAnalysisService } from './model-3d-analysis.service';

describe('FileAnalysisService', () => {
  let service: FileAnalysisService;

  beforeEach(() => {
    const model3d = {
      analyze: jest.fn().mockResolvedValue(null),
    } as unknown as Model3dAnalysisService;
    service = new FileAnalysisService(model3d);
  });

  it('returns null for unsupported mime type', async () => {
    const result = await service.analyze(Buffer.from('hello'), 'text/plain');
    expect(result).toBeNull();
  });

  it('returns null gracefully when PDF buffer is corrupt', async () => {
    const result = await service.analyze(
      Buffer.from('not-a-pdf'),
      'application/pdf',
    );
    expect(result).toBeNull();
  });

  it('returns null gracefully when image buffer is corrupt', async () => {
    const result = await service.analyze(
      Buffer.from('not-an-image'),
      'image/jpeg',
    );
    expect(result).toBeNull();
  });

  it('returns correct dimensions for a valid PDF', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([595, 842]); // A4 in points
    const pdfBytes = await pdfDoc.save();
    const result = await service.analyze(
      Buffer.from(pdfBytes),
      'application/pdf',
    );
    expect(result).not.toBeNull();
    expect(result!.widthPt).toBeCloseTo(595, 0);
    expect(result!.heightPt).toBeCloseTo(842, 0);
    expect(result!.pageCount).toBe(1);
    expect(result!.widthPx).toBeNull();
  });

  it('returns correct dimensions for a valid PNG image', async () => {
    // Minimal 1x1 white PNG (89 bytes, hardcoded)
    const pngBuffer = Buffer.from([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a, // PNG signature
      0x00,
      0x00,
      0x00,
      0x0d,
      0x49,
      0x48,
      0x44,
      0x52, // IHDR chunk length + type
      0x00,
      0x00,
      0x00,
      0x01,
      0x00,
      0x00,
      0x00,
      0x01, // width=1, height=1
      0x08,
      0x02,
      0x00,
      0x00,
      0x00,
      0x90,
      0x77,
      0x53, // bit depth=8, color type=2 (RGB), compression, filter, interlace + CRC
      0xde,
      0x00,
      0x00,
      0x00,
      0x0c,
      0x49,
      0x44,
      0x41, // IDAT chunk
      0x54,
      0x08,
      0xd7,
      0x63,
      0xf8,
      0xff,
      0xff,
      0x3f,
      0x00,
      0x05,
      0xfe,
      0x02,
      0xfe,
      0xdc,
      0xcc,
      0x59,
      0xe7,
      0x00,
      0x00,
      0x00,
      0x00,
      0x49,
      0x45,
      0x4e, // IEND chunk
      0x44,
      0xae,
      0x42,
      0x60,
      0x82,
    ]);
    const result = await service.analyze(pngBuffer, 'image/png');
    expect(result).not.toBeNull();
    expect(result!.widthPx).toBe(1);
    expect(result!.heightPx).toBe(1);
    expect(result!.widthPt).toBeNull();
  });

  it('analyzes CMYK TIFF images that arrive with generic binary MIME', async () => {
    const tiffBuffer = await sharp({
      create: {
        width: 2,
        height: 3,
        channels: 3,
        background: { r: 0, g: 255, b: 255 },
      },
    })
      .toColorspace('cmyk')
      .tiff()
      .toBuffer();

    const result = await service.analyze(
      tiffBuffer,
      'application/octet-stream',
      'poster.tif',
    );

    expect(result).not.toBeNull();
    expect(result!.widthPx).toBe(2);
    expect(result!.heightPx).toBe(3);
    expect(result!.colorSpace).toBe('cmyk');
  });
});
