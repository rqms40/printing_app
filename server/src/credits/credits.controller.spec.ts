import { ROLES_KEY } from '../auth/guards/roles.guard';
import { CreditsController } from './credits.controller';

describe('CreditsController authorization metadata', () => {
  for (const method of [
    'updateSettings',
    'getPendingRequests',
    'approveTopUp',
    'rejectTopUp',
    'grantPilotCredits',
    'manualAdjustment',
  ] as const) {
    it(`restricts ${method} to ops_admin / super_admin`, () => {
      expect(
        Reflect.getMetadata(ROLES_KEY, CreditsController.prototype[method]),
      ).toEqual(['ops_admin', 'super_admin']);
    });
  }

  it('does not expose grant to unauthenticated roles metadata on client endpoints', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, CreditsController.prototype.requestTopUp),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(ROLES_KEY, CreditsController.prototype.getMyCredits),
    ).toBeUndefined();
  });

  it('does not expose reserve/spend/release as client-callable mint endpoints', () => {
    const proto = CreditsController.prototype as Record<string, unknown>;
    expect(proto.reserve).toBeUndefined();
    expect(proto.spend).toBeUndefined();
    expect(proto.release).toBeUndefined();
  });
});
