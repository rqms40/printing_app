// server/src/products/products.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogPricingService } from './catalog-pricing.service';
import { CatalogReadService } from './catalog-read.service';
import { CatalogValidationService } from './catalog-validation.service';
import { ProductCategory } from './entities/product-category.entity';
import { ProductSpecDefinition } from './entities/product-spec-definition.entity';
import { ProductSpecOption } from './entities/product-spec-option.entity';
import { ServiceAddon } from './entities/service-addon.entity';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductCategory,
      ProductSpecDefinition,
      ProductSpecOption,
      ServiceAddon,
    ]),
  ],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    CatalogReadService,
    CatalogValidationService,
    CatalogPricingService,
  ],
  exports: [
    ProductsService,
    CatalogReadService,
    CatalogValidationService,
    CatalogPricingService,
  ],
})
export class ProductsModule {}
