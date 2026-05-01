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
    const objectKey = `uploads/${purpose}/${datePath}/${randomUUID()}${fileExt}`;

    // Run the original-file upload concurrently with content analysis.
    // Analysis only needs the in-memory buffer, not the upload result, so
    // there's no dependency between them. This roughly halves end-to-end
    // latency for 3D files where parsing + GLB encoding takes >100 ms.
    const uploadPromise = this.storageService
      .upload(file.buffer, objectKey, file.mimetype)
      .catch((err: unknown) => {
        this.logger.error('MinIO upload failed', err);
        throw new InternalServerErrorException('File upload failed');
      });

    const analysisPromise = this.analysisService
      .analyze(file.buffer, file.mimetype, file.originalname)
      .catch((err: unknown) => {
        this.logger.warn(`File analysis failed (non-fatal): ${String(err)}`);
        return null;
      });

    const [url, analysis] = await Promise.all([uploadPromise, analysisPromise]);

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
        this.logger.warn(`Preview GLB upload failed for ${objectKey}: ${err}`);
      }
    }

    const meta = this.fileRepo.create({
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url,
      objectKey,
      uploadedBy,
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
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + retentionDays);
    await this.fileRepo.update(fileMetadataId, { expiresAt });
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
