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
  createOrder(@Request() req: RequestWithUser, @Body() dto: CreateOrderDto) {
    return this.ordersService.create({ ...dto, userId: req.user.sub });
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
  updateStatus(@Param('id') id: number, @Body() dto: UpdateStatusDto) {
    return this.ordersService.updateStatus(id, dto.status);
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
