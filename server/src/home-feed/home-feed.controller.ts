import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { MIME_TO_EXT } from '../storage/storage.config';
import { StorageService } from '../storage/storage.service';
import { UserRole } from '../users/entities/user.entity';
import { CreateHomeFeedPromoCardDto } from './dto/create-home-feed-promo-card.dto';
import { ReorderHomeFeedPromoCardsDto } from './dto/reorder-home-feed-promo-cards.dto';
import { UpdateHomeFeedPromoCardDto } from './dto/update-home-feed-promo-card.dto';
import { UpdateHomeFeedSettingsDto } from './dto/update-home-feed-settings.dto';
import { HomeFeedService } from './home-feed.service';

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

@ApiTags('home-feed')
@ApiBearerAuth()
@Controller('home-feed')
export class HomeFeedController {
  constructor(
    private readonly service: HomeFeedService,
    private readonly storageService: StorageService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  getHomeFeed() {
    return this.service.getHomeFeed();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('settings')
  getSettings() {
    return this.service.getSettings();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('settings')
  updateSettings(@Body() dto: UpdateHomeFeedSettingsDto) {
    return this.service.updateSettings(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('promo-cards')
  getPromoCards() {
    return this.service.getPromoCards();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('promo-cards')
  createPromoCard(@Body() dto: CreateHomeFeedPromoCardDto) {
    return this.service.createPromoCard(dto);
  }

  /** Must be declared before :id to avoid route collision. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('promo-cards/reorder')
  reorderPromoCards(@Body() dto: ReorderHomeFeedPromoCardsDto) {
    return this.service.reorderPromoCards(dto.ids);
  }

  @ApiConsumes('multipart/form-data')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/upload-image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (
          IMAGE_MIME_TYPES.includes(
            file.mimetype as (typeof IMAGE_MIME_TYPES)[number],
          )
        ) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(`Unsupported file type: ${file.mimetype}`),
            false,
          );
        }
      },
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ url: string }> {
    if (!file) throw new BadRequestException('No file provided');
    const ext = MIME_TO_EXT[file.mimetype] ?? '';
    const objectKey = `home-feed/${randomUUID()}${ext}`;
    const url = await this.storageService.upload(
      file.buffer,
      objectKey,
      file.mimetype,
    );
    return { url };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('promo-cards/:id')
  updatePromoCard(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHomeFeedPromoCardDto,
  ) {
    return this.service.updatePromoCard(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete('promo-cards/:id')
  removePromoCard(@Param('id', ParseIntPipe) id: number) {
    return this.service.removePromoCard(id);
  }
}
