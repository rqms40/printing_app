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

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Get()
  getOrders(@Request() req: RequestWithUser) {
    return this.ordersService.findByUser(req.user.sub);
  }

  @Get(':id')
  async getOrder(@Request() req: RequestWithUser, @Param('id') id: number) {
    const order = await this.ordersService.findById(id);
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== req.user.sub && req.user.role !== 'admin') {
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
  @Roles('admin')
  @UseGuards(RolesGuard)
  updateStatus(
    @Request() req: RequestWithUser,
    @Param('id') id: number,
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
        reason: dto.notes?.trim() || 'Admin status update',
      },
    );
  }

  @Patch('admin/orders/:id/manual-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateManualStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateManualStatusDto,
  ) {
    return this.ordersService.updateManualStatus(id, dto);
  }
}
