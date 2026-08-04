import {
  ExecutionContext,
  ForbiddenException,
  INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { FilesController } from './files.controller';
import { FileMetadata } from './entities/file-metadata.entity';
import { PaperSizeValidatorService } from './paper-size-validator.service';
import { PrinterProfileService } from '../printer-profile/printer-profile.service';
import { FilesService } from './files.service';
import type { RequestWithUser } from '../common/interfaces/request-with-user';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const makeFile = (overrides: Partial<FileMetadata> = {}) =>
  ({
    id: 1,
    uploadedBy: 42,
    objectKey: 'uploads/general/file.pdf',
    originalName: 'file.pdf',
    mimeType: 'application/pdf',
    size: 100,
    url: 'http://storage/file.pdf',
    ...overrides,
  }) as FileMetadata;

const makeRequest = (
  sub: number,
  role = 'client',
  betaTestimonialPending = false,
  hostname = 'localhost',
) =>
  ({
    user: { sub, role, email: 'user@example.com', betaTestimonialPending },
    hostname,
  }) as RequestWithUser;

const mockFilesService = {
  findById: jest.fn(),
  getPresignedUrl: jest.fn(),
  getPresignedUrlForKey: jest.fn(),
};
const mockPrinterProfileService = { getProfile: jest.fn() };

describe('FilesController', () => {
  let controller: FilesController;
  let filesService: Pick<
    FilesService,
    'findById' | 'storeMetadata' | 'getPresignedUrl'
  >;

  beforeEach(() => {
    filesService = {
      findById: jest.fn(),
      storeMetadata: jest.fn(),
      getPresignedUrl: jest.fn(),
    };
    controller = new FilesController(
      filesService as FilesService,
      {} as PaperSizeValidatorService,
      {} as PrinterProfileService,
    );
  });

  it('returns file metadata for the owner', async () => {
    const file = makeFile({ uploadedBy: 42 });
    jest.mocked(filesService.findById).mockResolvedValue(file);

    await expect(controller.getFile(1, makeRequest(42))).resolves.toBe(file);
  });

  it('returns file metadata for admins', async () => {
    const file = makeFile({ uploadedBy: 42 });
    jest.mocked(filesService.findById).mockResolvedValue(file);

    await expect(controller.getFile(1, makeRequest(1, 'ops_admin'))).resolves.toBe(
      file,
    );
  });

  it('rejects file metadata reads by non-owners', async () => {
    jest
      .mocked(filesService.findById)
      .mockResolvedValue(makeFile({ uploadedBy: 99 }));

    await expect(controller.getFile(1, makeRequest(42))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('passes the request hostname through when presigning a file', async () => {
    jest
      .mocked(filesService.getPresignedUrl)
      .mockResolvedValue('http://10.0.2.2:9000/file.pdf?signature=test');

    await controller.getPresignedUrl(
      1,
      makeRequest(42, 'client', false, '10.0.2.2'),
    );

    expect(filesService.getPresignedUrl).toHaveBeenCalledWith(
      1,
      42,
      false,
      '10.0.2.2',
    );
  });

  it('allows beta-held users to upload only testimonial photos', async () => {
    const request = makeRequest(42, 'client', true);

    await expect(
      controller.uploadFile({} as Express.Multer.File, request, 'general'),
    ).rejects.toThrow(ForbiddenException);

    await controller.uploadFile(
      { buffer: Buffer.alloc(0) } as Express.Multer.File,
      request,
      'beta_testimonial',
    );
    expect(filesService.storeMetadata).toHaveBeenCalledWith(
      expect.anything(),
      42,
      'beta_testimonial',
    );
  });

  it('keeps the held-user rejection when no multipart file is present', async () => {
    await expect(
      controller.uploadFile(
        undefined as unknown as Express.Multer.File,
        makeRequest(42, 'client', true),
        'general',
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('FilesController upload HTTP cleanup', () => {
  let app: INestApplication;
  const filesService = { storeMetadata: jest.fn() };
  const uploadTmpDir = join(tmpdir(), 'gridgo-uploads');

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        { provide: FilesService, useValue: filesService },
        { provide: PaperSizeValidatorService, useValue: {} },
        { provide: PrinterProfileService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const httpRequest = context
            .switchToHttp()
            .getRequest<RequestWithUser>();
          httpRequest.user = {
            sub: 42,
            email: 'held@example.test',
            role: 'client',
            betaTestimonialPending: true,
          };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('removes the Multer disk file when a held user submits the wrong purpose', async () => {
    const suffix = `.held-cleanup-${process.pid}-${Date.now()}`;
    const before = new Set(await readUploadTmpDir());

    await request(app.getHttpServer())
      .post('/files/upload')
      .field('purpose', 'general')
      .attach('file', Buffer.from('held upload cleanup'), {
        filename: `rejected${suffix}`,
        contentType: 'application/octet-stream',
      })
      .expect(403);

    const leaked = (await readUploadTmpDir()).filter(
      (fileName) => fileName.endsWith(suffix) && !before.has(fileName),
    );
    await Promise.all(
      leaked.map((fileName) => unlink(join(uploadTmpDir, fileName))),
    );

    expect(leaked).toEqual([]);
    expect(filesService.storeMetadata).not.toHaveBeenCalled();
  });

  async function readUploadTmpDir(): Promise<string[]> {
    try {
      return await readdir(uploadTmpDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }
});

describe('FilesController inspect with 3D bounds', () => {
  let controller: FilesController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new FilesController(
      mockFilesService as unknown as FilesService,
      {} as PaperSizeValidatorService,
      mockPrinterProfileService as unknown as PrinterProfileService,
    );
  });

  it('inspect returns modelBounds + printerLimits for a 3D file', async () => {
    mockFilesService.findById.mockResolvedValue({
      id: 9,
      uploadedBy: 1,
      mimeType: 'application/octet-stream',
      originalName: 'm.stl',
      model3dWidthMm: '50.00',
      model3dDepthMm: '60.00',
      model3dHeightMm: '70.00',
      model3dTriangleCount: 12,
      widthPt: null,
      heightPt: null,
      widthPx: null,
      heightPx: null,
      colorSpace: null,
      pageCount: null,
      dpi: null,
    });
    mockPrinterProfileService.getProfile.mockResolvedValue({
      name: 'Bambu A1 Mini',
      buildVolumeWidthMm: 180,
      buildVolumeDepthMm: 180,
      buildVolumeHeightMm: 180,
      maxFileSizeMb: 200,
    });
    const out = await controller.inspect(9, {
      user: { sub: 1, role: 'client' },
    } as any);
    expect(out.modelBounds).toEqual(
      expect.objectContaining({
        widthMm: 50,
        depthMm: 60,
        heightMm: 70,
        triangleCount: 12,
        unit: 'mm',
      }),
    );
    expect(out.printerLimits).toEqual(
      expect.objectContaining({
        profileName: 'Bambu A1 Mini',
        fits: true,
        overflowAxes: [],
      }),
    );
  });

  it('inspect flags overflow axes when bounds exceed', async () => {
    mockFilesService.findById.mockResolvedValue({
      id: 10,
      uploadedBy: 1,
      mimeType: 'application/octet-stream',
      originalName: 'b.stl',
      model3dWidthMm: '200.00',
      model3dDepthMm: '60.00',
      model3dHeightMm: '210.00',
      model3dTriangleCount: 1,
      widthPt: null,
      heightPt: null,
      widthPx: null,
      heightPx: null,
      colorSpace: null,
      pageCount: null,
      dpi: null,
    });
    mockPrinterProfileService.getProfile.mockResolvedValue({
      name: 'X',
      buildVolumeWidthMm: 180,
      buildVolumeDepthMm: 180,
      buildVolumeHeightMm: 180,
      maxFileSizeMb: 200,
    });
    const out = await controller.inspect(10, {
      user: { sub: 1, role: 'client' },
    } as any);
    expect(out.printerLimits!.fits).toBe(false);
    expect(out.printerLimits!.overflowAxes.sort()).toEqual(['height', 'width']);
  });

  it('inspect returns a previewGlbUrl for converted 3D previews', async () => {
    mockFilesService.findById.mockResolvedValue({
      id: 11,
      uploadedBy: 1,
      mimeType: 'model/obj',
      originalName: 'quad.obj',
      objectKey: 'uploads/model.obj',
      previewGlbObjectKey: 'uploads/model.obj.preview.glb',
      model3dWidthMm: '10.00',
      model3dDepthMm: '5.00',
      model3dHeightMm: '2.00',
      model3dTriangleCount: 2,
      widthPt: null,
      heightPt: null,
      widthPx: null,
      heightPx: null,
      colorSpace: null,
      pageCount: null,
      dpi: null,
    });
    mockFilesService.getPresignedUrlForKey.mockResolvedValue(
      'https://files/model.obj.preview.glb',
    );
    mockPrinterProfileService.getProfile.mockResolvedValue({
      name: 'Bambu A1 Mini',
      buildVolumeWidthMm: 180,
      buildVolumeDepthMm: 180,
      buildVolumeHeightMm: 180,
      maxFileSizeMb: 200,
    });

    const out = await controller.inspect(11, {
      user: { sub: 1, role: 'client' },
      hostname: '10.0.2.2',
    } as any);

    expect(mockFilesService.getPresignedUrlForKey).toHaveBeenCalledWith(
      'uploads/model.obj.preview.glb',
      3600,
      '10.0.2.2',
    );
    expect(out.previewGlbUrl).toBe('https://files/model.obj.preview.glb');
  });
});
