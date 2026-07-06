import { Model3dAnalysisService } from './model-3d-analysis.service';

function buildBinaryStl(triangles: number[][][]): Buffer {
  const header = Buffer.alloc(80);
  const count = Buffer.alloc(4);
  count.writeUInt32LE(triangles.length, 0);
  const body = Buffer.concat(
    triangles.map((tri) => {
      const buf = Buffer.alloc(50);
      buf.writeFloatLE(0, 0);
      buf.writeFloatLE(0, 4);
      buf.writeFloatLE(1, 8);
      let off = 12;
      for (const v of tri) {
        buf.writeFloatLE(v[0], off);
        off += 4;
        buf.writeFloatLE(v[1], off);
        off += 4;
        buf.writeFloatLE(v[2], off);
        off += 4;
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
      [
        [0, 0, 0],
        [10, 0, 0],
        [0, 5, 2],
      ],
      [
        [10, 0, 0],
        [10, 5, 0],
        [0, 5, 2],
      ],
    ]);
    const out = await svc.analyze(buf, 'model.stl');
    expect(out!.widthMm).toBe(10);
    expect(out!.depthMm).toBe(5);
    expect(out!.heightMm).toBe(2);
    expect(out!.triangleCount).toBe(2);
    expect(out!.unit).toBe('mm');
  });

  it('converts ASCII STL triangles to a GLB preview', async () => {
    const stl = `
solid ascii
  facet normal 0 0 1
    outer loop
      vertex 0 0 0
      vertex 10 0 0
      vertex 0 5 2
    endloop
  endfacet
endsolid ascii
`;
    const out = await svc.analyze(Buffer.from(stl), 'ascii.stl');
    expect(out!.widthMm).toBe(10);
    expect(out!.depthMm).toBe(5);
    expect(out!.heightMm).toBe(2);
    expect(out!.triangleCount).toBe(1);
    expect(out!.glbBuffer?.subarray(0, 4).toString('utf8')).toBe('glTF');
  });

  it('returns null on truncated STL', async () => {
    const buf = Buffer.alloc(50);
    expect(await svc.analyze(buf, 'broken.stl')).toBeNull();
  });

  it('parses OBJ vertices', async () => {
    const obj = `
v 0 0 0
v 10 0 0
v 0 5 2
v 10 5 2
f 1 2 3
`;
    const out = await svc.analyze(Buffer.from(obj), 'box.obj');
    expect(out!.widthMm).toBe(10);
    expect(out!.depthMm).toBe(5);
    expect(out!.heightMm).toBe(2);
  });

  it('triangulates OBJ faces into a GLB preview', async () => {
    const obj = `
v 0 0 0
v 10 0 0
v 10 5 2
v 0 5 2
f 1 2 3 4
`;
    const out = await svc.analyze(Buffer.from(obj), 'quad.obj');
    expect(out!.triangleCount).toBe(2);
    expect(out!.glbBuffer?.subarray(0, 4).toString('utf8')).toBe('glTF');
  });

  it('parses 3MF and converts inch to mm', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const JSZip = require('jszip');
    const zip = new JSZip();
    zip.file(
      '3D/3dmodel.model',
      `<?xml version="1.0"?>
<model unit="inch" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1">
      <mesh>
        <vertices>
          <vertex x="0" y="0" z="0"/>
          <vertex x="1" y="0" z="0"/>
          <vertex x="0" y="1" z="0"/>
          <vertex x="0" y="0" z="1"/>
        </vertices>
      </mesh>
    </object>
  </resources>
</model>`,
    );
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const out = await svc.analyze(buffer, 'cube.3mf');
    expect(out!.unit).toBe('inch');
    expect(out!.widthMm).toBeCloseTo(25.4, 2);
    expect(out!.depthMm).toBeCloseTo(25.4, 2);
    expect(out!.heightMm).toBeCloseTo(25.4, 2);
  });
});
