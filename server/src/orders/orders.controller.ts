import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { OrdersService } from './orders.service';
import { CreateBatchOrderDto, CreateOrderDto } from './dto/create-order.dto';
import { QuoteOrderDto } from './dto/quote-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateManualStatusDto } from './dto/update-manual-status.dto';
import { OrderStatus } from './entities/order.entity';
import type { RequestWithUser } from '../common/interfaces/request-with-user';
import type { TransitionActor } from './order-status-transition';
import { QualityService } from '../quality/quality.service';
import { ResubmitCorrectionDto } from '../quality/dto/resubmit-correction.dto';
import { RejectProofDto } from '../quality/dto/reject-proof.dto';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(
    private ordersService: OrdersService,
    private qualityService: QualityService,
  ) {}

  @Get()
  getOrders(@Request() req: RequestWithUser) {
    return this.ordersService.findByUser(req.user.sub);
  }

  @Get(':id')
  async getOrder(@Request() req: RequestWithUser, @Param('id') id: number) {
    const order = await this.ordersService.findById(id);
    if (!order) throw new NotFoundException('Order not found');
    if (
      order.userId !== req.user.sub &&
      req.user.role !== 'ops_admin' &&
      req.user.role !== 'super_admin'
    ) {
      throw new ForbiddenException('You can only view your own orders');
    }
    return order;
  }

  @Post()
  async createOrder(
    @Request() req: RequestWithUser,
    @Body() dto: CreateOrderDto,
  ) {
    const result = await this.ordersService.createBatch(req.user.sub, {
      items: [
        {
          category: dto.category,
          quantity: dto.quantity,
          totalPrice: dto.totalPrice,
          fileName: dto.fileName,
          fileUrl: dto.fileUrl,
          fileMetadataId: dto.fileMetadataId,
          specialInstructions: dto.specialInstructions,
          paperSpecs: dto.paperSpecs,
          threeDSpecs: dto.threeDSpecs,
          specs: dto.specs,
          addonIds: dto.addonIds,
        },
      ],
      deliveryFee: dto.deliveryFee,
      paymentMethod: dto.paymentMethod,
      deliveryOption: dto.deliveryOption,
      deliveryAddressId: dto.deliveryAddressId,
    });
    return result.orders[0];
  }

  @Post('batch')
  createBatchOrder(
    @Request() req: RequestWithUser,
    @Body() dto: CreateBatchOrderDto,
  ) {
    return this.ordersService.createBatch(req.user.sub, dto);
  }

  @Post('quote')
  quote(@Body() dto: QuoteOrderDto) {
    return this.ordersService.quote(dto);
  }

  /**
   * Ops/super only: authorize payment after supplier_accepted / awaiting_payment
   * so production can start. Client cannot authorize.
   * Pilot Credits: reserve→spend from the order owner; COD: eligibility for collection.
   * Freezes commercial snapshot and enters payment_authorized.
   */
  @Post(':id/authorize-payment')
  @UseGuards(RolesGuard)
  @Roles('ops_admin', 'super_admin')
  authorizePayment(
    @Request() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ordersService.authorizePayment(id, {
      actorUserId: req.user.sub,
      actorRole: req.user.role ?? null,
      reason: 'Ops payment authorization',
    });
  }

  /**
   * Client (owner): bind revised artwork and return order to needs_qa.
   * Upload via POST /files/upload first, then pass fileMetadataId.
   */
  @Post(':id/resubmit-correction')
  @UseGuards(RolesGuard)
  @Roles('client', 'ops_admin', 'super_admin')
  resubmitCorrection(
    @Request() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResubmitCorrectionDto,
  ) {
    return this.qualityService.resubmitCorrection(id, dto, {
      userId: req.user.sub,
      role: (req.user.role ?? 'client') as TransitionActor,
    });
  }

  /**
   * Client (owner): approve proof → approved_for_matching.
   */
  @Post(':id/approve-proof')
  @UseGuards(RolesGuard)
  @Roles('client', 'ops_admin', 'super_admin')
  approveProof(
    @Request() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.qualityService.approveProof(id, {
      userId: req.user.sub,
      role: (req.user.role ?? 'client') as TransitionActor,
    });
  }

  /**
   * Client (owner): reject proof → client_correction for revision.
   */
  @Post(':id/reject-proof')
  @UseGuards(RolesGuard)
  @Roles('client', 'ops_admin', 'super_admin')
  rejectProof(
    @Request() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectProofDto,
  ) {
    return this.qualityService.rejectProof(id, dto ?? {}, {
      userId: req.user.sub,
      role: (req.user.role ?? 'client') as TransitionActor,
    });
  }

  @Patch(':id/cancel')
  async cancelOrder(@Request() req: RequestWithUser, @Param('id') id: number) {
    try {
      return await this.ordersService.cancelOrder(id, req.user.sub);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'Forbidden')
        throw new ForbiddenException('You can only cancel your own orders');
      if (msg.includes('cannot be cancelled'))
        throw new BadRequestException(msg);
      throw err;
    }
  }

  @Patch('batch/:id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancelBatch(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: { sub: number } },
  ) {
    await this.ordersService.cancelBatch(id, req.user.sub);
    return { ok: true };
  }

  @Patch(':id/status')
  @Roles('ops_admin', 'super_admin')
  @UseGuards(RolesGuard)
  updateStatus(
    @Request() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStatusDto,
  ) {
    if (dto.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Use the cancellation workflow');
    }
    return this.ordersService.updateStatus(
      id,
      dto.status,
      {},
      {
        actorUserId: req.user.sub,
        actorRole: req.user.role ?? null,
        reason: dto.notes?.trim() || 'Admin status update',
      },
    );
  }

  @Patch('admin/orders/:id/manual-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ops_admin', 'super_admin')
  async updateManualStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateManualStatusDto,
  ) {
    return this.ordersService.updateManualStatus(id, dto);
  }
}
