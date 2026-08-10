import { BadRequestException, Injectable } from '@nestjs/common';
import { closeSync, fstatSync, openSync, readSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { inflateRawSync } from 'node:zlib';

import {
  catalogV110ProductPolicy,
  isActiveOrderableRfqLeaf,
} from '../products/catalog-v1-10.definition';
import { ProductCategory } from '../products/entities/product-category.entity';
import { CATALOG_MIME_ALLOWED_EXTENSIONS } from '../storage/storage.config';
import { FileMetadata } from './entities/file-metadata.entity';

const MB = 1024 * 1024;
const CONTENT_INSPECTION_BYTES = MB;
const MAX_ARCHIVE_BYTES_EXAMINED = 8 * MB;
const MAX_CENTRAL_DIRECTORY_BYTES = MB;
const MAX_ENTRY_COUNT = 64;
const MAX_ENTRY_UNCOMPRESSED_BYTES = 16 * MB;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 64 * MB;
const MAX_MODEL_XML_BYTES = 2 * MB;
const MAX_XML_BYTES = 256 * 1024;
const MAX_COMPRESSION_RATIO = 100;
const MAX_INSPECTION_MS = 500;
const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_SIGNATURE = 0x04034b50;
const BINARY_DXF_MAGIC = Buffer.from(
  'AutoCAD Binary DXF\r\n\x1a\x00',
  'binary',
);

const DANGEROUS_EXTENSIONS = new Set([
  'app',
  'bat',
  'bin',
  'cmd',
  'com',
  'cpl',
  'dll',
  'dmg',
  'exe',
  'hta',
  'jar',
  'js',
  'jse',
  'msi',
  'msp',
  'pif',
  'ps1',
  'scr',
  'sh',
  'vbe',
  'vbs',
  'wsf',
]);

type StoredCatalogFile = Pick<
  FileMetadata,
  'originalName' | 'mimeType' | 'size'
>;

type ZipEntry = {
  name: string;
  flags: number;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
};

class BoundedReader {
  readonly size: number;
  private descriptor: number | null = null;
  private examined = 0;

  constructor(private readonly file: Express.Multer.File) {
    if (Buffer.isBuffer(file.buffer)) {
      this.size = file.buffer.length;
    } else if (file.path) {
      this.descriptor = openSync(file.path, 'r');
      this.size = fstatSync(this.descriptor).size;
    } else {
      throw new BadRequestException('Uploaded file is missing content');
    }
  }

  read(offset: number, length: number): Buffer {
    if (
      !Number.isSafeInteger(offset) ||
      !Number.isSafeInteger(length) ||
      offset < 0 ||
      length < 0 ||
      offset + length > this.size ||
      this.examined + length > MAX_ARCHIVE_BYTES_EXAMINED
    ) {
      throw new BadRequestException('File content does not match its type');
    }
    this.examined += length;
    if (Buffer.isBuffer(this.file.buffer)) {
      return this.file.buffer.subarray(offset, offset + length);
    }
    const result = Buffer.alloc(length);
    const bytesRead = readSync(this.descriptor!, result, 0, length, offset);
    if (bytesRead !== length) {
      throw new BadRequestException('Uploaded file is missing content');
    }
    return result;
  }

  close(): void {
    if (this.descriptor != null) {
      closeSync(this.descriptor);
      this.descriptor = null;
    }
  }
}

@Injectable()
export class CatalogUploadPolicyService {
  validate(category: ProductCategory, file: Express.Multer.File): void {
    const extension = this.validateProperties(
      category,
      file.originalname,
      file.mimetype,
      file.size,
    );

    let reader: BoundedReader;
    try {
      reader = new BoundedReader(file);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Uploaded file is missing content');
    }
    try {
      const prefix = reader.read(0, Math.min(reader.size, 32));
      if (this.hasExecutableSignature(prefix)) {
        throw new BadRequestException('Executable uploads are not allowed');
      }
      if (!this.signatureMatches(extension, reader)) {
        throw new BadRequestException('File content does not match its type');
      }
    } finally {
      reader.close();
    }
  }

  validateMetadata(category: ProductCategory, file: StoredCatalogFile): void {
    this.validateProperties(
      category,
      file.originalName,
      file.mimeType,
      file.size,
    );
  }

  private validateProperties(
    category: ProductCategory,
    originalName: string,
    mimeType: string,
    size: number,
  ): string {
    const canonical = catalogV110ProductPolicy(category.slug);
    if (!canonical || !isActiveOrderableRfqLeaf(category)) {
      throw new BadRequestException('Active catalog product required');
    }

    const normalizedName = basename(originalName ?? '').toLowerCase();
    const nameSegments = normalizedName.split('.');
    if (
      nameSegments.slice(1).some((segment) => DANGEROUS_EXTENSIONS.has(segment))
    ) {
      throw new BadRequestException('Executable uploads are not allowed');
    }

    const extension = extname(normalizedName);
    const persistedExtensions = new Set(
      (category.allowedExtensions ?? []).map(
        (value) => `.${String(value).trim().toLowerCase().replace(/^\./, '')}`,
      ),
    );
    const canonicalExtensions = new Set(
      canonical.allowedExtensions.map((value) => `.${value}`),
    );
    const canonicalMime = String(mimeType ?? '')
      .split(';', 1)[0]
      .trim()
      .toLowerCase();
    const mimeExtensions = CATALOG_MIME_ALLOWED_EXTENSIONS[canonicalMime];
    if (
      !extension ||
      !canonicalExtensions.has(extension) ||
      !persistedExtensions.has(extension) ||
      !mimeExtensions?.includes(extension)
    ) {
      throw new BadRequestException('File type not allowed');
    }

    const configuredLimitMb = Number(category.maxFileSizeMb);
    const limitMb =
      Number.isFinite(configuredLimitMb) && configuredLimitMb > 0
        ? Math.min(configuredLimitMb, canonical.maxFileSizeMb)
        : canonical.maxFileSizeMb;
    if (!Number.isFinite(size) || size < 0 || size > limitMb * MB) {
      throw new BadRequestException(`File exceeds ${limitMb} MB limit`);
    }
    return extension;
  }

  private hasExecutableSignature(content: Buffer): boolean {
    if (content.length >= 2 && content[0] === 0x4d && content[1] === 0x5a) {
      return true;
    }
    if (
      content.length >= 4 &&
      content[0] === 0x7f &&
      content.subarray(1, 4).toString('ascii') === 'ELF'
    ) {
      return true;
    }
    if (content.subarray(0, 2).toString('ascii') === '#!') return true;
    if (content.length < 4) return false;
    return new Set([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe]).has(
      content.readUInt32BE(0),
    );
  }

  private signatureMatches(extension: string, reader: BoundedReader): boolean {
    if (reader.size === 0) return false;
    if (extension === '.3mf') return this.isValid3mf(reader);

    const content = reader.read(
      0,
      Math.min(reader.size, CONTENT_INSPECTION_BYTES),
    );
    const ascii = content.toString('latin1');
    switch (extension) {
      case '.pdf':
        return ascii.startsWith('%PDF-');
      case '.png':
        return content
          .subarray(0, 8)
          .equals(
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          );
      case '.jpg':
      case '.jpeg':
        return (
          content.length >= 3 &&
          content[0] === 0xff &&
          content[1] === 0xd8 &&
          content[2] === 0xff
        );
      case '.tif':
      case '.tiff':
        return (
          content.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2a, 0])) ||
          content.subarray(0, 4).equals(Buffer.from([0x4d, 0x4d, 0, 0x2a]))
        );
      case '.ai':
        return ascii.startsWith('%!PS-Adobe') || ascii.startsWith('%PDF-');
      case '.psd':
        return this.isValidPsd(content);
      case '.stl':
        return this.isValidStl(content, reader.size);
      case '.obj':
        return this.isValidObj(ascii);
      case '.dwg':
        return /^AC10\d{2}/.test(ascii);
      case '.dxf':
        return this.isValidDxf(content);
      default:
        return false;
    }
  }

  private isValidPsd(content: Buffer): boolean {
    if (content.length < 26 || content.subarray(0, 4).toString() !== '8BPS') {
      return false;
    }
    return (
      content.readUInt16BE(4) === 1 &&
      content.subarray(6, 12).every((byte) => byte === 0) &&
      content.readUInt16BE(12) >= 1 &&
      content.readUInt16BE(12) <= 56 &&
      content.readUInt32BE(14) >= 1 &&
      content.readUInt32BE(14) <= 300000 &&
      content.readUInt32BE(18) >= 1 &&
      content.readUInt32BE(18) <= 300000 &&
      [1, 8, 16, 32].includes(content.readUInt16BE(22)) &&
      content.readUInt16BE(24) <= 9
    );
  }

  private isValidStl(content: Buffer, size: number): boolean {
    if (size >= 84 && content.length >= 84) {
      const triangles = content.readUInt32LE(80);
      if (triangles > 0 && 84 + triangles * 50 === size) return true;
    }
    const ascii = content.toString('latin1');
    if (/^\s*solid\b/i.test(ascii)) {
      const facets = ascii.match(/^\s*facet\s+normal\s+/gim)?.length ?? 0;
      const vertices = ascii.match(/^\s*vertex\s+/gim)?.length ?? 0;
      return (
        facets > 0 &&
        vertices >= facets * 3 &&
        /^\s*endfacet\s*$/im.test(ascii) &&
        /^\s*endsolid\b/im.test(ascii)
      );
    }
    return false;
  }

  private isValidObj(ascii: string): boolean {
    const vertices = ascii.match(
      /^\s*v\s+[-+.\deE]+\s+[-+.\deE]+\s+[-+.\deE]+/gm,
    );
    const face = ascii.match(/^\s*f\s+([^\r\n]+)/gm)?.some((line) => {
      const indices = line.trim().split(/\s+/).slice(1);
      return (
        indices.length >= 3 &&
        indices.every((part) => /^-?\d+(?:\/[^\s]*)?$/.test(part))
      );
    });
    return (vertices?.length ?? 0) >= 3 && face === true;
  }

  private isValidDxf(content: Buffer): boolean {
    if (content.subarray(0, BINARY_DXF_MAGIC.length).equals(BINARY_DXF_MAGIC)) {
      return true;
    }
    const lines = content
      .toString('latin1')
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.trim());
    const pairs: Array<[string, string]> = [];
    for (let index = 0; index + 1 < lines.length; index += 2) {
      if (!/^-?\d+$/.test(lines[index])) return false;
      pairs.push([lines[index], lines[index + 1]]);
    }
    return (
      pairs[0]?.[0] === '0' &&
      pairs[0]?.[1].toUpperCase() === 'SECTION' &&
      pairs.some(
        ([code, value]) => code === '0' && value.toUpperCase() === 'ENDSEC',
      ) &&
      pairs.at(-1)?.[0] === '0' &&
      pairs.at(-1)?.[1].toUpperCase() === 'EOF'
    );
  }

  private isValid3mf(reader: BoundedReader): boolean {
    try {
      const started = Date.now();
      const entries = this.readZipDirectory(reader);
      const contentTypes = this.readZipEntry(
        reader,
        entries.get('[Content_Types].xml'),
        MAX_XML_BYTES,
      ).toString('utf8');
      const relationships = this.readZipEntry(
        reader,
        entries.get('_rels/.rels'),
        MAX_XML_BYTES,
      ).toString('utf8');
      if (
        !/<Types\b/i.test(contentTypes) ||
        !/3dmanufacturing-3dmodel\+xml/i.test(contentTypes) ||
        !/<Relationships\b/i.test(relationships)
      ) {
        return false;
      }
      const relationship = relationships
        .match(/<Relationship\b[^>]*>/gi)
        ?.find((tag) => /Type=["'][^"']*\/3dmodel["']/i.test(tag));
      const target = relationship?.match(/Target=["']([^"']+)["']/i)?.[1];
      if (!target) return false;
      const modelName = target.replace(/^\//, '');
      if (!this.isSafeZipName(modelName)) return false;
      const model = this.readZipEntry(
        reader,
        entries.get(modelName),
        MAX_MODEL_XML_BYTES,
      ).toString('utf8');
      if (Date.now() - started > MAX_INSPECTION_MS) return false;
      return (
        /<model\b[^>]*xmlns=["'][^"']*3dmanufacturing\/core\//i.test(model) &&
        /<resources\b/i.test(model) &&
        /<object\b/i.test(model) &&
        /<mesh\b/i.test(model) &&
        (model.match(/<vertex\b/gi)?.length ?? 0) >= 3 &&
        /<triangle\b/i.test(model) &&
        /<build\b/i.test(model) &&
        /<item\b/i.test(model)
      );
    } catch {
      return false;
    }
  }

  private readZipDirectory(reader: BoundedReader): Map<string, ZipEntry> {
    const tailLength = Math.min(reader.size, 65_557);
    const tail = reader.read(reader.size - tailLength, tailLength);
    let eocd = -1;
    for (let index = tail.length - 22; index >= 0; index -= 1) {
      if (tail.readUInt32LE(index) === ZIP_EOCD_SIGNATURE) {
        eocd = index;
        break;
      }
    }
    if (eocd < 0 || eocd + 22 > tail.length) throw new Error('Invalid ZIP');
    const entryCount = tail.readUInt16LE(eocd + 10);
    const centralSize = tail.readUInt32LE(eocd + 12);
    const centralOffset = tail.readUInt32LE(eocd + 16);
    if (
      tail.readUInt16LE(eocd + 4) !== 0 ||
      tail.readUInt16LE(eocd + 6) !== 0 ||
      tail.readUInt16LE(eocd + 8) !== entryCount ||
      entryCount < 1 ||
      entryCount > MAX_ENTRY_COUNT ||
      centralSize > MAX_CENTRAL_DIRECTORY_BYTES ||
      centralOffset + centralSize > reader.size
    ) {
      throw new Error('Unsafe ZIP');
    }
    const central = reader.read(centralOffset, centralSize);
    const entries = new Map<string, ZipEntry>();
    let cursor = 0;
    let totalUncompressed = 0;
    for (let index = 0; index < entryCount; index += 1) {
      if (
        cursor + 46 > central.length ||
        central.readUInt32LE(cursor) !== ZIP_CENTRAL_SIGNATURE
      ) {
        throw new Error('Invalid central directory');
      }
      const flags = central.readUInt16LE(cursor + 8);
      const method = central.readUInt16LE(cursor + 10);
      const compressedSize = central.readUInt32LE(cursor + 20);
      const uncompressedSize = central.readUInt32LE(cursor + 24);
      const nameLength = central.readUInt16LE(cursor + 28);
      const extraLength = central.readUInt16LE(cursor + 30);
      const commentLength = central.readUInt16LE(cursor + 32);
      const localOffset = central.readUInt32LE(cursor + 42);
      const end = cursor + 46 + nameLength + extraLength + commentLength;
      if (end > central.length) throw new Error('Invalid central directory');
      const name = central
        .subarray(cursor + 46, cursor + 46 + nameLength)
        .toString('utf8');
      totalUncompressed += uncompressedSize;
      const ratio =
        compressedSize === 0 ? Infinity : uncompressedSize / compressedSize;
      if (
        (flags & 1) !== 0 ||
        ![0, 8].includes(method) ||
        !this.isSafeZipName(name) ||
        entries.has(name) ||
        uncompressedSize > MAX_ENTRY_UNCOMPRESSED_BYTES ||
        totalUncompressed > MAX_TOTAL_UNCOMPRESSED_BYTES ||
        (uncompressedSize > 64 * 1024 && ratio > MAX_COMPRESSION_RATIO)
      ) {
        throw new Error('Unsafe ZIP entry');
      }
      entries.set(name, {
        name,
        flags,
        method,
        compressedSize,
        uncompressedSize,
        localOffset,
      });
      cursor = end;
    }
    if (cursor !== central.length) throw new Error('Invalid central directory');
    return entries;
  }

  private readZipEntry(
    reader: BoundedReader,
    entry: ZipEntry | undefined,
    outputLimit: number,
  ): Buffer {
    if (!entry || entry.uncompressedSize > outputLimit)
      throw new Error('Missing ZIP entry');
    const header = reader.read(entry.localOffset, 30);
    if (
      header.readUInt32LE(0) !== ZIP_LOCAL_SIGNATURE ||
      (header.readUInt16LE(6) & 1) !== 0 ||
      header.readUInt16LE(8) !== entry.method
    ) {
      throw new Error('Invalid ZIP entry');
    }
    const nameLength = header.readUInt16LE(26);
    const extraLength = header.readUInt16LE(28);
    if (nameLength + extraLength > 65_535) throw new Error('Unsafe ZIP entry');
    const name = reader
      .read(entry.localOffset + 30, nameLength)
      .toString('utf8');
    if (name !== entry.name) throw new Error('Invalid ZIP entry');
    const compressed = reader.read(
      entry.localOffset + 30 + nameLength + extraLength,
      entry.compressedSize,
    );
    const result =
      entry.method === 0
        ? compressed
        : inflateRawSync(compressed, { maxOutputLength: outputLimit + 1 });
    if (
      result.length !== entry.uncompressedSize ||
      result.length > outputLimit
    ) {
      throw new Error('Invalid ZIP entry');
    }
    return result;
  }

  private isSafeZipName(name: string): boolean {
    if (
      !name ||
      name.includes('\\') ||
      name.includes('\0') ||
      name.startsWith('/')
    )
      return false;
    if (/^[A-Za-z]:/.test(name)) return false;
    return name
      .split('/')
      .every((segment) => segment !== '..' && segment !== '.');
  }
}
