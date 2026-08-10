import { getMetadataArgsStorage } from 'typeorm';
import { User } from './user.entity';

describe('user entity column metadata', () => {
  it('declares explicit database types for nullable union columns', () => {
    const columns = getMetadataArgsStorage().columns;

    const fullName = columns.find(
      (column) => column.target === User && column.propertyName === 'fullName',
    );
    const phoneNumber = columns.find(
      (column) =>
        column.target === User && column.propertyName === 'phoneNumber',
    );
    const gender = columns.find(
      (column) => column.target === User && column.propertyName === 'gender',
    );

    expect(fullName?.options.type).toBe('text');
    expect(phoneNumber?.options.type).toBe('text');
    expect(gender?.options.type).toBe('text');
  });

  it('does not declare print scaling as a user profile column', () => {
    const columns = getMetadataArgsStorage().columns;

    const defaultPrintMode = columns.find(
      (column) =>
        column.target === User && column.propertyName === 'defaultPrintMode',
    );

    expect(defaultPrintMode).toBeUndefined();
  });

  it('declares pilot COD eligibility and ops risk flags (default false)', () => {
    const columns = getMetadataArgsStorage().columns;

    const pilotCod = columns.find(
      (column) =>
        column.target === User && column.propertyName === 'pilotCodEligible',
    );
    const opsRisk = columns.find(
      (column) =>
        column.target === User && column.propertyName === 'codOpsRiskBlocked',
    );

    expect(pilotCod?.options.name).toBe('pilot_cod_eligible');
    expect(pilotCod?.options.type).toBe('boolean');
    expect(pilotCod?.options.default).toBe(false);
    expect(opsRisk?.options.name).toBe('cod_ops_risk_blocked');
    expect(opsRisk?.options.default).toBe(false);
  });
});
