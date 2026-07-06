import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  Request,
  ForbiddenException,
  HttpCode,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { ApiBearerAuth, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FilesService } from './files.service';
import { PresignedUrlResponseDto } from './dto/presigned-url.dto';
import { FileInspectionDto } from './dto/file-inspection.dto';
import { PaperSizeValidatorService } from './paper-size-validator.service';
import { PrinterProfileService } from '../printer-profile/printer-profile.service';
import { PT_TO_MM } from './files.constants';
import type { RequestWithUser } from '../common/interfaces/request-with-user';

const UPLOAD_TMP_DIR = join(tmpdir(), 'gridgo-uploads');

@ApiTags('files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(
    private filesService: FilesService,
    private paperSizeValidator: PaperSizeValidatorService,
    private printerProfileService: PrinterProfileService,
  ) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          mkdirSync(UPLOAD_TMP_DIR, { recursive: true });
          cb(null, UPLOAD_TMP_DIR);
        },
        filename: (_req, file, cb) => {
          cb(
            null,
            `${randomUUID()}${extname(file.originalname).toLowerCase()}`,
          );
        },
      }),
      // Match the largest allowed type (3D files at 200 MB). Multer
      // rejects anything larger before it reaches application code.
      limits: { fileSize: 200 * 1024 * 1024 },
    }),
  )
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: RequestWithUser,
    @Body('purpose') purpose?: string,
  ) {
    return this.filesService.storeMetadata(file, req.user?.sub, purpose);
  }

  // NOTE: 'my-uploads' must be declared before ':id' so the literal string
  // is not parsed as an integer by ParseIntPipe.
  @Get('my-uploads')
  getMyUploads(@Request() req: RequestWithUser) {
    return this.filesService.getMyUploads(req.user.sub);
  }

  @Get(':id/presigned-url')
  async getPresignedUrl(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
  ): Promise<PresignedUrlResponseDto> {
    const isAdmin = req.user.role === 'admin';
    const url = await this.filesService.getPresignedUrl(
      id,
      req.user.sub,
      isAdmin,
    );
    return { url };
  }

  @Get(':id/inspect')
  async inspect(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
    @Query('paperSize') paperSize?: string,
  ): Promise<FileInspectionDto> {
    const file = await this.filesService.findById(id);
    const isAdmin = req.user.role === 'admin';
    if (
      !isAdmin &&
      (file.uploadedBy == null || file.uploadedBy !== req.user.sub)
    ) {
      throw new ForbiddenException();
    }
    const widthMm = file.widthPt ? Number(file.widthPt) * PT_TO_MM : null;
    const heightMm = file.heightPt ? Number(file.heightPt) * PT_TO_MM : null;

    const has3d =
      file.model3dWidthMm != null &&
      file.model3dDepthMm != null &&
      file.model3dHeightMm != null;

    let modelBounds: FileInspectionDto['modelBounds'] = null;
    let printerLimits: FileInspectionDto['printerLimits'] = null;

    if (has3d) {
      const w = Number(file.model3dWidthMm);
      const d = Number(file.model3dDepthMm);
      const h = Number(file.model3dHeightMm);
      modelBounds = {
        widthMm: w,
        depthMm: d,
        heightMm: h,
        triangleCount: file.model3dTriangleCount ?? null,
        unit: 'mm' as const,
      };
      const profile = await this.printerProfileService.getProfile();
      const overflowAxes: ('width' | 'depth' | 'height')[] = [];
      if (w > profile.buildVolumeWidthMm) overflowAxes.push('width');
      if (d > profile.buildVolumeDepthMm) overflowAxes.push('depth');
      if (h > profile.buildVolumeHeightMm) overflowAxes.push('height');
      printerLimits = {
        profileName: profile.name,
        widthMm: profile.buildVolumeWidthMm,
        depthMm: profile.buildVolumeDepthMm,
        heightMm: profile.buildVolumeHeightMm,
        maxFileSizeMb: profile.maxFileSizeMb,
        fits: overflowAxes.length === 0,
        overflowAxes,
      };
    }

    // Always surface a presigned URL the mobile client can fetch. We use the
    // presigned flow (which honors MINIO_PUBLIC_URL) so the URL is reachable
    // when the user accesses the app via a LAN IP rather than localhost.
    //
    // - 3MF / STL / OBJ → server-built GLB sibling at file.previewGlbObjectKey
    // - GLB / GLTF      → the original object IS the renderable preview
    let previewGlbUrl: string | null = null;
    const ext = file.originalName
      ? file.originalName
          .toLowerCase()
          .slice(file.originalName.lastIndexOf('.'))
      : '';
    const isNativelyRenderable =
      ext === '.glb' || ext === '.gltf' || ext === '.obj';
    const previewKey = file.previewGlbObjectKey
      ? file.previewGlbObjectKey
      : isNativelyRenderable
        ? file.objectKey
        : null;
    if (previewKey) {
      try {
        previewGlbUrl = await this.filesService.getPresignedUrlForKey(
          previewKey,
          3600,
        );
      } catch {
        /* non-fatal */
      }
    }

    return {
      mimeType: file.mimeType,
      widthMm,
      heightMm,
      widthPx: file.widthPx,
      heightPx: file.heightPx,
      colorSpace: file.colorSpace,
      pageCount: file.pageCount,
      dpi: file.dpi,
      sizeValidation: paperSize
        ? this.paperSizeValidator.validate(
            {
              widthPt: file.widthPt ? Number(file.widthPt) : null,
              heightPt: file.heightPt ? Number(file.heightPt) : null,
              widthPx: file.widthPx,
              heightPx: file.heightPx,
              dpi: file.dpi,
            },
            paperSize,
          )
        : null,
      modelBounds,
      printerLimits,
      previewGlbUrl,
    };
  }

  @Get(':id')
  async getFile(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
  ) {
    const file = await this.filesService.findById(id);
    const isAdmin = req.user.role === 'admin';
    if (
      !isAdmin &&
      (file.uploadedBy == null || file.uploadedBy !== req.user.sub)
    ) {
      throw new ForbiddenException();
    }
    return file;
  }

  @Delete(':id')
  @HttpCode(204)
  async deleteFile(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
  ): Promise<void> {
    const isAdmin = req.user.role === 'admin';
    await this.filesService.deleteOwnedFile(id, req.user.sub, isAdmin);
  }
}
