import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { DailyGridService } from './daily-grid.service';
import { CreateDailyGridCardDto } from './dto/create-daily-grid-card.dto';
import { UpdateDailyGridCardDto } from './dto/update-daily-grid-card.dto';
import { StorageService } from '../storage/storage.service';

@ApiTags('daily-grid')
@Controller('daily-grid')
export class DailyGridController {
  constructor(
    private readonly service: DailyGridService,
    private readonly storageService: StorageService,
  ) {}

  /** Public — customer home screen carousel. */
  @Get()
  findActive() {
    return this.service.findActive();
  }

  /** Admin — all cards including inactive. */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin')
  findAll() {
    return this.service.findAll();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('admin')
  create(@Body() dto: CreateDailyGridCardDto) {
    return this.service.create(dto);
  }

  /** Must be declared before :id to avoid route collision. */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('admin/reorder')
  reorder(@Body() body: { ids: number[] }) {
    return this.service.reorder(body.ids);
  }

  /** Must be declared before :id to avoid route collision. */
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('admin/upload-image')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ url: string }> {
    if (!file) throw new BadRequestException('No file provided');
    const ext = (file.originalname.split('.').pop() ?? 'jpg').toLowerCase();
    const objectKey = `daily-grid/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const url = await this.storageService.upload(
      file.buffer,
      objectKey,
      file.mimetype,
    );
    return { url };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('admin/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDailyGridCardDto,
  ) {
    return this.service.update(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete('admin/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
