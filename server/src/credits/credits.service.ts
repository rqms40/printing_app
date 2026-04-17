import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreditTransaction,
  CreditTransactionType,
  CreditTransactionStatus,
} from './entities/credit-transaction.entity';
import { CreditSettings } from './entities/credit-settings.entity';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestTopUpDto, UpdateSettingsDto } from './dto/credits.dto';

@Injectable()
export class CreditsService {
  constructor(
    @InjectRepository(CreditTransaction)
    private transactionRepo: Repository<CreditTransaction>,
    @InjectRepository(CreditSettings)
    private settingsRepo: Repository<CreditSettings>,
    private usersService: UsersService,
    private notificationsService: NotificationsService,
  ) {}

  async getSettings(): Promise<CreditSettings> {
    let settings = await this.settingsRepo.find();
    if (settings.length === 0) {
      settings = [
        await this.settingsRepo.save(
          this.settingsRepo.create({ conversionRate: 1.0 }),
        ),
      ];
    }
    return settings[0];
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<CreditSettings> {
    const settings = await this.getSettings();
    if (dto.conversionRate !== undefined) {
      settings.conversionRate = dto.conversionRate;
    }
    if (dto.creditsOnlyMode !== undefined) {
      settings.creditsOnlyMode = dto.creditsOnlyMode;
    }
    return this.settingsRepo.save(settings);
  }

  async requestTopUp(
    userId: number,
    dto: RequestTopUpDto,
  ): Promise<CreditTransaction> {
    const settings = await this.getSettings();
    const amountCredits = dto.amountPhp * settings.conversionRate;

    const tx = this.transactionRepo.create({
      userId,
      type: CreditTransactionType.TOP_UP,
      amountPhp: dto.amountPhp,
      amountCredits,
      status: CreditTransactionStatus.PENDING,
      proofOfPaymentUrl: dto.proofOfPaymentUrl,
    });

    const saved = await this.transactionRepo.save(tx);

    try {
      const user = await this.usersService.findById(userId);
      await this.notificationsService.createForAllAdmins({
        title: 'Top-Up Request Received',
        message: `${user?.email ?? 'A user'} requested ₱${dto.amountPhp} top-up.`,
        type: 'topup_request',
        metadata: {
          transactionId: saved.id,
          amountPhp: dto.amountPhp,
          userEmail: user?.email ?? null,
        },
      });
    } catch {
      // notification failure must not break the request flow
    }

    return saved;
  }

  async approveTopUp(transactionId: number): Promise<CreditTransaction> {
    const tx = await this.transactionRepo.findOne({
      where: { id: transactionId },
    });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.status !== CreditTransactionStatus.PENDING) {
      throw new BadRequestException('Transaction is not pending');
    }

    // Add credits to user
    const user = await this.usersService.findById(tx.userId);
    if (!user) throw new NotFoundException('User not found');

    user.credits = Number(user.credits) + Number(tx.amountCredits);
    await this.usersService.updateProfile(user.id, { credits: user.credits });

    await this.notificationsService.triggerCreditsUpdate(
      user.id,
      Number(user.credits),
    );

    tx.status = CreditTransactionStatus.APPROVED;
    const savedTx = await this.transactionRepo.save(tx);

    // Notify the user
    await this.notificationsService.create({
      userId: user.id,
      title: 'Top-Up Approved',
      message: `Your top-up of ${tx.amountCredits} Credits has been approved!`,
      type: 'credit',
    });

    return savedTx;
  }

  async rejectTopUp(transactionId: number): Promise<CreditTransaction> {
    const tx = await this.transactionRepo.findOne({
      where: { id: transactionId },
    });
    if (!tx) throw new NotFoundException('Transaction not found');

    tx.status = CreditTransactionStatus.REJECTED;
    const saved = await this.transactionRepo.save(tx);

    try {
      await this.notificationsService.create({
        userId: tx.userId,
        title: 'Top-Up Rejected',
        message: `Your top-up request of ${tx.amountCredits} Credits was rejected.`,
        type: 'topup_rejected',
      });
    } catch {
      // notification failure must not break the reject flow
    }

    return saved;
  }

  async getPendingRequests(): Promise<CreditTransaction[]> {
    return this.transactionRepo.find({
      where: {
        status: CreditTransactionStatus.PENDING,
        type: CreditTransactionType.TOP_UP,
      },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
  }

  async getPendingCount(): Promise<number> {
    return this.transactionRepo.count({
      where: {
        status: CreditTransactionStatus.PENDING,
        type: CreditTransactionType.TOP_UP,
      },
    });
  }

  async subtractCredits(
    userId: number,
    amountCredits: number,
    referenceId?: string,
  ): Promise<CreditTransaction> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (Number(user.credits) < amountCredits) {
      throw new BadRequestException('Insufficient credits');
    }

    user.credits = Number(user.credits) - amountCredits;
    await this.usersService.updateProfile(user.id, { credits: user.credits });

    await this.notificationsService.triggerCreditsUpdate(
      user.id,
      Number(user.credits),
    );

    const tx = this.transactionRepo.create({
      userId,
      type: CreditTransactionType.DEDUCTION,
      amountCredits,
      status: CreditTransactionStatus.APPROVED,
      referenceId,
    });

    return this.transactionRepo.save(tx);
  }
}
