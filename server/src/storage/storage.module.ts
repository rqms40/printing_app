import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { StorageService } from './storage.service';
import { MINIO_CLIENT } from './storage.constants';

export { MINIO_CLIENT } from './storage.constants';

@Global()
@Module({
  providers: [
    {
      provide: MINIO_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Client({
          endPoint: config.get<string>('MINIO_ENDPOINT', 'localhost'),
          port: config.get<number>('MINIO_PORT', 9000),
          useSSL: config.get<string>('MINIO_USE_SSL', 'false') === 'true',
          accessKey: config.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
          secretKey: config.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
        }),
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
