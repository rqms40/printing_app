import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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

  /** Supplier reads own profile. */
  @Get('me')
  @Roles(UserRole.SUPPLIER)
  getMine(@Request() req: RequestWithUser) {
    return this.suppliersService.findByUserId(req.user.sub);
  }

  /** Ops admin + super admin list all supplier profiles. */
  @Get()
  @Roles(UserRole.OPS_ADMIN, UserRole.SUPER_ADMIN)
  findAll() {
    return this.suppliersService.findAll();
  }

  /** Ops/super admin read any; supplier read own only. */
  @Get(':id')
  @Roles(UserRole.SUPPLIER, UserRole.OPS_ADMIN, UserRole.SUPER_ADMIN)
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
  ) {
    const profile = await this.suppliersService.findById(id);
    if (req.user.role === 'supplier' && profile.userId !== req.user.sub) {
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

  /** Super admin updates profile fields. */
  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSupplierProfileDto,
  ) {
    return this.suppliersService.updateProfile(id, dto);
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
    if (req.user.role === 'supplier') {
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
