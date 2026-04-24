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

  it('accepts valid paperSpecs object', async () => {
    const errs = await v({
      title: 'Bond A4',
      category: 'paper',
      paperSpecs: { paperSize: 'a4', colorMode: 'blackAndWhite' },
    });
    expect(errs).toHaveLength(0);
  });

  it('accepts valid threeDSpecs object', async () => {
    const errs = await v({
      title: '3D Print',
      category: '3d',
      threeDSpecs: { material: 'pla', infillPercentage: 20 },
    });
    expect(errs).toHaveLength(0);
  });

  it('rejects paperSpecs as a string', async () => {
    const errs = await v({
      title: 'Bond A4',
      category: 'paper',
      paperSpecs: 'not-an-object',
    });
    expect(errs.some((e) => e.property === 'paperSpecs')).toBe(true);
  });

  it('accepts card without specs', async () => {
    const errs = await v({ title: 'Bond A4', category: 'paper' });
    expect(errs).toHaveLength(0);
  });

  it('rejects missing title', async () => {
    const errs = await v({ category: 'paper' });
    expect(errs.some((e) => e.property === 'title')).toBe(true);
  });

  it('rejects invalid category', async () => {
    const errs = await v({ title: 'Test', category: 'laser' });
    expect(errs.some((e) => e.property === 'category')).toBe(true);
  });
});
