import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { FileMetadata } from './entities/file-metadata.entity';
import { StorageService } from '../storage/storage.service';

const mockFileRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
};

const mockStorageService = {
  upload: jest.fn(),
  getPresignedUrl: jest.fn(),
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

describe('FilesService', () => {
  let service: FilesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: getRepositoryToken(FileMetadata), useValue: mockFileRepo },
        { provide: StorageService, useValue: mockStorageService },
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
      const savedMeta = {
        id: 1,
        originalName: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        url: fakeUrl,
        objectKey: 'uploads/general/2026/04/21/some-uuid.jpg',
        uploadedBy: 42,
      };
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
        }),
      );
      expect(result).toEqual(savedMeta);
    });

    it('throws BadRequestException for disallowed MIME type without calling StorageService', async () => {
      const file = makeFile({ mimetype: 'video/mp4' });
      await expect(service.storeMetadata(file, 1)).rejects.toThrow(
        new BadRequestException('File type not allowed'),
      );
      expect(mockStorageService.upload).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for file over 20 MB without calling StorageService', async () => {
      const file = makeFile({ size: 21 * 1024 * 1024 });
      await expect(service.storeMetadata(file, 1)).rejects.toThrow(
        new BadRequestException('File exceeds 20 MB limit'),
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
  });

  describe('getPresignedUrl', () => {
    const makeFileMeta = (overrides: Partial<FileMetadata> = {}) => ({
      id: 1,
      originalName: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
      url: 'http://localhost:9000/grid-print/uploads/general/2026/04/21/uuid.jpg',
      objectKey: 'uploads/general/2026/04/21/uuid.jpg',
      uploadedBy: 42,
      createdAt: new Date(),
      ...overrides,
    });

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
    it('returns files ordered by createdAt DESC for the given userId', async () => {
      const files = [
        { id: 2, uploadedBy: 42, createdAt: new Date('2026-04-21') },
        { id: 1, uploadedBy: 42, createdAt: new Date('2026-04-20') },
      ];
      mockFileRepo.find.mockResolvedValue(files);

      const result = await service.getMyUploads(42);

      expect(mockFileRepo.find).toHaveBeenCalledWith({
        where: { uploadedBy: 42 },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(files);
    });
  });
});
