import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { FileMetadata } from './entities/file-metadata.entity';
import { StorageService } from '../storage/storage.service';

const mockFileRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
};

const mockStorageService = {
  upload: jest.fn(),
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
});
