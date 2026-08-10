import { readFileSync } from 'fs';
import { join } from 'path';

function workflowSource(name: string): string {
  return readFileSync(
    join(__dirname, '..', '..', '.github', 'workflows', name),
    'utf8',
  );
}

describe('seed script', () => {
  it('requires independent role-specific passwords without publishing credentials', () => {
    const seedSource = readFileSync(join(__dirname, 'seed.ts'), 'utf8');

    expect(seedSource).toContain('GRIDGO_SEED_CUSTOMER_PASSWORD');
    expect(seedSource).toContain('GRIDGO_SEED_RIDER_PASSWORD');
    expect(seedSource).toContain('GRIDGO_SEED_ADMIN_PASSWORD');
    expect(seedSource).toContain('bcrypt.hash(customerPassword, 10)');
    expect(seedSource).toContain('bcrypt.hash(riderPassword, 10)');
    expect(seedSource).toContain('bcrypt.hash(adminPassword, 10)');
    expect(seedSource).not.toContain('password123');
    expect(seedSource).not.toContain('Login credentials');
    expect(seedSource).not.toContain('all use password');
  });

  it('passes seed password variable names through Compose without values', () => {
    const composeSource = readFileSync(
      join(__dirname, '..', '..', 'docker-compose.dev.yml'),
      'utf8',
    );

    expect(composeSource).toContain(
      'GRIDGO_SEED_CUSTOMER_PASSWORD: ${GRIDGO_SEED_CUSTOMER_PASSWORD}',
    );
    expect(composeSource).toContain(
      'GRIDGO_SEED_RIDER_PASSWORD: ${GRIDGO_SEED_RIDER_PASSWORD}',
    );
    expect(composeSource).toContain(
      'GRIDGO_SEED_ADMIN_PASSWORD: ${GRIDGO_SEED_ADMIN_PASSWORD}',
    );
    expect(composeSource).not.toMatch(
      /GRIDGO_SEED_(?:CUSTOMER|RIDER|ADMIN)_PASSWORD:\s*[^$\s]/,
    );
  });

  it('requires explicit JWT and MinIO credentials in deployment stacks', () => {
    const devCompose = readFileSync(
      join(__dirname, '..', '..', 'docker-compose.dev.yml'),
      'utf8',
    );
    const productionCompose = readFileSync(
      join(__dirname, '..', 'docker-compose.yml'),
      'utf8',
    );
    const freshStack = workflowSource('ci-fresh-stack.yml');

    for (const compose of [devCompose, productionCompose]) {
      expect(compose).toContain('JWT_SECRET: ${JWT_SECRET:?');
      expect(compose).toContain('MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY:?');
      expect(compose).toContain('MINIO_SECRET_KEY: ${MINIO_SECRET_KEY:?');
      expect(compose).not.toContain('minioadmin');
    }
    expect(productionCompose).toContain(
      'MINIO_PUBLIC_URL: ${MINIO_PUBLIC_URL:?',
    );
    expect(freshStack).toContain('MINIO_ACCESS_KEY MINIO_SECRET_KEY');
  });

  it('wires the migration lifecycle to the CI job MinIO service', () => {
    const serverCi = workflowSource('ci-server.yml');
    const migrationJob = serverCi.slice(serverCi.indexOf('  migration:'));
    const migrationEnv = migrationJob.slice(
      migrationJob.indexOf('    env:'),
      migrationJob.indexOf('    steps:'),
    );

    expect(migrationEnv).toContain(
      'GRIDGO_LIFECYCLE_MINIO_ENDPOINT: 127.0.0.1',
    );
    expect(migrationEnv).toContain('GRIDGO_LIFECYCLE_MINIO_PORT: "9000"');
    expect(migrationEnv).toContain(
      'GRIDGO_LIFECYCLE_MINIO_ACCESS_KEY: minioadmin',
    );
    expect(migrationEnv).toContain(
      'GRIDGO_LIFECYCLE_MINIO_SECRET_KEY: minioadmin',
    );
  });

  it('isolates release signing from publication with job-level least privilege', () => {
    const release = workflowSource('release-apk.yml');
    const topLevel = release.slice(0, release.indexOf('jobs:'));
    const gate = release.slice(
      release.indexOf('  gate:'),
      release.indexOf('  build:'),
    );
    const build = release.slice(
      release.indexOf('  build:'),
      release.indexOf('  publisher:'),
    );
    const publisher = release.slice(release.indexOf('  publisher:'));

    expect(topLevel).not.toContain('contents: write');
    expect(gate).toContain('permissions:');
    expect(gate).toContain('actions: read');
    expect(gate).toContain('checks: read');
    expect(gate).toContain('contents: read');
    expect(gate).toContain('timeout-minutes: 120');
    expect(build).toContain('permissions:');
    expect(build).toContain('contents: read');
    expect(build).toContain('persist-credentials: false');
    expect(build).toContain('Remove decoded signing material after build');
    expect(build).toContain('Remove decoded signing material if interrupted');
    expect(build).toContain(
      'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',
    );
    expect(build).not.toContain('softprops/action-gh-release');
    expect(publisher).toContain('permissions:');
    expect(publisher).toContain('contents: write');
    expect(publisher).toContain('needs: build');
    expect(publisher).toContain(
      'actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093',
    );
    expect(publisher).toContain(
      'softprops/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65',
    );
    expect(build).toMatch(
      /- name: Build signed release APK[\s\S]*?\n\n {6}- name: Remove decoded signing material after build/,
    );
  });

  it('uploads only secret-scanned sanitized visual evidence', () => {
    const visual = workflowSource('visual-evidence.yml');
    const uploadAction =
      'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02';

    expect(visual).toContain('Build sanitized accepted evidence');
    expect(visual).toContain('Scan sanitized evidence for secrets');
    expect(visual).toContain('GRIDGO_SEED_CUSTOMER_PASSWORD');
    expect(visual).toContain('GRIDGO_SEED_RIDER_PASSWORD');
    expect(visual).toContain('GRIDGO_SEED_ADMIN_PASSWORD');
    expect(visual).toContain('JWT_SECRET');
    expect(visual).toContain('Bearer\\s+');
    expect(visual).toContain(
      'access_?token|token|jwt|authorization|password|secret',
    );
    expect(visual.indexOf('Scan sanitized evidence for secrets')).toBeLessThan(
      visual.indexOf(uploadAction),
    );
    expect(visual.match(new RegExp(uploadAction, 'g'))).toHaveLength(1);
    expect(visual).toContain('path: sanitized-evidence');
    expect(visual).not.toContain('Upload unaccepted visual evidence');
    expect(visual).not.toContain('beta-visual-failure');
    expect(visual).not.toContain('path: visual-failure');
    expect(visual).not.toContain('path: beta-evidence');
    expect(visual).not.toContain('path: e2e/mobile-web/test-results');
  });

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

  it('delegates catalog persistence to the versioned v1.10 upsert', () => {
    const seedSource = readFileSync(join(__dirname, 'seed.ts'), 'utf8');

    expect(seedSource).toContain('import { upsertCatalogV110 }');
    expect(seedSource).toContain('await upsertCatalogV110(ds)');
    expect(seedSource).not.toContain("slug, 'paper'");
    expect(seedSource).not.toContain("slug, '3d'");
    expect(seedSource).not.toContain("category: 'paper'");
    expect(seedSource).not.toContain("category: '3d'");
    expect(seedSource.match(/subtitle: 'Quote required'/g)).toHaveLength(5);
  });

  it('seeds accounts with zero orders and no delivery fixtures', () => {
    const seedSource = readFileSync(join(__dirname, 'seed.ts'), 'utf8');

    // Seed users start from a clean slate — no demo orders, assignments,
    // payments, or order-bound notifications; the fresh-order journey is
    // exercised end-to-end by the app itself.
    expect(seedSource).not.toContain("order_id: 'ORD-");
    expect(seedSource).not.toContain('INSERT INTO orders');
    expect(seedSource).not.toContain('INSERT INTO order_items');
    expect(seedSource).not.toContain('INSERT INTO delivery_assignments');
    expect(seedSource).not.toContain('INSERT INTO payment_transactions');
    // Truncate list still resets order tables for repeatable fresh stacks.
    expect(seedSource).toContain('order_items, orders, batch_orders');
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
