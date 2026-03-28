import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

/**
 * Database seed script — creates demo data for all 3 roles.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/seed.ts
 * Or:  npm run seed
 */
async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);

  console.log('🌱 Seeding GRID database...\n');

  // Check if database already has data
  const [existingUsers] = await ds.query('SELECT count(*) FROM users');
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
      role: 'admin',
      is_profile_complete: true,
      is_active: true,
    },
  ];

  // Clear existing data (order matters for FK constraints)
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

  for (const u of users) {
    await ds.query(
      `INSERT INTO users (email, password_hash, full_name, phone_number, gender, role, is_profile_complete, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [u.email, u.password_hash, u.full_name, u.phone_number, u.gender, u.role, u.is_profile_complete, u.is_active],
    );
  }
  console.log('✅ 3 users created (maria/customer, juan/driver, admin)');

  // Get user IDs
  const [maria] = await ds.query("SELECT id FROM users WHERE email = 'maria@gridprint.ph'");
  const [juan] = await ds.query("SELECT id FROM users WHERE email = 'juan@gridprint.ph'");
  const mariaId = maria.id;
  const juanId = juan.id;

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
      latitude: 14.6400,
      longitude: 121.0530,
      is_default: false,
    },
  ];

  for (const a of addresses) {
    await ds.query(
      `INSERT INTO addresses (user_id, label, full_address, barangay, city, province, zip_code, landmark, latitude, longitude, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [a.user_id, a.label, a.full_address, a.barangay, a.city, a.province, a.zip_code, a.landmark, a.latitude, a.longitude, a.is_default],
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
    { order_id: 'ORD-10001', category: 'paper', quantity: 2, total_price: 120, delivery_fee: 50, payment_method: 'gcash', payment_status: 'paid', order_status: 'order_placed', delivery_option: 'delivery' },
    { order_id: 'ORD-10002', category: 'paper', quantity: 1, total_price: 80, delivery_fee: 0, payment_method: 'maya', payment_status: 'paid', order_status: 'printing_in_progress', delivery_option: 'pickup' },
    { order_id: 'ORD-10003', category: '3d', quantity: 1, total_price: 350, delivery_fee: 50, payment_method: 'cod', payment_status: 'pending', order_status: 'quality_checked', delivery_option: 'delivery' },
    { order_id: 'ORD-10004', category: 'paper', quantity: 5, total_price: 250, delivery_fee: 50, payment_method: 'gcash', payment_status: 'paid', order_status: 'on_the_way', delivery_option: 'delivery' },
    { order_id: 'ORD-10005', category: 'paper', quantity: 1, total_price: 45, delivery_fee: 0, payment_method: 'maya', payment_status: 'paid', order_status: 'delivered', delivery_option: 'pickup' },
    { order_id: 'ORD-10006', category: '3d', quantity: 2, total_price: 580, delivery_fee: 50, payment_method: 'gcash', payment_status: 'refunded', order_status: 'cancelled', delivery_option: 'delivery' },
  ];

  for (const o of orders) {
    await ds.query(
      `INSERT INTO orders (order_id, user_id, category, quantity, total_price, delivery_fee, payment_method, payment_status, order_status, delivery_option, file_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [o.order_id, mariaId, o.category, o.quantity, o.total_price, o.delivery_fee, o.payment_method, o.payment_status, o.order_status, o.delivery_option, `${o.category === 'paper' ? 'document' : 'model'}_${o.order_id.slice(-3)}.${o.category === 'paper' ? 'pdf' : 'stl'}`],
    );
  }
  console.log('✅ 6 orders created for Maria (various statuses)');

  // Get order IDs
  const orderRows = await ds.query("SELECT id, order_id FROM orders ORDER BY id");

  // ─── Paper Specs ────────────────────────────────────────────────────
  const paperOrderIds = orderRows.filter((r: any) => ['ORD-10001', 'ORD-10002', 'ORD-10004', 'ORD-10005'].includes(r.order_id));
  for (const o of paperOrderIds) {
    await ds.query(
      `INSERT INTO paper_specs (order_id, paper_size, color_mode, media_type, print_sides, binding)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [o.id, 'a4', 'fullColor', 'glossy', 'frontOnly', 'none'],
    );
  }
  console.log('✅ Paper specs added to 4 orders');

  // ─── 3D Specs ───────────────────────────────────────────────────────
  const threeDOrderIds = orderRows.filter((r: any) => ['ORD-10003', 'ORD-10006'].includes(r.order_id));
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
  const [driverProfile] = await ds.query("SELECT id FROM driver_profiles WHERE user_id = $1", [juanId]);
  const driverProfileId = driverProfile.id;

  const onTheWayOrder = orderRows.find((r: any) => r.order_id === 'ORD-10004');
  if (onTheWayOrder) {
    await ds.query(
      `INSERT INTO delivery_assignments (order_id, driver_id, status, accepted_at, picked_up_at, on_the_way_at)
       VALUES ($1, $2, $3, NOW(), NOW(), NOW())`,
      [onTheWayOrder.id, driverProfileId, 'on_the_way'],
    );
    // Update order with assigned driver
    await ds.query('UPDATE orders SET assigned_driver_id = $1 WHERE id = $2', [juanId, onTheWayOrder.id]);
    console.log('✅ Delivery assignment created (ORD-10004 → Juan, on_the_way)');
  }

  // ─── Notifications ──────────────────────────────────────────────────
  const notifications = [
    { user_id: mariaId, order_ref: 'ORD-10001', title: 'Order Placed', message: 'Your order ORD-10001 has been placed successfully.', type: 'order_update', is_read: false },
    { user_id: mariaId, order_ref: 'ORD-10002', title: 'Printing Started', message: 'Your order ORD-10002 is now being printed.', type: 'order_update', is_read: false },
    { user_id: mariaId, order_ref: 'ORD-10004', title: 'Driver On The Way', message: 'Juan is delivering your order ORD-10004.', type: 'delivery_update', is_read: false },
    { user_id: mariaId, order_ref: 'ORD-10005', title: 'Order Completed', message: 'Your order ORD-10005 has been picked up. Thank you!', type: 'order_update', is_read: true },
    { user_id: mariaId, order_ref: 'ORD-10006', title: 'Refund Processed', message: 'Your refund for ORD-10006 has been processed.', type: 'payment', is_read: true },
    { user_id: mariaId, order_ref: null, title: 'Welcome to GRID!', message: 'Start your first order and enjoy premium printing.', type: 'promo', is_read: true },
    { user_id: juanId, order_ref: 'ORD-10004', title: 'New Delivery', message: 'You have been assigned to deliver ORD-10004.', type: 'delivery_assignment', is_read: true },
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
  const paidOrders = orderRows.filter((r: any) => ['ORD-10001', 'ORD-10002', 'ORD-10004', 'ORD-10005'].includes(r.order_id));
  for (const o of paidOrders) {
    await ds.query(
      `INSERT INTO payment_transactions (order_id, payment_method, amount, status)
       VALUES ($1, $2, $3, $4)`,
      [o.id, 'gcash', 150, 'success'],
    );
  }
  console.log('✅ 4 payment transactions created');

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
