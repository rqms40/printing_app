import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  Request,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import {
  FailCodCollectionDto,
  RecordCodCollectionDto,
  ReconcileCodCollectionDto,
} from './dto/cod-collection.dto';
import { RejectQrPaymentDto } from './dto/qr-payment.dto';
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
   * Rider/ops: mark COD cash collection failed (no cash / refused).
   */
  @Post('cod/:orderId/fail')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('rider', 'ops_admin', 'super_admin')
  failCodCollection(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: FailCodCollectionDto,
  ) {
    return this.paymentsService.recordCashCollectionFailed(orderId, dto);
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

  /**
   * Ops/Super Admin: list COD collections for recon queue.
   * Query: status=collected|pending|failed|reconciled (default collected).
   */
  @Get('cod')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ops_admin', 'super_admin')
  listCodCollections(@Query('status') status?: string) {
    const allowed = new Set(['pending', 'collected', 'failed', 'reconciled']);
    const normalized = status && allowed.has(status) ? status : 'collected';
    return this.paymentsService.listCodCollections(normalized as any);
  }

  @Get('cod/:orderId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ops_admin', 'super_admin', 'rider')
  getCodCollection(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.paymentsService.getCodCollectionByOrder(orderId);
  }

  /**
   * Ops/Super Admin: list QR Ph (Instapay) payment receipts for verification.
   * Query: status=pending|verified|rejected (default: all).
   */
  @Get('qr-receipts')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ops_admin', 'super_admin')
  listQrReceipts(@Query('status') status?: string) {
    return this.paymentsService.listQrPaymentReceipts(status);
  }

  @Get('qr-receipts/pending-count')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ops_admin', 'super_admin')
  pendingQrReceiptCount() {
    return this.paymentsService
      .getPendingQrReceiptCount()
      .then((count) => ({ count }));
  }

  @Post('qr-receipts/:id/verify')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ops_admin', 'super_admin')
  verifyQrReceipt(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
  ) {
    return this.paymentsService.verifyQrPaymentReceipt(id, req.user.sub);
  }

  @Post('qr-receipts/:id/reject')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ops_admin', 'super_admin')
  rejectQrReceipt(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectQrPaymentDto,
    @Request() req: RequestWithUser,
  ) {
    return this.paymentsService.rejectQrPaymentReceipt(
      id,
      req.user.sub,
      dto?.reason,
    );
  }
}
