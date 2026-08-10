import { BadRequestException } from '@nestjs/common';

import { ProductCategory } from '../products/entities/product-category.entity';
import {
  FileProcessingType,
  PricingModel,
} from '../products/enums/catalog.enums';
import { CatalogUploadPolicyService } from './catalog-upload-policy.service';

const MB = 1024 * 1024;

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
    groupDescription: null,
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

describe('CatalogUploadPolicyService', () => {
  const policy = new CatalogUploadPolicyService();
  const general = makeCategory();
  const model = makeCategory({
    id: 2,
    name: '3D Printing & Scale Models',
    slug: '3d-printing-scale-models',
    groupSlug: 'specialized-prototyping',
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
    ['artwork.psd', 'image/vnd.adobe.photoshop', Buffer.from('8BPS\u0000')],
  ])('accepts configured general artwork %s', (name, mime, content) => {
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
    [
      'model.obj',
      'model/obj',
      Buffer.from('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n'),
    ],
    ['model.3mf', 'application/zip', Buffer.from('PK\u0003\u0004model')],
  ])('accepts canonical 3D format %s', (name, mime, content) => {
    expect(() =>
      policy.validate(model, makeUpload(name, mime, content)),
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
  ])('accepts configured CAD format %s', (name, mime, content) => {
    expect(() =>
      policy.validate(cad, makeUpload(name, mime, content)),
    ).not.toThrow();
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

  it('rejects MIME and filename extension mismatches', () => {
    expect(() =>
      policy.validate(
        general,
        makeUpload('artwork.pdf', 'image/png', Buffer.from('%PDF-1.7\n')),
      ),
    ).toThrow('File type not allowed');
  });

  it('rejects executable bytes spoofed as an allowed artwork file', () => {
    expect(() =>
      policy.validate(
        general,
        makeUpload(
          'artwork.pdf',
          'application/pdf',
          Buffer.from('MZ executable'),
        ),
      ),
    ).toThrow('Executable uploads are not allowed');
  });

  it('rejects content whose signature does not match its extension', () => {
    expect(() =>
      policy.validate(
        general,
        makeUpload('artwork.png', 'image/png', Buffer.from('%PDF-1.7\n')),
      ),
    ).toThrow('File content does not match its type');
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
        makeUpload(
          'model.stl',
          'model/stl',
          Buffer.from('solid model\nvertex 0 0 0'),
          200 * MB,
        ),
      ),
    ).not.toThrow();
    expect(() =>
      policy.validate(
        model,
        makeUpload(
          'model.stl',
          'model/stl',
          Buffer.from('solid model\nvertex 0 0 0'),
          200 * MB + 1,
        ),
      ),
    ).toThrow('200 MB');
  });

  it('rejects a file valid for a different product', () => {
    expect(() =>
      policy.validate(
        cad,
        makeUpload(
          'model.stl',
          'model/stl',
          Buffer.from('solid model\nvertex 0 0 0'),
        ),
      ),
    ).toThrow('File type not allowed');
  });

  it.each([
    makeCategory({ isActive: false }),
    makeCategory({ slug: 'marketing-promo', groupSlug: null }),
  ])('requires an active leaf product', (category) => {
    expect(() =>
      policy.validate(
        category,
        makeUpload('artwork.pdf', 'application/pdf', Buffer.from('%PDF-')),
      ),
    ).toThrow(new BadRequestException('Active catalog product required'));
  });
});
