import { readFileSync } from 'fs';
import { join } from 'path';

describe('seed script', () => {
  it('includes batch_orders in the fresh reset truncate list', () => {
    const seedSource = readFileSync(join(__dirname, 'seed.ts'), 'utf8');

    expect(seedSource).toContain('batch_orders');
  });

  it('includes order_items in the fresh reset truncate list', () => {
    const seedSource = readFileSync(join(__dirname, 'seed.ts'), 'utf8');

    expect(seedSource).toContain('order_items');
  });

  it('includes beta_mode_settings in the fresh reset truncate list', () => {
    const seedSource = readFileSync(join(__dirname, 'seed.ts'), 'utf8');

    expect(seedSource).toContain('beta_mode_settings');
  });

  it('seeds beta mode disabled after reset', () => {
    const seedSource = readFileSync(join(__dirname, 'seed.ts'), 'utf8');

    expect(seedSource).toContain(
      'INSERT INTO beta_mode_settings (is_enabled) VALUES ($1)',
    );
    expect(seedSource).toContain('[\n    false,\n  ]');
  });

  it('seeds dynamic product catalog tables', () => {
    const seedSource = readFileSync(join(__dirname, 'seed.ts'), 'utf8');

    expect(seedSource).toContain('product_categories');
    expect(seedSource).toContain('product_spec_definitions');
    expect(seedSource).toContain('product_spec_options');
    expect(seedSource).toContain('order_item_spec_values');
    expect(seedSource).toContain('per_page_modifiers');
    expect(seedSource).toContain('base_plus_material_estimate');
    expect(seedSource).toContain('"tif","tiff"');
  });
});
