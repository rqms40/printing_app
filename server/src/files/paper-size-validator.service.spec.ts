import { PaperSizeValidatorService } from './paper-size-validator.service';

describe('PaperSizeValidatorService', () => {
  let service: PaperSizeValidatorService;

  beforeEach(() => {
    service = new PaperSizeValidatorService();
  });

  it('returns match for A4 PDF (595×842pt portrait)', () => {
    const result = service.validate({ widthPt: 595, heightPt: 842 }, 'A4');
    expect(result.status).toBe('match');
    expect(result.orientation).toBe('portrait');
  });

  it('returns match for landscape A4 (842×595pt)', () => {
    const result = service.validate({ widthPt: 842, heightPt: 595 }, 'A4');
    expect(result.status).toBe('match');
    expect(result.orientation).toBe('landscape');
  });

  it('returns mismatch for A3 PDF against A4 paper size', () => {
    const result = service.validate({ widthPt: 842, heightPt: 1191 }, 'A4');
    expect(result.status).toBe('mismatch');
    expect(result.fileSizeMm).toContain('297');
  });

  it('returns unknown when no dimensions available', () => {
    const result = service.validate({ widthPt: null, heightPt: null }, 'A4');
    expect(result.status).toBe('unknown');
  });

  it('returns unknown for unrecognised paper size string', () => {
    const result = service.validate(
      { widthPt: 595, heightPt: 842 },
      'CUSTOM_WEIRD',
    );
    expect(result.status).toBe('unknown');
  });

  it('validates image dimensions via dpi + px (A4 at 300dpi)', () => {
    // A4 at 300dpi = 2480×3508px
    const result = service.validate(
      { widthPx: 2480, heightPx: 3508, dpi: 300 },
      'A4',
    );
    expect(result.status).toBe('match');
  });
});
