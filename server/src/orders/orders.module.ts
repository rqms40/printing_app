import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { PaperSpec } from './entities/paper-specs.entity';
import { ThreeDSpec } from './entities/three-d-specs.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrdersGateway } from './orders.gateway';
import { UsersModule } from '../users/users.module';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      PaperSpec,
      ThreeDSpec,
      OrderStatusHistory,
    ]),
    UsersModule,
    CreditsModule,
  ],
  providers: [OrdersService, OrdersGateway],
  controllers: [OrdersController],
  exports: [OrdersService, OrdersGateway],
})
export class OrdersModule {}
