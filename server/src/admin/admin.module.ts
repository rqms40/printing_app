import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { PaperSpec } from '../orders/entities/paper-specs.entity';
import { ThreeDSpec } from '../orders/entities/three-d-specs.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import { OrdersModule } from '../orders/orders.module';
import { DriversModule } from '../drivers/drivers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      User,
      PaperSpec,
      ThreeDSpec,
      OrderStatusHistory,
    ]),
    OrdersModule,
    DriversModule,
  ],
  controllers: [AdminController],
})
export class AdminModule {}
