import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { DeliverySlotTemplate } from './entities/delivery-slot-template.entity';
import { DeliverySlotBooking } from './entities/delivery-slot-booking.entity';
import { SlotFullException } from './exceptions';

export interface SlotAvailability {
  templateId: number;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  isFull: boolean;
}

export interface BookSlotInput {
  slotTemplateId: number;
  date: string;
  batchOrderId: number;
  priority: boolean;
}

@Injectable()
export class DeliverySlotsService {
  constructor(
    @InjectRepository(DeliverySlotTemplate)
    private readonly templateRepo: Repository<DeliverySlotTemplate>,
    @InjectRepository(DeliverySlotBooking)
    private readonly bookingRepo: Repository<DeliverySlotBooking>,
    private readonly dataSource: DataSource,
  ) {}

  async getAvailability(date: string): Promise<SlotAvailability[]> {
    const dayOfWeek = new Date(date + 'T00:00:00Z').getUTCDay();
    const templates = await this.templateRepo.find({
      where: { dayOfWeek, isActive: true },
      order: { startTime: 'ASC' },
    });

    const counts = await this.bookingRepo
      .createQueryBuilder('b')
      .innerJoin('batch_orders', 'bo', 'bo.id = b.batch_order_id')
      .innerJoin(
        'orders',
        'o',
        'o.batch_order_id = bo.id AND o.order_status NOT IN (:...excluded)',
        { excluded: ['cancelled', 'file_declined'] },
      )
      .where('b.date = :date', { date })
      .select('b.slot_template_id', 'slotTemplateId')
      .addSelect('COUNT(DISTINCT b.id)', 'count')
      .groupBy('b.slot_template_id')
      .getRawMany<{ slotTemplateId: string; count: string }>();

    const countMap = new Map(
      counts.map((c) => [Number(c.slotTemplateId), Number(c.count)]),
    );

    return templates.map((t) => {
      const bookedCount = countMap.get(t.id) ?? 0;
      return {
        templateId: t.id,
        startTime: t.startTime,
        endTime: t.endTime,
        capacity: t.capacity,
        bookedCount,
        isFull: bookedCount >= t.capacity,
      };
    });
  }

  async bookSlot(
    manager: EntityManager,
    input: BookSlotInput,
  ): Promise<DeliverySlotBooking> {
    const template = await manager.findOne(DeliverySlotTemplate, {
      where: { id: input.slotTemplateId, isActive: true },
    });
    if (!template) throw new SlotFullException();

    const count = await manager
      .createQueryBuilder(DeliverySlotBooking, 'b')
      .innerJoin('batch_orders', 'bo', 'bo.id = b.batch_order_id')
      .innerJoin(
        'orders',
        'o',
        'o.batch_order_id = bo.id AND o.order_status NOT IN (:...excluded)',
        { excluded: ['cancelled', 'file_declined'] },
      )
      .where('b.slot_template_id = :tid', { tid: input.slotTemplateId })
      .andWhere('b.date = :date', { date: input.date })
      .setLock('pessimistic_write')
      .getCount();

    if (count >= template.capacity) throw new SlotFullException();

    const booking = manager.create(DeliverySlotBooking, {
      slotTemplateId: input.slotTemplateId,
      date: input.date,
      batchOrderId: input.batchOrderId,
      priority: input.priority,
    });
    return manager.save(booking);
  }
}
