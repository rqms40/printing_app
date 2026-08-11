import {
  CallHandler,
  ExecutionContext,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { unlink } from 'node:fs/promises';
import { catchError, from, mergeMap, Observable, throwError } from 'rxjs';

import type { RequestWithUser } from '../common/interfaces/request-with-user';

const logger = new Logger('UploadTempFileCleanup');

export async function removeUploadedTempFile(
  file: Express.Multer.File | null | undefined,
): Promise<void> {
  if (!file || Buffer.isBuffer(file.buffer) || !file.path) return;
  try {
    await unlink(file.path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    logger.warn(`Failed to remove temporary upload ${file.path}: ${error}`);
  }
}

/** Cleans disk-backed Multer files when pipes or controller code reject. */
export class UploadTempFileCleanupInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    return next
      .handle()
      .pipe(
        catchError((error: unknown) =>
          from(removeUploadedTempFile(request.file)).pipe(
            mergeMap(() => throwError(() => error)),
          ),
        ),
      );
  }
}
