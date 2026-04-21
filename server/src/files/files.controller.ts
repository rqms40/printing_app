import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FilesService } from './files.service';
import { PresignedUrlResponseDto } from './dto/presigned-url.dto';
import type { RequestWithUser } from '../common/interfaces/request-with-user';

@ApiTags('files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private filesService: FilesService) {}

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
    const url = await this.filesService.getPresignedUrl(id, req.user.sub, isAdmin);
    return { url };
  }

  @Get(':id')
  getFile(@Param('id', ParseIntPipe) id: number) {
    return this.filesService.findById(id);
  }
}
