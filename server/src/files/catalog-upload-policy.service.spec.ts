import { BadRequestException } from '@nestjs/common';
import JSZip from 'jszip';
import { mkdtempSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ProductCategory } from '../products/entities/product-category.entity';
import {
  FileProcessingType,
  PricingModel,
} from '../products/enums/catalog.enums';
import { CatalogUploadPolicyService } from './catalog-upload-policy.service';

const MB = 1024 * 1024;
const VALID_MODEL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources><object id="1" type="model"><mesh><vertices>
    <vertex x="0" y="0" z="0"/><vertex x="1" y="0" z="0"/><vertex x="0" y="1" z="0"/>
  </vertices><triangles><triangle v1="0" v2="1" v3="2"/></triangles></mesh></object></resources>
  <build><item objectid="1"/></build>
</model>`;

const makeCategory = (
  overrides: Partial<ProductCategory> = {},
): ProductCategory =>
  ({
    id: 1,
    name: 'Flyers',
    slug: 'flyers',
    description: null,
    groupSlug: 'marketing-promo',
    groupName: 'Marketing & Promotional Collateral',
    groupDescription: 'Best for businesses and events.',
    groupSortOrder: 1,
    mobileDescription: null,
    examples: [],
    icon: null,
    fileProcessingType: FileProcessingType.DOCUMENT,
    pricingModel: PricingModel.QUOTE_REQUIRED,
    baseRate: 0,
    quantityUnit: 'copy',
    maxFileSizeMb: 100,
    allowedExtensions: [
      'pdf',
      'png',
      'jpg',
      'jpeg',
      'tif',
      'tiff',
      'ai',
      'psd',
    ],
    isActive: true,
    sortOrder: 1,
    specs: [],
    addons: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as ProductCategory;

const makeUpload = (
  originalname: string,
  mimetype: string,
  buffer: Buffer,
  size = buffer.length,
): Express.Multer.File =>
  ({
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype,
    size,
    buffer,
    stream: null as never,
    destination: '',
    filename: '',
    path: '',
  }) as Express.Multer.File;

const makePsd = (overrides: { version?: number; width?: number } = {}) => {
  const psd = Buffer.alloc(26);
  psd.write('8BPS', 0, 'ascii');
  psd.writeUInt16BE(overrides.version ?? 1, 4);
  psd.writeUInt16BE(3, 12);
  psd.writeUInt32BE(10, 14);
  psd.writeUInt32BE(overrides.width ?? 10, 18);
  psd.writeUInt16BE(8, 22);
  psd.writeUInt16BE(3, 24);
  return psd;
};

const makeBinaryStl = (extraBytes = 0) => {
  const stl = Buffer.alloc(134 + extraBytes);
  stl.writeUInt32LE(1, 80);
  return stl;
};

async function make3mf(
  options: {
    modelXml?: string;
    extras?: Record<string, string>;
    compression?: 'STORE' | 'DEFLATE';
  } = {},
): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>',
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>',
  );
  zip.file('3D/3dmodel.model', options.modelXml ?? VALID_MODEL_XML);
  for (const [name, value] of Object.entries(options.extras ?? {})) {
    zip.file(name, value);
  }
  return zip.generateAsync({
    type: 'nodebuffer',
    compression: options.compression ?? 'DEFLATE',
  });
}

describe('CatalogUploadPolicyService', () => {
  const policy = new CatalogUploadPolicyService();
  const general = makeCategory();
  const model = makeCategory({
    id: 2,
    name: '3D Printing & Scale Models',
    slug: '3d-printing-scale-models',
    groupSlug: 'specialized-prototyping',
    groupName: 'Specialized & Prototyping Services',
    groupDescription: 'Best for specialized builds.',
    groupSortOrder: 4,
    fileProcessingType: FileProcessingType.MODEL_3D,
    quantityUnit: 'model',
    maxFileSizeMb: 200,
    allowedExtensions: ['stl', 'obj', '3mf'],
  });
  const cad = makeCategory({
    id: 3,
    name: 'Blueprint & CAD Plotting',
    slug: 'blueprint-cad-plotting',
    groupSlug: 'specialized-prototyping',
    groupName: 'Specialized & Prototyping Services',
    groupDescription: 'Best for specialized builds.',
    groupSortOrder: 4,
    allowedExtensions: ['pdf', 'dwg', 'dxf'],
  });

  it.each([
    ['artwork.pdf', 'application/pdf', Buffer.from('%PDF-1.7\n')],
    [
      'artwork.png',
      'image/png',
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ],
    ['artwork.jpg', 'image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0])],
    ['artwork.jpeg', 'image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe1])],
    ['artwork.tif', 'image/tiff', Buffer.from('II*\u0000', 'binary')],
    ['artwork.tiff', 'image/tiff', Buffer.from('MM\u0000*', 'binary')],
    [
      'artwork.ai',
      'application/postscript',
      Buffer.from('%!PS-Adobe-3.0\n%%Creator: Adobe Illustrator'),
    ],
    ['artwork.psd', 'image/vnd.adobe.photoshop', makePsd()],
  ])('accepts structurally valid general artwork %s', (name, mime, content) => {
    expect(() =>
      policy.validate(general, makeUpload(name, mime, content)),
    ).not.toThrow();
  });

  it.each([
    [
      'model.stl',
      'model/stl',
      Buffer.from(
        'solid model\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid model',
      ),
    ],
    ['binary.stl', 'application/octet-stream', makeBinaryStl()],
    [
      'solid-header-binary.stl',
      'application/octet-stream',
      (() => {
        const stl = makeBinaryStl();
        stl.write('solid binary export', 0, 'ascii');
        return stl;
      })(),
    ],
    [
      'model.obj',
      'model/obj',
      Buffer.from('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n'),
    ],
  ])('accepts structurally valid 3D format %s', (name, mime, content) => {
    expect(() =>
      policy.validate(model, makeUpload(name, mime, content)),
    ).not.toThrow();
  });

  it('accepts a real bounded 3MF OPC package', async () => {
    const archive = await make3mf();
    expect(() =>
      policy.validate(
        model,
        makeUpload('model.3mf', 'application/zip', archive),
      ),
    ).not.toThrow();
  });

  it.each([
    ['model.glb', 'model/gltf-binary', Buffer.from('glTF')],
    ['model.gltf', 'model/gltf+json', Buffer.from('{"asset":{}}')],
    ['model.step', 'application/step', Buffer.from('ISO-10303-21;')],
    ['model.stp', 'application/step', Buffer.from('ISO-10303-21;')],
  ])('rejects out-of-scope v1.10 3D format %s', (name, mime, content) => {
    expect(() =>
      policy.validate(model, makeUpload(name, mime, content)),
    ).toThrow('File type not allowed');
  });

  it.each([
    ['drawing.pdf', 'application/pdf', Buffer.from('%PDF-1.7\n')],
    ['drawing.dwg', 'image/vnd.dwg', Buffer.from('AC1032')],
    [
      'drawing.dxf',
      'image/vnd.dxf',
      Buffer.from('0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n'),
    ],
    [
      'drawing.dxf',
      'application/octet-stream',
      Buffer.from('AutoCAD Binary DXF\r\n\u001a\u0000', 'binary'),
    ],
  ])('accepts structurally valid CAD format %s', (name, mime, content) => {
    expect(() =>
      policy.validate(cad, makeUpload(name, mime, content)),
    ).not.toThrow();
  });

  it.each([
    [
      'empty ASCII STL',
      'bad.stl',
      'model/stl',
      Buffer.from('solid empty\nendsolid empty'),
    ],
    [
      'binary STL with trailing payload',
      'bad.stl',
      'model/stl',
      makeBinaryStl(1),
    ],
    ['OBJ without faces', 'bad.obj', 'model/obj', Buffer.from('v 0 0 0\n')],
    [
      'truncated PSD',
      'bad.psd',
      'image/vnd.adobe.photoshop',
      Buffer.from('8BPS'),
    ],
    [
      'unsupported PSD version',
      'bad.psd',
      'image/vnd.adobe.photoshop',
      makePsd({ version: 2 }),
    ],
    [
      'zero-width PSD',
      'bad.psd',
      'image/vnd.adobe.photoshop',
      makePsd({ width: 0 }),
    ],
    [
      'malformed ASCII DXF',
      'bad.dxf',
      'image/vnd.dxf',
      Buffer.from('SECTION HEADER EOF'),
    ],
  ])('rejects malformed %s content', (_case, name, mime, content) => {
    expect(() =>
      policy.validate(
        name.endsWith('.dxf') ? cad : name.endsWith('.psd') ? general : model,
        makeUpload(name, mime, content),
      ),
    ).toThrow('File content does not match its type');
  });

  it.each([
    [
      'renamed JAR',
      { extras: { 'META-INF/MANIFEST.MF': 'Manifest-Version: 1.0' } },
      false,
    ],
    ['renamed APK', { extras: { 'AndroidManifest.xml': 'binary' } }, false],
    ['path traversal', { extras: { '../escape.txt': 'owned' } }, true],
  ])('rejects %s archives', async (_case, options, includeModel) => {
    const archive = includeModel
      ? await make3mf(options)
      : await new JSZip()
          .file(
            Object.keys(options.extras)[0],
            Object.values(options.extras)[0],
          )
          .generateAsync({ type: 'nodebuffer' });
    expect(() =>
      policy.validate(
        model,
        makeUpload('model.3mf', 'application/zip', archive),
      ),
    ).toThrow('File content does not match its type');
  });

  it('rejects empty ZIP archives renamed as 3MF', async () => {
    const archive = await new JSZip().generateAsync({ type: 'nodebuffer' });
    expect(() =>
      policy.validate(
        model,
        makeUpload('empty.3mf', 'application/zip', archive),
      ),
    ).toThrow('File content does not match its type');
  });

  it('rejects high-ratio 3MF model XML before decompression can expand it', async () => {
    const archive = await make3mf({
      modelXml: VALID_MODEL_XML + '<!--' + 'A'.repeat(6 * MB) + '-->',
      compression: 'DEFLATE',
    });
    expect(() =>
      policy.validate(
        model,
        makeUpload('bomb.3mf', 'application/zip', archive),
      ),
    ).toThrow('File content does not match its type');
  });

  it('rejects archives with excessive entry counts', async () => {
    const extras = Object.fromEntries(
      Array.from({ length: 70 }, (_, index) => [`Metadata/${index}.txt`, 'x']),
    );
    const archive = await make3mf({ extras });
    expect(() =>
      policy.validate(
        model,
        makeUpload('many.3mf', 'application/zip', archive),
      ),
    ).toThrow('File content does not match its type');
  });

  it('rejects a 200 MB sparse fake 3MF without materializing it', () => {
    const directory = mkdtempSync(join(tmpdir(), 'catalog-3mf-'));
    const path = join(directory, 'sparse.3mf');
    writeFileSync(path, Buffer.alloc(0));
    truncateSync(path, 200 * MB);
    const upload = makeUpload(
      'sparse.3mf',
      'application/zip',
      Buffer.alloc(0),
      200 * MB,
    );
    upload.buffer = undefined as never;
    upload.path = path;
    try {
      expect(() => policy.validate(model, upload)).toThrow(
        'File content does not match its type',
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects encrypted ZIP flags before reading entry content', async () => {
    const archive = await make3mf();
    for (let offset = 0; offset <= archive.length - 4; offset += 1) {
      const signature = archive.readUInt32LE(offset);
      if (signature === 0x04034b50)
        archive.writeUInt16LE(archive.readUInt16LE(offset + 6) | 1, offset + 6);
      if (signature === 0x02014b50)
        archive.writeUInt16LE(archive.readUInt16LE(offset + 8) | 1, offset + 8);
    }
    expect(() =>
      policy.validate(
        model,
        makeUpload('encrypted.3mf', 'application/zip', archive),
      ),
    ).toThrow('File content does not match its type');
  });

  it.each([
    [general, makeUpload('attack.stl', 'model/stl', makeBinaryStl()), ['stl']],
    [
      model,
      makeUpload('attack.pdf', 'application/pdf', Buffer.from('%PDF-1.7')),
      ['stl', 'obj', '3mf', 'pdf'],
    ],
    [
      cad,
      makeUpload(
        'attack.obj',
        'model/obj',
        Buffer.from('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n'),
      ),
      ['pdf', 'dwg', 'dxf', 'obj'],
    ],
  ])(
    'does not let a broadened persisted allowlist widen canonical policy',
    (category, file, allowedExtensions) => {
      expect(() =>
        policy.validate(makeCategory({ ...category, allowedExtensions }), file),
      ).toThrow('File type not allowed');
    },
  );

  it('allows persisted policy to narrow the canonical allowlist', () => {
    expect(() =>
      policy.validate(
        makeCategory({ allowedExtensions: ['pdf'] }),
        makeUpload(
          'artwork.png',
          'image/png',
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        ),
      ),
    ).toThrow('File type not allowed');
  });

  it('normalizes uppercase filename extensions', () => {
    expect(() =>
      policy.validate(
        general,
        makeUpload(
          'FINAL-ARTWORK.JPEG',
          'image/jpeg',
          Buffer.from([0xff, 0xd8, 0xff]),
        ),
      ),
    ).not.toThrow();
  });

  it('rejects a dangerous executable double extension', () => {
    expect(() =>
      policy.validate(
        general,
        makeUpload(
          'invoice.exe.PDF',
          'application/pdf',
          Buffer.from('%PDF-1.7\n'),
        ),
      ),
    ).toThrow('Executable uploads are not allowed');
  });

  it.each([
    ['PE', Buffer.from('MZ executable')],
    ['ELF', Buffer.from([0x7f, 0x45, 0x4c, 0x46])],
    ['Mach-O', Buffer.from([0xfe, 0xed, 0xfa, 0xce])],
    ['shebang', Buffer.from('#!/bin/sh')],
  ])('rejects %s executable bytes spoofed as PDF', (_case, content) => {
    expect(() =>
      policy.validate(
        general,
        makeUpload('artwork.pdf', 'application/pdf', content),
      ),
    ).toThrow('Executable uploads are not allowed');
  });

  it('rejects MIME and filename extension mismatches', () => {
    expect(() =>
      policy.validate(
        general,
        makeUpload('artwork.pdf', 'image/png', Buffer.from('%PDF-1.7\n')),
      ),
    ).toThrow('File type not allowed');
  });

  it('enforces 100 MB general and 200 MB 3D boundaries', () => {
    expect(() =>
      policy.validate(
        general,
        makeUpload(
          'artwork.pdf',
          'application/pdf',
          Buffer.from('%PDF-'),
          100 * MB,
        ),
      ),
    ).not.toThrow();
    expect(() =>
      policy.validate(
        general,
        makeUpload(
          'artwork.pdf',
          'application/pdf',
          Buffer.from('%PDF-'),
          100 * MB + 1,
        ),
      ),
    ).toThrow('100 MB');
    expect(() =>
      policy.validate(
        model,
        makeUpload('model.stl', 'model/stl', makeBinaryStl(), 200 * MB + 1),
      ),
    ).toThrow('200 MB');
  });

  it('rejects a file valid for a different product', () => {
    expect(() =>
      policy.validate(
        cad,
        makeUpload('model.stl', 'model/stl', makeBinaryStl()),
      ),
    ).toThrow('File type not allowed');
  });

  it.each([
    makeCategory({ isActive: false }),
    makeCategory({ pricingModel: PricingModel.PER_PAGE_MODIFIERS }),
    makeCategory({ groupSlug: null }),
    makeCategory({ groupName: ' ' }),
    makeCategory({ groupDescription: null }),
    makeCategory({ groupSortOrder: null }),
    makeCategory({ groupSortOrder: 1.5 }),
  ])('requires a complete active orderable RFQ leaf', (category) => {
    expect(() =>
      policy.validate(
        category,
        makeUpload('artwork.pdf', 'application/pdf', Buffer.from('%PDF-')),
      ),
    ).toThrow(new BadRequestException('Active catalog product required'));
  });
});
