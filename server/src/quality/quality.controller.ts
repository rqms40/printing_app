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
import { QualityDecisionDto } from './dto/quality-decision.dto';
import { QualityService } from './quality.service';

@ApiTags('ops-qa')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ops/qa')
export class QualityController {
  constructor(private readonly qualityService: QualityService) {}

  /**
   * Shared Pickup QA checklist definition (supplier, rider, ops).
   * Authenticated so mobile/web clients can render the same lines the server enforces.
   */
  @Get('pickup-checklist')
  @Roles('ops_admin', 'super_admin', 'supplier', 'rider')
  @UseGuards(RolesGuard)
  getPickupChecklistDefinition() {
    return this.qualityService.getPickupQaChecklistDefinition();
  }

  /** Supplier + rider pickup QA submissions for ops/superadmin review. */
  @Get('pickup-submissions')
  @Roles('ops_admin', 'super_admin')
  @UseGuards(RolesGuard)
  getPickupQaQueue() {
    return this.qualityService.getPickupQaQueue();
  }

  @Get('pickup-submissions/:id')
  @Roles('ops_admin', 'super_admin')
  @UseGuards(RolesGuard)
  getPickupQaSubmission(@Param('id', ParseIntPipe) id: number) {
    return this.qualityService.getPickupQaSubmission(id);
  }

  /** Orders awaiting Ops QA (`submitted` + `needs_qa`). */
  @Get('queue')
  @Roles('ops_admin', 'super_admin')
  @UseGuards(RolesGuard)
  getQueue() {
    return this.qualityService.getQueue();
  }

  /** Workspace detail with signed artwork URL (ops only). */
  @Get(':orderId')
  @Roles('ops_admin', 'super_admin')
  @UseGuards(RolesGuard)
  getWorkspace(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Request() req: RequestWithUser,
  ) {
    return this.qualityService.getWorkspace(
      orderId,
      {
        userId: req.user.sub,
        role: req.user.role as TransitionActor,
      },
      req.hostname,
    );
  }

  /** Record QA decision, QualityReview row, status history + audit. */
  @Post(':orderId/decision')
  @Roles('ops_admin', 'super_admin')
  @UseGuards(RolesGuard)
  recordDecision(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: QualityDecisionDto,
    @Request() req: RequestWithUser,
  ) {
    return this.qualityService.recordDecision(orderId, dto, {
      userId: req.user.sub,
      role: req.user.role as TransitionActor,
    });
  }
}
