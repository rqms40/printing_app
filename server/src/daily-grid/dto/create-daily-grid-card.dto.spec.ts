import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateDailyGridCardDto } from './create-daily-grid-card.dto';

async function v(plain: object) {
  const dto = plainToInstance(CreateDailyGridCardDto, plain);
  return validate(dto);
}

describe('CreateDailyGridCardDto', () => {
  it('accepts minimal valid card', async () => {
    const errs = await v({ title: 'Bond A4', category: 'paper' });
    expect(errs).toHaveLength(0);
  });

  it('accepts dynamic catalog specs object', async () => {
    const errs = await v({
      title: 'Bond A4',
      category: 'paper',
      specs: { paper_size: 'a4', color_mode: 'black_and_white' },
    });
    expect(errs).toHaveLength(0);
  });

  it('accepts any product category slug', async () => {
    const errs = await v({
      title: 'Sticker Pack',
      category: 'stickers',
      specs: { size: 'small' },
    });
    expect(errs).toHaveLength(0);
  });

  it('rejects specs as a string', async () => {
    const errs = await v({
      title: 'Bond A4',
      category: 'paper',
      specs: 'not-an-object',
    });
    expect(errs.some((e) => e.property === 'specs')).toBe(true);
  });

  it('accepts card without specs', async () => {
    const errs = await v({ title: 'Bond A4', category: 'paper' });
    expect(errs).toHaveLength(0);
  });

  it('rejects missing title', async () => {
    const errs = await v({ category: 'paper' });
    expect(errs.some((e) => e.property === 'title')).toBe(true);
  });

  it('rejects invalid category slug format', async () => {
    const errs = await v({ title: 'Test', category: 'Laser Prints' });
    expect(errs.some((e) => e.property === 'category')).toBe(true);
  });
});
