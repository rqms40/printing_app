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

  it('seeds print scaling as a paper catalog option', () => {
    const seedSource = readFileSync(join(__dirname, 'seed.ts'), 'utf8');

    expect(seedSource).toContain("label: 'Print Mode'");
    expect(seedSource).toContain("label: 'Fit to Scale'");
    expect(seedSource).toContain("label: 'Actual Size'");
  });

  it('wires the active demo delivery to Maria home address coordinates', () => {
    const seedSource = readFileSync(join(__dirname, 'seed.ts'), 'utf8');

    expect(seedSource).toContain('homeAddressId');
    expect(seedSource).toMatch(
      /order_id: 'ORD-10004',[\s\S]*delivery_address_id: homeAddressId/,
    );
    expect(seedSource).toContain('INSERT INTO delivery_destinations');
    expect(seedSource).toContain(
      'destinationByOrderRef.set(o.order_id, destinationId)',
    );
    expect(seedSource).toContain(
      'delivery_address_id, batch_order_id, destination_id, file_name',
    );
    expect(seedSource).toContain('file_name, destination_id');
  });

  it('migrates print scaling out of user profile defaults', () => {
    const migrationSource = readFileSync(
      join(
        __dirname,
        '..',
        'migrations',
        '1777766500000-rename-print-mode-fit-to-scale.ts',
      ),
      'utf8',
    );

    expect(migrationSource).toContain('category."slug" = \'paper\'');
    expect(migrationSource).toContain(
      'DROP COLUMN IF EXISTS "default_print_mode"',
    );
  });
});
