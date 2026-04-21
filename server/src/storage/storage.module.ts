import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { StorageService } from './storage.service';
import { MINIO_CLIENT, MINIO_PRESIGN_CLIENT } from './storage.constants';

export { MINIO_CLIENT, MINIO_PRESIGN_CLIENT } from './storage.constants';

function makeClient(config: ConfigService, usePublicUrl = false): Client {
  const publicUrl = usePublicUrl
    ? config.get<string>('MINIO_PUBLIC_URL')
    : undefined;
  if (publicUrl) {
    const parsed = new URL(publicUrl);
    return new Client({
      endPoint: parsed.hostname,
      port: parsed.port
        ? parseInt(parsed.port, 10)
        : parsed.protocol === 'https:'
          ? 443
          : 80,
      useSSL: parsed.protocol === 'https:',
      accessKey: config.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: config.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
    });
  }
  return new Client({
    endPoint: config.get<string>('MINIO_ENDPOINT', 'localhost'),
    port: config.get<number>('MINIO_PORT', 9000),
    useSSL: config.get<string>('MINIO_USE_SSL', 'false') === 'true',
    accessKey: config.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
    secretKey: config.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
  });
}

@Global()
@Module({
  providers: [
    {
      provide: MINIO_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => makeClient(config, false),
    },
    {
      provide: MINIO_PRESIGN_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => makeClient(config, true),
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
