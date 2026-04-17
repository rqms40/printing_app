import { validateSync } from 'class-validator';
import { RegisterDto } from './register.dto';

describe('RegisterDto', () => {
  it('requires fullName during registration', () => {
    const dto = Object.assign(new RegisterDto(), {
      email: 'test@example.com',
      password: 'password123',
      profileCategory: 'student',
      profileField: 'architecture',
    });

    const errors = validateSync(dto);

    expect(errors.some((error) => error.property === 'fullName')).toBe(true);
  });
});
