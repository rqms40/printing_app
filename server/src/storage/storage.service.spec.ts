import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { MINIO_CLIENT } from './storage.module';

const mockMinioClient = {
  bucketExists: jest.fn(),
  makeBucket: jest.fn(),
  setBucketPolicy: jest.fn(),
  putObject: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string, defaultVal?: unknown) => {
    const vals: Record<string, unknown> = {
      MINIO_ENDPOINT: 'localhost',
      MINIO_PORT: 9000,
      MINIO_BUCKET: 'test-bucket',
      MINIO_USE_SSL: 'false',
    };
    return vals[key] ?? defaultVal;
  }),
};

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: MINIO_CLIENT, useValue: mockMinioClient },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = module.get<StorageService>(StorageService);
  });

  describe('onModuleInit', () => {
    it('does not create bucket when it already exists', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(true);
      await service.onModuleInit();
      expect(mockMinioClient.makeBucket).not.toHaveBeenCalled();
    });

    it('creates bucket with public-read policy when it does not exist', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(false);
      mockMinioClient.makeBucket.mockResolvedValue(undefined);
      mockMinioClient.setBucketPolicy.mockResolvedValue(undefined);
      await service.onModuleInit();
      expect(mockMinioClient.makeBucket).toHaveBeenCalledWith('test-bucket');
      expect(mockMinioClient.setBucketPolicy).toHaveBeenCalledWith(
        'test-bucket',
        expect.stringContaining('"Effect":"Allow"'),
      );
    });
  });

  describe('upload', () => {
    it('returns public URL on successful upload', async () => {
      mockMinioClient.putObject.mockResolvedValue({ etag: 'abc', versionId: null });
      const buffer = Buffer.from('test-image-data');
      const key = 'uploads/general/2026/04/21/test.jpg';

      const url = await service.upload(buffer, key, 'image/jpeg');

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        'test-bucket',
        key,
        buffer,
        buffer.length,
        { 'Content-Type': 'image/jpeg' },
      );
      expect(url).toBe(`http://localhost:9000/test-bucket/${key}`);
    });

    it('propagates error when putObject throws', async () => {
      mockMinioClient.putObject.mockRejectedValue(new Error('MinIO unavailable'));
      await expect(
        service.upload(Buffer.from('x'), 'key', 'image/png'),
      ).rejects.toThrow('MinIO unavailable');
    });
  });
});
