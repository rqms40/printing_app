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
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ops_admin', 'super_admin')
@Controller('ops/qa')
export class QualityController {
  constructor(private readonly qualityService: QualityService) {}

  /** Orders awaiting Ops QA (`submitted` + `needs_qa`). */
  @Get('queue')
  getQueue() {
    return this.qualityService.getQueue();
  }

  /** Workspace detail with signed artwork URL (ops only). */
  @Get(':orderId')
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
