/**
 * GRIDGO demo seed — managed marketplace pilot cast (5 roles).
 *
 * Accounts (passwords from ignored env only; never commit secrets):
 * | Email                 | Role          | Password env                    |
 * |-----------------------|---------------|---------------------------------|
 * | maria@gridgo.ph       | client        | GRIDGO_SEED_CUSTOMER_PASSWORD   |
 * | supplier@gridgo.ph    | supplier      | GRIDGO_SEED_CUSTOMER_PASSWORD   |
 * | juan@gridgo.ph        | rider         | GRIDGO_SEED_RIDER_PASSWORD      |
 * | admin@gridgo.ph       | ops_admin     | GRIDGO_SEED_ADMIN_PASSWORD      |
 * | superadmin@gridgo.ph  | super_admin   | GRIDGO_SEED_ADMIN_PASSWORD      |
 *
 * Keep CLAUDE.md seed table in sync when changing emails/roles.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import {
  PrintingPreference,
  ProfileCategory,
  ProfileField,
} from './users/profile.constants';
import { upsertCatalogV110 } from './products/catalog-v1-10.persistence';

interface CountRow {
  count: string;
}

interface IdRow {
  id: number;
}

type SeedPasswordVariable =
  | 'GRIDGO_SEED_CUSTOMER_PASSWORD'
  | 'GRIDGO_SEED_RIDER_PASSWORD'
  | 'GRIDGO_SEED_ADMIN_PASSWORD';

function requireSeedPassword(name: SeedPasswordVariable): string {
  const password = process.env[name];
  if (!password) {
    throw new Error(`${name} is required to seed demo users`);
  }
  return password;
}

function typedQuery<T>(
  ds: DataSource,
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  return ds.query(sql, params);
}

async function seed() {
  const customerPassword = requireSeedPassword('GRIDGO_SEED_CUSTOMER_PASSWORD');
  const riderPassword = requireSeedPassword('GRIDGO_SEED_RIDER_PASSWORD');
  const adminPassword = requireSeedPassword('GRIDGO_SEED_ADMIN_PASSWORD');
  const [customerPasswordHash, riderPasswordHash, adminPasswordHash] =
    await Promise.all([
      bcrypt.hash(customerPassword, 10),
      bcrypt.hash(riderPassword, 10),
      bcrypt.hash(adminPassword, 10),
    ]);

  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);

  console.log('🌱 Seeding GRIDGO database...\n');

  // Check if database already has data
  const [existingUsers] = await typedQuery<CountRow>(
    ds,
    'SELECT count(*) FROM users',
  );
  if (parseInt(existingUsers.count) > 0) {
    console.log('⚠️  Database already has data. Running full reset...');
  }

  // ─── Users ──────────────────────────────────────────────────────────
  const users = [
    {
      email: 'maria@gridgo.ph',
      password_hash: customerPasswordHash,
      full_name: 'Maria Santos',
      phone_number: '+639171234567',
      gender: 'female',
      profile_category: ProfileCategory.STUDENT,
      profile_field: ProfileField.ARCHITECTURE,
      course: 'BS Architecture',
      organization: 'Mapua University',
      printing_preferences: [
        PrintingPreference.PLOTTING_BLUEPRINTS,
        PrintingPreference.HIGH_RES_COLOR,
      ].join(','),
      role: 'client',
      is_profile_complete: true,
      is_active: true,
    },
    {
      email: 'juan@gridgo.ph',
      password_hash: riderPasswordHash,
      full_name: 'Juan Reyes',
      phone_number: '+639181234567',
      gender: 'male',
      profile_category: ProfileCategory.PROFESSIONAL,
      profile_field: ProfileField.ENGINEER_CONTRACTOR,
      course: null,
      organization: 'Grid Logistics',
      printing_preferences: [PrintingPreference.TECHNICAL_SPECS].join(','),
      role: 'rider',
      is_profile_complete: true,
      is_active: true,
    },
    {
      email: 'admin@gridgo.ph',
      password_hash: adminPasswordHash,
      full_name: 'Ops Admin',
      phone_number: '+639191234567',
      gender: 'male',
      profile_category: ProfileCategory.PROFESSIONAL,
      profile_field: ProfileField.BUSINESS_CORPORATE,
      course: null,
      organization: 'Grid Print HQ',
      printing_preferences: [PrintingPreference.MARKETING_MATERIALS].join(','),
      role: 'ops_admin',
      is_profile_complete: true,
      is_active: true,
    },
    {
      email: 'superadmin@gridgo.ph',
      password_hash: adminPasswordHash,
      full_name: 'Super Admin',
      phone_number: '+639192234567',
      gender: 'female',
      profile_category: ProfileCategory.PROFESSIONAL,
      profile_field: ProfileField.BUSINESS_CORPORATE,
      course: null,
      organization: 'Grid Print HQ',
      printing_preferences: [PrintingPreference.MARKETING_MATERIALS].join(','),
      role: 'super_admin',
      is_profile_complete: true,
      is_active: true,
    },
    {
      email: 'supplier@gridgo.ph',
      password_hash: customerPasswordHash,
      full_name: 'Demo Supplier',
      phone_number: '+639193234567',
      gender: 'male',
      profile_category: ProfileCategory.PROFESSIONAL,
      profile_field: ProfileField.BUSINESS_CORPORATE,
      course: null,
      organization: 'Davao Print Co',
      printing_preferences: [PrintingPreference.HIGH_RES_COLOR].join(','),
      role: 'supplier',
      is_profile_complete: true,
      is_active: true,
    },
  ];

  // Clear all tables — CASCADE handles FK ordering automatically
  await ds.query(`
    TRUNCATE TABLE
      order_item_spec_values, product_spec_options, product_spec_definitions,
      product_categories, service_addons,
      notifications, payment_transactions, credit_transactions, credit_settings,
      delivery_assignments, order_status_history,
      order_items, orders, batch_orders,
      addresses, rider_profiles, file_metadata,
      beta_mode_settings,
      tam_survey_settings, tam_surveys, tam_survey_requirements,
      daily_grid_cards,
      delivery_slot_bookings, delivery_slot_templates, delivery_settings,
      printer_profiles,
      users
    RESTART IDENTITY CASCADE
  `);

  // Sequences were already reset by TRUNCATE ... RESTART IDENTITY above
  await ds.query('INSERT INTO beta_mode_settings (is_enabled) VALUES ($1)', [
    false,
  ]);
  console.log('✅ Beta mode seeded (disabled)');

  for (const u of users) {
    await ds.query(
      `INSERT INTO users (
        email,
        password_hash,
        full_name,
        phone_number,
        gender,
        profile_category,
        profile_field,
        course,
        organization,
        printing_preferences,
        role,
        is_profile_complete,
        is_active
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        u.email,
        u.password_hash,
        u.full_name,
        u.phone_number,
        u.gender,
        u.profile_category,
        u.profile_field,
        u.course,
        u.organization,
        u.printing_preferences,
        u.role,
        u.is_profile_complete,
        u.is_active,
      ],
    );
  }
  console.log(
    '✅ 5 users created (maria/client, juan/rider, admin/ops_admin, superadmin/super_admin, supplier/supplier)',
  );

  // Get user IDs
  const [maria] = await typedQuery<IdRow>(
    ds,
    "SELECT id FROM users WHERE email = 'maria@gridgo.ph'",
  );

  const [juan] = await typedQuery<IdRow>(
    ds,
    "SELECT id FROM users WHERE email = 'juan@gridgo.ph'",
  );
  const mariaId: number = maria.id;
  const juanId: number = juan.id;

  // ─── Addresses ──────────────────────────────────────────────────────
  const addresses = [
    {
      user_id: mariaId,
      label: 'Home',
      full_address: '88 Quimpo Blvd, Brgy. Ecoland, Davao City',
      barangay: 'Ecoland',
      city: 'Davao City',
      province: 'Davao del Sur',
      zip_code: '8000',
      landmark: 'Near SM City Davao',
      // SM City Davao / Quimpo Blvd Ecoland (not the map-picker default)
      latitude: 7.0497,
      longitude: 125.588,
      is_default: true,
    },
    {
      user_id: mariaId,
      label: 'Office',
      full_address: '45 Katipunan Ave, Brgy. Loyola Heights, Quezon City',
      barangay: 'Loyola Heights',
      city: 'Quezon City',
      province: 'Metro Manila',
      zip_code: '1108',
      landmark: 'Beside Ateneo gate',
      latitude: 14.64,
      longitude: 121.053,
      is_default: false,
    },
  ];

  for (const a of addresses) {
    await ds.query(
      `INSERT INTO addresses (user_id, label, full_address, barangay, city, province, zip_code, landmark, latitude, longitude, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        a.user_id,
        a.label,
        a.full_address,
        a.barangay,
        a.city,
        a.province,
        a.zip_code,
        a.landmark,
        a.latitude,
        a.longitude,
        a.is_default,
      ],
    );
  }
  console.log('✅ 2 addresses created for Maria');

  // ─── Rider Profile ─────────────────────────────────────────────────
  await ds.query(
    `INSERT INTO rider_profiles (user_id, vehicle_type, plate_number, license_number, is_available)
     VALUES ($1, $2, $3, $4, $5)`,
    [juanId, 'motorcycle', 'ABC 1234', 'N01-23-456789', true],
  );
  console.log('✅ Rider profile created for Juan');

  // ─── Notifications ──────────────────────────────────────────────────
  // Seed accounts start with zero orders, so only order-agnostic content.
  await ds.query(
    `INSERT INTO notifications (user_id, order_ref, title, message, type, is_read)
     VALUES ($1, NULL, $2, $3, $4, $5)`,
    [
      mariaId,
      'Welcome to GRIDGO!',
      'Start your first order and enjoy premium printing.',
      'promo',
      false,
    ],
  );
  console.log('✅ 1 welcome notification created');

  // ─── Product Catalog ────────────────────────────────────────────────
  await upsertCatalogV110(ds);
  console.log('✅ v1.10 catalog created (4 groups, 17 RFQ products)');

  // ─── Service Addons ─────────────────────────────────────────────────
  // Rush Processing is catalog-independent. Product-owned legacy addons
  // are not rebound without explicit coverage for a v1.10 leaf.
  await ds.query(
    `INSERT INTO service_addons (category_id, name, description, price, price_type, is_active, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      null,
      'Rush Processing',
      'Priority queue processing, ready in 2 hours',
      150.0,
      'flat',
      true,
      20,
    ],
  );
  console.log('✅ 1 catalog-independent service addon created');

  // ─── TAM Surveys ────────────────────────────────────────────────────────
  const mockSurveys = [
    {
      user_id: mariaId,
      survey_data: JSON.stringify({
        0: 4,
        1: 4,
        2: 4,
        3: 4,
        4: 5,
        5: 5,
        6: 4,
        7: 5,
        8: 5,
        9: 5,
      }),
      open_forum_feedback:
        'GRIDGO is amazing! It saved me so much time printing my architectural plans. The UI could be slightly better though.',
    },
    {
      user_id: juanId,
      survey_data: JSON.stringify({
        0: 3,
        1: 2,
        2: 3,
        3: 3,
        4: 4,
        5: 4,
        6: 3,
        7: 4,
        8: 3,
        9: 4,
      }),
      open_forum_feedback:
        "It's alright, but sometimes the delivery assignments mismatch map locations.",
    },
  ];

  for (const s of mockSurveys) {
    await ds.query(
      `INSERT INTO tam_surveys (user_id, survey_data, open_forum_feedback, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())`,
      [s.user_id, s.survey_data, s.open_forum_feedback],
    );
  }
  console.log('✅ 2 TAM surveys created');

  // ─── Daily Grid Cards ────────────────────────────────────────────────
  const dailyGridCards = [
    {
      title: 'Flyers',
      subtitle: 'Quote required',
      imageUrl:
        'https://images.unsplash.com/photo-1588580000645-4562a6d2c839?w=160&h=160&fit=crop&q=80',
      category: 'flyers',
      specs: {},
      sortOrder: 0,
      isActive: true,
    },
    {
      title: 'Posters & Standees',
      subtitle: 'Quote required',
      imageUrl:
        'https://images.unsplash.com/photo-1503455637927-730bce8583c0?w=160&h=160&fit=crop&q=80',
      category: 'posters-standees',
      specs: {},
      sortOrder: 1,
      isActive: true,
    },
    {
      title: '3D Printing & Scale Models',
      subtitle: 'Quote required',
      imageUrl:
        'https://images.unsplash.com/photo-1617839625591-e5a789593135?w=160&h=160&fit=crop&q=80',
      category: '3d-printing-scale-models',
      specs: {},
      sortOrder: 2,
      isActive: true,
    },
    {
      title: 'Tarpaulins & Outdoor Banners',
      subtitle: 'Quote required',
      imageUrl:
        'https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?w=160&h=160&fit=crop&q=80',
      category: 'tarpaulins-outdoor-banners',
      specs: {},
      sortOrder: 3,
      isActive: true,
    },
    {
      title: 'Business Cards',
      subtitle: 'Quote required',
      imageUrl:
        'https://images.unsplash.com/photo-1601645191163-3fc0d5d64e35?w=160&h=160&fit=crop&q=80',
      category: 'business-cards',
      specs: {},
      sortOrder: 4,
      isActive: true,
    },
  ];
  for (const c of dailyGridCards) {
    await ds.query(
      `INSERT INTO daily_grid_cards (title, subtitle, "imageUrl", category, specs, "sortOrder", "isActive")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        c.title,
        c.subtitle,
        c.imageUrl,
        c.category,
        JSON.stringify(c.specs),
        c.sortOrder,
        c.isActive,
      ],
    );
  }
  console.log('✅ 5 Daily Grid cards seeded');

  // ─── Delivery Slot Templates (Mon–Fri) ──────────────────────────────
  const [slotCount] = await typedQuery<CountRow>(
    ds,
    'SELECT count(*) FROM delivery_slot_templates',
  );
  if (parseInt(slotCount.count) === 0) {
    for (let day = 1; day <= 5; day++) {
      for (const [start, end] of [
        ['09:30:00', '11:30:00'],
        ['14:00:00', '16:00:00'],
        ['21:00:00', '23:00:00'],
      ]) {
        await ds.query(
          `INSERT INTO delivery_slot_templates (day_of_week, start_time, end_time, capacity)
           VALUES ($1, $2, $3, $4)`,
          [day, start, end, 10],
        );
      }
    }
    console.log('✅ 15 delivery slot templates seeded');
  }

  // ─── Delivery Settings (singleton row) ──────────────────────────────
  const [settingsCount] = await typedQuery<CountRow>(
    ds,
    'SELECT count(*) FROM delivery_settings WHERE id = 1',
  );
  if (parseInt(settingsCount.count) === 0) {
    await ds.query(
      `INSERT INTO delivery_settings (service_center_lat, service_center_lng, service_radius_km, priority_fee_amount, extra_destination_surcharge)
       VALUES ($1, $2, $3, $4, $5)`,
      [7.0731, 125.6128, 25, 50, 30],
    );
    console.log('✅ Delivery settings seeded');
  }

  // ─── Printer Profile (singleton row) ────────────────────────────────
  const [profileCount] = await typedQuery<CountRow>(
    ds,
    'SELECT count(*) FROM printer_profiles WHERE id = 1',
  );
  if (parseInt(profileCount.count) === 0) {
    await ds.query(
      `INSERT INTO printer_profiles (name, build_volume_width_mm, build_volume_depth_mm, build_volume_height_mm, max_file_size_mb)
       VALUES ($1, $2, $3, $4, $5)`,
      ['Bambu A1 Mini', 180, 180, 180, 200],
    );
    console.log('✅ Printer profile seeded (Bambu A1 Mini)');
  }

  console.log('\n🎉 Seed complete!\n');

  await app.close();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
