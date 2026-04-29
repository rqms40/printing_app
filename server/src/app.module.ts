import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrdersModule } from './orders/orders.module';
import { AddressesModule } from './addresses/addresses.module';
import { DriversModule } from './drivers/drivers.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FirebaseModule } from './firebase/firebase.module';
import { StorageModule } from './storage/storage.module';
import { HealthModule } from './health/health.module';
import { PaymentsModule } from './payments/payments.module';
import { FilesModule } from './files/files.module';
import { AdminModule } from './admin/admin.module';
import { ProductsModule } from './products/products.module';
import { CreditsModule } from './credits/credits.module';
import { TamSurveysModule } from './tam-surveys/tam-surveys.module';
import { DailyGridModule } from './daily-grid/daily-grid.module';
import { BetaModeModule } from './beta-mode/beta-mode.module';
import { ChatModule } from './chat/chat.module';
import { ScheduleModule } from '@nestjs/schedule';
import { DeliverySlotsModule } from './delivery-slots/delivery-slots.module';

@Module({
  imports: [
    // Environment variables
    ConfigModule.forRoot({ isGlobal: true }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 30, // 30 requests per minute
      },
    ]),

    // Database
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DATABASE_HOST', 'localhost'),
        port: config.get<number>('DATABASE_PORT', 5432),
        username: config.get<string>('DATABASE_USER', 'postgres'),
        password: config.get<string>('DATABASE_PASSWORD', 'postgres'),
        database: config.get<string>('DATABASE_NAME', 'grid_print'),
        autoLoadEntities: true,
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),

    // Firebase (global — push notifications)
    FirebaseModule,

    // Storage (global — MinIO object storage)
    StorageModule,

    // Cron scheduling
    ScheduleModule.forRoot(),

    // Feature modules
    AuthModule,
    UsersModule,
    OrdersModule,
    AddressesModule,
    DriversModule,
    NotificationsModule,
    HealthModule,
    PaymentsModule,
    FilesModule,
    AdminModule,
    ProductsModule,
    CreditsModule,
    TamSurveysModule,
    DailyGridModule,
    BetaModeModule,
    ChatModule,
    DeliverySlotsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
