import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import {
  RecordCodCollectionDto,
  ReconcileCodCollectionDto,
} from './dto/cod-collection.dto';
import type { RequestWithUser } from '../common/interfaces/request-with-user';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('intent')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  createIntent(@Body() dto: CreatePaymentIntentDto) {
    return this.paymentsService.createIntent(dto);
  }

  @Post('confirm/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  confirmPayment(@Param('id', ParseIntPipe) id: number) {
    return this.paymentsService.confirmPayment(id);
  }

  @Post('webhook')
  handleWebhook(@Body() payload: Record<string, any>) {
    return this.paymentsService.handleWebhook(payload);
  }

  @Post('refund/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ops_admin', 'super_admin')
  initiateRefund(@Param('id', ParseIntPipe) id: number) {
    return this.paymentsService.initiateRefund(id);
  }

  /**
   * Rider/ops: record COD cash collection with OTP/photo proof → cash_collected.
   */
  @Post('cod/:orderId/collect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('rider', 'ops_admin', 'super_admin')
  recordCodCollection(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: RecordCodCollectionDto,
  ) {
    return this.paymentsService.recordCashCollection(orderId, dto);
  }

  /**
   * Ops/Super Admin: reconcile collected COD cash → cash_reconciled.
   * Required before supplier payout release when method is COD.
   */
  @Post('cod/:orderId/reconcile')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ops_admin', 'super_admin')
  reconcileCodCollection(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: ReconcileCodCollectionDto,
    @Request() req: RequestWithUser,
  ) {
    return this.paymentsService.reconcileCodCollection(
      orderId,
      req.user.sub,
      dto,
    );
  }

  @Get('cod/:orderId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ops_admin', 'super_admin', 'rider')
  getCodCollection(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.paymentsService.getCodCollectionByOrder(orderId);
  }
}
