import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(PaymentTransaction)
    private txnRepo: Repository<PaymentTransaction>,
  ) {}

  async createIntent(
    dto: CreatePaymentIntentDto,
  ): Promise<{ transaction: PaymentTransaction; checkoutUrl: string }> {
    const txn = this.txnRepo.create({
      orderId: dto.orderId,
      paymentMethod: dto.paymentMethod,
      amount: dto.amount,
      status: 'pending',
    });
    const saved = await this.txnRepo.save(txn);

    // Mock checkout URL — replace with real PayMongo integration later
    const checkoutUrl = `https://checkout.paymongo.com/mock/${saved.id}`;

    return { transaction: saved, checkoutUrl };
  }

  async confirmPayment(id: number): Promise<PaymentTransaction> {
    const txn = await this.txnRepo.findOne({ where: { id } });
    if (!txn) throw new NotFoundException('Payment transaction not found');
    if (txn.status !== 'pending') {
      throw new BadRequestException(
        `Cannot confirm transaction with status '${txn.status}'`,
      );
    }
    txn.status = 'success';
    return this.txnRepo.save(txn);
  }

  async handleWebhook(
    payload: Record<string, any>,
  ): Promise<PaymentTransaction> {
    const data = payload?.data as Record<string, any> | undefined;
    const attributes = data?.attributes as Record<string, any> | undefined;
    const externalRefId = attributes?.reference_number as string | undefined;
    if (!externalRefId) {
      throw new BadRequestException(
        'Invalid webhook payload: missing reference_number',
      );
    }

    const txn = await this.txnRepo.findOne({
      where: { externalReferenceId: externalRefId },
    });
    if (!txn)
      throw new NotFoundException('Transaction not found for reference');

    txn.webhookPayload = payload;
    const eventType = attributes?.type as string | undefined;
    if (eventType === 'payment.paid') {
      txn.status = 'success';
    } else if (eventType === 'payment.failed') {
      txn.status = 'failed';
    }

    return this.txnRepo.save(txn);
  }

  async initiateRefund(id: number): Promise<PaymentTransaction> {
    const txn = await this.txnRepo.findOne({ where: { id } });
    if (!txn) throw new NotFoundException('Payment transaction not found');
    if (txn.status !== 'success') {
      throw new BadRequestException('Can only refund successful transactions');
    }
    txn.status = 'refunded';
    return this.txnRepo.save(txn);
  }
}
