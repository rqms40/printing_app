import { ConfigService } from '@nestjs/config';
import * as http from 'http';
import * as https from 'https';
import { Client } from 'minio';

// Shared keep-alive agents reuse TCP connections across uploads and presigning.
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 32 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 32 });

export function makeClient(
  config: ConfigService,
  usePublicUrl = false,
  endPointOverride?: string,
): Client {
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
      endPoint: endPointOverride ?? parsed.hostname,
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
    endPoint:
      endPointOverride ?? config.get<string>('MINIO_ENDPOINT', 'localhost'),
    port: config.get<number>('MINIO_PORT', 9000),
    useSSL,
    region,
    accessKey,
    secretKey,
    transportAgent: useSSL ? httpsAgent : httpAgent,
  });
}
