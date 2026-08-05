import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import type { RequestWithUser } from '../common/interfaces/request-with-user';
import { SuperService } from './super.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { SetRiderVerificationDto } from './dto/set-rider-verification.dto';

@ApiTags('super')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('super')
export class SuperController {
  constructor(private readonly superService: SuperService) {}

  /** Paginated append-only audit log (super_admin). */
  @Get('audit')
  @Roles(UserRole.SUPER_ADMIN)
  listAudit(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('orderId') orderId?: string,
    @Query('actorId') actorId?: string,
  ) {
    return this.superService.listAudit({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      action,
      entityType,
      orderId: orderId ? Number(orderId) : undefined,
      actorId: actorId ? Number(actorId) : undefined,
    });
  }

  /** Platform health + governance counters. */
  @Get('health')
  @Roles(UserRole.SUPER_ADMIN)
  health() {
    return this.superService.platformHealth();
  }

  /** Super-only role assignment. */
  @Patch('users/:id/role')
  @Roles(UserRole.SUPER_ADMIN)
  async updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserRoleDto,
    @Request() req: RequestWithUser,
  ) {
    const user = await this.superService.updateUserRole(
      id,
      dto.role,
      req.user.sub,
      req.user.role,
    );
    const { passwordHash: _ph, ...safe } = user;
    return safe;
  }

  @Get('riders/verification')
  @Roles(UserRole.SUPER_ADMIN)
  listRiderVerification() {
    return this.superService.listRidersForVerification();
  }

  @Patch('riders/:id/verification')
  @Roles(UserRole.SUPER_ADMIN)
  setRiderVerification(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetRiderVerificationDto,
    @Request() req: RequestWithUser,
  ) {
    return this.superService.setRiderVerification(
      id,
      dto.status,
      req.user.sub,
      dto.notes,
    );
  }
}
