/**
 * Minimal GLB (binary glTF 2.0) encoder for unlit indexed triangle meshes.
 * Supports POSITION + indices only — no normals, materials, or textures.
 *
 * Spec: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#binary-gltf-layout
 */
export interface Glb {
  positions: Float32Array; // length = 3 * vertex count
  indices: Uint32Array;    // length = 3 * triangle count
}

const GLB_MAGIC = 0x46546c67; // "glTF"
const GLB_VERSION = 2;
const CHUNK_TYPE_JSON = 0x4e4f534a; // "JSON"
const CHUNK_TYPE_BIN = 0x004e4942; // "BIN "
const COMPONENT_TYPE_FLOAT = 5126;
const COMPONENT_TYPE_UNSIGNED_INT = 5125;
const TARGET_ARRAY_BUFFER = 34962;
const TARGET_ELEMENT_ARRAY_BUFFER = 34963;
const PRIMITIVE_MODE_TRIANGLES = 4;

function pad4(buf: Buffer, fill: number): Buffer {
  const remainder = buf.length % 4;
  if (remainder === 0) return buf;
  const padLen = 4 - remainder;
  const pad = Buffer.alloc(padLen, fill);
  return Buffer.concat([buf, pad]);
}

function computeBounds(positions: Float32Array): { min: number[]; max: number[] } {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

export function encodeGlb(mesh: Glb): Buffer {
  const positionsBuf = Buffer.from(mesh.positions.buffer, mesh.positions.byteOffset, mesh.positions.byteLength);
  const indicesBuf = Buffer.from(mesh.indices.buffer, mesh.indices.byteOffset, mesh.indices.byteLength);

  // BIN chunk: positions, then indices, each 4-byte aligned.
  const positionsAligned = pad4(positionsBuf, 0);
  const indicesAligned = pad4(indicesBuf, 0);
  const binChunkData = Buffer.concat([positionsAligned, indicesAligned]);

  const positionsByteLength = mesh.positions.byteLength;
  const indicesByteLength = mesh.indices.byteLength;
  const indicesByteOffset = positionsAligned.length; // 4-aligned start

  const bounds = computeBounds(mesh.positions);

  const json = {
    asset: { version: '2.0', generator: 'grid-glb-encoder' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0 },
            indices: 1,
            mode: PRIMITIVE_MODE_TRIANGLES,
          },
        ],
      },
    ],
    buffers: [{ byteLength: binChunkData.length }],
    bufferViews: [
      {
        buffer: 0,
        byteOffset: 0,
        byteLength: positionsByteLength,
        target: TARGET_ARRAY_BUFFER,
      },
      {
        buffer: 0,
        byteOffset: indicesByteOffset,
        byteLength: indicesByteLength,
        target: TARGET_ELEMENT_ARRAY_BUFFER,
      },
    ],
    accessors: [
      {
        bufferView: 0,
        byteOffset: 0,
        componentType: COMPONENT_TYPE_FLOAT,
        count: mesh.positions.length / 3,
        type: 'VEC3',
        min: bounds.min,
        max: bounds.max,
      },
      {
        bufferView: 1,
        byteOffset: 0,
        componentType: COMPONENT_TYPE_UNSIGNED_INT,
        count: mesh.indices.length,
        type: 'SCALAR',
      },
    ],
  };

  const jsonString = JSON.stringify(json);
  const jsonBuf = Buffer.from(jsonString, 'utf8');
  const jsonAligned = pad4(jsonBuf, 0x20); // pad with spaces

  // Chunk headers: 4-byte length + 4-byte type
  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonAligned.length, 0);
  jsonChunkHeader.writeUInt32LE(CHUNK_TYPE_JSON, 4);

  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(binChunkData.length, 0);
  binChunkHeader.writeUInt32LE(CHUNK_TYPE_BIN, 4);

  // GLB header: 12 bytes (magic, version, total length)
  const totalLength =
    12 + jsonChunkHeader.length + jsonAligned.length + binChunkHeader.length + binChunkData.length;
  const glbHeader = Buffer.alloc(12);
  glbHeader.writeUInt32LE(GLB_MAGIC, 0);
  glbHeader.writeUInt32LE(GLB_VERSION, 4);
  glbHeader.writeUInt32LE(totalLength, 8);

  return Buffer.concat([
    glbHeader,
    jsonChunkHeader,
    jsonAligned,
    binChunkHeader,
    binChunkData,
  ]);
}
