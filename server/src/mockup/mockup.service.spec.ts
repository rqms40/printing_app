import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MockupService } from './mockup.service';
import { MockupRenderStatus } from './entities/artwork-mockup-render.entity';

describe('MockupService', () => {
  let service: MockupService;
  let mockupRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
  };
  let fileRepo: { findOne: jest.Mock };

  beforeEach(() => {
    mockupRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) =>
        Array.isArray(x) ? x : { id: 1, createdAt: new Date(), ...x },
      ),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };
    fileRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 10,
        uploadedBy: 5,
      }),
    };
    service = new MockupService(mockupRepo as any, fileRepo as any);
  });

  it('renders static non-production mockup and versions template', async () => {
    const out = await service.render(
      { artworkFileId: 10, productType: 'flyer' },
      5,
      false,
    );
    expect(out.isNonProduction).toBe(true);
    expect(out.notPrintReady).toBe(true);
    expect(out.templateVersion).toBe('flyer-v1');
    expect(out.productType).toBe('flyer');
    expect(out.renderStatus).toBe(MockupRenderStatus.READY);
    expect(out.renderUrl).toContain('flyer-v1');
  });

  it('rejects non-owner client', async () => {
    await expect(
      service.render({ artworkFileId: 10, productType: 'signage' }, 99, false),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows staff to preview any artwork', async () => {
    const out = await service.render(
      { artworkFileId: 10, productType: 't-shirt' },
      1,
      true,
    );
    expect(out.productType).toBe('t-shirt');
    expect(out.templateVersion).toBe('tshirt-v1');
  });

  it('invalidates prior ready renders on re-render', async () => {
    mockupRepo.find.mockResolvedValueOnce([
      {
        id: 2,
        artworkFileId: 10,
        productType: 'flyer',
        renderStatus: MockupRenderStatus.READY,
      },
    ]);
    await service.render({ artworkFileId: 10, productType: 'flyer' }, 5, false);
    expect(mockupRepo.save).toHaveBeenCalled();
    const invalidated = mockupRepo.save.mock.calls[0][0];
    expect(Array.isArray(invalidated)).toBe(true);
    expect(invalidated[0].renderStatus).toBe(MockupRenderStatus.INVALIDATED);
  });

  it('returns static SVG for known template keys', () => {
    const svg = service.getStaticSvg('flyer-v1.svg');
    expect(svg).toContain('MOCKUP — NOT PRINT-READY');
    expect(svg).toContain('flyer-v1');
  });

  it('throws when artwork missing', async () => {
    fileRepo.findOne.mockResolvedValue(null);
    await expect(
      service.render({ artworkFileId: 1, productType: 'flyer' }, 1, true),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
