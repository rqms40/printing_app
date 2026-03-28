import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { RequestWithUser } from '../common/interfaces/request-with-user';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

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
