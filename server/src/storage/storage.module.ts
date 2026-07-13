import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as http from 'http';
import * as https from 'https';
import { Client } from 'minio';
import { StorageService } from './storage.service';
import { MINIO_CLIENT, MINIO_PRESIGN_CLIENT } from './storage.constants';

export { MINIO_CLIENT, MINIO_PRESIGN_CLIENT } from './storage.constants';

// Shared keep-alive agents — reuses TCP connections across uploads,
// shaves 30-100 ms off each subsequent request to MinIO. Especially
// noticeable for the upload + preview-GLB-sibling pair.
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 32 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 32 });

function makeClient(config: ConfigService, usePublicUrl = false): Client {
  const region = config.get<string>('MINIO_REGION', 'us-east-1');
  const accessKey = config.getOrThrow<string>('MINIO_ACCESS_KEY');
  const secretKey = config.getOrThrow<string>('MINIO_SECRET_KEY');
  const publicUrl = usePublicUrl
    ? config.get<string>('MINIO_PUBLIC_URL')
    : undefined;
  if (publicUrl) {
    const parsed = new URL(publicUrl);
    const useSSL = parsed.protocol === 'https:';
    return new Client({
      endPoint: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : useSSL ? 443 : 80,
      useSSL,
      region,
      accessKey,
      secretKey,
      transportAgent: useSSL ? httpsAgent : httpAgent,
    });
  }
  const useSSL = config.get<string>('MINIO_USE_SSL', 'false') === 'true';
  return new Client({
    endPoint: config.get<string>('MINIO_ENDPOINT', 'localhost'),
    port: config.get<number>('MINIO_PORT', 9000),
    useSSL,
    region,
    accessKey,
    secretKey,
    transportAgent: useSSL ? httpsAgent : httpAgent,
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
