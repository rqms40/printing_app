import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { MINIO_CLIENT, MINIO_PRESIGN_CLIENT } from './storage.constants';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(MINIO_CLIENT) private readonly minioClient: Client,
    @Inject(MINIO_PRESIGN_CLIENT) private readonly presignClient: Client,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const bucket = this.config.get<string>('MINIO_BUCKET', 'grid-print');
    try {
      const exists = await this.minioClient.bucketExists(bucket);
      if (!exists) {
        await this.minioClient.makeBucket(bucket);
        this.logger.log(`Bucket '${bucket}' created (private)`);
      }
    } catch (err) {
      this.logger.error(`Failed to initialize MinIO bucket '${bucket}'`, err);
      throw err;
    }
  }

  async upload(
    buffer: Buffer,
    objectKey: string,
    mimeType: string,
  ): Promise<string> {
    const bucket = this.config.get<string>('MINIO_BUCKET', 'grid-print');
    await this.minioClient.putObject(bucket, objectKey, buffer, buffer.length, {
      'Content-Type': mimeType,
    });
    const useSSL = this.config.get<string>('MINIO_USE_SSL', 'false') === 'true';
    const scheme = useSSL ? 'https' : 'http';
    const endpoint = this.config.get<string>('MINIO_ENDPOINT', 'localhost');
    const port = this.config.get<number>('MINIO_PORT', 9000);
    return `${scheme}://${endpoint}:${port}/${bucket}/${objectKey}`;
  }

  async getPresignedUrl(
    objectKey: string,
    expirySeconds = 3600,
  ): Promise<string> {
    const bucket = this.config.get<string>('MINIO_BUCKET', 'grid-print');
    return this.presignClient.presignedGetObject(
      bucket,
      objectKey,
      expirySeconds,
    );
  }
}
