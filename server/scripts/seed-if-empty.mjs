import { spawn } from 'node:child_process';
import { Client } from 'pg';

const requiredMigration = {
  timestamp: '1777853500000',
  name: 'AtomicCreditAccounting1777853500000',
};

const client = new Client({
  host: process.env.DATABASE_HOST || 'localhost',
  port: Number(process.env.DATABASE_PORT || 5432),
  database: process.env.DATABASE_NAME || 'grid_print',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
});

function runSeed() {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'seed'], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Seed exited with code ${code}`));
    });
  });
}

async function main() {
  await client.connect();
  try {
    const tables = await client.query(
      `SELECT
         to_regclass('public.users') AS users_table,
         to_regclass('public.migrations') AS migrations_table`,
    );
    if (!tables.rows[0]?.users_table || !tables.rows[0]?.migrations_table) {
      throw new Error('Run npm run migration:run before seeding');
    }

    const migration = await client.query(
      `SELECT EXISTS (
         SELECT 1 FROM migrations
         WHERE timestamp = $1 AND name = $2
       ) AS applied`,
      [requiredMigration.timestamp, requiredMigration.name],
    );
    if (!migration.rows[0]?.applied) {
      throw new Error('Run npm run migration:run before seeding');
    }

    const count = await client.query(
      'SELECT count(*)::int AS count FROM users',
    );
    if (Number(count.rows[0]?.count || 0) > 0) {
      console.log('GRIDGO seed skipped: users table already has data.');
      return;
    }
  } finally {
    await client.end();
  }

  await runSeed();
}

main().catch((error) => {
  console.error('GRIDGO seed-if-empty failed:', error);
  process.exit(1);
});
