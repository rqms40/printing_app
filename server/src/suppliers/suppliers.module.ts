import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupplierProfile } from './entities/supplier-profile.entity';
import { SupplierCapability } from './entities/supplier-capability.entity';
import { SupplierVerification } from './entities/supplier-verification.entity';
import { SupplierCatalogOffering } from './entities/supplier-catalog-offering.entity';
import { SupplierCatalogService } from './supplier-catalog.service';
import { SupplierAssignment } from '../matching/entities/supplier-assignment.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { FileMetadata } from '../files/entities/file-metadata.entity';
import { AuditModule } from '../audit/audit.module';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QualityModule } from '../quality/quality.module';
import { SuppliersService } from './suppliers.service';
import { SuppliersController } from './suppliers.controller';
import { SupplierJobsService } from './supplier-jobs.service';
import { SupplierJobsController } from './supplier-jobs.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SupplierProfile,
      SupplierCapability,
      SupplierVerification,
      SupplierCatalogOffering,
      SupplierAssignment,
      Order,
      OrderStatusHistory,
      OrderItem,
      FileMetadata,
    ]),
    AuditModule,
    FilesModule,
    NotificationsModule,
    QualityModule,
  ],
  controllers: [SuppliersController, SupplierJobsController],
  providers: [SuppliersService, SupplierJobsService, SupplierCatalogService],
  exports: [
    SuppliersService,
    SupplierJobsService,
    SupplierCatalogService,
    TypeOrmModule,
  ],
})
export class SuppliersModule {}
