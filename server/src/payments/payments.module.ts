import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { CodCollection } from './entities/cod-collection.entity';
import { QrPaymentReceipt } from './entities/qr-payment-receipt.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { Payout } from '../payouts/entities/payout.entity';
import { FileMetadata } from '../files/entities/file-metadata.entity';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [
    FilesModule,
    TypeOrmModule.forFeature([
      PaymentTransaction,
      CodCollection,
      QrPaymentReceipt,
      Order,
      User,
      Payout,
      FileMetadata,
    ]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService, TypeOrmModule],
})
export class PaymentsModule {}
