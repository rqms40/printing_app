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

function typedQuery<T>(
  ds: DataSource,
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  return ds.query(sql, params);
}

/**
 * Database seed script -- creates demo data for all 3 roles.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/seed.ts
 * Or:  npm run seed
 */
async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);

  console.log('🌱 Seeding GRID database...\n');

  // Check if database already has data
  const [existingUsers] = await typedQuery<CountRow>(
    ds,
    'SELECT count(*) FROM users',
  );
  if (parseInt(existingUsers.count) > 0) {
    console.log('⚠️  Database already has data. Running full reset...');
  }

  // ─── Users ──────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('password123', 10);

  const users = [
    {
      email: 'maria@gridprint.ph',
      password_hash: passwordHash,
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
      email: 'juan@gridprint.ph',
      password_hash: passwordHash,
      full_name: 'Juan Reyes',
      phone_number: '+639181234567',
      gender: 'male',
      profile_category: ProfileCategory.PROFESSIONAL,
      profile_field: ProfileField.ENGINEER_CONTRACTOR,
      course: null,
      organization: 'Grid Logistics',
      printing_preferences: [PrintingPreference.TECHNICAL_SPECS].join(','),
      role: 'driver',
      is_profile_complete: true,
      is_active: true,
    },
    {
      email: 'admin@gridprint.ph',
      password_hash: passwordHash,
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

  // Clear existing data (order matters for FK constraints)
  // Product tables (clear before others)
  await ds.query('DELETE FROM spec_options');
  await ds.query('DELETE FROM service_addons');
  await ds.query('DELETE FROM service_categories');
  await ds.query('DELETE FROM notifications');
  await ds.query('DELETE FROM payment_transactions');
  await ds.query('DELETE FROM delivery_assignments');
  await ds.query('DELETE FROM order_status_history');
  await ds.query('DELETE FROM paper_specs');
  await ds.query('DELETE FROM three_d_specs');
  await ds.query('DELETE FROM orders');
  await ds.query('DELETE FROM addresses');
  await ds.query('DELETE FROM driver_profiles');
  await ds.query('DELETE FROM file_metadata');
  await ds.query('DELETE FROM tam_surveys');
  await ds.query('DELETE FROM users');

  // Reset all sequences so IDs start fresh
  await ds.query("SELECT setval('users_id_seq', 1, false)");
  await ds.query("SELECT setval('orders_id_seq', 1, false)");
  await ds.query("SELECT setval('addresses_id_seq', 1, false)");
  await ds.query("SELECT setval('notifications_id_seq', 1, false)");
  await ds.query("SELECT setval('payment_transactions_id_seq', 1, false)");
  await ds.query("SELECT setval('delivery_assignments_id_seq', 1, false)");
  await ds.query("SELECT setval('order_status_history_id_seq', 1, false)");
  await ds.query("SELECT setval('paper_specs_id_seq', 1, false)");
  await ds.query("SELECT setval('three_d_specs_id_seq', 1, false)");
  await ds.query("SELECT setval('driver_profiles_id_seq', 1, false)");
  await ds.query("SELECT setval('file_metadata_id_seq', 1, false)");
  await ds.query("SELECT setval('service_categories_id_seq', 1, false)");
  await ds.query("SELECT setval('spec_options_id_seq', 1, false)");
  await ds.query("SELECT setval('service_addons_id_seq', 1, false)");
  await ds.query("SELECT setval('tam_surveys_id_seq', 1, false)");

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
  console.log('✅ 3 users created (maria/customer, juan/driver, admin)');

  // Get user IDs
  const [maria] = await typedQuery<IdRow>(
    ds,
    "SELECT id FROM users WHERE email = 'maria@gridprint.ph'",
  );
  const [juan] = await typedQuery<IdRow>(
    ds,
    "SELECT id FROM users WHERE email = 'juan@gridprint.ph'",
  );
  const mariaId: number = maria.id;
  const juanId: number = juan.id;

  // ─── Addresses ──────────────────────────────────────────────────────
  const addresses = [
    {
      user_id: mariaId,
      label: 'Home',
      full_address: '123 Ayala Ave, Brgy. Bel-Air, Makati City',
      barangay: 'Bel-Air',
      city: 'Makati City',
      province: 'Metro Manila',
      zip_code: '1209',
      landmark: 'Near Greenbelt 5',
      latitude: 14.5547,
      longitude: 121.0244,
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

  // ─── Driver Profile ─────────────────────────────────────────────────
  await ds.query(
    `INSERT INTO driver_profiles (user_id, vehicle_type, plate_number, license_number, is_available)
     VALUES ($1, $2, $3, $4, $5)`,
    [juanId, 'motorcycle', 'ABC 1234', 'N01-23-456789', true],
  );
  console.log('✅ Driver profile created for Juan');

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
    },
  ];

  for (const o of orders) {
    await ds.query(
      `INSERT INTO orders (order_id, user_id, category, quantity, total_price, delivery_fee, payment_method, payment_status, order_status, delivery_option, file_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
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

  // ─── Paper Specs ────────────────────────────────────────────────────
  const paperOrderIds: OrderRow[] = orderRows.filter((r: OrderRow) =>
    ['ORD-10001', 'ORD-10002', 'ORD-10004', 'ORD-10005'].includes(r.order_id),
  );
  for (const o of paperOrderIds) {
    await ds.query(
      `INSERT INTO paper_specs (order_id, paper_size, color_mode, media_type, print_sides, binding)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [o.id, 'a4', 'fullColor', 'glossy', 'frontOnly', 'none'],
    );
  }
  console.log('✅ Paper specs added to 4 orders');

  // ─── 3D Specs ───────────────────────────────────────────────────────
  const threeDOrderIds: OrderRow[] = orderRows.filter((r: OrderRow) =>
    ['ORD-10003', 'ORD-10006'].includes(r.order_id),
  );
  for (const o of threeDOrderIds) {
    await ds.query(
      `INSERT INTO three_d_specs (order_id, file_format, material, color, infill_percentage, layer_height, supports)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [o.id, 'stl', 'pla', 'White', 20, 0.2, false],
    );
  }
  console.log('✅ 3D specs added to 2 orders');

  // ─── Delivery Assignment ────────────────────────────────────────────
  // Get driver profile ID (FK references driver_profiles, not users)
  const [driverProfile] = await typedQuery<IdRow>(
    ds,
    'SELECT id FROM driver_profiles WHERE user_id = $1',
    [juanId],
  );
  const driverProfileId: number = driverProfile.id;

  const onTheWayOrder: OrderRow | undefined = orderRows.find(
    (r: OrderRow) => r.order_id === 'ORD-10004',
  );
  if (onTheWayOrder) {
    await ds.query(
      `INSERT INTO delivery_assignments (order_id, driver_id, status, accepted_at, picked_up_at, on_the_way_at)
       VALUES ($1, $2, $3, NOW(), NOW(), NOW())`,
      [onTheWayOrder.id, driverProfileId, 'on_the_way'],
    );
    // Update order with assigned driver
    await ds.query('UPDATE orders SET assigned_driver_id = $1 WHERE id = $2', [
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
      title: 'Driver On The Way',
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
      title: 'Welcome to GRID!',
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

  // ─── Service Categories ─────────────────────────────────────────────
  await ds.query(
    `INSERT INTO service_categories (name, slug, description, icon, base_rate, max_file_size_mb, allowed_extensions, is_active, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      'Paper Printing',
      'paper',
      'Standard and large-format paper printing',
      'FileTextOutlined',
      2.0,
      50,
      '["pdf","png","jpg","jpeg","docx"]',
      true,
      1,
    ],
  );
  await ds.query(
    `INSERT INTO service_categories (name, slug, description, icon, base_rate, max_file_size_mb, allowed_extensions, is_active, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      '3D Printing',
      '3d',
      'FDM 3D printing with PLA, ABS, and PETG materials',
      'AppstoreOutlined',
      50.0,
      200,
      '["stl","obj","3mf"]',
      true,
      2,
    ],
  );
  console.log('✅ 2 service categories created (paper, 3d)');

  const [paperCat] = await ds.query<IdRow[]>(
    'SELECT id FROM service_categories WHERE slug = $1',
    ['paper'],
  );
  const [threeDCat] = await ds.query<IdRow[]>(
    'SELECT id FROM service_categories WHERE slug = $1',
    ['3d'],
  );
  const paperId: number = paperCat.id;
  const tdId: number = threeDCat.id;

  // ─── Paper Spec Options ─────────────────────────────────────────────
  const paperOptions = [
    // paper_size
    [paperId, 'paper_size', 'A5', 'a5', 0.8, 0, 0, null, false, true, 10],
    [paperId, 'paper_size', 'A4', 'a4', 1.0, 0, 0, null, true, true, 20],
    [paperId, 'paper_size', 'A3', 'a3', 1.5, 0, 0, null, false, true, 30],
    [paperId, 'paper_size', 'A2', 'a2', 2.5, 0, 0, null, false, true, 40],
    [paperId, 'paper_size', 'A1', 'a1', 4.0, 0, 0, null, false, true, 50],
    [
      paperId,
      'paper_size',
      '20×30in',
      'twenty_by_thirty',
      3.0,
      0,
      0,
      null,
      false,
      true,
      60,
    ],
    [
      paperId,
      'paper_size',
      'Custom',
      'custom',
      2.0,
      0,
      0,
      null,
      false,
      true,
      70,
    ],
    // color_mode
    [
      paperId,
      'color_mode',
      'Black & White',
      'black_and_white',
      1.0,
      0,
      0,
      null,
      true,
      true,
      10,
    ],
    [
      paperId,
      'color_mode',
      'Full Color',
      'full_color',
      2.5,
      0,
      0,
      null,
      false,
      true,
      20,
    ],
    // media_type
    [paperId, 'media_type', 'Matte', 'matte', 1.0, 0, 0, null, true, true, 10],
    [
      paperId,
      'media_type',
      'Glossy',
      'glossy',
      1.3,
      0,
      0,
      null,
      false,
      true,
      20,
    ],
    // print_sides
    [
      paperId,
      'print_sides',
      'Front Only',
      'front_only',
      1.0,
      0,
      0,
      null,
      true,
      true,
      10,
    ],
    [
      paperId,
      'print_sides',
      'Back-to-Back',
      'back_to_back',
      1.8,
      0,
      0,
      null,
      false,
      true,
      20,
    ],
    // binding
    [paperId, 'binding', 'None', 'none', 1.0, 0.0, 0, null, true, true, 10],
    [
      paperId,
      'binding',
      'Staple',
      'staple',
      1.0,
      10.0,
      0,
      null,
      false,
      true,
      20,
    ],
    [
      paperId,
      'binding',
      'Spiral',
      'spiral',
      1.0,
      25.0,
      0,
      null,
      false,
      true,
      30,
    ],
    [
      paperId,
      'binding',
      'Premium',
      'premium',
      1.0,
      50.0,
      0,
      null,
      false,
      true,
      40,
    ],
  ];
  for (const o of paperOptions) {
    await ds.query(
      `INSERT INTO spec_options (category_id, option_group, label, value, multiplier, fixed_fee, unit_cost, estimated_grams, is_default, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      o,
    );
  }
  console.log('✅ 17 paper spec options created');

  // ─── 3D Spec Options ────────────────────────────────────────────────
  const tdOptions = [
    // file_format
    [tdId, 'file_format', 'STL', 'stl', 1.0, 0, 0.0, null, true, true, 10],
    [tdId, 'file_format', 'OBJ', 'obj', 1.0, 0, 0.0, null, false, true, 20],
    [
      tdId,
      'file_format',
      '3MF',
      'three_mf',
      1.0,
      0,
      0.0,
      null,
      false,
      true,
      30,
    ],
    // material
    [tdId, 'material', 'PLA', 'pla', 1.0, 0, 3.0, null, true, true, 10],
    [tdId, 'material', 'ABS', 'abs', 1.0, 0, 3.0, null, false, true, 20],
    [tdId, 'material', 'PETG', 'petg', 1.0, 0, 4.0, null, false, true, 30],
    // infill
    [tdId, 'infill', '10%', 'infill_10', 1.0, 0, 0, 20, true, true, 10],
    [tdId, 'infill', '20%', 'infill_20', 1.0, 0, 0, 40, false, true, 20],
    [tdId, 'infill', '50%', 'infill_50', 1.0, 0, 0, 100, false, true, 30],
    [tdId, 'infill', '100%', 'infill_100', 1.0, 0, 0, 200, false, true, 40],
    // layer_height
    [
      tdId,
      'layer_height',
      '0.1mm',
      'layer_01',
      1.0,
      0,
      0,
      null,
      false,
      true,
      10,
    ],
    [
      tdId,
      'layer_height',
      '0.2mm',
      'layer_02',
      1.0,
      0,
      0,
      null,
      true,
      true,
      20,
    ],
    [
      tdId,
      'layer_height',
      '0.3mm',
      'layer_03',
      1.0,
      0,
      0,
      null,
      false,
      true,
      30,
    ],
  ];
  for (const o of tdOptions) {
    await ds.query(
      `INSERT INTO spec_options (category_id, option_group, label, value, multiplier, fixed_fee, unit_cost, estimated_grams, is_default, is_active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      o,
    );
  }
  console.log('✅ 13 3D spec options created');

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
        'GRID is amazing! It saved me so much time printing my architectural plans. The UI could be slightly better though.',
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

  console.log('\n🎉 Seed complete!\n');
  console.log('Login credentials (all use password: password123):');
  console.log('  Customer: maria@gridprint.ph');
  console.log('  Driver:   juan@gridprint.ph');
  console.log('  Admin:    admin@gridprint.ph');

  await app.close();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
