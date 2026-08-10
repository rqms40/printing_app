import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { CodCollection } from './entities/cod-collection.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { Payout } from '../payouts/entities/payout.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentTransaction,
      CodCollection,
      Order,
      User,
      Payout,
    ]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService, TypeOrmModule],
})
export class PaymentsModule {}
