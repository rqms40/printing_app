import { getMetadataArgsStorage } from 'typeorm';
import { PrinterProfile } from './printer-profile.entity';

describe('PrinterProfile entity metadata', () => {
  const cols = getMetadataArgsStorage()
    .filterColumns(PrinterProfile)
    .map((c) => c.propertyName);

  it('has required columns', () => {
    for (const name of [
      'id',
      'name',
      'buildVolumeWidthMm',
      'buildVolumeDepthMm',
      'buildVolumeHeightMm',
      'maxFileSizeMb',
    ]) {
      expect(cols).toContain(name);
    }
  });
});
