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
import {
  BoundedInspectionPool,
  CatalogUploadPolicyService,
} from './catalog-upload-policy.service';

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

const makeBinaryStl = (
  extraBytes = 0,
  triangles: Array<{
    normal?: [number, number, number];
    vertices?: [number, number, number][];
  }> = [{}],
) => {
  const stl = Buffer.alloc(84 + triangles.length * 50 + extraBytes);
  stl.writeUInt32LE(triangles.length, 80);
  triangles.forEach((triangle, triangleIndex) => {
    const values = [
      ...(triangle.normal ?? [0, 0, 1]),
      ...(
        triangle.vertices ?? [
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 0],
        ]
      ).flat(),
    ];
    values.forEach((value, valueIndex) => {
      stl.writeFloatLE(value, 84 + triangleIndex * 50 + valueIndex * 4);
    });
  });
  return stl;
};

async function make3mf(
  options: {
    modelXml?: string;
    contentTypesXml?: string;
    relationshipsXml?: string;
    modelName?: string;
    extras?: Record<string, string | Buffer>;
    compression?: 'STORE' | 'DEFLATE';
    comment?: string;
  } = {},
): Promise<Buffer> {
  const zip = new JSZip();
  const modelName = options.modelName ?? '3D/3dmodel.model';
  zip.file(
    '[Content_Types].xml',
    options.contentTypesXml ??
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>',
  );
  zip.file(
    '_rels/.rels',
    options.relationshipsXml ??
      `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/${modelName}" TargetMode="Internal" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`,
  );
  zip.file(modelName, options.modelXml ?? VALID_MODEL_XML);
  for (const [name, value] of Object.entries(options.extras ?? {})) {
    zip.file(name, value);
  }
  zip.comment = options.comment ?? null;
  return zip.generateAsync({
    type: 'nodebuffer',
    compression: options.compression ?? 'DEFLATE',
  });
}

const findZipRecord = (
  archive: Buffer,
  signature: number,
  entryName?: string,
): number => {
  for (let offset = 0; offset <= archive.length - 4; offset += 1) {
    if (archive.readUInt32LE(offset) !== signature) continue;
    if (!entryName) return offset;
    const nameLengthOffset = signature === 0x02014b50 ? 28 : 26;
    const nameOffset = signature === 0x02014b50 ? 46 : 30;
    const nameLength = archive.readUInt16LE(offset + nameLengthOffset);
    if (
      archive
        .subarray(offset + nameOffset, offset + nameOffset + nameLength)
        .toString('utf8') === entryName
    ) {
      return offset;
    }
  }
  throw new Error(`ZIP record not found: ${entryName ?? signature}`);
};

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
  ])(
    'accepts structurally valid general artwork %s',
    async (name, mime, content) => {
      await expect(
        policy.validate(general, makeUpload(name, mime, content)),
      ).resolves.toBeUndefined();
    },
  );

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
  ])('accepts structurally valid 3D format %s', async (name, mime, content) => {
    await expect(
      policy.validate(model, makeUpload(name, mime, content)),
    ).resolves.toBeUndefined();
  });

  it('accepts a real bounded 3MF OPC package', async () => {
    const archive = await make3mf();
    await expect(
      policy.validate(
        model,
        makeUpload('model.3mf', 'application/zip', archive),
      ),
    ).resolves.toBeUndefined();
  });

  it.each([
    [
      'large ASCII STL',
      model,
      makeUpload(
        'large.stl',
        'model/stl',
        Buffer.from(
          `solid large\n${'facet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\n'.repeat(12_000)}endsolid large\n`,
        ),
      ),
    ],
    [
      'large OBJ with faces after 1 MiB',
      model,
      makeUpload(
        'large.obj',
        'model/obj',
        Buffer.from(
          `v 0 0 0\nv 1 0 0\nv 0 1 0\n${'# ordinary model comment\n'.repeat(50_000)}f 1 2 3\n`,
        ),
      ),
    ],
    [
      'large DXF with EOF after 1 MiB',
      cad,
      makeUpload(
        'large.dxf',
        'image/vnd.dxf',
        Buffer.from(
          `0\nSECTION\n2\nENTITIES\n${'999\nordinary drawing comment\n'.repeat(45_000)}0\nENDSEC\n0\nEOF\n`,
        ),
      ),
    ],
  ])('accepts structurally valid %s', async (_case, category, upload) => {
    await expect(policy.validate(category, upload)).resolves.toBeUndefined();
  });

  it('accepts ASCII STL whose only geometry is beyond the first MiB', async () => {
    const content = Buffer.from(
      `solid delayed\n${'# harmless padding\n'.repeat(70_000)}facet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\n${'# trailing padding\n'.repeat(70_000)}endsolid delayed\n`,
    );

    await expect(
      policy.validate(model, makeUpload('delayed.stl', 'model/stl', content)),
    ).resolves.toBeUndefined();
  });

  it.each([
    [
      'ASCII STL corruption hidden in the middle',
      model,
      makeUpload(
        'middle.stl',
        'model/stl',
        Buffer.from(
          `solid corrupt\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\n${'# padding\n'.repeat(120_000)}vertex NaN 0 0\n${'# padding\n'.repeat(120_000)}endsolid corrupt\n`,
        ),
      ),
    ],
    [
      'OBJ out-of-range vertex reference',
      model,
      makeUpload(
        'bad-ref.obj',
        'model/obj',
        Buffer.from('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 99\n'),
      ),
    ],
    [
      'OBJ non-finite vertex',
      model,
      makeUpload(
        'bad-number.obj',
        'model/obj',
        Buffer.from('v 0 0 0\nv 1 0 0\nv 0 1 0\nv NaN 2 3\nf 1 2 3\n'),
      ),
    ],
    [
      'DXF malformed middle group code',
      cad,
      makeUpload(
        'bad-middle.dxf',
        'image/vnd.dxf',
        Buffer.from(
          `0\nSECTION\n2\nENTITIES\n${'999\npadding\n'.repeat(100_000)}NOT_A_CODE\ncorrupt\n${'999\npadding\n'.repeat(100_000)}0\nENDSEC\n0\nEOF\n`,
        ),
      ),
    ],
  ])(
    'rejects %s during complete text parsing',
    async (_case, category, upload) => {
      await expect(policy.validate(category, upload)).rejects.toThrow(
        'File content does not match its type',
      );
    },
  );

  it('accepts valid positive and negative OBJ vertex references', async () => {
    const content = Buffer.from(
      'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\nf -3 -2 -1\n',
    );
    await expect(
      policy.validate(model, makeUpload('refs.obj', 'model/obj', content)),
    ).resolves.toBeUndefined();
  });

  it('streams and validates every binary STL triangle record', async () => {
    const content = makeBinaryStl(0, [
      {},
      {
        vertices: [
          [0, 0, 1],
          [1, 0, 1],
          [0, 1, 1],
        ],
      },
    ]);

    await expect(
      (async () =>
        policy.validate(
          model,
          makeUpload('two-triangles.stl', 'model/stl', content),
        ))(),
    ).resolves.toBeUndefined();
  });

  it.each([
    [
      'a non-finite value in a later record',
      makeBinaryStl(0, [
        {},
        {
          vertices: [
            [0, 0, 1],
            [Number.NaN, 0, 1],
            [0, 1, 1],
          ],
        },
      ]),
    ],
    [
      'a degenerate triangle',
      makeBinaryStl(0, [
        {
          vertices: [
            [0, 0, 0],
            [1, 1, 1],
            [2, 2, 2],
          ],
        },
      ]),
    ],
  ])('rejects binary STL with %s', async (_case, content) => {
    await expect(
      (async () =>
        policy.validate(
          model,
          makeUpload('invalid.stl', 'model/stl', content),
        ))(),
    ).rejects.toThrow('File content does not match its type');
  });

  it('accepts exact OBJ face, line, point, and parameter reference grammar', async () => {
    const content = Buffer.from(
      [
        'v 0 0 0',
        'v 1 0 0',
        'v 0 1 0',
        'vt 0 0',
        'vt 1 0',
        'vt 0 1',
        'vn 0 0 1',
        'vp 0.5 0.25 1',
        'f 1 2 3',
        'f 1/1 2/2 3/3',
        'f 1//1 2//1 3//1',
        'f -3/-3/-1 -2/-2/-1 -1/-1/-1',
        'l 1/1 2/2 3/3',
        'p 1 -1',
      ].join('\n'),
    );

    await expect(
      (async () =>
        policy.validate(
          model,
          makeUpload('grammar.obj', 'model/obj', content),
        ))(),
    ).resolves.toBeUndefined();
  });

  it.each([
    ['empty trailing face component', 'f 1/ 2/2 3/3'],
    ['zero texture reference', 'f 1/0 2/2 3/3'],
    ['fractional normal reference', 'f 1//1.5 2//1 3//1'],
    ['out-of-range texture reference', 'f 1/9 2/2 3/3'],
    ['out-of-range normal reference', 'f 1//9 2//1 3//1'],
    ['malformed line reference', 'l 1/ 2/2'],
    ['out-of-range point reference', 'p 99'],
    ['non-finite parameter vertex', 'vp Infinity 0'],
    ['unsupported malformed free-form geometry', 'curv nope 1 2'],
  ])('rejects OBJ with %s', async (_case, statement) => {
    const content = Buffer.from(
      `v 0 0 0\nv 1 0 0\nv 0 1 0\nvt 0 0\nvt 1 0\nvt 0 1\nvn 0 0 1\n${statement}\nf 1 2 3\n`,
    );
    await expect(
      (async () =>
        policy.validate(
          model,
          makeUpload('invalid.obj', 'model/obj', content),
        ))(),
    ).rejects.toThrow('File content does not match its type');
  });

  it.each([
    ['fractional integer', '70\n1.5'],
    ['invalid boolean', '290\n2'],
    ['invalid handle', '320\nnot-hex'],
    ['invalid binary chunk', '310\n0xz1'],
  ])('rejects ASCII DXF with %s values', async (_case, pair) => {
    const content = Buffer.from(
      `0\nSECTION\n2\nENTITIES\n${pair}\n0\nENDSEC\n0\nEOF\n`,
    );
    await expect(
      (async () =>
        policy.validate(
          cad,
          makeUpload('typed.dxf', 'image/vnd.dxf', content),
        ))(),
    ).rejects.toThrow('File content does not match its type');
  });

  it.each([
    Buffer.from('AutoCAD Binary DXF\r\n\u001a\u0000', 'binary'),
    Buffer.concat([
      Buffer.from('AutoCAD Binary DXF\r\n\u001a\u0000', 'binary'),
      Buffer.from([0, 1, 2, 3]),
    ]),
  ])(
    'rejects unsupported binary DXF instead of trusting magic',
    async (content) => {
      await expect(
        (async () =>
          policy.validate(
            cad,
            makeUpload('binary.dxf', 'application/octet-stream', content),
          ))(),
      ).rejects.toThrow('File content does not match its type');
    },
  );

  it('yields to the event loop while scanning a worst-case text model', async () => {
    const content = Buffer.from(
      `solid responsive\n${'facet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\n'.repeat(30_000)}endsolid responsive\n`,
    );
    let validationSettled = false;
    const validation = Promise.resolve()
      .then(() =>
        policy.validate(
          model,
          makeUpload('responsive.stl', 'model/stl', content),
        ),
      )
      .finally(() => {
        validationSettled = true;
      });

    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(validationSettled).toBe(false);
    await expect(validation).resolves.toBeUndefined();
  });

  it('bounds concurrent inspectors and applies queue backpressure', async () => {
    const pool = new BoundedInspectionPool(2, 2);
    let active = 0;
    let maximumActive = 0;
    const releases: Array<() => void> = [];
    const task = () =>
      pool.run(async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise<void>((resolve) => releases.push(resolve));
        active -= 1;
      });

    const first = task();
    const second = task();
    const third = task();
    const fourth = task();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(active).toBe(2);
    expect(maximumActive).toBe(2);
    await expect(task()).rejects.toThrow('Upload inspection is busy');
    releases.shift()!();
    releases.shift()!();
    await new Promise<void>((resolve) => setImmediate(resolve));
    releases.shift()!();
    releases.shift()!();
    await Promise.all([first, second, third, fourth]);
    expect(maximumActive).toBe(2);
  });

  it('releases an inspection slot when a task throws before returning', async () => {
    const pool = new BoundedInspectionPool(1, 1, 20);

    await expect(
      pool.run((() => {
        throw new Error('early inspector failure');
      }) as never),
    ).rejects.toThrow('early inspector failure');
    await expect(pool.run(async () => 'next inspector')).resolves.toBe(
      'next inspector',
    );
  });

  it.each([
    [
      'model tags hidden in comments',
      {
        modelXml:
          '<model xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><!-- <resources><object><mesh><vertices><vertex/><vertex/><vertex/></vertices><triangles><triangle/></triangles></mesh></object></resources><build><item/></build> --></model>',
      },
    ],
    [
      'content-type root hidden in a comment',
      {
        contentTypesXml:
          '<Bogus xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><!-- <Types><Default ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types> --></Bogus>',
      },
    ],
    [
      'relationship root hidden in a comment',
      {
        relationshipsXml:
          '<Bogus xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><!-- <Relationships><Relationship Target="/3D/3dmodel.model" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships> --></Bogus>',
      },
    ],
    [
      'DTD and entity declarations',
      {
        modelXml: `<!DOCTYPE model [<!ENTITY payload "model">]>${VALID_MODEL_XML}`,
      },
    ],
    [
      'a model content type mapped to the wrong extension',
      {
        contentTypesXml:
          '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="bogus" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>',
      },
    ],
    [
      'a model relationship without an Id',
      {
        relationshipsXml:
          '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>',
      },
    ],
    [
      'a build item referencing a missing mesh object',
      {
        modelXml: VALID_MODEL_XML.replace('objectid="1"', 'objectid="999"'),
      },
    ],
    [
      'a non-finite vertex coordinate',
      {
        modelXml: VALID_MODEL_XML.replace('x="0"', 'x="NaN"'),
      },
    ],
    [
      'an out-of-range triangle vertex',
      {
        modelXml: VALID_MODEL_XML.replace('v3="2"', 'v3="99"'),
      },
    ],
    [
      'duplicate numeric object IDs',
      {
        modelXml: VALID_MODEL_XML.replace(
          '</resources>',
          '<object id="1" type="model"><mesh><vertices><vertex x="0" y="0" z="0"/><vertex x="1" y="0" z="0"/><vertex x="0" y="1" z="0"/></vertices><triangles><triangle v1="0" v2="1" v3="2"/></triangles></mesh></object></resources>',
        ),
      },
    ],
    [
      'an external model relationship',
      {
        relationshipsXml:
          '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" TargetMode="External" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>',
      },
    ],
  ])('rejects 3MF XML with %s', async (_case, options) => {
    const archive = await make3mf(options);
    await expect(
      policy.validate(model, makeUpload('bad.3mf', 'application/zip', archive)),
    ).rejects.toThrow('File content does not match its type');
  });

  it.each(['3D//bad.model', 'http:evil.model'])(
    'rejects non-normalized OPC model URI %s',
    async (modelName) => {
      const archive = await make3mf({ modelName });
      await expect(
        policy.validate(
          model,
          makeUpload('bad.3mf', 'application/zip', archive),
        ),
      ).rejects.toThrow('File content does not match its type');
    },
  );

  it('accepts a valid ZIP comment containing an EOCD signature', async () => {
    const archive = await make3mf({
      comment: `comment-PK\u0005\u0006-${'x'.repeat(40)}`,
    });
    await expect(
      policy.validate(
        model,
        makeUpload('commented.3mf', 'application/zip', archive),
      ),
    ).resolves.toBeUndefined();
  });

  it.each([
    [
      'trailing polyglot bytes',
      async () => Buffer.concat([await make3mf(), Buffer.from('MZpolyglot')]),
    ],
    [
      'gap between central directory and EOCD',
      async () => {
        const archive = await make3mf();
        const eocd = findZipRecord(archive, 0x06054b50);
        return Buffer.concat([
          archive.subarray(0, eocd),
          Buffer.from('UNTRACKED-GAP'),
          archive.subarray(eocd),
        ]);
      },
    ],
    [
      'case-folded duplicate entry names',
      () => make3mf({ extras: { '3d/3DMODEL.MODEL': VALID_MODEL_XML } }),
    ],
    [
      'local and central flag mismatch',
      async () => {
        const archive = await make3mf();
        const local = findZipRecord(archive, 0x04034b50, '[Content_Types].xml');
        archive.writeUInt16LE(
          archive.readUInt16LE(local + 6) | 0x0800,
          local + 6,
        );
        return archive;
      },
    ],
    [
      'unreferenced local and central metadata mismatch',
      async () => {
        const archive = await make3mf({
          extras: { 'Metadata/info.txt': 'ok' },
        });
        const local = findZipRecord(archive, 0x04034b50, 'Metadata/info.txt');
        archive.writeUInt16LE(
          archive.readUInt16LE(local + 6) | 0x0800,
          local + 6,
        );
        return archive;
      },
    ],
    [
      'required entry CRC mismatch',
      async () => {
        const archive = await make3mf();
        const central = findZipRecord(archive, 0x02014b50, '3D/3dmodel.model');
        archive.writeUInt32LE(
          archive.readUInt32LE(central + 16) ^ 0xffffffff,
          central + 16,
        );
        return archive;
      },
    ],
    [
      'local and central size mismatch',
      async () => {
        const archive = await make3mf();
        const local = findZipRecord(archive, 0x04034b50, '[Content_Types].xml');
        archive.writeUInt32LE(archive.readUInt32LE(local + 18) + 1, local + 18);
        return archive;
      },
    ],
    [
      'data-descriptor flag without a matching descriptor',
      async () => {
        const archive = await make3mf();
        const entryName = '[Content_Types].xml';
        const local = findZipRecord(archive, 0x04034b50, entryName);
        const central = findZipRecord(archive, 0x02014b50, entryName);
        archive.writeUInt16LE(
          archive.readUInt16LE(local + 6) | 0x0008,
          local + 6,
        );
        archive.writeUInt16LE(
          archive.readUInt16LE(central + 8) | 0x0008,
          central + 8,
        );
        archive.fill(0, local + 14, local + 26);
        return archive;
      },
    ],
  ])('rejects 3MF ZIP with %s', async (_case, archiveFactory) => {
    const archive = await archiveFactory();
    await expect(
      policy.validate(model, makeUpload('bad.3mf', 'application/zip', archive)),
    ).rejects.toThrow('File content does not match its type');
  });

  it.each([
    ['embedded JAR', 'Payload/evil.jar', Buffer.from('PK\u0003\u0004jar')],
    ['embedded APK/Dex', 'Payload/classes.dex', Buffer.from('dex\n035\u0000')],
    ['embedded native executable', 'Payload/tool.exe', Buffer.from('MZevil')],
  ])('rejects a valid 3MF with %s content', async (_case, name, content) => {
    const archive = await make3mf({ extras: { [name]: content } });
    await expect(
      policy.validate(model, makeUpload('bad.3mf', 'application/zip', archive)),
    ).rejects.toThrow('File content does not match its type');
  });

  it('rejects a corrupt unreferenced ZIP entry CRC', async () => {
    const entryName = 'Metadata/info.xml';
    const archive = await make3mf({
      compression: 'STORE',
      contentTypesXml:
        '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>',
      extras: { [entryName]: '<metadata/>' },
    });
    const local = findZipRecord(archive, 0x04034b50, entryName);
    const central = findZipRecord(archive, 0x02014b50, entryName);
    const wrongCrc = (archive.readUInt32LE(local + 14) ^ 0xffffffff) >>> 0;
    archive.writeUInt32LE(wrongCrc, local + 14);
    archive.writeUInt32LE(wrongCrc, central + 16);

    await expect(
      policy.validate(model, makeUpload('bad.3mf', 'application/zip', archive)),
    ).rejects.toThrow('File content does not match its type');
  });

  it('accepts legal DEFLATE compression-option flag bits', async () => {
    const archive = await make3mf();
    for (const entryName of [
      '[Content_Types].xml',
      '_rels/.rels',
      '3D/3dmodel.model',
    ]) {
      const local = findZipRecord(archive, 0x04034b50, entryName);
      const central = findZipRecord(archive, 0x02014b50, entryName);
      archive.writeUInt16LE(
        archive.readUInt16LE(local + 6) | 0x0002,
        local + 6,
      );
      archive.writeUInt16LE(
        archive.readUInt16LE(central + 8) | 0x0002,
        central + 8,
      );
    }

    await expect(
      policy.validate(
        model,
        makeUpload('deflate.3mf', 'application/zip', archive),
      ),
    ).resolves.toBeUndefined();
  });

  it('accepts a declared safe PNG thumbnail part', async () => {
    const contentTypesXml =
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="png" ContentType="image/png"/></Types>';
    const archive = await make3mf({
      contentTypesXml,
      extras: {
        'Metadata/thumbnail.png': Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        ]),
      },
    });

    await expect(
      policy.validate(
        model,
        makeUpload('thumbnail.3mf', 'application/zip', archive),
      ),
    ).resolves.toBeUndefined();
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
  ])(
    'accepts structurally valid CAD format %s',
    async (name, mime, content) => {
      await expect(
        policy.validate(cad, makeUpload(name, mime, content)),
      ).resolves.toBeUndefined();
    },
  );

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
  ])('rejects malformed %s content', async (_case, name, mime, content) => {
    await expect(
      policy.validate(
        name.endsWith('.dxf') ? cad : name.endsWith('.psd') ? general : model,
        makeUpload(name, mime, content),
      ),
    ).rejects.toThrow('File content does not match its type');
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
    await expect(
      policy.validate(
        model,
        makeUpload('model.3mf', 'application/zip', archive),
      ),
    ).rejects.toThrow('File content does not match its type');
  });

  it('rejects empty ZIP archives renamed as 3MF', async () => {
    const archive = await new JSZip().generateAsync({ type: 'nodebuffer' });
    await expect(
      policy.validate(
        model,
        makeUpload('empty.3mf', 'application/zip', archive),
      ),
    ).rejects.toThrow('File content does not match its type');
  });

  it('rejects high-ratio 3MF model XML before decompression can expand it', async () => {
    const archive = await make3mf({
      modelXml: VALID_MODEL_XML + '<!--' + 'A'.repeat(6 * MB) + '-->',
      compression: 'DEFLATE',
    });
    await expect(
      policy.validate(
        model,
        makeUpload('bomb.3mf', 'application/zip', archive),
      ),
    ).rejects.toThrow('File content does not match its type');
  });

  it('rejects archives with excessive entry counts', async () => {
    const extras = Object.fromEntries(
      Array.from({ length: 70 }, (_, index) => [`Metadata/${index}.txt`, 'x']),
    );
    const archive = await make3mf({ extras });
    await expect(
      policy.validate(
        model,
        makeUpload('many.3mf', 'application/zip', archive),
      ),
    ).rejects.toThrow('File content does not match its type');
  });

  it('rejects a 200 MB sparse fake 3MF without materializing it', async () => {
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
      await expect(policy.validate(model, upload)).rejects.toThrow(
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
    await expect(
      policy.validate(
        model,
        makeUpload('encrypted.3mf', 'application/zip', archive),
      ),
    ).rejects.toThrow('File content does not match its type');
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

  it('normalizes uppercase filename extensions', async () => {
    await expect(
      policy.validate(
        general,
        makeUpload(
          'FINAL-ARTWORK.JPEG',
          'image/jpeg',
          Buffer.from([0xff, 0xd8, 0xff]),
        ),
      ),
    ).resolves.toBeUndefined();
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
  ])('rejects %s executable bytes spoofed as PDF', async (_case, content) => {
    await expect(
      policy.validate(
        general,
        makeUpload('artwork.pdf', 'application/pdf', content),
      ),
    ).rejects.toThrow('Executable uploads are not allowed');
  });

  it('rejects MIME and filename extension mismatches', () => {
    expect(() =>
      policy.validate(
        general,
        makeUpload('artwork.pdf', 'image/png', Buffer.from('%PDF-1.7\n')),
      ),
    ).toThrow('File type not allowed');
  });

  it('enforces 100 MB general and 200 MB 3D boundaries', async () => {
    await expect(
      policy.validate(
        general,
        makeUpload(
          'artwork.pdf',
          'application/pdf',
          Buffer.from('%PDF-'),
          100 * MB,
        ),
      ),
    ).resolves.toBeUndefined();
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
