import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import type { RequestWithUser } from '../common/interfaces/request-with-user';
import { PreviewMatchDto } from './dto/preview-match.dto';
import { MatchingService } from './matching.service';

@ApiTags('matching')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('client', 'ops_admin', 'super_admin')
@Controller('matching')
export class MatchingPreviewController {
  constructor(private readonly matchingService: MatchingService) {}

  @Post('preview')
  preview(@Request() req: RequestWithUser, @Body() dto: PreviewMatchDto) {
    return this.matchingService.previewForClient(req.user.sub, dto);
  }
}
