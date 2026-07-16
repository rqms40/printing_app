import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { StorageService } from './storage.service';
import { MINIO_CLIENT, MINIO_PRESIGN_CLIENT } from './storage.constants';

jest.mock('minio', () => ({ Client: jest.fn() }));

const mockMinioClient = {
  bucketExists: jest.fn(),
  makeBucket: jest.fn(),
  setBucketPolicy: jest.fn(),
  putObject: jest.fn(),
  statObject: jest.fn(),
  presignedGetObject: jest.fn(),
};

const mockDerivedMinioClient = {
  presignedGetObject: jest.fn(),
};

const configValues: Record<string, unknown> = {
  MINIO_ENDPOINT: 'localhost',
  MINIO_PORT: 9000,
  MINIO_BUCKET: 'test-bucket',
  MINIO_USE_SSL: 'false',
  MINIO_ACCESS_KEY: 'test-access-key',
  MINIO_SECRET_KEY: 'test-secret-key',
};

const mockConfigService = {
  get: jest.fn(
    (key: string, defaultVal?: unknown) => configValues[key] ?? defaultVal,
  ),
  getOrThrow: jest.fn((key: string) => {
    const value = configValues[key];
    if (value == null) throw new Error(`Missing config: ${key}`);
    return value;
  }),
};

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    jest.clearAllMocks();
    delete configValues.MINIO_PUBLIC_URL;
    jest
      .mocked(Client)
      .mockImplementation(() => mockDerivedMinioClient as unknown as Client);
    const module = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: MINIO_CLIENT, useValue: mockMinioClient },
        { provide: MINIO_PRESIGN_CLIENT, useValue: mockMinioClient },
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

    it('creates bucket when it does not exist (no public-read policy)', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(false);
      mockMinioClient.makeBucket.mockResolvedValue(undefined);
      await service.onModuleInit();
      expect(mockMinioClient.makeBucket).toHaveBeenCalledWith('test-bucket');
      expect(mockMinioClient.setBucketPolicy).not.toHaveBeenCalled();
    });
  });

  describe('upload', () => {
    it('returns public URL on successful upload', async () => {
      mockMinioClient.putObject.mockResolvedValue({
        etag: 'abc',
        versionId: null,
      });
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
      mockMinioClient.putObject.mockRejectedValue(
        new Error('MinIO unavailable'),
      );
      await expect(
        service.upload(Buffer.from('x'), 'key', 'image/png'),
      ).rejects.toThrow('MinIO unavailable');
    });
  });

  describe('getPresignedUrl', () => {
    it('calls presignedGetObject with correct bucket, key, expiry and returns URL', async () => {
      const fakeUrl =
        'http://localhost:9000/test-bucket/uploads/general/2026/04/21/uuid.jpg?X-Amz-Signature=abc';
      mockMinioClient.presignedGetObject.mockResolvedValue(fakeUrl);

      const result = await service.getPresignedUrl(
        'uploads/general/2026/04/21/uuid.jpg',
        3600,
      );

      expect(mockMinioClient.presignedGetObject).toHaveBeenCalledWith(
        'test-bucket',
        'uploads/general/2026/04/21/uuid.jpg',
        3600,
      );
      expect(result).toBe(fakeUrl);
    });

    it('uses a cached client derived from a loopback public URL for the request hostname', async () => {
      configValues.MINIO_PUBLIC_URL = 'http://127.0.0.1:9000';
      mockDerivedMinioClient.presignedGetObject.mockResolvedValue(
        'http://10.0.2.2:9000/test-bucket/file.pdf?signature=derived',
      );

      const first = await service.getPresignedUrl('file.pdf', 3600, '10.0.2.2');
      const second = await service.getPresignedUrl(
        'another.pdf',
        3600,
        '10.0.2.2',
      );

      expect(Client).toHaveBeenCalledTimes(1);
      expect(Client).toHaveBeenCalledWith(
        expect.objectContaining({
          endPoint: '10.0.2.2',
          port: 9000,
          useSSL: false,
          region: 'us-east-1',
          accessKey: 'test-access-key',
          secretKey: 'test-secret-key',
          transportAgent: expect.anything(),
        }),
      );
      expect(mockDerivedMinioClient.presignedGetObject).toHaveBeenCalledTimes(
        2,
      );
      expect(mockMinioClient.presignedGetObject).not.toHaveBeenCalled();
      expect(first).toContain('10.0.2.2');
      expect(second).toContain('10.0.2.2');
    });

    it('ignores the request hostname for a non-loopback public URL', async () => {
      configValues.MINIO_PUBLIC_URL = 'https://cdn.gridgo.ph';
      mockMinioClient.presignedGetObject.mockResolvedValue(
        'https://cdn.gridgo.ph/test-bucket/file.pdf?signature=default',
      );

      await service.getPresignedUrl('file.pdf', 3600, '10.0.2.2');

      expect(Client).not.toHaveBeenCalled();
      expect(mockMinioClient.presignedGetObject).toHaveBeenCalledWith(
        'test-bucket',
        'file.pdf',
        3600,
      );
    });

    it.each(['evil/..', 'a:b'])(
      'falls back to the injected client for invalid request hostname %s',
      async (requestHostname) => {
        configValues.MINIO_PUBLIC_URL = 'http://127.0.0.1:9000';
        mockMinioClient.presignedGetObject.mockResolvedValue(
          'http://127.0.0.1:9000/test-bucket/file.pdf?signature=default',
        );

        await service.getPresignedUrl('file.pdf', 3600, requestHostname);

        expect(Client).not.toHaveBeenCalled();
        expect(mockMinioClient.presignedGetObject).toHaveBeenCalledWith(
          'test-bucket',
          'file.pdf',
          3600,
        );
      },
    );
  });

  describe('objectExists', () => {
    it('stats the configured bucket and returns true for an existing object', async () => {
      mockMinioClient.statObject.mockResolvedValue({ size: 123 });

      await expect(
        service.objectExists('uploads/proof/evidence.png'),
      ).resolves.toBe(true);
      expect(mockMinioClient.statObject).toHaveBeenCalledWith(
        'test-bucket',
        'uploads/proof/evidence.png',
      );
    });

    it('returns false only for a missing object response', async () => {
      mockMinioClient.statObject.mockRejectedValue({ code: 'NotFound' });

      await expect(
        service.objectExists('uploads/proof/missing.png'),
      ).resolves.toBe(false);
    });

    it('propagates storage availability errors', async () => {
      mockMinioClient.statObject.mockRejectedValue(
        new Error('storage unavailable'),
      );

      await expect(
        service.objectExists('uploads/proof/evidence.png'),
      ).rejects.toThrow('storage unavailable');
    });
  });
});
