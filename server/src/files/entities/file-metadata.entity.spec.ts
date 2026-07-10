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

describe('FileMetadata preview GLB column', () => {
  const cols = getMetadataArgsStorage()
    .filterColumns(FileMetadata)
    .map((c) => c.propertyName);

  it('has previewGlbObjectKey column', () => {
    expect(cols).toContain('previewGlbObjectKey');
  });
});

describe('FileMetadata purpose column', () => {
  it('persists the normalized upload purpose', () => {
    const columns = getMetadataArgsStorage()
      .filterColumns(FileMetadata)
      .map((column) => column.propertyName);

    expect(columns).toContain('purpose');
  });
});
