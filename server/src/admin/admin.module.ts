import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { PaperSpec } from '../orders/entities/paper-specs.entity';
import { ThreeDSpec } from '../orders/entities/three-d-specs.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { OrdersModule } from '../orders/orders.module';
import { RidersModule } from '../riders/riders.module';
import { CreditsModule } from '../credits/credits.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { TamSurvey } from '../tam-surveys/entities/tam-survey.entity';
import { TamSurveySettings } from '../tam-surveys/entities/tam-survey-settings.entity';
import { RiderProfile } from '../riders/entities/rider-profile.entity';
import { DeliveryAssignment } from '../riders/entities/delivery-assignment.entity';
import { SupplierAssignment } from '../matching/entities/supplier-assignment.entity';
import { AuditEvent } from '../audit/entities/audit-event.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      User,
      PaperSpec,
      ThreeDSpec,
      OrderStatusHistory,
      OrderItem,
      TamSurvey,
      TamSurveySettings,
      RiderProfile,
      DeliveryAssignment,
      SupplierAssignment,
      AuditEvent,
    ]),
    OrdersModule,
    RidersModule,
    CreditsModule,
    NotificationsModule,
    SuppliersModule,
  ],
  controllers: [AdminController],
})
export class AdminModule {}
