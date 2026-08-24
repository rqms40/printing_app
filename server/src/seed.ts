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
import { seedBusinessCatalog } from './products/seed-business-catalog';
import { applyParsedCatalogProducts } from './suppliers/supplier-catalog.apply';
import {
  parseCatalogText,
  POLYMEDIA_CATALOG_TEXT,
} from './suppliers/supplier-catalog.parser';

interface CountRow {
  count: string;
}

interface IdRow {
  id: number;
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
      supplier_assignments, supplier_capabilities, supplier_verifications,
      supplier_profiles,
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

  // ─── Supplier Profile (demo print shop, Super Admin–verified) ───────
  const [supplierUser] = await typedQuery<IdRow>(
    ds,
    "SELECT id FROM users WHERE email = 'supplier@gridgo.ph'",
  );
  const supplierUserId: number = supplierUser.id;
  const [superAdmin] = await typedQuery<IdRow>(
    ds,
    "SELECT id FROM users WHERE email = 'superadmin@gridgo.ph'",
  );
  const superAdminId: number = superAdmin.id;

  const [supplierProfile] = await typedQuery<IdRow>(
    ds,
    `INSERT INTO supplier_profiles (
       user_id, business_name, description, contact_phone, contact_email,
       address, latitude, longitude, service_zones, service_focus_ranks,
       is_active, rating_average, rating_count, attributes
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb,
       true, 0, 0, '{}'::jsonb
     ) RETURNING id`,
    [
      supplierUserId,
      'Polymedia Printing Services',
      'Demo supplier catalog from the Polymedia Printing Services product list.',
      '+639193234567',
      'supplier@gridgo.ph',
      'Quimpo Blvd, Ecoland, Davao City',
      7.0505,
      125.5889,
      '["Davao City","Toril","Calinan"]',
      '["document_printing","tarpaulins","signages","apparel"]',
    ],
  );
  const supplierProfileId: number = supplierProfile.id;

  await ds.query(
    `INSERT INTO supplier_verifications (
       supplier_id, status, payout_details_ref, reviewed_by, reviewed_at, notes
     ) VALUES ($1, 'verified', NULL, $2, NOW(), $3)`,
    [
      supplierProfileId,
      superAdminId,
      'Seed pilot supplier — verified for demo',
    ],
  );

  for (const family of [
    'flyers',
    'brochures',
    'business-cards',
    'tarpaulins-outdoor-banners',
    'custom-apparel',
    'business-store-signages',
  ]) {
    await ds.query(
      `INSERT INTO supplier_capabilities (
         supplier_id, product_family, materials, max_capacity, lead_time_days
       ) VALUES ($1, $2, $3::jsonb, $4, $5)`,
      [supplierProfileId, family, '["standard","premium"]', 50, 3],
    );
  }
  console.log(
    '✅ Supplier profile + verified verification + capabilities for supplier@gridgo.ph',
  );

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
  const paperExtensions = '["pdf","png","jpg","jpeg","tif","tiff","docx"]';
  const threeDExtensions = '["stl","obj","3mf","glb","gltf"]';

  const [paperCat] = await typedQuery<IdRow>(
    ds,
    `INSERT INTO product_categories (
      name, slug, description, mobile_description, audience_label, icon,
      parent_id, catalog_level, is_orderable,
      file_processing_type, pricing_model, base_rate, quantity_unit,
      max_file_size_mb, allowed_extensions, is_active, sort_order
    )
     VALUES ($1,$2,$3,$4,$5,$6,NULL,1,true,$7,$8,$9,$10,$11,$12::jsonb,true,$13)
     RETURNING id`,
    [
      'Paper Printing',
      'paper',
      'Standard and large-format paper printing',
      'Print documents, plans, posters, and handouts.',
      'Best for: Everyday document, plan, and poster printing.',
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
      name, slug, description, mobile_description, audience_label, icon,
      parent_id, catalog_level, is_orderable,
      file_processing_type, pricing_model, base_rate, quantity_unit,
      max_file_size_mb, allowed_extensions, is_active, sort_order
    )
     VALUES ($1,$2,$3,$4,$5,$6,NULL,1,true,$7,$8,$9,$10,$11,$12::jsonb,true,$13)
     RETURNING id`,
    [
      '3D Printing',
      '3d',
      'FDM 3D printing with PLA, ABS, and PETG materials',
      'Upload a model and configure print material and finish.',
      'Best for: Prototypes, models, and custom 3D parts.',
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

  // ─── GRIDGO Business hierarchical catalog ───────────────────────────
  const business = await seedBusinessCatalog(ds);
  console.log(
    `✅ Business catalog: ${business.categories} categories, ${business.subgroups} subgroups, ${business.variants} variants (with temp specs)`,
  );

  const polymedia = parseCatalogText(POLYMEDIA_CATALOG_TEXT);
  const applied = await applyParsedCatalogProducts(
    ds,
    supplierProfileId,
    polymedia.products,
    { kind: 'import', fileName: 'Polymedia Printing Services Catalog.docx' },
  );
  console.log(
    `✅ Polymedia catalog: ${applied.offerings} offerings across ${applied.categories.length} categories`,
  );

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
