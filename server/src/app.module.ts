import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrdersModule } from './orders/orders.module';
import { AddressesModule } from './addresses/addresses.module';
import { RidersModule } from './riders/riders.module';
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
import { PrinterProfileModule } from './printer-profile/printer-profile.module';
import { SupportTicketsModule } from './support-tickets/support-tickets.module';
import { HomeFeedModule } from './home-feed/home-feed.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { QualityModule } from './quality/quality.module';
import { MatchingModule } from './matching/matching.module';
import { IssuesModule } from './issues/issues.module';
import { PayoutsModule } from './payouts/payouts.module';
import { AuditModule } from './audit/audit.module';
import {
  createTypeOrmOptions,
  initializeDataSourceWithPreSyncNormalization,
} from './database/typeorm.config';

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
      useFactory: createTypeOrmOptions,
      dataSourceFactory: initializeDataSourceWithPreSyncNormalization,
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
    RidersModule,
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
    PrinterProfileModule,
    SupportTicketsModule,
    HomeFeedModule,
    SuppliersModule,
    QualityModule,
    MatchingModule,
    IssuesModule,
    PayoutsModule,
    AuditModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
