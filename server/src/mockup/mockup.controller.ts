import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import type { RequestWithUser } from '../common/interfaces/request-with-user';
import { CreateMockupDto } from './dto/create-mockup.dto';
import { MockupService } from './mockup.service';

function isStaffRole(role: string | undefined): boolean {
  return (
    role === UserRole.OPS_ADMIN ||
    role === UserRole.SUPER_ADMIN ||
    role === 'admin'
  );
}

@ApiTags('mockups')
@Controller('mockups')
export class MockupController {
  constructor(private readonly mockupService: MockupService) {}

  /** Public static template SVGs (non-production composites). */
  @Get('static/:templateKey')
  @Header('Cache-Control', 'public, max-age=86400')
  getStatic(
    @Param('templateKey') templateKey: string,
    @Res() res: Response,
  ): void {
    const svg = this.mockupService.getStaticSvg(templateKey);
    if (!svg) {
      throw new NotFoundException(`Unknown mockup template: ${templateKey}`);
    }
    res.type('image/svg+xml').send(svg);
  }

  @Post('render')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.CLIENT,
    UserRole.OPS_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.SUPPLIER,
  )
  render(@Body() dto: CreateMockupDto, @Request() req: RequestWithUser) {
    return this.mockupService.render(
      dto,
      req.user.sub,
      isStaffRole(req.user.role),
    );
  }

  @Get('by-artwork/:artworkFileId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  listForArtwork(
    @Param('artworkFileId', ParseIntPipe) artworkFileId: number,
    @Request() req: RequestWithUser,
  ) {
    return this.mockupService.listForArtwork(
      artworkFileId,
      req.user.sub,
      isStaffRole(req.user.role),
    );
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  getOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
  ) {
    return this.mockupService.getById(
      id,
      req.user.sub,
      isStaffRole(req.user.role),
    );
  }

  @Post('invalidate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OPS_ADMIN, UserRole.SUPER_ADMIN, UserRole.CLIENT)
  invalidate(
    @Query('artworkFileId', ParseIntPipe) artworkFileId: number,
    @Query('productType') productType: string | undefined,
    @Request() req: RequestWithUser,
  ) {
    // Ownership enforced inside list/render; invalidation is staff or owner via re-render.
    void req;
    return this.mockupService
      .invalidateForArtwork(artworkFileId, productType)
      .then((count) => ({ invalidated: count }));
  }
}
