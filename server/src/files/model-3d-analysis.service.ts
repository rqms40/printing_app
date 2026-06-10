import { Injectable, Logger } from '@nestjs/common';
import { extname } from 'path';
import JSZip from 'jszip';
import { encodeGlb } from './glb-encoder';

export interface Model3dBounds {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  triangleCount: number | null;
  unit: 'mm' | 'inch' | 'unknown';
  glbBuffer?: Buffer; // only set for formats we converted to GLB
}

const UNIT_TO_MM: Record<string, number> = {
  millimeter: 1,
  micrometer: 0.001,
  inch: 25.4,
  foot: 304.8,
  meter: 1000,
};

@Injectable()
export class Model3dAnalysisService {
  private readonly logger = new Logger(Model3dAnalysisService.name);

  async analyze(
    buffer: Buffer,
    filename: string,
  ): Promise<Model3dBounds | null> {
    const ext = extname(filename).toLowerCase();
    try {
      if (ext === '.stl') return this.analyzeStl(buffer);
      if (ext === '.obj') return this.analyzeObj(buffer);
      if (ext === '.3mf') return await this.analyze3mf(buffer);
      return null;
    } catch (err) {
      this.logger.warn(`3D parse failed for ${filename}: ${err}`);
      return null;
    }
  }

  private analyzeStl(buffer: Buffer): Model3dBounds | null {
    if (buffer.length < 84) return null;
    const triangleCount = buffer.readUInt32LE(80);
    const expectedSize = 84 + triangleCount * 50;
    if (buffer.length < expectedSize) {
      return this.analyzeStlAscii(buffer);
    }

    // Pre-allocate flat position + index arrays so we can hand them straight
    // to the GLB encoder. Each STL triangle stores its own 3 vertices (no
    // shared indices), so we just emit sequential indices [0,1,2,3,...].
    const vertexFloatCount = triangleCount * 9; // 3 vertices × 3 floats
    const positions = new Float32Array(vertexFloatCount);
    const indices = new Uint32Array(triangleCount * 3);

    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;
    let posIdx = 0;
    let idxIdx = 0;
    let baseIndex = 0;

    for (let i = 0; i < triangleCount; i++) {
      const base = 84 + i * 50 + 12;
      for (let v = 0; v < 3; v++) {
        const x = buffer.readFloatLE(base + v * 12);
        const y = buffer.readFloatLE(base + v * 12 + 4);
        const z = buffer.readFloatLE(base + v * 12 + 8);
        positions[posIdx++] = x;
        positions[posIdx++] = y;
        positions[posIdx++] = z;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
      }
      indices[idxIdx++] = baseIndex++;
      indices[idxIdx++] = baseIndex++;
      indices[idxIdx++] = baseIndex++;
    }

    if (!isFinite(minX)) return null;

    let glbBuffer: Buffer | undefined;
    try {
      glbBuffer = encodeGlb({ positions, indices });
    } catch (err) {
      this.logger.warn(`STL → GLB encode failed: ${err}`);
    }

    return {
      widthMm: maxX - minX,
      depthMm: maxY - minY,
      heightMm: maxZ - minZ,
      triangleCount,
      unit: 'mm',
      glbBuffer,
    };
  }

  private analyzeStlAscii(buffer: Buffer): Model3dBounds | null {
    const text = buffer.toString('utf8');
    const re =
      /vertex\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g;
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;
    let count = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const x = parseFloat(m[1]);
      const y = parseFloat(m[2]);
      const z = parseFloat(m[3]);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
      count++;
    }
    if (!isFinite(minX)) return null;
    return {
      widthMm: maxX - minX,
      depthMm: maxY - minY,
      heightMm: maxZ - minZ,
      triangleCount: Math.floor(count / 3),
      unit: 'mm',
    };
  }

  private analyzeObj(buffer: Buffer): Model3dBounds | null {
    const text = buffer.toString('utf8');
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;
    for (const line of text.split('\n')) {
      if (!line.startsWith('v ')) continue;
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4) continue;
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      const z = parseFloat(parts[3]);
      if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
    if (!isFinite(minX)) return null;
    return {
      widthMm: maxX - minX,
      depthMm: maxY - minY,
      heightMm: maxZ - minZ,
      triangleCount: null,
      unit: 'mm',
    };
  }

  private async analyze3mf(buffer: Buffer): Promise<Model3dBounds | null> {
    const zip = await new JSZip().loadAsync(buffer);
    const matches = zip.file(/3D\/3dmodel\.model$/i);
    const entry = matches[0];
    if (!entry) return null;
    const xml = await entry.async('string');
    const unitMatch = xml.match(/<model[^>]*\sunit="([^"]+)"/i);
    const unitName = (unitMatch?.[1] ?? 'millimeter').toLowerCase();
    const scale = UNIT_TO_MM[unitName] ?? 1;

    // Vertices: parse in order — index = position in array
    const vertexRe =
      /<vertex\s+x="(-?\d+(?:\.\d+)?)"\s+y="(-?\d+(?:\.\d+)?)"\s+z="(-?\d+(?:\.\d+)?)"/g;
    const positions: number[] = [];
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;
    let m: RegExpExecArray | null;
    while ((m = vertexRe.exec(xml)) !== null) {
      const x = parseFloat(m[1]) * scale;
      const y = parseFloat(m[2]) * scale;
      const z = parseFloat(m[3]) * scale;
      positions.push(x, y, z);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
    if (!isFinite(minX) || positions.length === 0) return null;

    // Triangles: parse v1/v2/v3 indices into the vertex array
    const triRe = /<triangle\s+v1="(\d+)"\s+v2="(\d+)"\s+v3="(\d+)"/g;
    const indices: number[] = [];
    let t: RegExpExecArray | null;
    while ((t = triRe.exec(xml)) !== null) {
      indices.push(Number(t[1]), Number(t[2]), Number(t[3]));
    }

    const inferredUnit: Model3dBounds['unit'] =
      unitName === 'inch'
        ? 'inch'
        : unitName === 'millimeter'
          ? 'mm'
          : 'unknown';

    // Build GLB if we have triangles
    let glbBuffer: Buffer | undefined;
    if (indices.length > 0) {
      try {
        glbBuffer = encodeGlb({
          positions: new Float32Array(positions),
          indices: new Uint32Array(indices),
        });
      } catch (err) {
        this.logger.warn(`GLB encode failed: ${err}`);
      }
    }

    return {
      widthMm: maxX - minX,
      depthMm: maxY - minY,
      heightMm: maxZ - minZ,
      triangleCount: indices.length / 3,
      unit: inferredUnit,
      glbBuffer,
    };
  }
}
