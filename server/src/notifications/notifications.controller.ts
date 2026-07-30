import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';

import { NotificationsService } from './notifications.service';
import { MarketingSchedulerService } from './marketing-scheduler.service';
import type { RequestWithUser } from '../common/interfaces/request-with-user';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private notificationsService: NotificationsService,
    private marketingSchedulerService: MarketingSchedulerService,
  ) {}

  @Get('marketing')
  @UseGuards(RolesGuard)
  @Roles('admin')
  getMarketingNotifications() {
    return this.notificationsService.getMarketingNotifications();
  }

  @Post('marketing')
  @UseGuards(RolesGuard)
  @Roles('admin')
  createMarketingNotification(@Body() data: any) {
    return this.notificationsService.createMarketingNotification(data);
  }

  @Patch('marketing/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  updateMarketingNotification(@Param('id') id: string, @Body() data: any) {
    return this.notificationsService.updateMarketingNotification(+id, data);
  }

  @Delete('marketing/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  deleteMarketingNotification(@Param('id') id: string) {
    return this.notificationsService.deleteMarketingNotification(+id);
  }

  @Post('marketing/:id/send')
  @UseGuards(RolesGuard)
  @Roles('admin')
  sendMarketingNotification(@Param('id') id: string) {
    return this.marketingSchedulerService.sendNotificationById(+id);
  }

  @Get()
  getNotifications(@Request() req: RequestWithUser) {
    return this.notificationsService.getByUser(req.user.sub);
  }

  @Get('unread-count')
  getUnreadCount(@Request() req: RequestWithUser) {
    return this.notificationsService.getUnreadCount(req.user.sub);
  }

  @Patch(':id/read')
  markAsRead(@Request() req: RequestWithUser, @Param('id') id: number) {
    return this.notificationsService.markAsRead(id, req.user.sub);
  }

  @Patch('read-all')
  markAllAsRead(@Request() req: RequestWithUser) {
    return this.notificationsService.markAllAsRead(req.user.sub);
  }
}
