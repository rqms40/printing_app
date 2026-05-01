import { encodeGlb } from './glb-encoder';

describe('GLB encoder', () => {
  it('emits a valid GLB header for a single triangle', () => {
    const out = encodeGlb({
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      indices: new Uint32Array([0, 1, 2]),
    });
    expect(out.readUInt32LE(0)).toBe(0x46546c67);
    expect(out.readUInt32LE(4)).toBe(2);
    expect(out.readUInt32LE(8)).toBe(out.length);
  });
});
