import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { SupportTicketsService } from './support-tickets.service';
import {
  CreateSupportTicketDto,
  ReplySupportTicketDto,
} from './dto/create-support-ticket.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

@Controller('support-tickets')
export class SupportTicketsController {
  constructor(private readonly supportTicketsService: SupportTicketsService) {}

  @Post()
  create(@Body() createSupportTicketDto: CreateSupportTicketDto) {
    return this.supportTicketsService.create(createSupportTicketDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OPS_ADMIN, UserRole.SUPER_ADMIN)
  findAll() {
    return this.supportTicketsService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OPS_ADMIN, UserRole.SUPER_ADMIN)
  findOne(@Param('id') id: string) {
    return this.supportTicketsService.findOne(id);
  }

  @Patch(':id/reply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OPS_ADMIN, UserRole.SUPER_ADMIN)
  reply(@Param('id') id: string, @Body() replyDto: ReplySupportTicketDto) {
    return this.supportTicketsService.reply(id, replyDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OPS_ADMIN, UserRole.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.supportTicketsService.remove(id);
  }
}
