import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';

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
  @Roles('admin')
  initiateRefund(@Param('id', ParseIntPipe) id: number) {
    return this.paymentsService.initiateRefund(id);
  }
}
