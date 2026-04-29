import { ForbiddenException } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FileMetadata } from './entities/file-metadata.entity';
import { PaperSizeValidatorService } from './paper-size-validator.service';
import type { FilesService } from './files.service';
import type { RequestWithUser } from '../common/interfaces/request-with-user';

const makeFile = (overrides: Partial<FileMetadata> = {}) =>
  ({
    id: 1,
    uploadedBy: 42,
    objectKey: 'uploads/general/file.pdf',
    originalName: 'file.pdf',
    mimeType: 'application/pdf',
    size: 100,
    url: 'http://storage/file.pdf',
    ...overrides,
  }) as FileMetadata;

const makeRequest = (sub: number, role = 'customer') =>
  ({ user: { sub, role, email: 'user@example.com' } }) as RequestWithUser;

describe('FilesController', () => {
  let controller: FilesController;
  let filesService: Pick<FilesService, 'findById'>;

  beforeEach(() => {
    filesService = {
      findById: jest.fn(),
    };
    controller = new FilesController(
      filesService as FilesService,
      {} as PaperSizeValidatorService,
    );
  });

  it('returns file metadata for the owner', async () => {
    const file = makeFile({ uploadedBy: 42 });
    jest.mocked(filesService.findById).mockResolvedValue(file);

    await expect(controller.getFile(1, makeRequest(42))).resolves.toBe(file);
  });

  it('returns file metadata for admins', async () => {
    const file = makeFile({ uploadedBy: 42 });
    jest.mocked(filesService.findById).mockResolvedValue(file);

    await expect(controller.getFile(1, makeRequest(1, 'admin'))).resolves.toBe(
      file,
    );
  });

  it('rejects file metadata reads by non-owners', async () => {
    jest
      .mocked(filesService.findById)
      .mockResolvedValue(makeFile({ uploadedBy: 99 }));

    await expect(controller.getFile(1, makeRequest(42))).rejects.toThrow(
      ForbiddenException,
    );
  });
});
