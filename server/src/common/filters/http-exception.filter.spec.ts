import { ForbiddenException } from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';

describe('AllExceptionsFilter', () => {
  it('preserves authored structured fields in an HTTP exception response', () => {
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status, json }),
        getRequest: () => ({ method: 'POST', url: '/api/auth/login' }),
      }),
    };
    const exception = new ForbiddenException({
      code: 'beta_held',
      message: 'Beta testing completed.',
      user: { fullName: 'Test User', email: 'test@example.com' },
      betaPhotoUploaded: true,
      betaSharedOnSocial: false,
      betaCompletedAt: '2026-07-09T10:00:00.000Z',
    });

    new AllExceptionsFilter().catch(exception, host as never);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        code: 'beta_held',
        user: { fullName: 'Test User', email: 'test@example.com' },
        betaPhotoUploaded: true,
        betaSharedOnSocial: false,
        betaCompletedAt: '2026-07-09T10:00:00.000Z',
      }),
    );
  });
});
