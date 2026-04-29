import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FilesService } from './files.service';
import { PresignedUrlResponseDto } from './dto/presigned-url.dto';
import { FileInspectionDto } from './dto/file-inspection.dto';
import { PaperSizeValidatorService } from './paper-size-validator.service';
import { PT_TO_MM } from './files.constants';
import type { RequestWithUser } from '../common/interfaces/request-with-user';

@ApiTags('files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(
    private filesService: FilesService,
    private paperSizeValidator: PaperSizeValidatorService,
  ) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: RequestWithUser,
  ) {
    return this.filesService.storeMetadata(file, req.user?.sub);
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
    if (!isAdmin && (file.uploadedBy == null || file.uploadedBy !== req.user.sub)) {
      throw new ForbiddenException();
    }
    const widthMm = file.widthPt ? Number(file.widthPt) * PT_TO_MM : null;
    const heightMm = file.heightPt ? Number(file.heightPt) * PT_TO_MM : null;
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
    };
  }

  @Get(':id')
  getFile(@Param('id', ParseIntPipe) id: number) {
    return this.filesService.findById(id);
  }
}
