import { isAdminRole, UserRole } from './user.entity';

describe('UserRole marketplace values', () => {
  it('exposes only the five marketplace role strings', () => {
    expect(Object.values(UserRole).sort()).toEqual(
      ['client', 'ops_admin', 'rider', 'super_admin', 'supplier'].sort(),
    );
  });

  it('does not keep legacy customer/admin enum members', () => {
    expect(UserRole).not.toHaveProperty('CUSTOMER');
    expect(UserRole).not.toHaveProperty('ADMIN');
    expect(Object.values(UserRole)).not.toContain('customer');
    expect(Object.values(UserRole)).not.toContain('admin');
  });

  it.each([
    [UserRole.OPS_ADMIN, true],
    [UserRole.SUPER_ADMIN, true],
    [UserRole.CLIENT, false],
    [UserRole.SUPPLIER, false],
    [UserRole.RIDER, false],
    ['ops_admin', true],
    ['super_admin', true],
    ['client', false],
    [null, false],
    [undefined, false],
  ])('isAdminRole(%p) → %p', (role, expected) => {
    expect(isAdminRole(role as string | null | undefined)).toBe(expected);
  });
});
