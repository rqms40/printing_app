import { ClientAccountType } from './profile.constants';

describe('ClientAccountType', () => {
  it('exposes only business | organization | teacher', () => {
    expect(Object.values(ClientAccountType).sort()).toEqual(
      ['business', 'organization', 'teacher'].sort(),
    );
  });
});
