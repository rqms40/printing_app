import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { HomeFeedMode } from '../entities/home-feed-settings.entity';
import { UpdateHomeFeedSettingsDto } from './update-home-feed-settings.dto';

async function validateDto(input: object) {
  return validate(plainToInstance(UpdateHomeFeedSettingsDto, input));
}

describe('UpdateHomeFeedSettingsDto', () => {
  it.each(Object.values(HomeFeedMode))('accepts the %s mode', async (mode) => {
    await expect(validateDto({ mode })).resolves.toHaveLength(0);
  });

  it('rejects a missing mode', async () => {
    const errors = await validateDto({});
    expect(errors.some((error) => error.property === 'mode')).toBe(true);
  });

  it('rejects an unknown mode', async () => {
    const errors = await validateDto({ mode: 'manual' });
    expect(errors.some((error) => error.property === 'mode')).toBe(true);
  });
});
