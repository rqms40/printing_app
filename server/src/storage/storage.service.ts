import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import type { Readable } from 'stream';
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
    data: Buffer | Readable,
    objectKey: string,
    mimeType: string,
    size?: number,
  ): Promise<string> {
    const bucket = this.config.get<string>('MINIO_BUCKET', 'grid-print');
    const objectSize = Buffer.isBuffer(data) ? data.length : size;
    await this.minioClient.putObject(bucket, objectKey, data, objectSize, {
      'Content-Type': mimeType,
    });

    // Construct the publicly-fetchable URL. Prefer MINIO_PUBLIC_URL when set
    // (LAN IP, https proxy, etc.) so clients on different networks than the
    // server can actually load the asset. Fall back to the internal endpoint
    // only when no public URL is configured.
    const publicUrl = this.config.get<string>('MINIO_PUBLIC_URL');
    if (publicUrl) {
      const trimmed = publicUrl.endsWith('/')
        ? publicUrl.slice(0, -1)
        : publicUrl;
      return `${trimmed}/${bucket}/${objectKey}`;
    }
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

  async objectExists(objectKey: string): Promise<boolean> {
    const bucket = this.config.get<string>('MINIO_BUCKET', 'grid-print');
    try {
      await this.minioClient.statObject(bucket, objectKey);
      return true;
    } catch (error) {
      const details =
        typeof error === 'object' && error !== null
          ? (error as Record<string, unknown>)
          : {};
      const code = typeof details.code === 'string' ? details.code : '';
      if (
        code === 'NotFound' ||
        code === 'NoSuchKey' ||
        code === 'NoSuchObject'
      ) {
        return false;
      }
      throw error;
    }
  }

  async delete(objectKey: string): Promise<void> {
    const bucket = this.config.get<string>('MINIO_BUCKET', 'grid-print');
    await this.minioClient.removeObject(bucket, objectKey);
  }
}
