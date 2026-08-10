import { BadRequestException, Injectable } from '@nestjs/common';
import { closeSync, fstatSync, openSync, readSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

import {
  catalogV110ProductPolicy,
  isActiveOrderableRfqLeaf,
} from '../products/catalog-v1-10.definition';
import { ProductCategory } from '../products/entities/product-category.entity';
import { CATALOG_MIME_ALLOWED_EXTENSIONS } from '../storage/storage.config';
import { FileMetadata } from './entities/file-metadata.entity';

const MB = 1024 * 1024;
const CONTENT_INSPECTION_BYTES = MB;
const MAX_CENTRAL_DIRECTORY_BYTES = MB;
const MAX_ENTRY_COUNT = 64;
const MAX_ENTRY_UNCOMPRESSED_BYTES = 16 * MB;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 64 * MB;
const MAX_MODEL_XML_BYTES = 2 * MB;
const MAX_XML_BYTES = 256 * 1024;
const MAX_COMPRESSION_RATIO = 100;
const MAX_INSPECTION_MS = 5_000;
const MAX_TEXT_INSPECTION_MS = 5_000;
const TEXT_SCAN_CHUNK_BYTES = 64 * 1024;
const MAX_TEXT_LINE_BYTES = 16 * 1024;
const MAX_TEXT_LINES = 5_000_000;
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
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
  centralOffset: number;
};

type XmlRecord = Record<string, unknown>;
type OpcContentTypes = {
  defaults: Map<string, string>;
  overrides: Map<string, string>;
};

class BoundedReader {
  readonly size: number;
  private descriptor: number | null = null;

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
      offset + length > this.size
    ) {
      throw new BadRequestException('File content does not match its type');
    }
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

  scanLines(visitor: (line: string) => boolean): boolean {
    const started = Date.now();
    let carry = '';
    let offset = 0;
    let lineCount = 0;
    while (offset < this.size) {
      if (Date.now() - started > MAX_TEXT_INSPECTION_MS) return false;
      const length = Math.min(TEXT_SCAN_CHUNK_BYTES, this.size - offset);
      let chunk: Buffer;
      if (Buffer.isBuffer(this.file.buffer)) {
        chunk = this.file.buffer.subarray(offset, offset + length);
      } else {
        chunk = Buffer.allocUnsafe(length);
        if (readSync(this.descriptor!, chunk, 0, length, offset) !== length) {
          return false;
        }
      }
      offset += length;
      const text = carry + chunk.toString('latin1');
      const lines = text.split('\n');
      carry = lines.pop() ?? '';
      if (carry.length > MAX_TEXT_LINE_BYTES) return false;
      for (const rawLine of lines) {
        if (
          ++lineCount > MAX_TEXT_LINES ||
          rawLine.length > MAX_TEXT_LINE_BYTES
        ) {
          return false;
        }
        const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
        if (!visitor(line)) return false;
      }
    }
    if (carry.length > 0) {
      if (++lineCount > MAX_TEXT_LINES || carry.length > MAX_TEXT_LINE_BYTES) {
        return false;
      }
      if (!visitor(carry.endsWith('\r') ? carry.slice(0, -1) : carry)) {
        return false;
      }
    }
    return Date.now() - started <= MAX_TEXT_INSPECTION_MS;
  }

  readHeadAndTail(windowBytes = CONTENT_INSPECTION_BYTES): {
    head: Buffer;
    tail: Buffer;
  } {
    const headLength = Math.min(this.size, windowBytes);
    const head = this.read(0, headLength);
    if (this.size <= headLength) return { head, tail: Buffer.alloc(0) };
    const tailLength = Math.min(this.size - headLength, windowBytes);
    return {
      head,
      tail: this.read(this.size - tailLength, tailLength),
    };
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
    if (extension === '.stl') return this.isValidStl(reader);
    if (extension === '.obj') return this.isValidObj(reader);

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
      case '.dwg':
        return /^AC10\d{2}/.test(ascii);
      case '.dxf':
        return this.isValidDxf(reader, content);
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

  private isValidStl(reader: BoundedReader): boolean {
    if (reader.size >= 84) {
      const header = reader.read(0, 84);
      const triangles = header.readUInt32LE(80);
      if (triangles > 0 && 84 + triangles * 50 === reader.size) return true;
    }
    let state:
      | 'start'
      | 'solid'
      | 'outer_loop'
      | 'vertices'
      | 'endloop'
      | 'endfacet'
      | 'ended' = 'start';
    let vertexCount = 0;
    let facetCount = 0;
    let ended = false;
    const valid = reader.scanLines((rawLine) => {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) return true;
      const tokens = line.split(/\s+/);
      const keyword = tokens[0].toLowerCase();
      if (state === 'start') {
        if (keyword !== 'solid') return false;
        state = 'solid';
        return true;
      }
      if (state === 'ended') return false;
      if (state === 'solid') {
        if (keyword === 'endsolid') {
          if (facetCount < 1) return false;
          state = 'ended';
          ended = true;
          return true;
        }
        if (
          tokens.length !== 5 ||
          keyword !== 'facet' ||
          tokens[1].toLowerCase() !== 'normal' ||
          !tokens.slice(2).every((value) => this.isFiniteNumber(value))
        ) {
          return false;
        }
        state = 'outer_loop';
        return true;
      }
      if (state === 'outer_loop') {
        if (tokens.length !== 2 || line.toLowerCase() !== 'outer loop') {
          return false;
        }
        vertexCount = 0;
        state = 'vertices';
        return true;
      }
      if (state === 'vertices') {
        if (
          tokens.length !== 4 ||
          keyword !== 'vertex' ||
          !tokens.slice(1).every((value) => this.isFiniteNumber(value))
        ) {
          return false;
        }
        vertexCount += 1;
        if (vertexCount === 3) state = 'endloop';
        return true;
      }
      if (state === 'endloop') {
        if (tokens.length !== 1 || keyword !== 'endloop') return false;
        state = 'endfacet';
        return true;
      }
      if (tokens.length !== 1 || keyword !== 'endfacet') return false;
      facetCount += 1;
      state = 'solid';
      return true;
    });
    return valid && ended && facetCount > 0;
  }

  private isValidObj(reader: BoundedReader): boolean {
    let vertices = 0;
    let textureVertices = 0;
    let normals = 0;
    let faces = 0;
    const maxPositive = { vertex: 0, texture: 0, normal: 0 };
    const inertKeywords = new Set([
      'o',
      'g',
      's',
      'usemtl',
      'mtllib',
      'l',
      'p',
      'vp',
      'cstype',
      'deg',
      'bmat',
      'step',
      'curv',
      'curv2',
      'surf',
      'parm',
      'trim',
      'hole',
      'scrv',
      'sp',
      'end',
      'con',
      'bevel',
      'c_interp',
      'd_interp',
      'lod',
      'shadow_obj',
      'trace_obj',
      'ctech',
      'stech',
    ]);
    const valid = reader.scanLines((rawLine) => {
      const line = rawLine.split('#', 1)[0].trim();
      if (!line) return true;
      const tokens = line.split(/\s+/);
      const keyword = tokens.shift()!.toLowerCase();
      if (keyword === 'v') {
        if (
          ![3, 4].includes(tokens.length) ||
          !tokens.every((value) => this.isFiniteNumber(value))
        ) {
          return false;
        }
        vertices += 1;
        return vertices <= MAX_TEXT_LINES;
      }
      if (keyword === 'vt') {
        if (
          tokens.length < 1 ||
          tokens.length > 3 ||
          !tokens.every((value) => this.isFiniteNumber(value))
        ) {
          return false;
        }
        textureVertices += 1;
        return true;
      }
      if (keyword === 'vn') {
        if (
          tokens.length !== 3 ||
          !tokens.every((value) => this.isFiniteNumber(value))
        ) {
          return false;
        }
        normals += 1;
        return true;
      }
      if (keyword === 'f') {
        if (tokens.length < 3) return false;
        for (const token of tokens) {
          const parts = token.split('/');
          if (parts.length > 3 || !parts[0]) return false;
          if (
            !this.validateObjIndex(parts[0], vertices, maxPositive, 'vertex') ||
            (parts[1] !== undefined &&
              parts[1] !== '' &&
              !this.validateObjIndex(
                parts[1],
                textureVertices,
                maxPositive,
                'texture',
              )) ||
            (parts[2] !== undefined &&
              parts[2] !== '' &&
              !this.validateObjIndex(parts[2], normals, maxPositive, 'normal'))
          ) {
            return false;
          }
        }
        faces += 1;
        return true;
      }
      return inertKeywords.has(keyword);
    });
    return (
      valid &&
      vertices >= 3 &&
      faces > 0 &&
      maxPositive.vertex <= vertices &&
      maxPositive.texture <= textureVertices &&
      maxPositive.normal <= normals
    );
  }

  private validateObjIndex(
    value: string,
    definedCount: number,
    maxima: { vertex: number; texture: number; normal: number },
    kind: 'vertex' | 'texture' | 'normal',
  ): boolean {
    if (!/^[+-]?\d+$/.test(value)) return false;
    const index = Number(value);
    if (!Number.isSafeInteger(index) || index === 0) return false;
    if (index < 0) return definedCount + index + 1 >= 1;
    maxima[kind] = Math.max(maxima[kind], index);
    return true;
  }

  private isValidDxf(reader: BoundedReader, content: Buffer): boolean {
    if (content.subarray(0, BINARY_DXF_MAGIC.length).equals(BINARY_DXF_MAGIC)) {
      return true;
    }
    let pendingCode: number | null = null;
    let inSection = false;
    let sawSection = false;
    let sawEndSection = false;
    let sawEof = false;
    const valid = reader.scanLines((rawLine) => {
      const line = rawLine.trim();
      if (pendingCode === null) {
        if (sawEof || !/^\d{1,4}$/.test(line)) return false;
        const code = Number(line);
        if (!Number.isInteger(code) || code < 0 || code > 1071) return false;
        pendingCode = code;
        return true;
      }
      const code = pendingCode;
      pendingCode = null;
      if (this.isDxfNumericCode(code) && !this.isFiniteNumber(line)) {
        return false;
      }
      if (code !== 0) return true;
      const marker = line.toUpperCase();
      if (marker === 'SECTION') {
        if (inSection || sawEof) return false;
        inSection = true;
        sawSection = true;
      } else if (marker === 'ENDSEC') {
        if (!inSection) return false;
        inSection = false;
        sawEndSection = true;
      } else if (marker === 'EOF') {
        if (inSection || !sawSection || !sawEndSection) return false;
        sawEof = true;
      }
      return true;
    });
    return valid && pendingCode === null && !inSection && sawEof;
  }

  private isDxfNumericCode(code: number): boolean {
    return (
      (code >= 10 && code <= 59) ||
      (code >= 60 && code <= 99) ||
      (code >= 110 && code <= 149) ||
      (code >= 160 && code <= 179) ||
      (code >= 210 && code <= 239) ||
      (code >= 270 && code <= 289) ||
      (code >= 370 && code <= 389) ||
      (code >= 400 && code <= 409) ||
      (code >= 420 && code <= 469) ||
      (code >= 1010 && code <= 1071)
    );
  }

  private isFiniteNumber(value: string): boolean {
    return (
      /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) &&
      Number.isFinite(Number(value))
    );
  }

  private isValid3mf(reader: BoundedReader): boolean {
    try {
      const started = Date.now();
      const entries = this.readZipDirectory(reader);
      const contentTypesXml = this.readZipEntry(
        reader,
        entries.get('[Content_Types].xml'),
        MAX_XML_BYTES,
      ).toString('utf8');
      const relationshipsXml = this.readZipEntry(
        reader,
        entries.get('_rels/.rels'),
        MAX_XML_BYTES,
      ).toString('utf8');
      const contentTypeRoot = this.xmlRoot(contentTypesXml, 'Types');
      const contentTypes = this.opcContentTypes(contentTypeRoot);
      if (!contentTypes) return false;
      const modelContentType =
        'application/vnd.ms-package.3dmanufacturing-3dmodel+xml';
      const relationshipRoot = this.xmlRoot(relationshipsXml, 'Relationships');
      if (
        relationshipRoot['@_xmlns'] !==
        'http://schemas.openxmlformats.org/package/2006/relationships'
      ) {
        return false;
      }
      const relationship = this.xmlArray(relationshipRoot.Relationship).find(
        (entry) => {
          const record = this.xmlRecord(entry);
          return (
            typeof record?.['@_Id'] === 'string' &&
            record['@_Id'].trim().length > 0 &&
            (record['@_TargetMode'] === undefined ||
              record['@_TargetMode'] === 'Internal') &&
            record?.['@_Type'] ===
              'http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel'
          );
        },
      );
      const target = this.xmlRecord(relationship)?.['@_Target'];
      if (typeof target !== 'string') return false;
      const modelName = this.normalizeOpcPartUri(target, true);
      if (
        !modelName ||
        this.contentTypeForPart(contentTypes, modelName) !== modelContentType
      ) {
        return false;
      }
      let modelXml: string | null = null;
      for (const entry of entries.values()) {
        if (Date.now() - started > MAX_INSPECTION_MS) return false;
        const limit =
          entry.name === modelName
            ? MAX_MODEL_XML_BYTES
            : entry.name === '[Content_Types].xml' ||
                entry.name.endsWith('.rels') ||
                entry.name.endsWith('.xml')
              ? MAX_XML_BYTES
              : MAX_ENTRY_UNCOMPRESSED_BYTES;
        const content = this.readZipEntry(reader, entry, limit);
        if (!this.isAllowed3mfPart(entry, content, contentTypes, modelName)) {
          return false;
        }
        if (entry.name === modelName) modelXml = content.toString('utf8');
      }
      if (modelXml === null) return false;
      if (Date.now() - started > MAX_INSPECTION_MS) return false;
      const modelRoot = this.xmlRoot(modelXml, 'model');
      if (
        modelRoot['@_xmlns'] !==
        'http://schemas.microsoft.com/3dmanufacturing/core/2015/02'
      ) {
        return false;
      }
      const resources = this.xmlRecord(modelRoot.resources);
      const build = this.xmlRecord(modelRoot.build);
      if (!resources || !build || this.xmlArray(build.item).length < 1) {
        return false;
      }
      const objectIds = new Set<number>();
      const meshObjectIds = new Set<number>();
      for (const object of this.xmlArray(resources.object)) {
        const objectRecord = this.xmlRecord(object);
        const objectId = this.strictNonNegativeInteger(objectRecord?.['@_id']);
        if (objectId === null || objectId < 1 || objectIds.has(objectId)) {
          return false;
        }
        objectIds.add(objectId);
        const mesh = this.xmlRecord(this.xmlRecord(object)?.mesh);
        const vertices = this.xmlRecord(mesh?.vertices);
        const triangles = this.xmlRecord(mesh?.triangles);
        if (!mesh) continue;
        const vertexRecords = this.xmlArray(vertices?.vertex);
        const triangleRecords = this.xmlArray(triangles?.triangle);
        if (vertexRecords.length < 3 || triangleRecords.length < 1)
          return false;
        if (
          !vertexRecords.every((vertex) => {
            const record = this.xmlRecord(vertex);
            return ['@_x', '@_y', '@_z'].every(
              (attribute) =>
                typeof record?.[attribute] === 'string' &&
                this.isFiniteNumber(record[attribute]),
            );
          }) ||
          !triangleRecords.every((triangle) => {
            const record = this.xmlRecord(triangle);
            return ['@_v1', '@_v2', '@_v3'].every((attribute) => {
              const index = this.strictNonNegativeInteger(record?.[attribute]);
              return index !== null && index < vertexRecords.length;
            });
          })
        ) {
          return false;
        }
        meshObjectIds.add(objectId);
      }
      const buildItems = this.xmlArray(build.item);
      return (
        buildItems.length > 0 &&
        buildItems.every((item) => {
          const objectId = this.strictNonNegativeInteger(
            this.xmlRecord(item)?.['@_objectid'],
          );
          return objectId !== null && meshObjectIds.has(objectId);
        })
      );
    } catch {
      return false;
    }
  }

  private opcContentTypes(root: XmlRecord): OpcContentTypes | null {
    if (
      root['@_xmlns'] !==
      'http://schemas.openxmlformats.org/package/2006/content-types'
    ) {
      return null;
    }
    const defaults = new Map<string, string>();
    const overrides = new Map<string, string>();
    for (const entry of this.xmlArray(root.Default)) {
      const record = this.xmlRecord(entry);
      const extension = record?.['@_Extension'];
      const contentType = record?.['@_ContentType'];
      if (
        typeof extension !== 'string' ||
        !/^[A-Za-z0-9]+$/.test(extension) ||
        typeof contentType !== 'string' ||
        defaults.has(extension.toLowerCase())
      ) {
        return null;
      }
      defaults.set(extension.toLowerCase(), contentType);
    }
    for (const entry of this.xmlArray(root.Override)) {
      const record = this.xmlRecord(entry);
      const partName = record?.['@_PartName'];
      const contentType = record?.['@_ContentType'];
      if (typeof partName !== 'string' || typeof contentType !== 'string') {
        return null;
      }
      const normalized = this.normalizeOpcPartUri(partName, true);
      if (
        !normalized ||
        partName !== `/${normalized}` ||
        overrides.has(normalized)
      ) {
        return null;
      }
      overrides.set(normalized, contentType);
    }
    return { defaults, overrides };
  }

  private contentTypeForPart(
    contentTypes: OpcContentTypes,
    name: string,
  ): string | null {
    const override = contentTypes.overrides.get(name);
    if (override) return override;
    const basename = name.slice(name.lastIndexOf('/') + 1);
    const extension = basename
      .slice(basename.lastIndexOf('.') + 1)
      .toLowerCase();
    return contentTypes.defaults.get(extension) ?? null;
  }

  private isAllowed3mfPart(
    entry: ZipEntry,
    content: Buffer,
    contentTypes: OpcContentTypes,
    modelName: string,
  ): boolean {
    // v1.10 accepts only the core OPC/model parts plus XML metadata and
    // signature-checked PNG/JPEG thumbnails with matching content types.
    // Executable/native/nested-archive and undeclared extensions are rejected.
    if (entry.name.endsWith('/')) {
      return entry.compressedSize === 0 && entry.uncompressedSize === 0;
    }
    if (this.normalizeOpcPartUri(entry.name, false) !== entry.name)
      return false;
    if (this.hasExecutableSignature(content)) return false;
    if (content.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
      return false;
    }
    if (entry.name === '[Content_Types].xml') {
      return this.isSafeXml(content.toString('utf8'));
    }
    const contentType = this.contentTypeForPart(contentTypes, entry.name);
    if (!contentType) return false;
    if (entry.name === modelName) {
      return (
        contentType ===
          'application/vnd.ms-package.3dmanufacturing-3dmodel+xml' &&
        this.isSafeXml(content.toString('utf8'))
      );
    }
    if (entry.name.endsWith('.rels')) {
      return (
        contentType ===
          'application/vnd.openxmlformats-package.relationships+xml' &&
        this.isSafeRelationshipsXml(content.toString('utf8'))
      );
    }
    if (entry.name.endsWith('.xml')) {
      return (
        ['application/xml', 'text/xml'].includes(contentType) &&
        this.isSafeXml(content.toString('utf8'))
      );
    }
    if (entry.name.endsWith('.png')) {
      return (
        contentType === 'image/png' &&
        content
          .subarray(0, 8)
          .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      );
    }
    if (/\.jpe?g$/i.test(entry.name)) {
      return (
        contentType === 'image/jpeg' &&
        content.length >= 3 &&
        content[0] === 0xff &&
        content[1] === 0xd8 &&
        content[2] === 0xff
      );
    }
    return false;
  }

  private isSafeRelationshipsXml(xml: string): boolean {
    try {
      const root = this.xmlRoot(xml, 'Relationships');
      if (
        root['@_xmlns'] !==
        'http://schemas.openxmlformats.org/package/2006/relationships'
      ) {
        return false;
      }
      return this.xmlArray(root.Relationship).every((entry) => {
        const record = this.xmlRecord(entry);
        const target = record?.['@_Target'];
        return (
          typeof record?.['@_Id'] === 'string' &&
          record['@_Id'].trim().length > 0 &&
          typeof record['@_Type'] === 'string' &&
          typeof target === 'string' &&
          (record['@_TargetMode'] === undefined ||
            record['@_TargetMode'] === 'Internal') &&
          this.normalizeOpcPartUri(target, target.startsWith('/')) !== null
        );
      });
    } catch {
      return false;
    }
  }

  private isSafeXml(xml: string): boolean {
    return (
      !/<!DOCTYPE\b|<!ENTITY\b/i.test(xml) &&
      XMLValidator.validate(xml) === true
    );
  }

  private strictNonNegativeInteger(value: unknown): number | null {
    if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }

  private normalizeOpcPartUri(
    value: string,
    allowLeadingSlash: boolean,
  ): string | null {
    if (
      !value ||
      value.includes('\\') ||
      value.includes('\0') ||
      value.includes('?') ||
      value.includes('#') ||
      value.includes('%') ||
      value.includes(':')
    ) {
      return null;
    }
    if (value.startsWith('/') !== allowLeadingSlash) return null;
    const withoutRoot = allowLeadingSlash ? value.slice(1) : value;
    const segments = withoutRoot.split('/');
    if (
      segments.length < 1 ||
      segments.some(
        (segment) =>
          !segment ||
          segment === '.' ||
          segment === '..' ||
          segment.normalize('NFC') !== segment,
      )
    ) {
      return null;
    }
    return segments.join('/');
  }

  private xmlRoot(xml: string, expectedRoot: string): XmlRecord {
    if (/<!DOCTYPE\b|<!ENTITY\b/i.test(xml)) throw new Error('Unsafe XML');
    if (XMLValidator.validate(xml) !== true) throw new Error('Invalid XML');
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      processEntities: false,
      parseTagValue: false,
      trimValues: true,
      maxNestedTags: 64,
    });
    const document = this.xmlRecord(parser.parse(xml));
    if (!document) throw new Error('Invalid XML');
    const rootNames = Object.keys(document).filter((name) => name !== '?xml');
    if (rootNames.length !== 1 || rootNames[0] !== expectedRoot) {
      throw new Error('Unexpected XML root');
    }
    const root = this.xmlRecord(document[expectedRoot]);
    if (!root) throw new Error('Invalid XML root');
    return root;
  }

  private xmlRecord(value: unknown): XmlRecord | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as XmlRecord)
      : null;
  }

  private xmlArray(value: unknown): unknown[] {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
  }

  private readZipDirectory(reader: BoundedReader): Map<string, ZipEntry> {
    const tailLength = Math.min(reader.size, 65_557);
    const tail = reader.read(reader.size - tailLength, tailLength);
    let eocd = -1;
    for (let index = tail.length - 22; index >= 0; index -= 1) {
      if (
        tail.readUInt32LE(index) === ZIP_EOCD_SIGNATURE &&
        index + 22 <= tail.length &&
        reader.size -
          tailLength +
          index +
          22 +
          tail.readUInt16LE(index + 20) ===
          reader.size
      ) {
        eocd = index;
        break;
      }
    }
    if (eocd < 0 || eocd + 22 > tail.length) throw new Error('Invalid ZIP');
    const entryCount = tail.readUInt16LE(eocd + 10);
    const centralSize = tail.readUInt32LE(eocd + 12);
    const centralOffset = tail.readUInt32LE(eocd + 16);
    const absoluteEocdOffset = reader.size - tailLength + eocd;
    if (
      tail.readUInt16LE(eocd + 4) !== 0 ||
      tail.readUInt16LE(eocd + 6) !== 0 ||
      tail.readUInt16LE(eocd + 8) !== entryCount ||
      entryCount < 1 ||
      entryCount > MAX_ENTRY_COUNT ||
      centralSize > MAX_CENTRAL_DIRECTORY_BYTES ||
      !Number.isSafeInteger(centralOffset + centralSize) ||
      centralOffset + centralSize !== absoluteEocdOffset
    ) {
      throw new Error('Unsafe ZIP');
    }
    const central = reader.read(centralOffset, centralSize);
    const entries = new Map<string, ZipEntry>();
    const normalizedNames = new Set<string>();
    let cursor = 0;
    let totalCompressed = 0;
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
      const crc32 = central.readUInt32LE(cursor + 16);
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
      const normalizedName = this.normalizedZipName(name);
      totalCompressed += compressedSize;
      totalUncompressed += uncompressedSize;
      const ratio =
        compressedSize === 0 ? Infinity : uncompressedSize / compressedSize;
      if (
        (flags & 1) !== 0 ||
        (flags & ~(0x0006 | 0x0008 | 0x0800)) !== 0 ||
        (method !== 8 && (flags & 0x0006) !== 0) ||
        ![0, 8].includes(method) ||
        !this.isSafeZipName(name) ||
        entries.has(name) ||
        normalizedNames.has(normalizedName) ||
        compressedSize > MAX_ENTRY_UNCOMPRESSED_BYTES ||
        uncompressedSize > MAX_ENTRY_UNCOMPRESSED_BYTES ||
        totalCompressed > MAX_TOTAL_UNCOMPRESSED_BYTES ||
        totalUncompressed > MAX_TOTAL_UNCOMPRESSED_BYTES ||
        localOffset + 30 > centralOffset ||
        (uncompressedSize > 64 * 1024 && ratio > MAX_COMPRESSION_RATIO)
      ) {
        throw new Error('Unsafe ZIP entry');
      }
      entries.set(name, {
        name,
        flags,
        method,
        crc32,
        compressedSize,
        uncompressedSize,
        localOffset,
        centralOffset,
      });
      normalizedNames.add(normalizedName);
      cursor = end;
    }
    if (cursor !== central.length) throw new Error('Invalid central directory');
    const localRanges = [...entries.values()]
      .map((entry) => ({
        start: entry.localOffset,
        end: this.validateZipLocalEntry(reader, entry).recordEnd,
      }))
      .sort((left, right) => left.start - right.start);
    if (
      localRanges[0]?.start !== 0 ||
      localRanges.at(-1)?.end !== centralOffset ||
      localRanges.some(
        (range, index) =>
          index > 0 && localRanges[index - 1].end !== range.start,
      )
    ) {
      throw new Error('Invalid local ZIP layout');
    }
    return entries;
  }

  private readZipEntry(
    reader: BoundedReader,
    entry: ZipEntry | undefined,
    outputLimit: number,
  ): Buffer {
    if (!entry || entry.uncompressedSize > outputLimit)
      throw new Error('Missing ZIP entry');
    const { dataOffset } = this.validateZipLocalEntry(reader, entry);
    const compressed = reader.read(dataOffset, entry.compressedSize);
    const result =
      entry.method === 0
        ? compressed
        : inflateRawSync(compressed, { maxOutputLength: outputLimit + 1 });
    if (
      result.length !== entry.uncompressedSize ||
      result.length > outputLimit ||
      this.crc32(result) !== entry.crc32
    ) {
      throw new Error('Invalid ZIP entry');
    }
    return result;
  }

  private validateZipLocalEntry(
    reader: BoundedReader,
    entry: ZipEntry,
  ): { dataOffset: number; recordEnd: number } {
    const header = reader.read(entry.localOffset, 30);
    if (
      header.readUInt32LE(0) !== ZIP_LOCAL_SIGNATURE ||
      header.readUInt16LE(6) !== entry.flags ||
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
    const dataOffset = entry.localOffset + 30 + nameLength + extraLength;
    const dataEnd = dataOffset + entry.compressedSize;
    if (
      !Number.isSafeInteger(dataOffset) ||
      !Number.isSafeInteger(dataEnd) ||
      dataEnd > entry.centralOffset
    ) {
      throw new Error('Invalid ZIP entry range');
    }
    const usesDescriptor = (entry.flags & 0x0008) !== 0;
    const localCrc = header.readUInt32LE(14);
    const localCompressedSize = header.readUInt32LE(18);
    const localUncompressedSize = header.readUInt32LE(22);
    if (
      (!usesDescriptor &&
        (localCrc !== entry.crc32 ||
          localCompressedSize !== entry.compressedSize ||
          localUncompressedSize !== entry.uncompressedSize)) ||
      (usesDescriptor &&
        (![0, entry.crc32].includes(localCrc) ||
          ![0, entry.compressedSize].includes(localCompressedSize) ||
          ![0, entry.uncompressedSize].includes(localUncompressedSize)))
    ) {
      throw new Error('Inconsistent ZIP entry');
    }
    const descriptorLength = usesDescriptor
      ? this.validateDataDescriptor(reader, entry, dataEnd)
      : 0;
    return { dataOffset, recordEnd: dataEnd + descriptorLength };
  }

  private validateDataDescriptor(
    reader: BoundedReader,
    entry: ZipEntry,
    offset: number,
  ): number {
    if (offset + 12 > entry.centralOffset) {
      throw new Error('Missing ZIP data descriptor');
    }
    const first = reader.read(offset, 4).readUInt32LE(0);
    const hasSignature = first === 0x08074b50;
    const length = hasSignature ? 16 : 12;
    if (offset + length > entry.centralOffset) {
      throw new Error('Invalid ZIP data descriptor');
    }
    const descriptor = reader.read(offset, length);
    const valuesOffset = hasSignature ? 4 : 0;
    if (
      descriptor.readUInt32LE(valuesOffset) !== entry.crc32 ||
      descriptor.readUInt32LE(valuesOffset + 4) !== entry.compressedSize ||
      descriptor.readUInt32LE(valuesOffset + 8) !== entry.uncompressedSize
    ) {
      throw new Error('Invalid ZIP data descriptor');
    }
    return length;
  }

  private crc32(content: Buffer): number {
    let crc = 0xffffffff;
    for (const byte of content) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  private normalizedZipName(name: string): string {
    return name.normalize('NFC').toLocaleLowerCase('en-US');
  }

  private isSafeZipName(name: string): boolean {
    if (name.endsWith('/')) {
      const directoryName = name.slice(0, -1);
      return this.normalizeOpcPartUri(directoryName, false) === directoryName;
    }
    return this.normalizeOpcPartUri(name, false) === name;
  }
}
