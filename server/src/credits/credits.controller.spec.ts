import { ROLES_KEY } from '../auth/guards/roles.guard';
import { CreditsController } from './credits.controller';

describe('CreditsController authorization metadata', () => {
  for (const method of [
    'updateSettings',
    'getPendingRequests',
    'approveTopUp',
    'rejectTopUp',
  ] as const) {
    it(`restricts ${method} to admins`, () => {
      expect(
        Reflect.getMetadata(ROLES_KEY, CreditsController.prototype[method]),
      ).toEqual(['admin']);
    });
  }
});
