import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import {
  PrintingPreference,
  ProfileCategory,
  ProfileField,
} from './users/profile.constants';

interface CountRow {
  count: string;
}

interface IdRow {
  id: number;
}

interface OrderRow {
  id: number;
  order_id: string;
}

interface SpecSeed {
  categoryId: number;
  key: string;
  label: string;
  inputType: string;
  valueType: string;
  pricingRole: string;
  sortOrder: number;
  defaultValue?: string | null;
  unitLabel?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  stepValue?: number | null;
  isRequired?: boolean;
  metadata?: Record<string, unknown> | null;
}

interface OptionSeed {
  specDefinitionId: number;
  label: string;
  value: string;
  multiplier?: number;
  fixedFee?: number;
  unitCost?: number;
  estimatedQuantity?: number | null;
  isDefault?: boolean;
  sortOrder: number;
}

interface SpecSnapshotLookupRow {
  spec_definition_id: number;
  spec_key: string;
  spec_label: string;
  input_type: string;
  option_id: number | null;
  option_label: string | null;
  multiplier: string | null;
  fixed_fee: string | null;
  unit_cost: string | null;
  estimated_quantity: string | null;
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

async function insertSpecDefinition(
  ds: DataSource,
  spec: SpecSeed,
): Promise<number> {
  const [row] = await typedQuery<IdRow>(
    ds,
    `INSERT INTO product_spec_definitions (
      category_id, key, label, input_type, value_type, is_required,
      is_active, default_value, pricing_role, unit_label, min_value,
      max_value, step_value, sort_order, metadata
    )
     VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
     RETURNING id`,
    [
      spec.categoryId,
      spec.key,
      spec.label,
      spec.inputType,
      spec.valueType,
      spec.isRequired ?? true,
      spec.defaultValue ?? null,
      spec.pricingRole,
      spec.unitLabel ?? null,
      spec.minValue ?? null,
      spec.maxValue ?? null,
      spec.stepValue ?? null,
      spec.sortOrder,
      JSON.stringify(spec.metadata ?? null),
    ],
  );
  return row.id;
}

async function insertSpecOption(
  ds: DataSource,
  option: OptionSeed,
): Promise<void> {
  await ds.query(
    `INSERT INTO product_spec_options (
      spec_definition_id, label, value, multiplier, fixed_fee, unit_cost,
      estimated_quantity, is_default, is_active, sort_order
    )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9)`,
    [
      option.specDefinitionId,
      option.label,
      option.value,
      option.multiplier ?? 1,
      option.fixedFee ?? 0,
      option.unitCost ?? 0,
      option.estimatedQuantity ?? null,
      option.isDefault ?? false,
      option.sortOrder,
    ],
  );
}

async function insertOrderItemSpecSnapshot(
  ds: DataSource,
  orderItemId: number,
  specKey: string,
  value: string,
  displayValue?: string,
): Promise<void> {
  const [lookup] = await typedQuery<SpecSnapshotLookupRow>(
    ds,
    `SELECT
       d.id AS spec_definition_id,
       d.key AS spec_key,
       d.label AS spec_label,
       d.input_type,
       o.id AS option_id,
       o.label AS option_label,
       o.multiplier,
       o.fixed_fee,
       o.unit_cost,
       o.estimated_quantity
     FROM product_spec_definitions d
     LEFT JOIN product_spec_options o
       ON o.spec_definition_id = d.id AND o.value = $2
     WHERE d.key = $1
     ORDER BY d.id
     LIMIT 1`,
    [specKey, value],
  );
  if (!lookup) return;
  await ds.query(
    `INSERT INTO order_item_spec_values (
      order_item_id, spec_definition_id, spec_key, spec_label, input_type,
      value, display_value, option_id, option_label, multiplier, fixed_fee,
      unit_cost, estimated_quantity
    )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      orderItemId,
      lookup.spec_definition_id,
      lookup.spec_key,
      lookup.spec_label,
      lookup.input_type,
      value,
      displayValue ?? lookup.option_label ?? value,
      lookup.option_id,
      lookup.option_label,
      lookup.multiplier ?? 1,
      lookup.fixed_fee ?? 0,
      lookup.unit_cost ?? 0,
      lookup.estimated_quantity,
    ],
  );
}

/**
 * Database seed script -- creates demo data for all 3 roles.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/seed.ts
 * Or:  npm run seed
 */
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
      role: 'customer',
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
      full_name: 'Admin User',
      phone_number: '+639191234567',
      gender: 'male',
      profile_category: ProfileCategory.PROFESSIONAL,
      profile_field: ProfileField.BUSINESS_CORPORATE,
      course: null,
      organization: 'Grid Print HQ',
      printing_preferences: [PrintingPreference.MARKETING_MATERIALS].join(','),
      role: 'admin',
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
  console.log('✅ 3 users created (maria/customer, juan/rider, admin)');

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
      latitude: 7.0731,
      longitude: 125.6128,
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

  const [homeAddress] = await typedQuery<IdRow>(
    ds,
    'SELECT id FROM addresses WHERE user_id = $1 AND label = $2',
    [mariaId, 'Home'],
  );
  const homeAddressId = homeAddress.id;
  const homeAddressSeed = addresses.find(
    (address) => address.label === 'Home',
  )!;

  // ─── Rider Profile ─────────────────────────────────────────────────
  await ds.query(
    `INSERT INTO rider_profiles (user_id, vehicle_type, plate_number, license_number, is_available)
     VALUES ($1, $2, $3, $4, $5)`,
    [juanId, 'motorcycle', 'ABC 1234', 'N01-23-456789', true],
  );
  console.log('✅ Rider profile created for Juan');

  // ─── Orders ─────────────────────────────────────────────────────────
  const orders = [
    {
      order_id: 'ORD-10001',
      category: 'paper',
      quantity: 2,
      total_price: 120,
      delivery_fee: 50,
      payment_method: 'gcash',
      payment_status: 'paid',
      order_status: 'order_placed',
      delivery_option: 'delivery',
      delivery_address_id: homeAddressId,
    },
    {
      order_id: 'ORD-10002',
      category: 'paper',
      quantity: 1,
      total_price: 80,
      delivery_fee: 0,
      payment_method: 'maya',
      payment_status: 'paid',
      order_status: 'printing_in_progress',
      delivery_option: 'pickup',
    },
    {
      order_id: 'ORD-10003',
      category: '3d',
      quantity: 1,
      total_price: 350,
      delivery_fee: 50,
      payment_method: 'cod',
      payment_status: 'pending',
      order_status: 'quality_checked',
      delivery_option: 'delivery',
      delivery_address_id: homeAddressId,
    },
    {
      order_id: 'ORD-10004',
      category: 'paper',
      quantity: 5,
      total_price: 250,
      delivery_fee: 50,
      payment_method: 'gcash',
      payment_status: 'paid',
      order_status: 'on_the_way',
      delivery_option: 'delivery',
      delivery_address_id: homeAddressId,
    },
    {
      order_id: 'ORD-10005',
      category: 'paper',
      quantity: 1,
      total_price: 45,
      delivery_fee: 0,
      payment_method: 'maya',
      payment_status: 'paid',
      order_status: 'delivered',
      delivery_option: 'pickup',
    },
    {
      order_id: 'ORD-10006',
      category: '3d',
      quantity: 2,
      total_price: 580,
      delivery_fee: 50,
      payment_method: 'gcash',
      payment_status: 'refunded',
      order_status: 'cancelled',
      delivery_option: 'delivery',
      delivery_address_id: homeAddressId,
    },
  ];

  const destinationByOrderRef = new Map<string, number | null>();

  for (const o of orders) {
    let batchOrderId: number | null = null;
    let destinationId: number | null = null;

    if (o.delivery_option === 'delivery' && o.delivery_address_id != null) {
      const [batchOrder] = await typedQuery<IdRow>(
        ds,
        `INSERT INTO batch_orders (
          batch_ref, user_id, subtotal, delivery_fee, total_price,
          payment_method, payment_status, delivery_option, delivery_address_id,
          delivery_type, speed_tier, priority_fee, extra_destination_fee
        )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'local','standard',0,0)
         RETURNING id`,
        [
          `BATCH-${o.order_id.slice(4)}`,
          mariaId,
          o.total_price,
          o.delivery_fee,
          o.total_price + o.delivery_fee,
          o.payment_method,
          o.payment_status,
          o.delivery_option,
          o.delivery_address_id,
        ],
      );
      batchOrderId = batchOrder.id;

      const [destination] = await typedQuery<IdRow>(
        ds,
        `INSERT INTO delivery_destinations (
          batch_order_id, address_id, label, sort_order, full_address,
          barangay, city, province, zip_code, landmark, latitude, longitude
        )
         VALUES ($1,$2,$3,0,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id`,
        [
          batchOrderId,
          o.delivery_address_id,
          homeAddressSeed.label,
          homeAddressSeed.full_address,
          homeAddressSeed.barangay,
          homeAddressSeed.city,
          homeAddressSeed.province,
          homeAddressSeed.zip_code,
          homeAddressSeed.landmark,
          homeAddressSeed.latitude,
          homeAddressSeed.longitude,
        ],
      );
      destinationId = destination.id;
    }

    destinationByOrderRef.set(o.order_id, destinationId);

    await ds.query(
      `INSERT INTO orders (
        order_id, user_id, category, quantity, total_price, delivery_fee,
        payment_method, payment_status, order_status, delivery_option,
        delivery_address_id, batch_order_id, destination_id, file_name
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        o.order_id,
        mariaId,
        o.category,
        o.quantity,
        o.total_price,
        o.delivery_fee,
        o.payment_method,
        o.payment_status,
        o.order_status,
        o.delivery_option,
        o.delivery_address_id ?? null,
        batchOrderId,
        destinationId,
        `${o.category === 'paper' ? 'document' : 'model'}_${o.order_id.slice(-3)}.${o.category === 'paper' ? 'pdf' : 'stl'}`,
      ],
    );
  }
  console.log('✅ 6 orders created for Maria (various statuses)');

  // Get order IDs
  const orderRows = await typedQuery<OrderRow>(
    ds,
    'SELECT id, order_id FROM orders ORDER BY id',
  );

  const orderItemByOrderId = new Map<string, number>();
  for (const row of orderRows) {
    const source = orders.find((order) => order.order_id === row.order_id)!;
    const [item] = await typedQuery<IdRow>(
      ds,
      `INSERT INTO order_items (order_id, category, quantity, total_price, file_name, destination_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        row.id,
        source.category,
        source.quantity,
        source.total_price,
        `${source.category === 'paper' ? 'document' : 'model'}_${source.order_id.slice(-3)}.${source.category === 'paper' ? 'pdf' : 'stl'}`,
        destinationByOrderRef.get(row.order_id) ?? null,
      ],
    );
    orderItemByOrderId.set(row.order_id, item.id);
  }
  console.log('✅ Order items added to 6 orders');

  // ─── Delivery Assignment ────────────────────────────────────────────
  // Get rider profile ID (FK references rider_profiles, not users)
  const [riderProfile] = await typedQuery<IdRow>(
    ds,
    'SELECT id FROM rider_profiles WHERE user_id = $1',
    [juanId],
  );
  const riderProfileId: number = riderProfile.id;

  const onTheWayOrder: OrderRow | undefined = orderRows.find(
    (r: OrderRow) => r.order_id === 'ORD-10004',
  );
  if (onTheWayOrder) {
    await ds.query(
      `INSERT INTO delivery_assignments (order_id, rider_id, status, accepted_at, picked_up_at, on_the_way_at)
       VALUES ($1, $2, $3, NOW(), NOW(), NOW())`,
      [onTheWayOrder.id, riderProfileId, 'on_the_way'],
    );
    // Update order with assigned rider
    await ds.query('UPDATE orders SET assigned_rider_id = $1 WHERE id = $2', [
      juanId,
      onTheWayOrder.id,
    ]);
    console.log(
      '✅ Delivery assignment created (ORD-10004 → Juan, on_the_way)',
    );
  }

  // ─── Notifications ──────────────────────────────────────────────────
  const notifications = [
    {
      user_id: mariaId,
      order_ref: 'ORD-10001' as string | null,
      title: 'Order Placed',
      message: 'Your order ORD-10001 has been placed successfully.',
      type: 'order_update',
      is_read: false,
    },
    {
      user_id: mariaId,
      order_ref: 'ORD-10002' as string | null,
      title: 'Printing Started',
      message: 'Your order ORD-10002 is now being printed.',
      type: 'order_update',
      is_read: false,
    },
    {
      user_id: mariaId,
      order_ref: 'ORD-10004' as string | null,
      title: 'Rider On The Way',
      message: 'Juan is delivering your order ORD-10004.',
      type: 'delivery_update',
      is_read: false,
    },
    {
      user_id: mariaId,
      order_ref: 'ORD-10005' as string | null,
      title: 'Order Completed',
      message: 'Your order ORD-10005 has been picked up. Thank you!',
      type: 'order_update',
      is_read: true,
    },
    {
      user_id: mariaId,
      order_ref: 'ORD-10006' as string | null,
      title: 'Refund Processed',
      message: 'Your refund for ORD-10006 has been processed.',
      type: 'payment',
      is_read: true,
    },
    {
      user_id: mariaId,
      order_ref: null as string | null,
      title: 'Welcome to GRIDGO!',
      message: 'Start your first order and enjoy premium printing.',
      type: 'promo',
      is_read: true,
    },
    {
      user_id: juanId,
      order_ref: 'ORD-10004' as string | null,
      title: 'New Delivery',
      message: 'You have been assigned to deliver ORD-10004.',
      type: 'delivery_assignment',
      is_read: true,
    },
  ];

  for (const n of notifications) {
    await ds.query(
      `INSERT INTO notifications (user_id, order_ref, title, message, type, is_read)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [n.user_id, n.order_ref, n.title, n.message, n.type, n.is_read],
    );
  }
  console.log('✅ 7 notifications created');

  // ─── Payment Transactions ───────────────────────────────────────────
  const paidOrders: OrderRow[] = orderRows.filter((r: OrderRow) =>
    ['ORD-10001', 'ORD-10002', 'ORD-10004', 'ORD-10005'].includes(r.order_id),
  );
  for (const o of paidOrders) {
    await ds.query(
      `INSERT INTO payment_transactions (order_id, payment_method, amount, status)
       VALUES ($1, $2, $3, $4)`,
      [o.id, 'gcash', 150, 'success'],
    );
  }
  console.log('✅ 4 payment transactions created');

  // ─── Product Catalog ────────────────────────────────────────────────
  const paperExtensions = '["pdf","png","jpg","jpeg","tif","tiff","docx"]';
  const threeDExtensions = '["stl","obj","3mf","glb","gltf"]';

  const [paperCat] = await typedQuery<IdRow>(
    ds,
    `INSERT INTO product_categories (
      name, slug, description, mobile_description, icon, file_processing_type,
      pricing_model, base_rate, quantity_unit, max_file_size_mb,
      allowed_extensions, is_active, sort_order
    )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,true,$12)
     RETURNING id`,
    [
      'Paper Printing',
      'paper',
      'Standard and large-format paper printing',
      'Print documents, plans, posters, and handouts.',
      'FileTextOutlined',
      'document',
      'per_page_modifiers',
      2,
      'copy',
      50,
      paperExtensions,
      1,
    ],
  );
  const [threeDCat] = await typedQuery<IdRow>(
    ds,
    `INSERT INTO product_categories (
      name, slug, description, mobile_description, icon, file_processing_type,
      pricing_model, base_rate, quantity_unit, max_file_size_mb,
      allowed_extensions, is_active, sort_order
    )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,true,$12)
     RETURNING id`,
    [
      '3D Printing',
      '3d',
      'FDM 3D printing with PLA, ABS, and PETG materials',
      'Upload a model and configure print material and finish.',
      'AppstoreOutlined',
      'model_3d',
      'base_plus_material_estimate',
      50,
      'model',
      200,
      threeDExtensions,
      2,
    ],
  );
  const paperId = paperCat.id;
  const tdId = threeDCat.id;
  await ds.query(
    `UPDATE order_items
     SET category_id = $1, category_slug = 'paper', category_name = 'Paper Printing',
         pricing_model = 'per_page_modifiers'
     WHERE category = 'paper'`,
    [paperId],
  );
  await ds.query(
    `UPDATE order_items
     SET category_id = $1, category_slug = '3d', category_name = '3D Printing',
         pricing_model = 'base_plus_material_estimate'
     WHERE category = '3d'`,
    [tdId],
  );
  console.log('✅ 2 product categories created (paper, 3d)');

  const paperSizeSpec = await insertSpecDefinition(ds, {
    categoryId: paperId,
    key: 'paper_size',
    label: 'Paper Size',
    inputType: 'select',
    valueType: 'string',
    pricingRole: 'multiplier',
    sortOrder: 10,
  });
  const colorModeSpec = await insertSpecDefinition(ds, {
    categoryId: paperId,
    key: 'color_mode',
    label: 'Color Mode',
    inputType: 'select',
    valueType: 'string',
    pricingRole: 'multiplier',
    sortOrder: 20,
  });
  const mediaTypeSpec = await insertSpecDefinition(ds, {
    categoryId: paperId,
    key: 'media_type',
    label: 'Media Type',
    inputType: 'select',
    valueType: 'string',
    pricingRole: 'multiplier',
    sortOrder: 30,
  });
  const printSidesSpec = await insertSpecDefinition(ds, {
    categoryId: paperId,
    key: 'print_sides',
    label: 'Print Sides',
    inputType: 'select',
    valueType: 'string',
    pricingRole: 'multiplier',
    sortOrder: 40,
  });
  const bindingSpec = await insertSpecDefinition(ds, {
    categoryId: paperId,
    key: 'binding',
    label: 'Binding',
    inputType: 'select',
    valueType: 'string',
    pricingRole: 'fixed_fee',
    sortOrder: 50,
  });
  const printModeSpec = await insertSpecDefinition(ds, {
    categoryId: paperId,
    key: 'print_mode',
    label: 'Print Mode',
    inputType: 'select',
    valueType: 'string',
    pricingRole: 'none',
    sortOrder: 60,
    defaultValue: 'fitToPage',
  });
  await insertSpecDefinition(ds, {
    categoryId: paperId,
    key: 'page_count',
    label: 'Page Count',
    inputType: 'number',
    valueType: 'number',
    pricingRole: 'estimated_quantity',
    sortOrder: 70,
    defaultValue: '1',
    unitLabel: 'pages',
    minValue: 1,
    maxValue: 500,
    stepValue: 1,
    metadata: { hidden: true },
  });

  const paperOptions: OptionSeed[] = [
    {
      specDefinitionId: paperSizeSpec,
      label: 'A5',
      value: 'a5',
      multiplier: 0.8,
      sortOrder: 10,
    },
    {
      specDefinitionId: paperSizeSpec,
      label: 'A4',
      value: 'a4',
      multiplier: 1,
      isDefault: true,
      sortOrder: 20,
    },
    {
      specDefinitionId: paperSizeSpec,
      label: 'A3',
      value: 'a3',
      multiplier: 1.5,
      sortOrder: 30,
    },
    {
      specDefinitionId: paperSizeSpec,
      label: 'A2',
      value: 'a2',
      multiplier: 2.5,
      sortOrder: 40,
    },
    {
      specDefinitionId: paperSizeSpec,
      label: 'A1',
      value: 'a1',
      multiplier: 4,
      sortOrder: 50,
    },
    {
      specDefinitionId: paperSizeSpec,
      label: '20x30',
      value: 'twenty_by_thirty',
      multiplier: 3,
      sortOrder: 60,
    },
    {
      specDefinitionId: paperSizeSpec,
      label: 'Custom',
      value: 'custom',
      multiplier: 2,
      sortOrder: 70,
    },
    {
      specDefinitionId: colorModeSpec,
      label: 'Black & White',
      value: 'black_and_white',
      multiplier: 1,
      isDefault: true,
      sortOrder: 10,
    },
    {
      specDefinitionId: colorModeSpec,
      label: 'Full Color',
      value: 'full_color',
      multiplier: 2.5,
      sortOrder: 20,
    },
    {
      specDefinitionId: mediaTypeSpec,
      label: 'Matte',
      value: 'matte',
      multiplier: 1,
      isDefault: true,
      sortOrder: 10,
    },
    {
      specDefinitionId: mediaTypeSpec,
      label: 'Glossy',
      value: 'glossy',
      multiplier: 1.3,
      sortOrder: 20,
    },
    {
      specDefinitionId: printSidesSpec,
      label: 'Front Only',
      value: 'front_only',
      multiplier: 1,
      isDefault: true,
      sortOrder: 10,
    },
    {
      specDefinitionId: printSidesSpec,
      label: 'Back to Back',
      value: 'back_to_back',
      multiplier: 1.8,
      sortOrder: 20,
    },
    {
      specDefinitionId: bindingSpec,
      label: 'None',
      value: 'none',
      fixedFee: 0,
      isDefault: true,
      sortOrder: 10,
    },
    {
      specDefinitionId: bindingSpec,
      label: 'Staple',
      value: 'staple',
      fixedFee: 10,
      sortOrder: 20,
    },
    {
      specDefinitionId: bindingSpec,
      label: 'Spiral',
      value: 'spiral',
      fixedFee: 25,
      sortOrder: 30,
    },
    {
      specDefinitionId: bindingSpec,
      label: 'Premium',
      value: 'premium',
      fixedFee: 50,
      sortOrder: 40,
    },
    {
      specDefinitionId: printModeSpec,
      label: 'Fit to Scale',
      value: 'fitToPage',
      isDefault: true,
      sortOrder: 10,
    },
    {
      specDefinitionId: printModeSpec,
      label: 'Actual Size',
      value: 'actualSize',
      sortOrder: 20,
    },
  ];
  for (const option of paperOptions) await insertSpecOption(ds, option);
  console.log('✅ Paper catalog specs and options created');

  const fileFormatSpec = await insertSpecDefinition(ds, {
    categoryId: tdId,
    key: 'file_format',
    label: 'File Format',
    inputType: 'select',
    valueType: 'string',
    pricingRole: 'none',
    sortOrder: 10,
  });
  const materialSpec = await insertSpecDefinition(ds, {
    categoryId: tdId,
    key: 'material',
    label: 'Material',
    inputType: 'select',
    valueType: 'string',
    pricingRole: 'unit_cost',
    sortOrder: 20,
  });
  const colorSpec = await insertSpecDefinition(ds, {
    categoryId: tdId,
    key: 'color',
    label: 'Color',
    inputType: 'select',
    valueType: 'string',
    pricingRole: 'none',
    sortOrder: 30,
  });
  const infillSpec = await insertSpecDefinition(ds, {
    categoryId: tdId,
    key: 'infill_percentage',
    label: 'Infill Percentage',
    inputType: 'select',
    valueType: 'number',
    pricingRole: 'estimated_quantity',
    unitLabel: '%',
    sortOrder: 40,
  });
  const layerHeightSpec = await insertSpecDefinition(ds, {
    categoryId: tdId,
    key: 'layer_height',
    label: 'Layer Height',
    inputType: 'select',
    valueType: 'number',
    pricingRole: 'none',
    unitLabel: 'mm',
    sortOrder: 50,
  });
  const supportsSpec = await insertSpecDefinition(ds, {
    categoryId: tdId,
    key: 'supports',
    label: 'Supports',
    inputType: 'select',
    valueType: 'boolean',
    pricingRole: 'fixed_fee',
    sortOrder: 60,
  });
  await insertSpecDefinition(ds, {
    categoryId: tdId,
    key: 'notes',
    label: 'Notes',
    inputType: 'text',
    valueType: 'string',
    pricingRole: 'none',
    sortOrder: 70,
    isRequired: false,
  });

  const tdOptions: OptionSeed[] = [
    {
      specDefinitionId: fileFormatSpec,
      label: 'STL',
      value: 'stl',
      isDefault: true,
      sortOrder: 10,
    },
    {
      specDefinitionId: fileFormatSpec,
      label: 'OBJ',
      value: 'obj',
      sortOrder: 20,
    },
    {
      specDefinitionId: fileFormatSpec,
      label: '3MF',
      value: '3mf',
      sortOrder: 30,
    },
    {
      specDefinitionId: fileFormatSpec,
      label: 'GLB',
      value: 'glb',
      sortOrder: 40,
    },
    {
      specDefinitionId: fileFormatSpec,
      label: 'GLTF',
      value: 'gltf',
      sortOrder: 50,
    },
    {
      specDefinitionId: materialSpec,
      label: 'PLA',
      value: 'pla',
      unitCost: 3,
      isDefault: true,
      sortOrder: 10,
    },
    {
      specDefinitionId: materialSpec,
      label: 'ABS',
      value: 'abs',
      unitCost: 3,
      sortOrder: 20,
    },
    {
      specDefinitionId: materialSpec,
      label: 'PETG',
      value: 'petg',
      unitCost: 4,
      sortOrder: 30,
    },
    {
      specDefinitionId: colorSpec,
      label: 'White',
      value: 'white',
      isDefault: true,
      sortOrder: 10,
    },
    {
      specDefinitionId: colorSpec,
      label: 'Black',
      value: 'black',
      sortOrder: 20,
    },
    {
      specDefinitionId: colorSpec,
      label: 'Gray',
      value: 'gray',
      sortOrder: 30,
    },
    {
      specDefinitionId: infillSpec,
      label: '10%',
      value: '10',
      estimatedQuantity: 20,
      isDefault: true,
      sortOrder: 10,
    },
    {
      specDefinitionId: infillSpec,
      label: '20%',
      value: '20',
      estimatedQuantity: 40,
      sortOrder: 20,
    },
    {
      specDefinitionId: infillSpec,
      label: '50%',
      value: '50',
      estimatedQuantity: 100,
      sortOrder: 30,
    },
    {
      specDefinitionId: infillSpec,
      label: '100%',
      value: '100',
      estimatedQuantity: 200,
      sortOrder: 40,
    },
    {
      specDefinitionId: layerHeightSpec,
      label: '0.1mm',
      value: '0.1',
      sortOrder: 10,
    },
    {
      specDefinitionId: layerHeightSpec,
      label: '0.2mm',
      value: '0.2',
      isDefault: true,
      sortOrder: 20,
    },
    {
      specDefinitionId: layerHeightSpec,
      label: '0.3mm',
      value: '0.3',
      sortOrder: 30,
    },
    {
      specDefinitionId: supportsSpec,
      label: 'No',
      value: 'false',
      fixedFee: 0,
      isDefault: true,
      sortOrder: 10,
    },
    {
      specDefinitionId: supportsSpec,
      label: 'Yes',
      value: 'true',
      fixedFee: 30,
      sortOrder: 20,
    },
  ];
  for (const option of tdOptions) await insertSpecOption(ds, option);
  console.log('✅ 3D catalog specs and options created');

  const paperOrderIds: OrderRow[] = orderRows.filter((r: OrderRow) =>
    ['ORD-10001', 'ORD-10002', 'ORD-10004', 'ORD-10005'].includes(r.order_id),
  );
  for (const order of paperOrderIds) {
    const orderItemId = orderItemByOrderId.get(order.order_id);
    if (!orderItemId) continue;
    await insertOrderItemSpecSnapshot(ds, orderItemId, 'paper_size', 'a4');
    await insertOrderItemSpecSnapshot(
      ds,
      orderItemId,
      'color_mode',
      'full_color',
    );
    await insertOrderItemSpecSnapshot(ds, orderItemId, 'media_type', 'glossy');
    await insertOrderItemSpecSnapshot(
      ds,
      orderItemId,
      'print_sides',
      'front_only',
    );
    await insertOrderItemSpecSnapshot(ds, orderItemId, 'binding', 'none');
    await insertOrderItemSpecSnapshot(
      ds,
      orderItemId,
      'print_mode',
      'fitToPage',
    );
    await insertOrderItemSpecSnapshot(ds, orderItemId, 'page_count', '1');
  }

  const threeDOrderIds: OrderRow[] = orderRows.filter((r: OrderRow) =>
    ['ORD-10003', 'ORD-10006'].includes(r.order_id),
  );
  for (const order of threeDOrderIds) {
    const orderItemId = orderItemByOrderId.get(order.order_id);
    if (!orderItemId) continue;
    await insertOrderItemSpecSnapshot(ds, orderItemId, 'file_format', 'stl');
    await insertOrderItemSpecSnapshot(ds, orderItemId, 'material', 'pla');
    await insertOrderItemSpecSnapshot(ds, orderItemId, 'color', 'white');
    await insertOrderItemSpecSnapshot(
      ds,
      orderItemId,
      'infill_percentage',
      '20',
    );
    await insertOrderItemSpecSnapshot(ds, orderItemId, 'layer_height', '0.2');
    await insertOrderItemSpecSnapshot(ds, orderItemId, 'supports', 'false');
    await insertOrderItemSpecSnapshot(ds, orderItemId, 'notes', '');
  }
  console.log('✅ Dynamic order item spec snapshots added to seeded orders');

  // ─── Service Addons ─────────────────────────────────────────────────
  await ds.query(
    `INSERT INTO service_addons (category_id, name, description, price, price_type, is_active, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      paperId,
      'Lamination (A4)',
      'Matte or glossy lamination for A4 sheets',
      20.0,
      'per_unit',
      true,
      10,
    ],
  );
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
  console.log('✅ 2 service addons created');

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
      title: 'Bond Paper A4',
      subtitle: '₱15 / page',
      imageUrl:
        'https://images.unsplash.com/photo-1588580000645-4562a6d2c839?w=160&h=160&fit=crop&q=80',
      category: 'paper',
      specs: { paper_size: 'a4', color_mode: 'black_and_white' },
      sortOrder: 0,
      isActive: true,
    },
    {
      title: 'A3 Poster',
      subtitle: '₱75 / sheet',
      imageUrl:
        'https://images.unsplash.com/photo-1503455637927-730bce8583c0?w=160&h=160&fit=crop&q=80',
      category: 'paper',
      specs: {
        paper_size: 'a3',
        color_mode: 'full_color',
        media_type: 'glossy',
      },
      sortOrder: 1,
      isActive: true,
    },
    {
      title: '3D Print',
      subtitle: 'From ₱120',
      imageUrl:
        'https://images.unsplash.com/photo-1617839625591-e5a789593135?w=160&h=160&fit=crop&q=80',
      category: '3d',
      specs: {
        file_format: 'stl',
        material: 'pla',
        color: 'white',
        infill_percentage: '20',
        layer_height: '0.2',
        supports: 'false',
      },
      sortOrder: 2,
      isActive: true,
    },
    {
      title: 'Large Banner',
      subtitle: 'From ₱350',
      imageUrl:
        'https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?w=160&h=160&fit=crop&q=80',
      category: 'paper',
      specs: {
        paper_size: 'a1',
        color_mode: 'full_color',
        media_type: 'glossy',
      },
      sortOrder: 3,
      isActive: true,
    },
    {
      title: 'Flyer Print',
      subtitle: '₱12 / sheet',
      imageUrl:
        'https://images.unsplash.com/photo-1601645191163-3fc0d5d64e35?w=160&h=160&fit=crop&q=80',
      category: 'paper',
      specs: {
        paper_size: 'a5',
        color_mode: 'full_color',
        media_type: 'matte',
      },
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
