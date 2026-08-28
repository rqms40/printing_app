import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RiderPayout } from './entities/rider-payout.entity';
import { RiderProfile } from './entities/rider-profile.entity';
import {
  DeliveryAssignment,
  DeliveryStatus,
} from './entities/delivery-assignment.entity';
import { FilesService } from '../files/files.service';
import {
  FileMetadata,
  FilePurpose,
} from '../files/entities/file-metadata.entity';
import { riderDeliveryFeeMinor } from './riders.service';

export type RiderPayoutItemView = {
  assignmentId: number;
  orderId: number;
  orderRef: string;
  amountMinor: string;
  deliveredAt: Date | null;
  status: 'paid' | 'unpaid';
  paidAt: Date | null;
  adminReceiptFileId: number | null;
  adminReceiptUrl: string | null;
};

export type RiderPayoutsView = {
  riderId: number;
  payoutQrFileId: number | null;
  payoutQrUrl: string | null;
  items: RiderPayoutItemView[];
};

@Injectable()
export class RiderPayoutsService {
  constructor(
    @InjectRepository(RiderPayout)
    private readonly payoutRepo: Repository<RiderPayout>,
    @InjectRepository(RiderProfile)
    private readonly profileRepo: Repository<RiderProfile>,
    @InjectRepository(DeliveryAssignment)
    private readonly assignmentRepo: Repository<DeliveryAssignment>,
    private readonly filesService: FilesService,
  ) {}

  async listForRiderUser(userId: number): Promise<RiderPayoutsView> {
    const rider = await this.profileRepo.findOne({ where: { userId } });
    if (!rider) throw new NotFoundException('Rider profile not found');
    return this.listForRider(rider);
  }

  async listForAdmin(riderId: number): Promise<RiderPayoutsView> {
    const rider = await this.profileRepo.findOne({ where: { id: riderId } });
    if (!rider) throw new NotFoundException('Rider profile not found');
    return this.listForRider(rider);
  }

  async recordReceipt(
    riderId: number,
    input: { assignmentId: number; receiptFileId: number },
    actorUserId: number,
  ): Promise<RiderPayoutsView> {
    const rider = await this.profileRepo.findOne({ where: { id: riderId } });
    if (!rider) throw new NotFoundException('Rider profile not found');
    if (!rider.payoutQrFileId) {
      throw new BadRequestException({
        code: 'rider_payout_qr_required',
        message: 'Rider must upload a payout QR before payment can be recorded',
      });
    }

    const assignment = await this.assignmentRepo.findOne({
      where: { id: input.assignmentId, riderId },
      relations: ['order'],
    });
    if (!assignment) {
      throw new NotFoundException(
        `Assignment ${input.assignmentId} not found for this rider`,
      );
    }
    if (assignment.status !== DeliveryStatus.DELIVERED) {
      throw new BadRequestException({
        code: 'assignment_not_delivered',
        message: 'Only completed deliveries can be paid',
      });
    }

    await this.assertOwnedPayoutReceipt(input.receiptFileId, actorUserId);

    let payout = await this.payoutRepo.findOne({
      where: { assignmentId: assignment.id },
    });
    const amountMinor = String(riderDeliveryFeeMinor(assignment.order));
    if (!payout) {
      payout = this.payoutRepo.create({
        riderId: rider.id,
        assignmentId: assignment.id,
        orderId: assignment.orderId,
        amountMinor,
        adminReceiptFileId: input.receiptFileId,
        paidAt: new Date(),
        paidByUserId: actorUserId,
      });
    } else {
      payout.amountMinor = amountMinor;
      payout.adminReceiptFileId = input.receiptFileId;
      payout.paidAt = new Date();
      payout.paidByUserId = actorUserId;
    }
    await this.payoutRepo.save(payout);
    return this.listForRider(rider);
  }

  private async listForRider(rider: RiderProfile): Promise<RiderPayoutsView> {
    const assignments = await this.assignmentRepo.find({
      where: { riderId: rider.id, status: DeliveryStatus.DELIVERED },
      relations: ['order'],
      order: { deliveredAt: 'DESC', id: 'DESC' },
    });
    const payouts = await this.payoutRepo.find({
      where: { riderId: rider.id },
    });
    const byAssignment = new Map(
      payouts.map((row) => [row.assignmentId, row]),
    );
    const payoutQrUrl = await this.signedFileUrl(rider.payoutQrFileId ?? null);
    const items: RiderPayoutItemView[] = [];
    for (const assignment of assignments) {
      const payout = byAssignment.get(assignment.id);
      items.push({
        assignmentId: assignment.id,
        orderId: assignment.orderId,
        orderRef: assignment.order?.orderId ?? String(assignment.orderId),
        amountMinor: String(riderDeliveryFeeMinor(assignment.order)),
        deliveredAt: assignment.deliveredAt ?? assignment.updatedAt ?? null,
        status: payout?.adminReceiptFileId ? 'paid' : 'unpaid',
        paidAt: payout?.paidAt ?? null,
        adminReceiptFileId: payout?.adminReceiptFileId ?? null,
        adminReceiptUrl: await this.signedFileUrl(
          payout?.adminReceiptFileId ?? null,
        ),
      });
    }
    return {
      riderId: rider.id,
      payoutQrFileId: rider.payoutQrFileId ?? null,
      payoutQrUrl,
      items,
    };
  }

  private async assertOwnedPayoutReceipt(
    fileId: number,
    actorUserId: number,
  ): Promise<FileMetadata> {
    if (!Number.isInteger(fileId) || fileId <= 0) {
      throw new BadRequestException({
        code: 'payout_receipt_required',
        message: 'Upload a payment receipt before recording the rider payout',
      });
    }
    let file: FileMetadata | null = null;
    try {
      file = await this.filesService.findById(fileId);
    } catch {
      file = null;
    }
    if (!file) {
      throw new BadRequestException({
        code: 'payout_receipt_invalid',
        message: 'Payout receipt file was not found',
      });
    }
    if (file.uploadedBy != null && file.uploadedBy !== actorUserId) {
      throw new ForbiddenException({
        code: 'payout_receipt_not_owned',
        message: 'Payout receipt must be uploaded by the authorizing admin',
      });
    }
    if (file.purpose && file.purpose !== FilePurpose.PAYOUT_RECEIPT) {
      throw new BadRequestException({
        code: 'payout_receipt_invalid',
        message: 'Uploaded file is not a payout receipt',
      });
    }
    return file;
  }

  private async signedFileUrl(fileId: number | null): Promise<string | null> {
    if (!fileId) return null;
    try {
      const file = await this.filesService.findById(fileId);
      if (!file) return null;
      if (!file.objectKey) return file.url ?? null;
      return await this.filesService.getPresignedUrlForKey(
        file.objectKey,
        3600,
      );
    } catch {
      return null;
    }
  }
}
