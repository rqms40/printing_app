import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, MoreThan, Repository } from 'typeorm';
import { extname } from 'path';
import { createReadStream } from 'fs';
import { readFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import type { Readable } from 'stream';
import { FileMetadata, FilePurpose } from './entities/file-metadata.entity';
import { DELIVERY_PROOF_IMAGE_MIME_TYPES } from './files.constants';
import { StorageService } from '../storage/storage.service';
import { FileAnalysisService } from './file-analysis.service';
import {
  ALLOWED_MIME_TYPES,
  MIME_ALLOWED_EXTENSIONS,
  PAPER_MAX_FILE_SIZE_BYTES,
  PAPER_MAX_FILE_SIZE_MB,
  THREE_D_EXTENSIONS,
  THREE_D_MAX_FILE_SIZE_BYTES,
  THREE_D_MAX_FILE_SIZE_MB,
} from '../storage/storage.config';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    @InjectRepository(FileMetadata)
    private readonly fileRepo: Repository<FileMetadata>,
    private readonly storageService: StorageService,
    private readonly analysisService: FileAnalysisService,
  ) {}

  async storeMetadata(
    file: Express.Multer.File,
    uploadedBy?: number,
    purpose = 'general',
  ): Promise<FileMetadata> {
    try {
      const normalizedPurpose = this.normalizeUploadPurpose(purpose);
      const fileExt = extname(file.originalname).toLowerCase();
      const mimeOk = ALLOWED_MIME_TYPES.includes(file.mimetype);
      const extOk =
        MIME_ALLOWED_EXTENSIONS[file.mimetype]?.includes(fileExt) ?? false;
      const fileTypeAllowed = mimeOk && extOk;
      // Match MIME and filename extension. Generic browser fallbacks are still
      // accepted through MIME_ALLOWED_EXTENSIONS, but only for known extensions.
      if (!fileTypeAllowed) {
        throw new BadRequestException('File type not allowed');
      }
      const isThreeDFile = THREE_D_EXTENSIONS.includes(fileExt);
      const maxSizeBytes = isThreeDFile
        ? THREE_D_MAX_FILE_SIZE_BYTES
        : PAPER_MAX_FILE_SIZE_BYTES;
      const maxSizeMb = isThreeDFile
        ? THREE_D_MAX_FILE_SIZE_MB
        : PAPER_MAX_FILE_SIZE_MB;
      if (file.size > maxSizeBytes) {
        throw new BadRequestException(`File exceeds ${maxSizeMb} MB limit`);
      }

      const now = new Date();
      const datePath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
      const objectKey = `uploads/${normalizedPurpose}/${datePath}/${randomUUID()}${fileExt}`;

      // Run the original-file upload concurrently with content analysis.
      // Disk-backed uploads stream to object storage so large files do not sit
      // in Multer's heap buffer before the service can process them.
      const uploadPromise = (
        this.hasMemoryBuffer(file)
          ? this.storageService.upload(
              this.storageSource(file),
              objectKey,
              file.mimetype,
            )
          : this.storageService.upload(
              this.storageSource(file),
              objectKey,
              file.mimetype,
              file.size,
            )
      ).catch((err: unknown) => {
        this.logger.error('MinIO upload failed', err);
        throw new InternalServerErrorException('File upload failed');
      });

      const analysisPromise = this.readUploadBuffer(file)
        .then((buffer) =>
          this.analysisService.analyze(
            buffer,
            file.mimetype,
            file.originalname,
          ),
        )
        .catch((err: unknown) => {
          this.logger.warn(`File analysis failed (non-fatal): ${String(err)}`);
          return null;
        });

      const [url, analysis] = await Promise.all([
        uploadPromise,
        analysisPromise,
      ]);

      // For 3D models that produced a GLB preview, kick off the sibling upload
      // immediately. Failure is non-fatal — the original file is still saved.
      let previewGlbObjectKey: string | null = null;
      if (analysis?.glbBuffer && analysis.glbBuffer.length > 0) {
        const previewKey = `${objectKey}.preview.glb`;
        try {
          await this.storageService.upload(
            analysis.glbBuffer,
            previewKey,
            'model/gltf-binary',
          );
          previewGlbObjectKey = previewKey;
        } catch (err) {
          this.logger.warn(
            `Preview GLB upload failed for ${objectKey}: ${err}`,
          );
        }
      }

      const meta = this.fileRepo.create({
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url,
        objectKey,
        uploadedBy,
        purpose: normalizedPurpose,
        widthPt: analysis?.widthPt ?? null,
        heightPt: analysis?.heightPt ?? null,
        widthPx: analysis?.widthPx ?? null,
        heightPx: analysis?.heightPx ?? null,
        colorSpace: analysis?.colorSpace ?? null,
        pageCount: analysis?.pageCount ?? null,
        dpi: analysis?.dpi ?? null,
        model3dWidthMm: analysis?.model3dWidthMm ?? null,
        model3dDepthMm: analysis?.model3dDepthMm ?? null,
        model3dHeightMm: analysis?.model3dHeightMm ?? null,
        model3dTriangleCount: analysis?.model3dTriangleCount ?? null,
        previewGlbObjectKey,
      });
      return this.fileRepo.save(meta);
    } finally {
      await this.removeDiskUpload(file);
    }
  }

  private normalizeUploadPurpose(purpose: string): FilePurpose {
    const normalized = purpose.trim().toLowerCase().replace(/-/g, '_');
    const allowed = new Set<FilePurpose>([
      FilePurpose.GENERAL,
      FilePurpose.PAPER,
      FilePurpose.PROOF_OF_DELIVERY,
      FilePurpose.BETA_TESTIMONIAL,
    ]);
    if (!allowed.has(normalized as FilePurpose)) {
      throw new BadRequestException('File purpose not allowed');
    }
    return normalized as FilePurpose;
  }

  async resolveDeliveryProofFile(
    fileId: number,
    riderUserId: number,
    manager: EntityManager,
  ): Promise<FileMetadata> {
    const file = await manager.getRepository(FileMetadata).findOne({
      where: { id: fileId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!file) {
      throw new BadRequestException('Proof file not found');
    }
    if (file.uploadedBy !== riderUserId) {
      throw new BadRequestException('Proof file does not belong to this rider');
    }
    if (file.purpose !== FilePurpose.PROOF_OF_DELIVERY) {
      throw new BadRequestException('File is not a proof of delivery');
    }
    if (
      !DELIVERY_PROOF_IMAGE_MIME_TYPES.includes(
        file.mimeType as (typeof DELIVERY_PROOF_IMAGE_MIME_TYPES)[number],
      )
    ) {
      throw new BadRequestException('Proof file must be PNG, JPEG, or WebP');
    }
    if (!file.objectKey?.trim()) {
      throw new BadRequestException('Proof file has no storage object');
    }
    return file;
  }

  private hasMemoryBuffer(file: Express.Multer.File): boolean {
    return Buffer.isBuffer(file.buffer);
  }

  private storageSource(file: Express.Multer.File): Buffer | Readable {
    if (this.hasMemoryBuffer(file)) {
      return file.buffer;
    }
    if (file.path) {
      return createReadStream(file.path);
    }
    throw new BadRequestException('Uploaded file is missing content');
  }

  private readUploadBuffer(file: Express.Multer.File): Promise<Buffer> {
    if (this.hasMemoryBuffer(file)) {
      return Promise.resolve(file.buffer);
    }
    if (file.path) {
      return readFile(file.path);
    }
    return Promise.reject(
      new BadRequestException('Uploaded file is missing content'),
    );
  }

  private async removeDiskUpload(file: Express.Multer.File): Promise<void> {
    if (this.hasMemoryBuffer(file) || !file.path) return;
    try {
      await unlink(file.path);
    } catch (err) {
      this.logger.warn(
        `Failed to remove temporary upload ${file.path}: ${err}`,
      );
    }
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
    if (
      !isAdmin &&
      (file.uploadedBy == null || file.uploadedBy !== requestingUserId)
    ) {
      throw new ForbiddenException();
    }
    if (!file.objectKey) throw new NotFoundException('File has no storage key');
    try {
      return await this.storageService.getPresignedUrl(file.objectKey, 3600);
    } catch (err) {
      this.logger.error('Failed to generate presigned URL', err);
      throw new InternalServerErrorException(
        'Could not generate download link',
      );
    }
  }

  async getPresignedUrlForKey(objectKey: string, ttl: number): Promise<string> {
    return this.storageService.getPresignedUrl(objectKey, ttl);
  }

  /**
   * Permanently deletes a file the user owns: removes the original from
   * MinIO, the preview-GLB sibling (if any), and the DB row. Throws if the
   * caller doesn't own the file (admins bypass via `isAdmin`).
   */
  async deleteOwnedFile(
    fileId: number,
    requestingUserId: number,
    isAdmin: boolean,
  ): Promise<void> {
    const file = await this.fileRepo.findOne({ where: { id: fileId } });
    if (!file) throw new NotFoundException('File not found');
    if (
      !isAdmin &&
      (file.uploadedBy == null || file.uploadedBy !== requestingUserId)
    ) {
      throw new ForbiddenException();
    }

    // Delete MinIO objects first; tolerate "not found" so a partial state
    // (object already gone) still cleans up the DB row. Hard errors on the
    // primary object propagate so the caller knows storage is broken.
    if (file.objectKey) {
      try {
        await this.storageService.delete(file.objectKey);
      } catch (err) {
        this.logger.warn(
          `Primary object delete failed for ${file.objectKey}: ${err}`,
        );
      }
    }
    if (file.previewGlbObjectKey) {
      try {
        await this.storageService.delete(file.previewGlbObjectKey);
      } catch (err) {
        this.logger.warn(
          `Preview GLB delete failed for ${file.previewGlbObjectKey}: ${err}`,
        );
      }
    }
    await this.fileRepo.delete(fileId);
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

  async stampExpiry(
    fileMetadataId: number,
    retentionDays: number,
    manager?: EntityManager,
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + retentionDays);
    const repo = manager?.getRepository(FileMetadata) ?? this.fileRepo;
    await repo.update(fileMetadataId, { expiresAt });
  }

  async deleteExpired(): Promise<{
    found: number;
    deleted: number;
    skipped: number;
  }> {
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
          this.logger.error(
            `Failed to delete MinIO object ${file.objectKey}`,
            err,
          );
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
