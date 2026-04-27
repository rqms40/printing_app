import { FileAnalysisService } from './file-analysis.service';

describe('FileAnalysisService', () => {
  let service: FileAnalysisService;

  beforeEach(() => {
    service = new FileAnalysisService();
  });

  it('returns null for unsupported mime type', async () => {
    const result = await service.analyze(Buffer.from('hello'), 'text/plain');
    expect(result).toBeNull();
  });

  it('returns null gracefully when PDF buffer is corrupt', async () => {
    const result = await service.analyze(Buffer.from('not-a-pdf'), 'application/pdf');
    expect(result).toBeNull();
  });

  it('returns null gracefully when image buffer is corrupt', async () => {
    const result = await service.analyze(Buffer.from('not-an-image'), 'image/jpeg');
    expect(result).toBeNull();
  });
});
