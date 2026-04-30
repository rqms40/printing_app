import { Model3dAnalysisService } from './model-3d-analysis.service';

function buildBinaryStl(triangles: number[][][]): Buffer {
  const header = Buffer.alloc(80);
  const count = Buffer.alloc(4);
  count.writeUInt32LE(triangles.length, 0);
  const body = Buffer.concat(
    triangles.map((tri) => {
      const buf = Buffer.alloc(50);
      buf.writeFloatLE(0, 0); buf.writeFloatLE(0, 4); buf.writeFloatLE(1, 8);
      let off = 12;
      for (const v of tri) {
        buf.writeFloatLE(v[0], off); off += 4;
        buf.writeFloatLE(v[1], off); off += 4;
        buf.writeFloatLE(v[2], off); off += 4;
      }
      return buf;
    }),
  );
  return Buffer.concat([header, count, body]);
}

describe('Model3dAnalysisService', () => {
  const svc = new Model3dAnalysisService();

  it('parses binary STL bounds', async () => {
    const buf = buildBinaryStl([
      [[0, 0, 0], [10, 0, 0], [0, 5, 2]],
      [[10, 0, 0], [10, 5, 0], [0, 5, 2]],
    ]);
    const out = await svc.analyze(buf, 'model.stl');
    expect(out!.widthMm).toBe(10);
    expect(out!.depthMm).toBe(5);
    expect(out!.heightMm).toBe(2);
    expect(out!.triangleCount).toBe(2);
    expect(out!.unit).toBe('mm');
  });

  it('returns null on truncated STL', async () => {
    const buf = Buffer.alloc(50);
    expect(await svc.analyze(buf, 'broken.stl')).toBeNull();
  });
});
