import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateHomeFeedPromoCardDto } from './create-home-feed-promo-card.dto';
import { ReorderHomeFeedPromoCardsDto } from './reorder-home-feed-promo-cards.dto';
import { UpdateHomeFeedPromoCardDto } from './update-home-feed-promo-card.dto';

describe('home feed promo card DTOs', () => {
  it('accepts a valid image-led card', async () => {
    const dto = plainToInstance(CreateHomeFeedPromoCardDto, {
      title: 'Fresh finishes',
      body: "Explore this week's paper picks.",
      ctaLabel: 'Start printing',
      ctaTarget: '/customer/order/new',
      imageUrl: 'https://cdn.example.com/card.webp',
      isActive: true,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('accepts a title-only card and a nullable update', async () => {
    const create = plainToInstance(CreateHomeFeedPromoCardDto, {
      title: 'Simple campaign',
    });
    const update = plainToInstance(UpdateHomeFeedPromoCardDto, {
      body: null,
      ctaLabel: null,
      ctaTarget: null,
      imageUrl: null,
    });

    await expect(validate(create)).resolves.toHaveLength(0);
    await expect(validate(update)).resolves.toHaveLength(0);
  });

  it.each(['title', 'isActive'])(
    'rejects null for %s on update',
    async (key) => {
      const errors = await validate(
        plainToInstance(UpdateHomeFeedPromoCardDto, { [key]: null }),
      );
      expect(errors.some((error) => error.property === key)).toBe(true);
    },
  );

  it.each([
    [{}, 'title'],
    [{ title: '   ' }, 'title'],
    [{ title: 'x'.repeat(81) }, 'title'],
    [{ title: 'Card', ctaTarget: 'http://example.com' }, 'ctaTarget'],
    [{ title: 'Card', imageUrl: 'not-a-url' }, 'imageUrl'],
  ] as const)('rejects invalid card input', async (input, property) => {
    const errors = await validate(
      plainToInstance(CreateHomeFeedPromoCardDto, input),
    );
    expect(errors.some((error) => error.property === property)).toBe(true);
  });

  it('accepts a unique positive reorder list', async () => {
    const dto = plainToInstance(ReorderHomeFeedPromoCardsDto, {
      ids: [3, 1, 2],
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([[[]], [[1, 1]], [[0, 2]], [[1.5, 2]]])(
    'rejects invalid reorder ids %j',
    async (ids) => {
      const errors = await validate(
        plainToInstance(ReorderHomeFeedPromoCardsDto, { ids }),
      );
      expect(errors.some((error) => error.property === 'ids')).toBe(true);
    },
  );
});
