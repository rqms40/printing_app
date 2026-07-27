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
import { GoogleRoutesRoutingProvider } from './routing/google-routes.provider';
import { UsersModule } from '../users/users.module';
import { RealtimeSessionsModule } from '../common/realtime/realtime-sessions.module';

function createRoutingProvider(config: ConfigService) {
  const preferred = (config.get<string>('ROUTING_PROVIDER') ?? '')
    .trim()
    .toLowerCase();
  const hasGoogleKey = Boolean(
    config.get<string>('GOOGLE_MAPS_API')?.trim() ||
      config.get<string>('GOOGLE_MAPS_API_KEY')?.trim(),
  );

  // Prefer Google when explicitly requested, or when a Maps key is present
  // and the operator did not force OSRM.
  // Note: Google Routes API requires billing enabled on the GCP project.
  // If dispatch fails with routing_unavailable / 403, either enable billing
  // or set ROUTING_PROVIDER=osrm (and run compose --profile osrm).
  const useGoogle =
    preferred === 'google' ||
    preferred === 'google_routes' ||
    (preferred !== 'osrm' && hasGoogleKey);

  if (useGoogle) {
    // eslint-disable-next-line no-console
    console.log('[routing] provider=google_routes (GOOGLE_MAPS_API present)');
    return new GoogleRoutesRoutingProvider(config);
  }
  // eslint-disable-next-line no-console
  console.log('[routing] provider=osrm');
  return new OsrmRoutingProvider(config);
}

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RiderProfile,
      DeliveryAssignment,
      DispatchPlan,
      DispatchPlanStop,
      Order,
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
  ],
  controllers: [RidersController],
  providers: [
    RidersService,
    DispatchPlanService,
    LocationGateway,
    {
      provide: ROUTING_PROVIDER,
      inject: [ConfigService],
      useFactory: createRoutingProvider,
    },
  ],
  exports: [RidersService, DispatchPlanService, LocationGateway],
})
export class RidersModule {}
