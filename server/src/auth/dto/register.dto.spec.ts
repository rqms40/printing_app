import { validateSync } from 'class-validator';
import { RegisterDto } from './register.dto';

describe('RegisterDto', () => {
  it('accepts optional profile fields during registration', () => {
    const dto = Object.assign(new RegisterDto(), {
      email: 'test@example.com',
      password: 'password123',
      fullName: 'Maria Santos',
      nickname: 'Mia',
      profileCategory: 'student',
      profileField: 'architecture',
      ageRange: '18_24',
      phoneNumber: '+639171234567',
      gender: 'female',
      dateOfBirth: '2001-02-03',
      course: 'BS Architecture',
      organization: 'Mapua University',
      printingPreferences: ['plotting_blueprints'],
    });

    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toHaveLength(0);
  });

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

  it('rejects empty fullName during registration', () => {
    const dto = Object.assign(new RegisterDto(), {
      email: 'test@example.com',
      password: 'password123',
      fullName: '',
      profileCategory: 'student',
      profileField: 'architecture',
    });

    const errors = validateSync(dto);

    expect(errors.some((error) => error.property === 'fullName')).toBe(true);
  });

  it('rejects whitespace-only fullName during registration', () => {
    const dto = Object.assign(new RegisterDto(), {
      email: 'test@example.com',
      password: 'password123',
      fullName: '   ',
      profileCategory: 'student',
      profileField: 'architecture',
    });

    const errors = validateSync(dto);

    expect(errors.some((error) => error.property === 'fullName')).toBe(true);
  });

  it('rejects an invalid ageRange during registration', () => {
    const dto = Object.assign(new RegisterDto(), {
      email: 'test@example.com',
      password: 'password123',
      fullName: 'Maria Santos',
      nickname: 'Mia',
      profileCategory: 'student',
      profileField: 'architecture',
      ageRange: 'old_enough',
    });

    const errors = validateSync(dto);

    expect(errors.some((error) => error.property === 'ageRange')).toBe(true);
  });

  it('accepts optional clientAccountType values business|organization|teacher', () => {
    for (const clientAccountType of [
      'business',
      'organization',
      'teacher',
    ] as const) {
      const dto = Object.assign(new RegisterDto(), {
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Maria Santos',
        profileCategory: 'professional',
        profileField: 'business_corporate',
        clientAccountType,
      });

      const errors = validateSync(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      expect(errors).toHaveLength(0);
    }
  });

  it('allows omitting clientAccountType during registration', () => {
    const dto = Object.assign(new RegisterDto(), {
      email: 'test@example.com',
      password: 'password123',
      fullName: 'Maria Santos',
      profileCategory: 'student',
      profileField: 'architecture',
    });

    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toHaveLength(0);
    expect(dto.clientAccountType).toBeUndefined();
  });

  it('rejects an invalid clientAccountType during registration', () => {
    const dto = Object.assign(new RegisterDto(), {
      email: 'test@example.com',
      password: 'password123',
      fullName: 'Maria Santos',
      profileCategory: 'professional',
      profileField: 'business_corporate',
      clientAccountType: 'enterprise',
    });

    const errors = validateSync(dto);

    expect(errors.some((error) => error.property === 'clientAccountType')).toBe(
      true,
    );
  });
});
