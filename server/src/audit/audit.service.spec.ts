import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from './audit.service';
import { AuditEvent } from './entities/audit-event.entity';

describe('AuditService', () => {
  let service: AuditService;
  let repo: jest.Mocked<
    Pick<Repository<AuditEvent>, 'create' | 'save' | 'findOne'>
  >;

  beforeEach(async () => {
    repo = {
      create: jest.fn((data) => data as AuditEvent),
      save: jest.fn(async (row) => ({ id: 1, ...row }) as AuditEvent),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditEvent), useValue: repo },
      ],
    }).compile();

    service = module.get(AuditService);
  });

  describe('append', () => {
    it('writes an immutable audit row with actor, states, reason, entity refs', async () => {
      const saved = await service.append({
        actorId: 7,
        actorRole: 'ops_admin',
        action: 'status_transition',
        entityType: 'order',
        entityId: '42',
        orderId: 42,
        fromState: 'submitted',
        toState: 'approved_for_matching',
        reason: 'Admin production update',
        metadata: { source: 'admin' },
      });

      expect(repo.create).toHaveBeenCalledWith({
        actorId: 7,
        actorRole: 'ops_admin',
        action: 'status_transition',
        entityType: 'order',
        entityId: '42',
        orderId: 42,
        fromState: 'submitted',
        toState: 'approved_for_matching',
        reason: 'Admin production update',
        metadata: { source: 'admin' },
        idempotencyKey: null,
      });
      expect(repo.save).toHaveBeenCalled();
      expect(saved.id).toBe(1);
      expect(saved.action).toBe('status_transition');
    });

    it('defaults nullable fields and empty metadata', async () => {
      await service.append({
        action: 'qa_decision',
        entityType: 'quality_review',
        entityId: '9',
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: null,
          actorRole: null,
          orderId: null,
          fromState: null,
          toState: null,
          reason: null,
          metadata: {},
          idempotencyKey: null,
        }),
      );
    });

    it('uses the transaction manager repository when provided', async () => {
      const txRepo = {
        create: jest.fn((data) => data),
        save: jest.fn(async (row) => ({ id: 3, ...row })),
        findOne: jest.fn(),
      };
      const manager = {
        getRepository: jest.fn().mockReturnValue(txRepo),
      } as any;

      await service.append(
        {
          action: 'status_transition',
          entityType: 'order',
          entityId: '1',
          orderId: 1,
          fromState: 'submitted',
          toState: 'needs_qa',
          reason: 'system',
        },
        manager,
      );

      expect(manager.getRepository).toHaveBeenCalledWith(AuditEvent);
      expect(txRepo.save).toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('returns existing row on idempotency key unique violation', async () => {
      const existing = {
        id: 99,
        idempotencyKey: 'pay:order:1',
        action: 'payment_authorized',
      } as AuditEvent;
      repo.save.mockRejectedValueOnce({
        code: '23505',
        constraint: 'uq_audit_events_idempotency_key',
      });
      repo.findOne.mockResolvedValue(existing);

      const result = await service.append({
        action: 'payment_authorized',
        entityType: 'order',
        entityId: '1',
        orderId: 1,
        idempotencyKey: 'pay:order:1',
      });

      expect(result).toBe(existing);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { idempotencyKey: 'pay:order:1' },
      });
    });

    it('rethrows non-idempotency errors', async () => {
      repo.save.mockRejectedValueOnce(new Error('db down'));

      await expect(
        service.append({
          action: 'status_transition',
          entityType: 'order',
          entityId: '1',
        }),
      ).rejects.toThrow('db down');
    });
  });

  describe('recordOrderStatusTransition', () => {
    it('writes status_transition with order entity refs', async () => {
      await service.recordOrderStatusTransition({
        orderId: 15,
        fromStatus: 'submitted',
        toStatus: 'approved_for_matching',
        actorUserId: 3,
        actorRole: 'ops_admin',
        reason: 'Admin status update',
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'status_transition',
          entityType: 'order',
          entityId: '15',
          orderId: 15,
          fromState: 'submitted',
          toState: 'approved_for_matching',
          actorId: 3,
          actorRole: 'ops_admin',
          reason: 'Admin status update',
        }),
      );
    });
  });
});
