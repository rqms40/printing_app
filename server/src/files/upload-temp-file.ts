import { Logger } from '@nestjs/common';
import { unlink } from 'node:fs/promises';

const logger = new Logger('UploadTempFileCleanup');

export async function removeUploadedTempFile(
  file: Express.Multer.File | null | undefined,
): Promise<void> {
  if (!file || Buffer.isBuffer(file.buffer) || !file.path) return;
  try {
    await unlink(file.path);
  } catch (error) {
    logger.warn(`Failed to remove temporary upload ${file.path}: ${error}`);
  }
}
