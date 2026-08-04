import { getMetadataArgsStorage } from 'typeorm';
import { AuditEvent } from './audit-event.entity';

function columnType(
  target: Function,
  propertyName: string,
): string | Function | undefined {
  return getMetadataArgsStorage().columns.find(
    (column) =>
      column.target === target && column.propertyName === propertyName,
  )?.options.type as string | Function | undefined;
}

describe('AuditEvent entity metadata', () => {
  it('maps to audit_events table', () => {
    const table = getMetadataArgsStorage().tables.find(
      (t) => t.target === AuditEvent,
    );
    expect(table?.name).toBe('audit_events');
  });

  it('declares actor, transition, entity-ref, and idempotency columns', () => {
    expect(columnType(AuditEvent, 'actorId')).toBe('int');
    expect(columnType(AuditEvent, 'actorRole')).toBe('varchar');
    expect(columnType(AuditEvent, 'action')).toBe('varchar');
    expect(columnType(AuditEvent, 'entityType')).toBe('varchar');
    expect(columnType(AuditEvent, 'entityId')).toBe('varchar');
    expect(columnType(AuditEvent, 'orderId')).toBe('int');
    expect(columnType(AuditEvent, 'fromState')).toBe('varchar');
    expect(columnType(AuditEvent, 'toState')).toBe('varchar');
    expect(columnType(AuditEvent, 'reason')).toBe('text');
    expect(columnType(AuditEvent, 'metadata')).toBe('jsonb');
    expect(columnType(AuditEvent, 'idempotencyKey')).toBe('varchar');
  });

  it('is append-only (no UpdateDateColumn)', () => {
    const updateColumns = getMetadataArgsStorage().columns.filter(
      (column) =>
        column.target === AuditEvent && column.propertyName === 'updatedAt',
    );
    expect(updateColumns).toHaveLength(0);
  });

  it('declares partial unique index on idempotency_key', () => {
    const index = getMetadataArgsStorage().indices.find(
      (entry) =>
        entry.target === AuditEvent &&
        entry.name === 'uq_audit_events_idempotency_key',
    );
    expect(index?.unique).toBe(true);
    expect(index?.where).toContain('idempotency_key');
  });
});
