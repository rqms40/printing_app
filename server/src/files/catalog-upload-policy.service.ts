import { BadRequestException, Injectable } from '@nestjs/common';
import { closeSync, openSync, readSync } from 'node:fs';
import { basename, extname } from 'node:path';

import { ProductCategory } from '../products/entities/product-category.entity';
import { CATALOG_MIME_ALLOWED_EXTENSIONS } from '../storage/storage.config';
import { FileMetadata } from './entities/file-metadata.entity';

const MB = 1024 * 1024;
const CONTENT_PREFIX_BYTES = 64 * 1024;
const MODEL_PRODUCT_SLUG = '3d-printing-scale-models';
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

@Injectable()
export class CatalogUploadPolicyService {
  validate(category: ProductCategory, file: Express.Multer.File): void {
    this.validateProperties(
      category,
      file.originalname,
      file.mimetype,
      file.size,
    );
    const prefix = this.readContentPrefix(file);
    if (this.hasExecutableSignature(prefix)) {
      throw new BadRequestException('Executable uploads are not allowed');
    }

    const extension = extname(file.originalname).toLowerCase();
    if (!this.signatureMatches(extension, prefix)) {
      throw new BadRequestException('File content does not match its type');
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
  ): void {
    if (!category.isActive || !category.groupSlug?.trim()) {
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
    const allowedExtensions = new Set(
      (category.allowedExtensions ?? []).map(
        (value) => `.${String(value).trim().toLowerCase().replace(/^\./, '')}`,
      ),
    );
    const canonicalMime = String(mimeType ?? '')
      .split(';', 1)[0]
      .trim()
      .toLowerCase();
    const mimeExtensions = CATALOG_MIME_ALLOWED_EXTENSIONS[canonicalMime];
    if (
      !extension ||
      !allowedExtensions.has(extension) ||
      !mimeExtensions?.includes(extension)
    ) {
      throw new BadRequestException('File type not allowed');
    }

    const canonicalLimitMb = category.slug === MODEL_PRODUCT_SLUG ? 200 : 100;
    const configuredLimitMb = Number(category.maxFileSizeMb);
    const limitMb =
      Number.isFinite(configuredLimitMb) && configuredLimitMb > 0
        ? Math.min(configuredLimitMb, canonicalLimitMb)
        : canonicalLimitMb;
    if (!Number.isFinite(size) || size < 0 || size > limitMb * MB) {
      throw new BadRequestException(`File exceeds ${limitMb} MB limit`);
    }
  }

  private readContentPrefix(file: Express.Multer.File): Buffer {
    if (Buffer.isBuffer(file.buffer)) {
      return file.buffer.subarray(0, CONTENT_PREFIX_BYTES);
    }
    if (!file.path) {
      throw new BadRequestException('Uploaded file is missing content');
    }

    let descriptor: number | null = null;
    try {
      descriptor = openSync(file.path, 'r');
      const prefix = Buffer.alloc(Math.min(file.size, CONTENT_PREFIX_BYTES));
      const bytesRead = readSync(descriptor, prefix, 0, prefix.length, 0);
      return prefix.subarray(0, bytesRead);
    } catch {
      throw new BadRequestException('Uploaded file is missing content');
    } finally {
      if (descriptor != null) closeSync(descriptor);
    }
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

    const magic = content.readUInt32BE(0);
    return new Set([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe]).has(magic);
  }

  private signatureMatches(extension: string, content: Buffer): boolean {
    if (content.length === 0) return false;
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
        return ascii.startsWith('8BPS');
      case '.stl':
        return /^\s*solid\b/i.test(ascii) || content.length >= 84;
      case '.obj':
        return /^\s*v\s+-?(?:\d|\.)/m.test(ascii);
      case '.3mf':
        return (
          content.length >= 4 &&
          content[0] === 0x50 &&
          content[1] === 0x4b &&
          [0x03, 0x05, 0x07].includes(content[2]) &&
          [0x04, 0x06, 0x08].includes(content[3])
        );
      case '.dwg':
        return /^AC10\d{2}/.test(ascii);
      case '.dxf':
        return /(?:^|\r?\n)\s*SECTION\s*(?:\r?\n|$)/i.test(ascii);
      default:
        return false;
    }
  }
}
