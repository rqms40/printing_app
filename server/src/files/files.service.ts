import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { FileMetadata } from './entities/file-metadata.entity';
import { StorageService } from '../storage/storage.service';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '../storage/storage.config';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    @InjectRepository(FileMetadata)
    private readonly fileRepo: Repository<FileMetadata>,
    private readonly storageService: StorageService,
  ) {}

  async storeMetadata(
    file: Express.Multer.File,
    uploadedBy?: number,
    purpose = 'general',
  ): Promise<FileMetadata> {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('File type not allowed');
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File exceeds 20 MB limit');
    }

    const ext = extname(file.originalname).toLowerCase();
    const now = new Date();
    const datePath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    const objectKey = `uploads/${purpose}/${datePath}/${randomUUID()}${ext}`;

    let url: string;
    try {
      url = await this.storageService.upload(
        file.buffer,
        objectKey,
        file.mimetype,
      );
    } catch (err) {
      this.logger.error('MinIO upload failed', err);
      throw new InternalServerErrorException('File upload failed');
    }

    const meta = this.fileRepo.create({
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url,
      objectKey,
      uploadedBy,
    });
    return this.fileRepo.save(meta);
  }

  async findById(id: number): Promise<FileMetadata> {
    const file = await this.fileRepo.findOne({ where: { id } });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }

  async getPresignedUrl(
    fileId: number,
    requestingUserId: number,
    isAdmin: boolean,
  ): Promise<string> {
    const file = await this.fileRepo.findOne({ where: { id: fileId } });
    if (!file) throw new NotFoundException('File not found');
    if (!isAdmin && (file.uploadedBy == null || file.uploadedBy !== requestingUserId)) {
      throw new ForbiddenException();
    }
    if (!file.objectKey) throw new NotFoundException('File has no storage key');
    try {
      return await this.storageService.getPresignedUrl(file.objectKey, 3600);
    } catch (err) {
      this.logger.error('Failed to generate presigned URL', err);
      throw new InternalServerErrorException('Could not generate download link');
    }
  }

  async getMyUploads(userId: number): Promise<FileMetadata[]> {
    const now = new Date();
    return this.fileRepo.find({
      where: [
        { uploadedBy: userId, expiresAt: IsNull() },
        { uploadedBy: userId, expiresAt: MoreThan(now) },
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async stampExpiry(fileMetadataId: number, retentionDays: number): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + retentionDays);
    await this.fileRepo.update(fileMetadataId, { expiresAt });
  }

  async deleteExpired(): Promise<{ found: number; deleted: number; skipped: number }> {
    const now = new Date();
    const expired = await this.fileRepo
      .createQueryBuilder('fm')
      .where('fm.expires_at IS NOT NULL')
      .andWhere('fm.expires_at <= :now', { now })
      .getMany();

    let deleted = 0;
    let skipped = 0;

    for (const file of expired) {
      if (file.objectKey) {
        try {
          await this.storageService.delete(file.objectKey);
        } catch (err) {
          this.logger.error(`Failed to delete MinIO object ${file.objectKey}`, err);
          skipped++;
          continue;
        }
      }
      await this.fileRepo.delete(file.id);
      deleted++;
    }

    return { found: expired.length, deleted, skipped };
  }
}
