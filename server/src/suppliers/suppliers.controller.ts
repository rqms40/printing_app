import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import type { RequestWithUser } from '../common/interfaces/request-with-user';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierProfileDto } from './dto/create-supplier-profile.dto';
import { UpdateSupplierProfileDto } from './dto/update-supplier-profile.dto';
import { SetSupplierVerificationDto } from './dto/set-supplier-verification.dto';
import { CreateSupplierCapabilityDto } from './dto/create-supplier-capability.dto';

@ApiTags('suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  /**
   * Access gate for supplier UIs. Allowed even when pending/under_review
   * so clients can show a verification wall (not the jobs interface).
   */
  @Get('me/access')
  @Roles(UserRole.SUPPLIER)
  getAccess(@Request() req: RequestWithUser) {
    return this.suppliersService.getAccessStatus(req.user.sub);
  }

  /** Supplier reads own profile (includes verification status + logo URL). */
  @Get('me')
  @Roles(UserRole.SUPPLIER)
  getMine(@Request() req: RequestWithUser) {
    return this.suppliersService.findByUserId(req.user.sub);
  }

  /** Supplier self-edit (verified only): business details, zones, attributes, logo. */
  @Patch('me')
  @Roles(UserRole.SUPPLIER)
  updateMine(
    @Request() req: RequestWithUser,
    @Body() dto: UpdateSupplierProfileDto,
  ) {
    return this.suppliersService.updateOwnProfile(req.user.sub, dto);
  }

  /**
   * Service-focus ranking (onboarding + settings).
   * Allowed for pending suppliers so first-login setup works before verification.
   */
  @Patch('me/service-focus')
  @Roles(UserRole.SUPPLIER)
  updateServiceFocus(
    @Request() req: RequestWithUser,
    @Body() dto: UpdateSupplierProfileDto,
  ) {
    if (!dto.serviceFocusRanks?.length) {
      return this.suppliersService.updateOwnServiceFocusRanks(req.user.sub, []);
    }
    return this.suppliersService.updateOwnServiceFocusRanks(
      req.user.sub,
      dto.serviceFocusRanks,
    );
  }

  /** Supplier adds a product capability / attribute family. */
  @Post('me/capabilities')
  @Roles(UserRole.SUPPLIER)
  addMineCapability(
    @Request() req: RequestWithUser,
    @Body() dto: CreateSupplierCapabilityDto,
  ) {
    return this.suppliersService.addOwnCapability(req.user.sub, dto);
  }

  /** Supplier removes own capability. */
  @Delete('me/capabilities/:capabilityId')
  @Roles(UserRole.SUPPLIER)
  removeMineCapability(
    @Request() req: RequestWithUser,
    @Param('capabilityId', ParseIntPipe) capabilityId: number,
  ) {
    return this.suppliersService.removeOwnCapability(
      req.user.sub,
      capabilityId,
    );
  }

  /** Ops admin + super admin list all supplier profiles. */
  @Get()
  @Roles(UserRole.OPS_ADMIN, UserRole.SUPER_ADMIN)
  findAll() {
    return this.suppliersService.findAll();
  }

  /**
   * Ops directory: profiles + ranked service focus + order/review stats.
   * Must be declared before :id.
   */
  @Get('directory')
  @Roles(UserRole.OPS_ADMIN, UserRole.SUPER_ADMIN)
  directory() {
    return this.suppliersService.listDirectory();
  }

  /**
   * Leaderboards: most reviews or most orders received.
   * Query: ?metric=reviews|orders&limit=20
   */
  @Get('leaderboard')
  @Roles(UserRole.OPS_ADMIN, UserRole.SUPER_ADMIN)
  leaderboard(
    @Query('metric') metric?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const by = metric === 'orders' || metric === 'reviews' ? metric : 'reviews';
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(limitRaw ?? '20', 10) || 20),
    );
    return this.suppliersService.leaderboard(by, limit);
  }

  /** Ops/super admin read any; supplier read own only. */
  @Get(':id')
  @Roles(UserRole.SUPPLIER, UserRole.OPS_ADMIN, UserRole.SUPER_ADMIN)
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
  ) {
    const profile = await this.suppliersService.findById(id);
    if (
      req.user.role === UserRole.SUPPLIER &&
      profile.userId !== req.user.sub
    ) {
      throw new ForbiddenException(
        'You can only read your own supplier profile',
      );
    }
    return profile;
  }

  /** Super admin creates a supplier profile for a user. */
  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateSupplierProfileDto) {
    return this.suppliersService.createProfile(dto);
  }

  /** Super admin updates profile fields (including isActive). */
  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSupplierProfileDto,
    @Request() req: RequestWithUser,
  ) {
    return this.suppliersService.updateProfile(id, dto, {
      allowIsActive: true,
      actorUserId: req.user.sub,
    });
  }

  /**
   * Write verification status — super_admin only.
   * Ops admin may read verification via profile GET; not write.
   */
  @Patch(':id/verification')
  @Roles(UserRole.SUPER_ADMIN)
  setVerification(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetSupplierVerificationDto,
    @Request() req: RequestWithUser,
  ) {
    return this.suppliersService.setVerification(id, dto, req.user.sub);
  }

  @Get(':id/capabilities')
  @Roles(UserRole.SUPPLIER, UserRole.OPS_ADMIN, UserRole.SUPER_ADMIN)
  async listCapabilities(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
  ) {
    if (req.user.role === UserRole.SUPPLIER) {
      const profile = await this.suppliersService.findById(id);
      if (profile.userId !== req.user.sub) {
        throw new ForbiddenException(
          'You can only read your own supplier capabilities',
        );
      }
    }
    return this.suppliersService.listCapabilities(id);
  }

  @Post(':id/capabilities')
  @Roles(UserRole.SUPER_ADMIN)
  addCapability(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateSupplierCapabilityDto,
  ) {
    return this.suppliersService.addCapability(id, dto);
  }
}
