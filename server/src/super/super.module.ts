import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuperController } from './super.controller';
import { SuperService } from './super.service';
import { User } from '../users/entities/user.entity';
import { AuditEvent } from '../audit/entities/audit-event.entity';
import { RiderProfile } from '../riders/entities/rider-profile.entity';
import { Order } from '../orders/entities/order.entity';
import { CodCollection } from '../payments/entities/cod-collection.entity';
import { Payout } from '../payouts/entities/payout.entity';
import { SupplierProfile } from '../suppliers/entities/supplier-profile.entity';
import { SupplierVerification } from '../suppliers/entities/supplier-verification.entity';
import { SupplierCapability } from '../suppliers/entities/supplier-capability.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      AuditEvent,
      RiderProfile,
      Order,
      CodCollection,
      Payout,
      SupplierProfile,
      SupplierVerification,
      SupplierCapability,
    ]),
    AuditModule,
  ],
  controllers: [SuperController],
  providers: [SuperService],
  exports: [SuperService],
})
export class SuperModule {}
