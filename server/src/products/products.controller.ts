// server/src/products/products.controller.ts
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { ProductsService } from './products.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateSpecOptionDto } from './dto/create-spec-option.dto';
import { UpdateSpecOptionDto } from './dto/update-spec-option.dto';
import { ReorderOptionsDto } from './dto/reorder-options.dto';
import { CreateAddonDto } from './dto/create-addon.dto';
import { UpdateAddonDto } from './dto/update-addon.dto';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ─── Categories (public reads, admin writes) ──────────────────────

  @Get('categories')
  findAllCategories(@Query('include_inactive') includeInactive?: string) {
    return this.productsService.findAllCategories(includeInactive === 'true');
  }

  // IMPORTANT: declare ':slug/pricing' before ':id' — different segment count, no conflict
  @Get('categories/:slug/pricing')
  getCategoryPricing(@Param('slug') slug: string) {
    return this.productsService.getCategoryPricing(slug);
  }

  @Get('categories/:id')
  findCategory(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findCategoryById(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.productsService.createCategory(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('categories/:id')
  updateCategory(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoryDto) {
    return this.productsService.updateCategory(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete('categories/:id')
  deleteCategory(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.deleteCategory(id);
  }

  // ─── Spec Options ─────────────────────────────────────────────────

  @ApiQuery({ name: 'category_id', required: false, type: Number })
  @ApiQuery({ name: 'group', required: false })
  @Get('options')
  findOptions(
    @Query('category_id') categoryId?: number,
    @Query('group') group?: string,
  ) {
    return this.productsService.findOptions(categoryId, group);
  }

  // IMPORTANT: 'reorder' route must be declared BEFORE ':id' route
  // to prevent NestJS from treating "reorder" as an id param
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('options/reorder')
  reorderOptions(@Body() dto: ReorderOptionsDto) {
    return this.productsService.reorderOptions(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('options')
  createOption(@Body() dto: CreateSpecOptionDto) {
    return this.productsService.createOption(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('options/:id')
  updateOption(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSpecOptionDto) {
    return this.productsService.updateOption(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete('options/:id')
  deleteOption(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.deleteOption(id);
  }

  // ─── Addons ───────────────────────────────────────────────────────

  @ApiQuery({ name: 'category_id', required: false, type: Number })
  @Get('addons')
  findAddons(@Query('category_id') categoryId?: number) {
    return this.productsService.findAddons(categoryId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('addons')
  createAddon(@Body() dto: CreateAddonDto) {
    return this.productsService.createAddon(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('addons/:id')
  updateAddon(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAddonDto) {
    return this.productsService.updateAddon(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete('addons/:id')
  deleteAddon(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.deleteAddon(id);
  }
}
