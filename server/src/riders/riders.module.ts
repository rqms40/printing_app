import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RiderProfile } from './entities/rider-profile.entity';
import { DeliveryAssignment } from './entities/delivery-assignment.entity';
import { Order } from '../orders/entities/order.entity';
import { OrdersModule } from '../orders/orders.module';
import { RidersService } from './riders.service';
import { RidersController } from './riders.controller';
import { LocationGateway } from './location.gateway';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatModule } from '../chat/chat.module';
import { FilesModule } from '../files/files.module';
import { DispatchPlan } from './entities/dispatch-plan.entity';
import { DispatchPlanStop } from './entities/dispatch-plan-stop.entity';
import { DispatchPlanService } from './dispatch-plan.service';
import { ROUTING_PROVIDER } from './routing/routing-provider';
import { OsrmRoutingProvider } from './routing/osrm-routing.provider';
import { UsersModule } from '../users/users.module';
import { RealtimeSessionsModule } from '../common/realtime/realtime-sessions.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QualityModule } from '../quality/quality.module';
import { RiderPayout } from './entities/rider-payout.entity';
import { RiderPayoutsService } from './rider-payouts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RiderProfile,
      DeliveryAssignment,
      DispatchPlan,
      DispatchPlanStop,
      Order,
      RiderPayout,
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRATION', '7d') },
      }),
    }),
    OrdersModule,
    ChatModule,
    FilesModule,
    UsersModule,
    RealtimeSessionsModule,
    AuditModule,
    NotificationsModule,
    QualityModule,
  ],
  controllers: [RidersController],
  providers: [
    RidersService,
    RiderPayoutsService,
    DispatchPlanService,
    LocationGateway,
    {
      provide: ROUTING_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new OsrmRoutingProvider(config),
    },
  ],
  exports: [
    RidersService,
    RiderPayoutsService,
    DispatchPlanService,
    LocationGateway,
  ],
})
export class RidersModule {}
