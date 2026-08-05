import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import type { RequestWithUser } from '../common/interfaces/request-with-user';
import { PayoutsService } from './payouts.service';
import { PayoutSettlementState } from './entities/payout.entity';

class ApprovePayoutDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  settlementReference?: string | null;
}

@ApiTags('payouts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payouts')
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get()
  @Roles(UserRole.OPS_ADMIN, UserRole.SUPER_ADMIN)
  list(
    @Query('settlementState') settlementState?: PayoutSettlementState,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.payoutsService.list({
      settlementState: settlementState as PayoutSettlementState | undefined,
      supplierId: supplierId ? Number(supplierId) : undefined,
    });
  }

  /** Supplier portal / mobile: own payouts only. */
  @Get('mine')
  @Roles(UserRole.SUPPLIER)
  listMine(@Request() req: RequestWithUser) {
    return this.payoutsService.listForSupplierUser(req.user.sub);
  }

  @Get('mine/:id')
  @Roles(UserRole.SUPPLIER)
  getMine(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
  ) {
    return this.payoutsService.assertSupplierOwnsPayout(id, req.user.sub);
  }

  @Get(':id')
  @Roles(UserRole.OPS_ADMIN, UserRole.SUPER_ADMIN)
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.payoutsService.findById(id);
  }

  /** Approve / release supplier payout (COD recon gate enforced). */
  @Post(':id/approve')
  @Roles(UserRole.OPS_ADMIN, UserRole.SUPER_ADMIN)
  approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApprovePayoutDto,
    @Request() req: RequestWithUser,
  ) {
    return this.payoutsService.approveRelease(
      id,
      req.user.sub,
      req.user.role,
      dto?.settlementReference,
    );
  }
}
