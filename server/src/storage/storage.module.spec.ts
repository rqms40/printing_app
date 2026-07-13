import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Client } from 'minio';
import { MINIO_PRESIGN_CLIENT } from './storage.constants';
import { StorageModule } from './storage.module';

describe('StorageModule', () => {
  it('refuses to initialize clients without explicit storage credentials', async () => {
    const previousAccessKey = process.env.MINIO_ACCESS_KEY;
    const previousSecretKey = process.env.MINIO_SECRET_KEY;
    delete process.env.MINIO_ACCESS_KEY;
    delete process.env.MINIO_SECRET_KEY;

    try {
      await expect(
        Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({
              isGlobal: true,
              ignoreEnvFile: true,
            }),
            StorageModule,
          ],
        }).compile(),
      ).rejects.toThrow(/MINIO_ACCESS_KEY|MINIO_SECRET_KEY/);
    } finally {
      if (previousAccessKey === undefined) delete process.env.MINIO_ACCESS_KEY;
      else process.env.MINIO_ACCESS_KEY = previousAccessKey;
      if (previousSecretKey === undefined) delete process.env.MINIO_SECRET_KEY;
      else process.env.MINIO_SECRET_KEY = previousSecretKey;
    }
  });

  it('pins the public presign client region so URL generation stays offline', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              MINIO_PUBLIC_URL: 'http://127.0.0.1:9000',
              MINIO_ACCESS_KEY: 'minioadmin',
              MINIO_SECRET_KEY: 'minioadmin',
              MINIO_REGION: 'us-east-1',
            }),
          ],
        }),
        StorageModule,
      ],
    }).compile();

    const client = moduleRef.get<Client>(MINIO_PRESIGN_CLIENT);

    expect((client as Client & { region?: string }).region).toBe('us-east-1');
  });
});
