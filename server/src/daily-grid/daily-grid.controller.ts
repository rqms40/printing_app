import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { DailyGridService } from './daily-grid.service';

@ApiTags('daily-grid')
@Controller('daily-grid')
export class DailyGridController {
  constructor(private readonly service: DailyGridService) {}

  /** Public — customer home screen carousel. */
  @Get()
  findActive() {
    return this.service.findActive();
  }

  /** Admin — all cards including inactive. */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin')
  findAll() {
    return this.service.findAll();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('admin')
  create(
    @Body()
    body: Partial<import('./entities/daily-grid-card.entity').DailyGridCard>,
  ) {
    return this.service.create(body);
  }

  /** Reorder — must be declared before :id to avoid param collision. */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('admin/reorder')
  reorder(@Body() body: { ids: number[] }) {
    return this.service.reorder(body.ids);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('admin/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: Partial<import('./entities/daily-grid-card.entity').DailyGridCard>,
  ) {
    return this.service.update(id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete('admin/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
