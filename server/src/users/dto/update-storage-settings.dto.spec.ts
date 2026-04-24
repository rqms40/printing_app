import { validate } from 'class-validator';
import { UpdateStorageSettingsDto } from './update-storage-settings.dto';

async function check(value: unknown) {
  const dto = Object.assign(new UpdateStorageSettingsDto(), {
    fileRetentionDays: value,
  });
  return validate(dto);
}

describe('UpdateStorageSettingsDto', () => {
  it('accepts null (disables retention)', async () => {
    expect(await check(null)).toHaveLength(0);
  });

  it('accepts 1', async () => {
    expect(await check(1)).toHaveLength(0);
  });

  it('accepts 7', async () => {
    expect(await check(7)).toHaveLength(0);
  });

  it('accepts 30', async () => {
    expect(await check(30)).toHaveLength(0);
  });

  it('accepts 45 (arbitrary custom value)', async () => {
    expect(await check(45)).toHaveLength(0);
  });

  it('accepts 365', async () => {
    expect(await check(365)).toHaveLength(0);
  });

  it('rejects 0', async () => {
    expect((await check(0)).length).toBeGreaterThan(0);
  });

  it('rejects -1', async () => {
    expect((await check(-1)).length).toBeGreaterThan(0);
  });

  it('rejects 1.5 (non-integer)', async () => {
    expect((await check(1.5)).length).toBeGreaterThan(0);
  });
});
