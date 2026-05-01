import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { DeliverySlotTemplate } from './entities/delivery-slot-template.entity';
import { DeliverySlotBooking } from './entities/delivery-slot-booking.entity';
import { SlotFullException, CancellationClosedException } from './exceptions';
import { DeliverySlotsGateway } from './delivery-slots.gateway';

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
    private readonly gateway: DeliverySlotsGateway,
  ) {}

  async getAvailability(
    date: string,
    opts: { pickupOnly?: boolean } = {},
  ): Promise<SlotAvailability[]> {
    const dayOfWeek = new Date(date + 'T00:00:00Z').getUTCDay();
    const where: {
      dayOfWeek: number;
      isActive: boolean;
      allowsPickup?: boolean;
    } = { dayOfWeek, isActive: true };
    if (opts.pickupOnly === true) {
      where.allowsPickup = true;
    }
    const templates = await this.templateRepo.find({
      where,
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
    // Lock the template row first to serialize concurrent bookings for the
    // same template+date. Postgres does not allow FOR UPDATE on aggregate
    // queries, so we cannot lock via the COUNT statement. Locking the parent
    // template row is the canonical workaround — it gates capacity checks
    // for everyone trying to book this template.
    const template = await manager
      .createQueryBuilder(DeliverySlotTemplate, 't')
      .where('t.id = :id', { id: input.slotTemplateId })
      .andWhere('t.is_active = TRUE')
      .setLock('pessimistic_write')
      .getOne();
    if (!template) throw new SlotFullException();

    // Count active bookings for this template+date. No row lock here —
    // serialization comes from the template lock above.
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

  async releaseSlot(
    manager: EntityManager,
    bookingId: number,
  ): Promise<void> {
    const booking = await manager.findOne(DeliverySlotBooking, {
      where: { id: bookingId },
      relations: ['slotTemplate'],
    });
    if (!booking) return;
    const slotStart = new Date(`${booking.date}T${booking.slotTemplate.startTime}`);
    if (Date.now() >= slotStart.getTime()) {
      throw new CancellationClosedException();
    }
    const releasedDate = booking.date;
    await manager.remove(booking);
    // Broadcast so admin views drop the row in real time. Fires after the
    // remove() above; the parent transaction may still roll back, in which
    // case subscribers harmlessly re-fetch and find the booking still there.
    this.gateway.notifyDateChanged(releasedDate);
  }

  async getTodaySnapshot(date: string) {
    const dayOfWeek = new Date(date + 'T00:00:00Z').getUTCDay();
    const templates = await this.templateRepo.find({
      where: { dayOfWeek, isActive: true },
      order: { startTime: 'ASC' },
    });
    const result = await this.bookingRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.slotTemplate', 'tpl')
      .leftJoin('batch_orders', 'bo', 'bo.id = b.batch_order_id')
      .leftJoin('users', 'u', 'u.id = bo.user_id')
      .where('b.date = :date', { date })
      .addSelect(['bo.id', 'bo.batch_ref'])
      .addSelect(['u.full_name', 'u.email'])
      .orderBy('b.priority_rank', 'ASC', 'NULLS LAST')
      .addOrderBy('b.booked_at', 'ASC')
      .getRawAndEntities();

    return { templates, bookings: result.entities, raw: result.raw };
  }

  /// Aggregates active booking counts for each of 7 consecutive days starting
  /// at `weekStart`. Returns an object keyed by ISO date — every requested day
  /// appears in the result (zero-counts included), so the client can render
  /// without further normalization.
  async getWeekBookingCounts(weekStart: string): Promise<Record<string, number>> {
    const start = new Date(weekStart + 'T00:00:00Z');
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    const endIso = end.toISOString().slice(0, 10);

    const rows = await this.bookingRepo
      .createQueryBuilder('b')
      .innerJoin('batch_orders', 'bo', 'bo.id = b.batch_order_id')
      .innerJoin(
        'orders',
        'o',
        'o.batch_order_id = bo.id AND o.order_status NOT IN (:...excluded)',
        { excluded: ['cancelled', 'file_declined'] },
      )
      .where('b.date >= :start AND b.date < :end', { start: weekStart, end: endIso })
      .select('b.date::text', 'date')
      .addSelect('COUNT(DISTINCT b.id)', 'count')
      .groupBy('b.date')
      .getRawMany<{ date: string; count: string }>();

    const result: Record<string, number> = {};
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      result[d.toISOString().slice(0, 10)] = 0;
    }
    for (const r of rows) result[r.date] = Number(r.count);
    return result;
  }

  async reorderBookings(orderedIds: number[]) {
    if (orderedIds.length === 0) return;
    let affectedDate: string | null = null;
    await this.dataSource.transaction(async (m) => {
      // Capture the date once so we can broadcast after commit. All ordered
      // ids must belong to the same slot/date; we just read the first.
      const first = await m.findOne(DeliverySlotBooking, {
        where: { id: orderedIds[0] },
      });
      affectedDate = first?.date ?? null;
      for (let i = 0; i < orderedIds.length; i++) {
        await m.update(DeliverySlotBooking, orderedIds[i], { priorityRank: i + 1 });
      }
    });
    if (affectedDate) this.gateway.notifyDateChanged(affectedDate);
  }

  /**
   * Toggle the express/priority flag on a single booking and reposition it
   * within its slot. When `priority=true` the booking is jumped to the top
   * (rank 1) and the other ranked siblings are pushed down. When `false`
   * the rank is cleared so it falls back to FIFO.
   */
  async setPriority(bookingId: number, priority: boolean) {
    const updated = await this.dataSource.transaction(async (m) => {
      const booking = await m.findOne(DeliverySlotBooking, {
        where: { id: bookingId },
      });
      if (!booking) {
        throw new SlotFullException();
      }

      if (priority) {
        const siblings = await m.find(DeliverySlotBooking, {
          where: {
            slotTemplateId: booking.slotTemplateId,
            date: booking.date,
          },
          order: { priorityRank: 'ASC', bookedAt: 'ASC' },
        });
        let rank = 2;
        for (const s of siblings) {
          if (s.id === bookingId) continue;
          await m.update(DeliverySlotBooking, s.id, { priorityRank: rank++ });
        }
        await m.update(DeliverySlotBooking, bookingId, {
          priority: true,
          priorityRank: 1,
        });
      } else {
        await m.update(DeliverySlotBooking, bookingId, {
          priority: false,
          priorityRank: null,
        });
      }

      return m.findOne(DeliverySlotBooking, { where: { id: bookingId } });
    });
    if (updated?.date) this.gateway.notifyDateChanged(updated.date);
    return updated;
  }
}
