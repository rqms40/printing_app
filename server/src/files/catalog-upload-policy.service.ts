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
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
  centralOffset: number;
};

type XmlRecord = Record<string, unknown>;

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

    const { head: content, tail } = reader.readHeadAndTail();
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
        return this.isValidStl(content, tail, reader.size);
      case '.obj':
        return this.isValidObj(`${ascii}\n${tail.toString('latin1')}`);
      case '.dwg':
        return /^AC10\d{2}/.test(ascii);
      case '.dxf':
        return this.isValidDxf(content, tail);
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

  private isValidStl(content: Buffer, tail: Buffer, size: number): boolean {
    if (size >= 84 && content.length >= 84) {
      const triangles = content.readUInt32LE(80);
      if (triangles > 0 && 84 + triangles * 50 === size) return true;
    }
    const ascii =
      tail.length > 0
        ? `${content.toString('latin1')}\n${tail.toString('latin1')}`
        : content.toString('latin1');
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

  private isValidDxf(content: Buffer, tail: Buffer): boolean {
    if (content.subarray(0, BINARY_DXF_MAGIC.length).equals(BINARY_DXF_MAGIC)) {
      return true;
    }
    const ascii =
      tail.length > 0
        ? `${content.toString('latin1')}\n${tail.toString('latin1')}`
        : content.toString('latin1');
    if (tail.length > 0) {
      return (
        /(?:^|\r?\n)\s*0\s*\r?\n\s*SECTION\s*(?:\r?\n|$)/i.test(
          content.toString('latin1'),
        ) &&
        /(?:^|\r?\n)\s*0\s*\r?\n\s*ENDSEC\s*(?:\r?\n|$)/i.test(
          tail.toString('latin1'),
        ) &&
        /(?:^|\r?\n)\s*0\s*\r?\n\s*EOF\s*$/i.test(tail.toString('latin1'))
      );
    }
    const lines = ascii
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
      const contentTypeRoot = this.xmlRoot(contentTypes, 'Types');
      if (
        contentTypeRoot['@_xmlns'] !==
        'http://schemas.openxmlformats.org/package/2006/content-types'
      ) {
        return false;
      }
      const modelContentType =
        'application/vnd.ms-package.3dmanufacturing-3dmodel+xml';
      const relationshipRoot = this.xmlRoot(relationships, 'Relationships');
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
            record?.['@_Type'] ===
              'http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel'
          );
        },
      );
      const target = this.xmlRecord(relationship)?.['@_Target'];
      if (typeof target !== 'string') return false;
      const modelName = target.replace(/^\//, '');
      if (!this.isSafeZipName(modelName)) return false;
      const modelExtension = extname(modelName).slice(1).toLowerCase();
      const declaresModel =
        this.xmlArray(contentTypeRoot.Default).some((entry) => {
          const record = this.xmlRecord(entry);
          return (
            record?.['@_ContentType'] === modelContentType &&
            typeof record['@_Extension'] === 'string' &&
            record['@_Extension'].toLowerCase() === modelExtension
          );
        }) ||
        this.xmlArray(contentTypeRoot.Override).some((entry) => {
          const record = this.xmlRecord(entry);
          return (
            record?.['@_ContentType'] === modelContentType &&
            record['@_PartName'] === `/${modelName}`
          );
        });
      if (!declaresModel) return false;
      const model = this.readZipEntry(
        reader,
        entries.get(modelName),
        MAX_MODEL_XML_BYTES,
      ).toString('utf8');
      if (Date.now() - started > MAX_INSPECTION_MS) return false;
      const modelRoot = this.xmlRoot(model, 'model');
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
      const meshObjectIds = new Set<string>();
      for (const object of this.xmlArray(resources.object)) {
        const objectRecord = this.xmlRecord(object);
        const objectId = objectRecord?.['@_id'];
        const mesh = this.xmlRecord(this.xmlRecord(object)?.mesh);
        const vertices = this.xmlRecord(mesh?.vertices);
        const triangles = this.xmlRecord(mesh?.triangles);
        if (
          typeof objectId === 'string' &&
          objectId.trim().length > 0 &&
          this.xmlArray(vertices?.vertex).length >= 3 &&
          this.xmlArray(triangles?.triangle).length >= 1
        ) {
          meshObjectIds.add(objectId);
        }
      }
      return this.xmlArray(build.item).some((item) => {
        const objectId = this.xmlRecord(item)?.['@_objectid'];
        return typeof objectId === 'string' && meshObjectIds.has(objectId);
      });
    } catch {
      return false;
    }
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
      totalUncompressed += uncompressedSize;
      const ratio =
        compressedSize === 0 ? Infinity : uncompressedSize / compressedSize;
      if (
        (flags & 1) !== 0 ||
        (flags & ~(0x0008 | 0x0800)) !== 0 ||
        ![0, 8].includes(method) ||
        !this.isSafeZipName(name) ||
        entries.has(name) ||
        normalizedNames.has(normalizedName) ||
        uncompressedSize > MAX_ENTRY_UNCOMPRESSED_BYTES ||
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
