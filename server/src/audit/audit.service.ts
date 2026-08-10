import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuditEvent } from './entities/audit-event.entity';

/** Input for an append-only audit row. */
export type AppendAuditEventInput = {
  actorId?: number | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  orderId?: number | null;
  fromState?: string | null;
  toState?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string | null;
};

/** Controlled order status transition audit payload. */
export type OrderStatusTransitionAuditInput = {
  orderId: number;
  fromStatus: string;
  toStatus: string;
  actorUserId: number | null;
  actorRole?: string | null;
  reason: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string | null;
};

/**
 * Append-only audit writer (Task 2.3).
 * Callers pass an optional EntityManager so the row commits with the
 * controlling business transaction (status change, payment, payout, …).
 */
@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditEvent)
    private readonly auditRepo: Repository<AuditEvent>,
  ) {}

  /**
   * Insert an immutable audit event. Never updates existing rows.
   * When `idempotencyKey` is set and a unique violation occurs, returns the
   * existing row instead of throwing (safe retries for payments/webhooks).
   */
  async append(
    input: AppendAuditEventInput,
    manager?: EntityManager,
  ): Promise<AuditEvent> {
    const repo = manager ? manager.getRepository(AuditEvent) : this.auditRepo;

    // actor_id FKs to users — never persist 0 / invalid sentinel ids.
    const actorId =
      input.actorId != null && input.actorId > 0 ? input.actorId : null;
    const row = repo.create({
      actorId,
      actorRole: input.actorRole ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      orderId: input.orderId ?? null,
      fromState: input.fromState ?? null,
      toState: input.toState ?? null,
      reason: input.reason ?? null,
      metadata: input.metadata ?? {},
      idempotencyKey: input.idempotencyKey ?? null,
    });

    try {
      return await repo.save(row);
    } catch (error) {
      if (
        input.idempotencyKey &&
        AuditService.isIdempotencyKeyViolation(error)
      ) {
        const existing = await repo.findOne({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  /** Convenience writer for order status_transition events. */
  async recordOrderStatusTransition(
    input: OrderStatusTransitionAuditInput,
    manager?: EntityManager,
  ): Promise<AuditEvent> {
    return this.append(
      {
        actorId: input.actorUserId,
        actorRole: input.actorRole ?? null,
        action: 'status_transition',
        entityType: 'order',
        entityId: String(input.orderId),
        orderId: input.orderId,
        fromState: input.fromStatus,
        toState: input.toStatus,
        reason: input.reason,
        metadata: input.metadata,
        idempotencyKey: input.idempotencyKey ?? null,
      },
      manager,
    );
  }

  private static isIdempotencyKeyViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error == null) return false;
    const candidate = error as {
      code?: unknown;
      constraint?: unknown;
      driverError?: { code?: unknown; constraint?: unknown };
    };
    const code = candidate.driverError?.code ?? candidate.code;
    const constraint =
      candidate.driverError?.constraint ?? candidate.constraint;
    return (
      code === '23505' &&
      (constraint === 'uq_audit_events_idempotency_key' ||
        (typeof constraint === 'string' &&
          constraint.includes('idempotency_key')))
    );
  }
}
