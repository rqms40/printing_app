import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import type { RequestWithUser } from '../common/interfaces/request-with-user';
import { IssuesService } from './issues.service';
import { OpenIssueDto } from './dto/open-issue.dto';
import { ResolveIssueDto } from './dto/resolve-issue.dto';
import { IssueStatus } from './entities/issue.entity';

@ApiTags('issues')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('issues')
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  /** Ops claims queue. */
  @Get()
  @Roles(UserRole.OPS_ADMIN, UserRole.SUPER_ADMIN)
  list(
    @Query('status') status?: IssueStatus,
    @Query('orderId') orderId?: string,
  ) {
    return this.issuesService.list({
      status: status,
      orderId: orderId ? Number(orderId) : undefined,
    });
  }

  @Get(':id')
  @Roles(UserRole.OPS_ADMIN, UserRole.SUPER_ADMIN)
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.issuesService.findById(id);
  }

  /** Client or ops opens a material claim. */
  @Post()
  @Roles(UserRole.CLIENT, UserRole.OPS_ADMIN, UserRole.SUPER_ADMIN)
  open(@Body() dto: OpenIssueDto, @Request() req: RequestWithUser) {
    return this.issuesService.openIssue(dto, req.user.sub, req.user.role);
  }

  /** Ops resolve paths: reprint | refund | adjustment | release | reject. */
  @Post(':id/resolve')
  @Roles(UserRole.OPS_ADMIN, UserRole.SUPER_ADMIN)
  resolve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolveIssueDto,
    @Request() req: RequestWithUser,
  ) {
    return this.issuesService.resolveIssue(
      id,
      dto,
      req.user.sub,
      req.user.role,
    );
  }
}
