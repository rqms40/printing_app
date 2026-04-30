import { getMetadataArgsStorage } from 'typeorm';
import { FileMetadata } from './file-metadata.entity';

describe('FileMetadata 3D columns', () => {
  const cols = getMetadataArgsStorage()
    .filterColumns(FileMetadata)
    .map((c) => c.propertyName);

  it('has 3D-bounds columns', () => {
    for (const name of [
      'model3dWidthMm',
      'model3dDepthMm',
      'model3dHeightMm',
      'model3dTriangleCount',
    ]) {
      expect(cols).toContain(name);
    }
  });
});
