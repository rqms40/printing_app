import { Injectable, Logger } from '@nestjs/common';
import { extname } from 'path';

export interface Model3dBounds {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  triangleCount: number | null;
  unit: 'mm' | 'inch' | 'unknown';
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
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < triangleCount; i++) {
      const base = 84 + i * 50 + 12;
      for (let v = 0; v < 3; v++) {
        const x = buffer.readFloatLE(base + v * 12);
        const y = buffer.readFloatLE(base + v * 12 + 4);
        const z = buffer.readFloatLE(base + v * 12 + 8);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
      }
    }
    if (!isFinite(minX)) return null;
    return {
      widthMm: maxX - minX,
      depthMm: maxY - minY,
      heightMm: maxZ - minZ,
      triangleCount,
      unit: 'mm',
    };
  }

  private analyzeStlAscii(buffer: Buffer): Model3dBounds | null {
    const text = buffer.toString('utf8');
    const re = /vertex\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
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
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
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
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);
    const matches = zip.file(/3D\/3dmodel\.model$/i);
    const entry = matches[0];
    if (!entry) return null;
    const xml = await entry.async('string');
    const unitMatch = xml.match(/<model[^>]*\sunit="([^"]+)"/i);
    const unitName = (unitMatch?.[1] ?? 'millimeter').toLowerCase();
    const scale = UNIT_TO_MM[unitName] ?? 1;
    const re = /<vertex\s+x="(-?\d+(?:\.\d+)?)"\s+y="(-?\d+(?:\.\d+)?)"\s+z="(-?\d+(?:\.\d+)?)"/g;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) {
      const x = parseFloat(m[1]);
      const y = parseFloat(m[2]);
      const z = parseFloat(m[3]);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
    if (!isFinite(minX)) return null;
    const inferredUnit: Model3dBounds['unit'] =
      unitName === 'inch' ? 'inch' : unitName === 'millimeter' ? 'mm' : 'unknown';
    return {
      widthMm: (maxX - minX) * scale,
      depthMm: (maxY - minY) * scale,
      heightMm: (maxZ - minZ) * scale,
      triangleCount: null,
      unit: inferredUnit,
    };
  }
}
