import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import type { RequestWithUser } from '../common/interfaces/request-with-user';
import type { TransitionActor } from '../orders/order-status-transition';
import { AssignSupplierDto } from './dto/assign-supplier.dto';
import { MatchingService } from './matching.service';

@ApiTags('ops-matching')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ops_admin', 'super_admin')
@Controller('ops/matching')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  /** Ranked eligible suppliers for an order in approved_for_matching. */
  @Get(':orderId/candidates')
  getCandidates(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.matchingService.getCandidates(orderId);
  }

  /** Current (latest) supplier assignment for the order, if any. */
  @Get(':orderId/assignment')
  getAssignment(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.matchingService.getAssignmentForOrder(orderId);
  }

  /** Ops selects a specific eligible supplier. */
  @Post(':orderId/assign')
  assign(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: AssignSupplierDto,
    @Request() req: RequestWithUser,
  ) {
    return this.matchingService.assign(
      orderId,
      dto.supplierId,
      {
        userId: req.user.sub,
        role: req.user.role as TransitionActor,
      },
      dto.notes,
    );
  }

  /** Auto-match top-ranked eligible supplier. */
  @Post(':orderId/auto-match')
  autoMatch(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Request() req: RequestWithUser,
  ) {
    return this.matchingService.autoMatch(orderId, {
      userId: req.user.sub,
      role: req.user.role as TransitionActor,
    });
  }
}
