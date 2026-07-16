import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import type { Readable } from 'stream';
import { makeClient } from './storage.client';
import { MINIO_CLIENT, MINIO_PRESIGN_CLIENT } from './storage.constants';

const LOOPBACK_HOSTNAMES = new Set([
  '127.0.0.1',
  'localhost',
  '::1',
  '0.0.0.0',
]);
const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(?:\.(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))*$/;

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly derivedPresignClients = new Map<string, Client>();

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
    requestHostname?: string,
  ): Promise<string> {
    const bucket = this.config.get<string>('MINIO_BUCKET', 'grid-print');
    const client = this.getPresignClient(requestHostname);
    return client.presignedGetObject(bucket, objectKey, expirySeconds);
  }

  private getPresignClient(requestHostname?: string): Client {
    if (!requestHostname || !HOSTNAME_PATTERN.test(requestHostname)) {
      return this.presignClient;
    }

    const publicUrl = this.config.get<string>('MINIO_PUBLIC_URL');
    const configuredHostname = publicUrl
      ? new URL(publicUrl).hostname
      : this.config.get<string>('MINIO_ENDPOINT', 'localhost');
    const normalizedConfiguredHostname = configuredHostname
      .toLowerCase()
      .replace(/^\[|\]$/g, '');
    const normalizedRequestHostname = requestHostname.toLowerCase();

    if (
      !LOOPBACK_HOSTNAMES.has(normalizedConfiguredHostname) ||
      normalizedRequestHostname === normalizedConfiguredHostname
    ) {
      return this.presignClient;
    }

    let client = this.derivedPresignClients.get(normalizedRequestHostname);
    if (!client) {
      client = makeClient(this.config, true, normalizedRequestHostname);
      this.derivedPresignClients.set(normalizedRequestHostname, client);
    }
    return client;
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
