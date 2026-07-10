import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { FilesService } from './files.service';
import { FileMetadata } from './entities/file-metadata.entity';
import { StorageService } from '../storage/storage.service';
import { FileAnalysisService } from './file-analysis.service';
import { EntityManager } from 'typeorm';

const mockFileRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockStorageService = {
  upload: jest.fn(),
  getPresignedUrl: jest.fn(),
  delete: jest.fn(),
};

const mockAnalysisService = {
  analyze: jest.fn(),
};

const makeFile = (
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File => ({
  fieldname: 'file',
  originalname: 'photo.jpg',
  encoding: '7bit',
  mimetype: 'image/jpeg',
  size: 1024,
  buffer: Buffer.from('fake-image-data'),
  stream: null as any,
  destination: '',
  filename: '',
  path: '',
  ...overrides,
});

const makeFileMeta = (overrides: Partial<FileMetadata> = {}): FileMetadata =>
  ({
    id: 1,
    originalName: 'photo.jpg',
    mimeType: 'image/jpeg',
    size: 1024,
    url: 'http://localhost:9000/grid-print/uploads/general/2026/04/21/uuid.jpg',
    objectKey: 'uploads/general/2026/04/21/uuid.jpg',
    uploadedBy: 42,
    expiresAt: null,
    createdAt: new Date(),
    widthPt: null,
    heightPt: null,
    widthPx: null,
    heightPx: null,
    colorSpace: null,
    pageCount: null,
    dpi: null,
    ...overrides,
  }) as FileMetadata;

describe('FilesService', () => {
  let service: FilesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAnalysisService.analyze.mockResolvedValue(null);
    const module = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: getRepositoryToken(FileMetadata), useValue: mockFileRepo },
        { provide: StorageService, useValue: mockStorageService },
        { provide: FileAnalysisService, useValue: mockAnalysisService },
      ],
    }).compile();
    service = module.get<FilesService>(FilesService);
  });

  describe('storeMetadata', () => {
    it('uploads file to MinIO and returns metadata with objectKey and url', async () => {
      const file = makeFile();
      const fakeUrl =
        'http://localhost:9000/grid-print/uploads/general/2026/04/21/uuid.jpg';
      mockStorageService.upload.mockResolvedValue(fakeUrl);
      const savedMeta = makeFileMeta({ url: fakeUrl });
      mockFileRepo.create.mockReturnValue(savedMeta);
      mockFileRepo.save.mockResolvedValue(savedMeta);

      const result = await service.storeMetadata(file, 42);

      expect(mockStorageService.upload).toHaveBeenCalledWith(
        file.buffer,
        expect.stringMatching(
          /^uploads\/general\/\d{4}\/\d{2}\/\d{2}\/.+\.jpg$/,
        ),
        'image/jpeg',
      );
      expect(mockFileRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          originalName: 'photo.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
          url: fakeUrl,
          objectKey: expect.stringMatching(
            /^uploads\/general\/\d{4}\/\d{2}\/\d{2}\/.+\.jpg$/,
          ),
          uploadedBy: 42,
          purpose: 'general',
        }),
      );
      expect(result).toEqual(savedMeta);
      expect(mockAnalysisService.analyze).toHaveBeenCalledWith(
        file.buffer,
        file.mimetype,
        file.originalname,
      );
    });

    it('processes disk-backed uploads without requiring an in-memory multer buffer', async () => {
      const dir = await mkdtemp(join(tmpdir(), 'gridgo-test-upload-'));
      const path = join(dir, 'upload.jpg');
      await writeFile(path, Buffer.from('disk-backed-image'));
      const file = makeFile({
        buffer: undefined as unknown as Buffer,
        path,
      });
      const fakeUrl =
        'http://localhost:9000/grid-print/uploads/general/2026/04/21/uuid.jpg';
      mockStorageService.upload.mockResolvedValue(fakeUrl);
      const savedMeta = makeFileMeta({ url: fakeUrl });
      mockFileRepo.create.mockReturnValue(savedMeta);
      mockFileRepo.save.mockResolvedValue(savedMeta);

      try {
        await service.storeMetadata(file, 42);

        expect(mockStorageService.upload).toHaveBeenCalledWith(
          expect.objectContaining({ path }),
          expect.stringMatching(
            /^uploads\/general\/\d{4}\/\d{2}\/\d{2}\/.+\.jpg$/,
          ),
          'image/jpeg',
          1024,
        );
        expect(mockAnalysisService.analyze).toHaveBeenCalledWith(
          expect.any(Buffer),
          'image/jpeg',
          'photo.jpg',
        );
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('throws BadRequestException for disallowed MIME type without calling StorageService', async () => {
      // Both MIME and extension must be unrecognized — extension whitelist
      // accepts .stl/.obj/.3mf/etc even when MIME is generic, so the bad-input
      // fixture has to use a non-whitelisted extension as well.
      const file = makeFile({
        mimetype: 'video/mp4',
        originalname: 'clip.mp4',
      });
      await expect(service.storeMetadata(file, 1)).rejects.toThrow(
        new BadRequestException('File type not allowed'),
      );
      expect(mockStorageService.upload).not.toHaveBeenCalled();
    });

    it('accepts a 3MF upload with octet-stream MIME (3D-print case)', async () => {
      const file = makeFile({
        mimetype: 'application/octet-stream',
        originalname: 'model.3mf',
      });
      mockFileRepo.create.mockReturnValue({ id: 99 });
      mockFileRepo.save.mockResolvedValue({ id: 99 });
      mockStorageService.upload.mockResolvedValue('http://x/y');
      mockAnalysisService.analyze.mockResolvedValue(null);
      await service.storeMetadata(file, 1);
      expect(mockStorageService.upload).toHaveBeenCalled();
    });

    it('accepts a TIFF upload with image/tiff MIME (paper-print case)', async () => {
      const file = makeFile({
        mimetype: 'image/tiff',
        originalname: 'poster.tif',
      });
      mockFileRepo.create.mockReturnValue({ id: 102 });
      mockFileRepo.save.mockResolvedValue({ id: 102 });
      mockStorageService.upload.mockResolvedValue('http://x/y');

      await service.storeMetadata(file, 1, 'paper');

      expect(mockStorageService.upload).toHaveBeenCalledWith(
        file.buffer,
        expect.stringMatching(/uploads\/paper\/\d{4}\/\d{2}\/\d{2}\/.+\.tif$/),
        'image/tiff',
      );
      expect(mockAnalysisService.analyze).toHaveBeenCalledWith(
        file.buffer,
        'image/tiff',
        'poster.tif',
      );
    });

    it('normalizes the legacy proof purpose before building the object key', async () => {
      const file = makeFile();
      mockStorageService.upload.mockResolvedValue('http://x/y');
      mockFileRepo.create.mockImplementation(
        (value: Partial<FileMetadata>) => value as FileMetadata,
      );
      mockFileRepo.save.mockImplementation(
        async (value: FileMetadata) => value,
      );

      await service.storeMetadata(file, 7, ' proof-of-delivery ');

      expect(mockStorageService.upload).toHaveBeenCalledWith(
        file.buffer,
        expect.stringMatching(
          /^uploads\/proof_of_delivery\/\d{4}\/\d{2}\/\d{2}\/.+\.jpg$/,
        ),
        'image/jpeg',
      );
      expect(mockFileRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ purpose: 'proof_of_delivery' }),
      );
    });

    it('rejects an arbitrary purpose before writing an object', async () => {
      const file = makeFile();

      await expect(
        service.storeMetadata(file, 7, '../../rider-proof'),
      ).rejects.toThrow('File purpose not allowed');

      expect(mockStorageService.upload).not.toHaveBeenCalled();
      expect(mockFileRepo.save).not.toHaveBeenCalled();
    });

    it('accepts a TIFF upload with generic binary MIME (paper-print fallback)', async () => {
      const file = makeFile({
        mimetype: 'application/octet-stream',
        originalname: 'scan.tiff',
      });
      mockFileRepo.create.mockReturnValue({ id: 103 });
      mockFileRepo.save.mockResolvedValue({ id: 103 });
      mockStorageService.upload.mockResolvedValue('http://x/y');

      await service.storeMetadata(file, 1, 'paper');

      expect(mockStorageService.upload).toHaveBeenCalledWith(
        file.buffer,
        expect.stringMatching(/uploads\/paper\/\d{4}\/\d{2}\/\d{2}\/.+\.tiff$/),
        'application/octet-stream',
      );
      expect(mockAnalysisService.analyze).toHaveBeenCalledWith(
        file.buffer,
        'application/octet-stream',
        'scan.tiff',
      );
    });

    it('accepts a 3MF upload with zip MIME and a spaced filename', async () => {
      const file = makeFile({
        mimetype: 'application/zip',
        originalname: 'Hook and loop fastener.3mf',
      });
      mockFileRepo.create.mockReturnValue({ id: 100 });
      mockFileRepo.save.mockResolvedValue({ id: 100 });
      mockStorageService.upload.mockResolvedValue('http://x/y');

      await service.storeMetadata(file, 1);

      expect(mockStorageService.upload).toHaveBeenCalledWith(
        file.buffer,
        expect.stringMatching(/\/.+\.3mf$/),
        'application/zip',
      );
    });

    it('rejects generic binary MIME when the extension is not allowed', async () => {
      const file = makeFile({
        mimetype: 'application/octet-stream',
        originalname: 'malware.exe',
      });

      await expect(service.storeMetadata(file, 1)).rejects.toThrow(
        new BadRequestException('File type not allowed'),
      );
      expect(mockStorageService.upload).not.toHaveBeenCalled();
    });

    it('rejects a specific MIME when the extension does not match', async () => {
      const file = makeFile({
        mimetype: 'application/pdf',
        originalname: 'model.3mf',
      });

      await expect(service.storeMetadata(file, 1)).rejects.toThrow(
        new BadRequestException('File type not allowed'),
      );
      expect(mockStorageService.upload).not.toHaveBeenCalled();
    });

    it('accepts a 3D model upload over the old 20 MB cap', async () => {
      const file = makeFile({
        mimetype: 'model/3mf',
        originalname: 'large-model.3mf',
        size: 21 * 1024 * 1024,
      });
      mockFileRepo.create.mockReturnValue({ id: 101 });
      mockFileRepo.save.mockResolvedValue({ id: 101 });
      mockStorageService.upload.mockResolvedValue('http://x/y');

      await service.storeMetadata(file, 1);

      expect(mockStorageService.upload).toHaveBeenCalled();
    });

    it('throws BadRequestException for paper files over 50 MB without calling StorageService', async () => {
      const file = makeFile({ size: 51 * 1024 * 1024 });
      await expect(service.storeMetadata(file, 1)).rejects.toThrow(
        new BadRequestException('File exceeds 50 MB limit'),
      );
      expect(mockStorageService.upload).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for 3D files over 200 MB without calling StorageService', async () => {
      const file = makeFile({
        mimetype: 'model/3mf',
        originalname: 'huge-model.3mf',
        size: 201 * 1024 * 1024,
      });
      await expect(service.storeMetadata(file, 1)).rejects.toThrow(
        new BadRequestException('File exceeds 200 MB limit'),
      );
      expect(mockStorageService.upload).not.toHaveBeenCalled();
    });

    it('throws InternalServerErrorException when MinIO fails without saving to DB', async () => {
      const file = makeFile();
      mockStorageService.upload.mockRejectedValue(
        new Error('MinIO unavailable'),
      );
      await expect(service.storeMetadata(file, 1)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(mockFileRepo.save).not.toHaveBeenCalled();
    });

    it('persists analysis fields when analysis succeeds', async () => {
      const file = makeFile();
      const fakeUrl = 'http://localhost:9000/test.jpg';
      const analysisResult = {
        widthPt: null,
        heightPt: null,
        widthPx: 1920,
        heightPx: 1080,
        colorSpace: 'srgb',
        pageCount: null,
        dpi: 96,
      };
      mockStorageService.upload.mockResolvedValue(fakeUrl);
      mockAnalysisService.analyze.mockResolvedValue(analysisResult);
      const savedMeta = makeFileMeta({
        url: fakeUrl,
        widthPx: 1920,
        heightPx: 1080,
        colorSpace: 'srgb',
        dpi: 96,
      });
      mockFileRepo.create.mockReturnValue(savedMeta);
      mockFileRepo.save.mockResolvedValue(savedMeta);

      await service.storeMetadata(file, 42);

      expect(mockFileRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          widthPx: 1920,
          heightPx: 1080,
          colorSpace: 'srgb',
          dpi: 96,
        }),
      );
    });

    it('persists 3D bounds when analyzer returns model3d result', async () => {
      const file = makeFile({
        mimetype: 'application/octet-stream',
        originalname: 'thing.stl',
      });
      mockStorageService.upload.mockResolvedValue('http://x/y');
      mockAnalysisService.analyze.mockResolvedValue({
        widthPt: null,
        heightPt: null,
        widthPx: null,
        heightPx: null,
        colorSpace: null,
        pageCount: null,
        dpi: null,
        model3dWidthMm: 50,
        model3dDepthMm: 60,
        model3dHeightMm: 70,
        model3dTriangleCount: 12,
      });
      mockFileRepo.create.mockReturnValue({ id: 1 });
      mockFileRepo.save.mockResolvedValue({ id: 1 });

      await service.storeMetadata(file, 1);

      expect(mockFileRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model3dWidthMm: 50,
          model3dDepthMm: 60,
          model3dHeightMm: 70,
          model3dTriangleCount: 12,
        }),
      );
    });
  });

  describe('resolveDeliveryProofFile', () => {
    const getRepository = jest.fn(() => mockFileRepo);
    const manager = {
      getRepository,
    } as unknown as EntityManager;

    const resolveProof = (fileId: number, riderUserId: number) =>
      service.resolveDeliveryProofFile(fileId, riderUserId, manager);

    it('rejects a proof file owned by another user', async () => {
      mockFileRepo.findOne.mockResolvedValue(
        makeFileMeta({
          id: 44,
          uploadedBy: 999,
          objectKey: 'uploads/proof_of_delivery/44.png',
          mimeType: 'image/png',
          purpose: 'proof_of_delivery',
        } as Partial<FileMetadata>),
      );

      await expect(resolveProof(44, 7)).rejects.toThrow(
        'Proof file does not belong to this rider',
      );
    });

    it('rejects the wrong proof purpose', async () => {
      mockFileRepo.findOne.mockResolvedValue(
        makeFileMeta({
          id: 44,
          uploadedBy: 7,
          objectKey: 'uploads/general/44.png',
          mimeType: 'image/png',
          purpose: 'general',
        } as Partial<FileMetadata>),
      );

      await expect(resolveProof(44, 7)).rejects.toThrow(
        'File is not a proof of delivery',
      );
    });

    it('rejects a proof file with a non-image MIME type', async () => {
      mockFileRepo.findOne.mockResolvedValue(
        makeFileMeta({
          id: 44,
          uploadedBy: 7,
          objectKey: 'uploads/proof_of_delivery/44.pdf',
          mimeType: 'application/pdf',
          purpose: 'proof_of_delivery',
        } as Partial<FileMetadata>),
      );

      await expect(resolveProof(44, 7)).rejects.toThrow(
        'Proof file must be PNG, JPEG, or WebP',
      );
    });

    it('rejects a missing or purged proof record', async () => {
      mockFileRepo.findOne.mockResolvedValue(null);

      await expect(resolveProof(404, 7)).rejects.toThrow(
        'Proof file not found',
      );
    });

    it('rejects a proof record without a real object key', async () => {
      mockFileRepo.findOne.mockResolvedValue(
        makeFileMeta({
          id: 44,
          uploadedBy: 7,
          objectKey: null,
          mimeType: 'image/webp',
          purpose: 'proof_of_delivery',
        } as Partial<FileMetadata>),
      );

      await expect(resolveProof(44, 7)).rejects.toThrow(
        'Proof file has no storage object',
      );
    });

    it('returns owned proof metadata with the audited server object key', async () => {
      const file = makeFileMeta({
        id: 44,
        uploadedBy: 7,
        objectKey: 'uploads/proof_of_delivery/44.webp',
        mimeType: 'image/webp',
        purpose: 'proof_of_delivery',
      } as Partial<FileMetadata>);
      mockFileRepo.findOne.mockResolvedValue(file);

      await expect(resolveProof(44, 7)).resolves.toBe(file);
      expect(getRepository).toHaveBeenCalledWith(FileMetadata);
    });
  });

  describe('getPresignedUrl', () => {
    it('returns presigned URL when owner requests own file', async () => {
      const fileMeta = makeFileMeta();
      mockFileRepo.findOne.mockResolvedValue(fileMeta);
      mockStorageService.getPresignedUrl.mockResolvedValue(
        'http://minio/presigned?sig=abc',
      );

      const result = await service.getPresignedUrl(1, 42, false);

      expect(mockStorageService.getPresignedUrl).toHaveBeenCalledWith(
        'uploads/general/2026/04/21/uuid.jpg',
        3600,
      );
      expect(result).toBe('http://minio/presigned?sig=abc');
    });

    it('returns presigned URL when admin requests any file', async () => {
      const fileMeta = makeFileMeta({ uploadedBy: 99 });
      mockFileRepo.findOne.mockResolvedValue(fileMeta);
      mockStorageService.getPresignedUrl.mockResolvedValue(
        'http://minio/presigned?sig=xyz',
      );

      const result = await service.getPresignedUrl(1, 1, true);

      expect(result).toBe('http://minio/presigned?sig=xyz');
    });

    it('throws ForbiddenException when non-owner non-admin requests file', async () => {
      const fileMeta = makeFileMeta({ uploadedBy: 99 });
      mockFileRepo.findOne.mockResolvedValue(fileMeta);

      await expect(service.getPresignedUrl(1, 42, false)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockStorageService.getPresignedUrl).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when file does not exist', async () => {
      mockFileRepo.findOne.mockResolvedValue(null);

      await expect(service.getPresignedUrl(999, 42, false)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when objectKey is null', async () => {
      mockFileRepo.findOne.mockResolvedValue(makeFileMeta({ objectKey: null }));

      await expect(service.getPresignedUrl(1, 42, false)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockStorageService.getPresignedUrl).not.toHaveBeenCalled();
    });

    it('throws InternalServerErrorException when storage service fails', async () => {
      const fileMeta = makeFileMeta();
      mockFileRepo.findOne.mockResolvedValue(fileMeta);
      mockStorageService.getPresignedUrl.mockRejectedValue(
        new Error('MinIO down'),
      );

      await expect(service.getPresignedUrl(1, 42, false)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getMyUploads', () => {
    it('uses two-branch OR where clause to exclude expired files', async () => {
      mockFileRepo.find.mockResolvedValue([]);
      await service.getMyUploads(7);

      const whereArg = mockFileRepo.find.mock.calls[0][0].where;
      expect(Array.isArray(whereArg)).toBe(true);
      expect(whereArg).toHaveLength(2);
      expect(whereArg[0].uploadedBy).toBe(7);
      expect(whereArg[1].uploadedBy).toBe(7);
    });
  });

  describe('stampExpiry', () => {
    it('sets expiresAt to now + retentionDays on the file row', async () => {
      mockFileRepo.update.mockResolvedValue({});
      const before = new Date();
      await service.stampExpiry(5, 7);
      const after = new Date();

      expect(mockFileRepo.update).toHaveBeenCalledTimes(1);
      const [id, payload] = mockFileRepo.update.mock.calls[0];
      expect(id).toBe(5);
      const expiresAt: Date = payload.expiresAt;
      const diffMs = expiresAt.getTime() - before.getTime();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(diffMs).toBeGreaterThanOrEqual(sevenDaysMs - 1000);
      expect(diffMs).toBeLessThanOrEqual(
        sevenDaysMs + (after.getTime() - before.getTime()) + 1000,
      );
    });

    it('uses a supplied transaction manager instead of the global repository', async () => {
      const transactionRepo = { update: jest.fn().mockResolvedValue({}) };
      const getRepository = jest.fn(() => transactionRepo);
      const manager = {
        getRepository,
      } as unknown as EntityManager;

      await service.stampExpiry(5, 7, manager);

      expect(getRepository).toHaveBeenCalledWith(FileMetadata);
      expect(transactionRepo.update).toHaveBeenCalledWith(5, {
        expiresAt: expect.any(Date),
      });
      expect(mockFileRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteExpired', () => {
    it('deletes MinIO objects and db rows for expired files', async () => {
      const fakeQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            objectKey: 'key/a.pdf',
            expiresAt: new Date(Date.now() - 1000),
          },
          {
            id: 2,
            objectKey: 'key/b.pdf',
            expiresAt: new Date(Date.now() - 1000),
          },
        ]),
      };
      mockFileRepo.createQueryBuilder.mockReturnValue(fakeQb);
      mockStorageService.delete.mockResolvedValue(undefined);
      mockFileRepo.delete.mockResolvedValue({});

      const result = await service.deleteExpired();

      expect(mockStorageService.delete).toHaveBeenCalledTimes(2);
      expect(mockFileRepo.delete).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ found: 2, deleted: 2, skipped: 0 });
    });

    it('skips a record when MinIO deletion fails', async () => {
      const fakeQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            objectKey: 'key/a.pdf',
            expiresAt: new Date(Date.now() - 1000),
          },
        ]),
      };
      mockFileRepo.createQueryBuilder.mockReturnValue(fakeQb);
      mockStorageService.delete.mockRejectedValue(new Error('MinIO down'));

      const result = await service.deleteExpired();

      expect(mockFileRepo.delete).not.toHaveBeenCalled();
      expect(result).toEqual({ found: 1, deleted: 0, skipped: 1 });
    });

    it('deletes db row even when objectKey is null', async () => {
      const fakeQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([
            { id: 3, objectKey: null, expiresAt: new Date(Date.now() - 1000) },
          ]),
      };
      mockFileRepo.createQueryBuilder.mockReturnValue(fakeQb);
      mockFileRepo.delete.mockResolvedValue({});

      const result = await service.deleteExpired();

      expect(mockStorageService.delete).not.toHaveBeenCalled();
      expect(mockFileRepo.delete).toHaveBeenCalledWith(3);
      expect(result).toEqual({ found: 1, deleted: 1, skipped: 0 });
    });
  });
});
