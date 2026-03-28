import { Controller, Post, Get, Param, UseGuards, UseInterceptors, UploadedFile, ParseIntPipe, Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FilesService } from './files.service';

@ApiTags('files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private filesService: FilesService) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
    return this.filesService.storeMetadata(file, req.user?.sub);
  }

  @Get(':id')
  getFile(@Param('id', ParseIntPipe) id: number) {
    return this.filesService.findById(id);
  }
}
