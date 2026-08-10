/**
 * Upsert the five marketplace pilot login accounts so local logins work
 * even when the DB was seeded earlier with old roles/passwords.
 *
 * Usage (from server/):
 *   node scripts/sync-seed-logins.mjs
 *
 * Requires GRIDGO_SEED_CUSTOMER_PASSWORD, GRIDGO_SEED_RIDER_PASSWORD,
 * GRIDGO_SEED_ADMIN_PASSWORD (same mapping as seed.ts).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import bcrypt from 'bcrypt';

// Load server/.env without requiring dotenv package.
const serverDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(serverDir, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const accounts = [
  {
    email: 'maria@gridgo.ph',
    role: 'client',
    fullName: 'Maria Santos',
    phone: '+639171234567',
    passwordEnv: 'GRIDGO_SEED_CUSTOMER_PASSWORD',
  },
  {
    email: 'juan@gridgo.ph',
    role: 'rider',
    fullName: 'Juan Reyes',
    phone: '+639181234567',
    passwordEnv: 'GRIDGO_SEED_RIDER_PASSWORD',
  },
  {
    email: 'admin@gridgo.ph',
    role: 'ops_admin',
    fullName: 'Ops Admin',
    phone: '+639191234567',
    passwordEnv: 'GRIDGO_SEED_ADMIN_PASSWORD',
  },
  {
    email: 'superadmin@gridgo.ph',
    role: 'super_admin',
    fullName: 'Super Admin',
    phone: '+639192234567',
    passwordEnv: 'GRIDGO_SEED_ADMIN_PASSWORD',
  },
  {
    email: 'supplier@gridgo.ph',
    role: 'supplier',
    fullName: 'Demo Supplier',
    phone: '+639193234567',
    passwordEnv: 'GRIDGO_SEED_CUSTOMER_PASSWORD',
  },
];

function requirePassword(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(
      `${name} is required. Add it to server/.env then re-run this script.`,
    );
  }
  return String(value);
}

async function main() {
  const client = new Client({
    host: process.env.DATABASE_HOST || '127.0.0.1',
    port: Number(process.env.DATABASE_PORT || 5432),
    database: process.env.DATABASE_NAME || 'grid_print',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
  });

  await client.connect();
  try {
    const usersTable = await client.query(
      `SELECT to_regclass('public.users') AS users_table`,
    );
    if (!usersTable.rows[0]?.users_table) {
      throw new Error('users table missing — run migrations first');
    }

    console.log('Syncing pilot login accounts...\n');

    for (const account of accounts) {
      const password = requirePassword(account.passwordEnv);
      const passwordHash = await bcrypt.hash(password, 10);

      const existing = await client.query(
        `SELECT id, role FROM users WHERE lower(email) = lower($1)`,
        [account.email],
      );

      let userId;
      if (existing.rows.length === 0) {
        const inserted = await client.query(
          `INSERT INTO users (
             email, password_hash, full_name, phone_number, role,
             is_profile_complete, is_active
           ) VALUES ($1, $2, $3, $4, $5, true, true)
           RETURNING id`,
          [
            account.email,
            passwordHash,
            account.fullName,
            account.phone,
            account.role,
          ],
        );
        userId = inserted.rows[0].id;
        console.log(`  + created ${account.email} (${account.role}) id=${userId}`);
      } else {
        userId = existing.rows[0].id;
        await client.query(
          `UPDATE users SET
             password_hash = $2,
             full_name = COALESCE(full_name, $3),
             phone_number = COALESCE(phone_number, $4),
             role = $5,
             is_profile_complete = true,
             is_active = true,
             account_hold_reason = NULL,
             account_held_at = NULL,
             updated_at = NOW()
           WHERE id = $1`,
          [
            userId,
            passwordHash,
            account.fullName,
            account.phone,
            account.role,
          ],
        );
        console.log(
          `  ~ updated ${account.email} → role=${account.role} password=reset id=${userId}`,
        );
      }

      if (account.role === 'rider') {
        const rider = await client.query(
          `SELECT id FROM rider_profiles WHERE user_id = $1`,
          [userId],
        );
        if (rider.rows.length === 0) {
          // verification_status may not exist on older DBs — try with it first
          try {
            await client.query(
              `INSERT INTO rider_profiles (
                 user_id, vehicle_type, plate_number, license_number,
                 is_available, verification_status
               ) VALUES ($1, 'motorcycle', 'ABC 1234', 'N01-23-456789', true, 'verified')`,
              [userId],
            );
          } catch {
            await client.query(
              `INSERT INTO rider_profiles (
                 user_id, vehicle_type, plate_number, license_number, is_available
               ) VALUES ($1, 'motorcycle', 'ABC 1234', 'N01-23-456789', true)`,
              [userId],
            );
          }
          console.log(`    + rider profile`);
        } else {
          try {
            await client.query(
              `UPDATE rider_profiles SET
                 is_available = true,
                 verification_status = 'verified'
               WHERE user_id = $1`,
              [userId],
            );
          } catch {
            await client.query(
              `UPDATE rider_profiles SET is_available = true WHERE user_id = $1`,
              [userId],
            );
          }
        }
      }

      if (account.role === 'supplier') {
        let profileId;
        const profile = await client.query(
          `SELECT id FROM supplier_profiles WHERE user_id = $1`,
          [userId],
        );
        if (profile.rows.length === 0) {
          const inserted = await client.query(
            `INSERT INTO supplier_profiles (
               user_id, business_name, service_zones, is_active
             ) VALUES ($1, $2, $3::jsonb, true)
             RETURNING id`,
            [
              userId,
              'Davao Print Co',
              JSON.stringify(['davao_city', 'toril']),
            ],
          );
          profileId = inserted.rows[0].id;
          console.log(`    + supplier profile id=${profileId}`);
        } else {
          profileId = profile.rows[0].id;
          await client.query(
            `UPDATE supplier_profiles SET is_active = true WHERE id = $1`,
            [profileId],
          );
        }

        const verification = await client.query(
          `SELECT id FROM supplier_verifications WHERE supplier_id = $1`,
          [profileId],
        );
        if (verification.rows.length === 0) {
          await client.query(
            `INSERT INTO supplier_verifications (
               supplier_id, status, payout_details_ref, reviewed_at
             ) VALUES ($1, 'verified', 'seed-local-payout-ref', NOW())`,
            [profileId],
          );
          console.log(`    + supplier verification=verified`);
        } else {
          await client.query(
            `UPDATE supplier_verifications SET
               status = 'verified',
               payout_details_ref = COALESCE(payout_details_ref, 'seed-local-payout-ref'),
               reviewed_at = COALESCE(reviewed_at, NOW())
             WHERE supplier_id = $1`,
            [profileId],
          );
        }

        const capability = await client.query(
          `SELECT id FROM supplier_capabilities WHERE supplier_id = $1 LIMIT 1`,
          [profileId],
        );
        if (capability.rows.length === 0) {
          await client.query(
            `INSERT INTO supplier_capabilities (
               supplier_id, product_family, materials, max_capacity, lead_time_days
             ) VALUES ($1, $2, $3::jsonb, $4, $5)`,
            [
              profileId,
              'flyers',
              JSON.stringify(['glossy', 'matte']),
              100,
              2,
            ],
          );
          console.log(`    + supplier capability flyers`);
        }
      }
    }

    console.log('\nDone. Pilot logins are ready (passwords from env, not printed).');
    console.log('Accounts:');
    for (const a of accounts) {
      console.log(`  ${a.email}  role=${a.role}  env=${a.passwordEnv}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('sync-seed-logins failed:', error.message || error);
  process.exit(1);
});
