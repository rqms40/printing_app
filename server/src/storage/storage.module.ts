import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { makeClient } from './storage.client';
import { MINIO_CLIENT, MINIO_PRESIGN_CLIENT } from './storage.constants';

export { MINIO_CLIENT, MINIO_PRESIGN_CLIENT } from './storage.constants';

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
