import { MigrationInterface, QueryRunner } from 'typeorm';

export class CurrentSchemaBaseline1700000000000 implements MigrationInterface {
  name = 'CurrentSchemaBaseline1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('users')) {
      return;
    }

    await queryRunner.query(
      `CREATE TYPE "public"."users_age_range_enum" AS ENUM('under_18', '18_24', '25_34', '35_44', '45_plus')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_profile_category_enum" AS ENUM('student', 'professional')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_profile_field_enum" AS ENUM('architecture', 'engineering', 'medical_nursing', 'law_arts_others', 'architect_designer', 'engineer_contractor', 'medical_professional', 'business_corporate')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('customer', 'rider', 'admin')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" SERIAL NOT NULL, "email" character varying NOT NULL, "password_hash" character varying NOT NULL, "full_name" text, "nickname" text, "phone_number" text, "gender" text, "age_range" "public"."users_age_range_enum", "date_of_birth" TIMESTAMP, "profile_category" "public"."users_profile_category_enum", "profile_field" "public"."users_profile_field_enum", "course" text, "organization" text, "printing_preferences" text, "role" "public"."users_role_enum" NOT NULL DEFAULT 'customer', "is_profile_complete" boolean NOT NULL DEFAULT false, "fcm_token" text, "is_active" boolean NOT NULL DEFAULT true, "account_hold_reason" character varying(50), "account_held_at" TIMESTAMP, "beta_completed_at" TIMESTAMP, "credits" numeric(10,2) NOT NULL DEFAULT '0', "file_retention_days" integer, "default_payment_method" character varying(20), "tutorial_seen_keys" text array NOT NULL DEFAULT '{}', "is_beta_user" boolean NOT NULL DEFAULT false, "beta_enrolled_at" TIMESTAMP, "beta_credits_granted" boolean NOT NULL DEFAULT false, "is_beta_survey_exempt" boolean NOT NULL DEFAULT false, "beta_photo_file_id" integer, "beta_photo_uploaded_at" TIMESTAMP WITH TIME ZONE, "beta_shared_on_social" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tam_survey_settings" ("id" SERIAL NOT NULL, "is_enabled" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_984c9a8aeaf473c159b00a3f38f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "addresses" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "label" character varying(50) NOT NULL, "full_address" text NOT NULL, "barangay" character varying(100), "city" character varying(100) NOT NULL, "province" character varying(100), "zip_code" character varying(10), "landmark" text, "latitude" numeric(10,7) NOT NULL, "longitude" numeric(10,7) NOT NULL, "is_default" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_745d8f43d3af10ab8247465e450" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_addresses_user_id" ON "addresses" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "order_status_history" ("id" SERIAL NOT NULL, "order_id" integer NOT NULL, "from_status" character varying(30) NOT NULL, "to_status" character varying(30) NOT NULL, "changed_by_user_id" integer NOT NULL, "notes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e6c66d853f155531985fc4f6ec8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_order_status_history_order" ON "order_status_history" ("order_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "batch_orders" ("id" SERIAL NOT NULL, "batch_ref" character varying NOT NULL, "user_id" integer NOT NULL, "subtotal" numeric(10,2) NOT NULL, "delivery_fee" numeric(10,2) NOT NULL DEFAULT '0', "total_price" numeric(10,2) NOT NULL, "payment_method" character varying NOT NULL, "payment_status" character varying NOT NULL DEFAULT 'pending', "delivery_option" character varying NOT NULL DEFAULT 'pickup', "delivery_address_id" integer, "delivery_type" character varying(20) NOT NULL DEFAULT 'local', "slot_booking_id" integer, "priority_fee" numeric(10,2) NOT NULL DEFAULT '0', "speed_tier" character varying(20) NOT NULL DEFAULT 'standard', "extra_destination_fee" numeric(10,2) NOT NULL DEFAULT '0', "external_delivery_status" character varying(30), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_8a4babf4fcb8bf2eefe991a5ab9" UNIQUE ("batch_ref"), CONSTRAINT "PK_565cf992d77f98631b7e39181d5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "delivery_destinations" ("id" SERIAL NOT NULL, "batch_order_id" integer NOT NULL, "address_id" integer, "label" character varying(100), "sort_order" integer NOT NULL DEFAULT '0', "full_address" text, "barangay" character varying(100), "city" character varying(100), "province" character varying(100), "zip_code" character varying(10), "landmark" text, "latitude" numeric(10,7), "longitude" numeric(10,7), CONSTRAINT "PK_6fbc1c8994d4fa1700e2bd8cc63" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_destination_batch" ON "delivery_destinations" ("batch_order_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "order_item_spec_values" ("id" SERIAL NOT NULL, "order_item_id" integer NOT NULL, "spec_definition_id" integer, "spec_key" character varying(50) NOT NULL, "spec_label" character varying(100) NOT NULL, "input_type" character varying(30) NOT NULL, "value" character varying(120) NOT NULL, "display_value" character varying(120) NOT NULL, "option_id" integer, "option_label" character varying(100), "multiplier" numeric(8,3) NOT NULL DEFAULT '1', "fixed_fee" numeric(10,2) NOT NULL DEFAULT '0', "unit_cost" numeric(10,2) NOT NULL DEFAULT '0', "estimated_quantity" numeric(10,2), CONSTRAINT "PK_54028c55c3ee2e8d625d75d828c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "order_items" ("id" SERIAL NOT NULL, "order_id" integer NOT NULL, "category" character varying NOT NULL, "category_id" integer, "category_slug" character varying(50), "category_name" character varying(100), "pricing_model" character varying(50), "file_url" character varying, "file_name" character varying, "file_metadata_id" integer, "special_instructions" text, "destination_id" integer, "quantity" integer NOT NULL DEFAULT '1', "total_price" numeric(10,2) NOT NULL, CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."orders_order_status_enum" AS ENUM('order_placed', 'file_verified', 'file_declined', 'printing_in_progress', 'finishing_mounting', 'quality_checked', 'ready_for_dispatch', 'rider_assigned', 'picked_up', 'on_the_way', 'arrived_at_destination', 'delivered', 'completed_pickup', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "orders" ("id" SERIAL NOT NULL, "order_id" character varying NOT NULL, "user_id" integer NOT NULL, "batch_order_id" integer, "destination_id" integer, "category" character varying NOT NULL, "file_url" character varying, "file_name" character varying, "file_metadata_id" integer, "quantity" integer NOT NULL DEFAULT '1', "total_price" numeric(10,2) NOT NULL, "delivery_fee" numeric(10,2) NOT NULL DEFAULT '0', "payment_method" character varying NOT NULL, "payment_status" character varying NOT NULL DEFAULT 'pending', "order_status" "public"."orders_order_status_enum" NOT NULL DEFAULT 'order_placed', "delivery_option" character varying NOT NULL DEFAULT 'pickup', "admin_status_note" character varying(255), "estimated_completion_at" TIMESTAMP, "admin_status_set_at" TIMESTAMP, "decline_reason" text, "cancellation_reason" text, "cancelled_at" TIMESTAMP, "delivery_address_id" integer, "assigned_rider_id" integer, "admin_notes" text, "tracking_link" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_cad55b3cb25b38be94d2ce831db" UNIQUE ("order_id"), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_status" ON "orders" ("order_status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_orders_user_id" ON "orders" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tam_survey_requirements_reason_enum" AS ENUM('post_delivery')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."tam_survey_requirements_status_enum" AS ENUM('pending', 'submitted')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tam_survey_requirements" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "order_id" integer NOT NULL, "reason" "public"."tam_survey_requirements_reason_enum" NOT NULL DEFAULT 'post_delivery', "status" "public"."tam_survey_requirements_status_enum" NOT NULL DEFAULT 'pending', "survey_id" integer, "required_at" TIMESTAMP NOT NULL, "submitted_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_fc8b9dac04a68e774241c8fa63" UNIQUE ("survey_id"), CONSTRAINT "PK_1d7047ca67fc13e5a07e3bc3dce" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_tam_survey_requirements_order_reason" ON "tam_survey_requirements" ("order_id", "reason") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tam_survey_requirements_user_status" ON "tam_survey_requirements" ("user_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "tam_surveys" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "order_id" integer, "requirement_id" integer, "survey_data" jsonb NOT NULL, "open_forum_feedback" text, "is_approved_for_feed" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3abda0f1b412d823745d9131f57" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "rider_profiles" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "vehicle_type" character varying(20) NOT NULL, "plate_number" character varying(20), "license_number" character varying(50), "is_available" boolean NOT NULL DEFAULT false, "last_latitude" numeric(10,7), "last_longitude" numeric(10,7), "last_location_update" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_eb61b4b5bcd3ad3a6c14f491dbb" UNIQUE ("user_id"), CONSTRAINT "PK_bec1afad599cabe486f80dbcbf2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."support_tickets_status_enum" AS ENUM('open', 'closed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "support_tickets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "email" character varying NOT NULL, "subject" character varying NOT NULL, "message" text NOT NULL, "status" "public"."support_tickets_status_enum" NOT NULL DEFAULT 'open', "adminReply" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_942e8d8f5df86100471d2324643" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."delivery_assignments_status_enum" AS ENUM('assigned', 'accepted', 'declined', 'picked_up', 'on_the_way', 'arrived', 'delivered')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."delivery_proof_type_enum" AS ENUM('photo', 'signature')`,
    );
    await queryRunner.query(
      `CREATE TABLE "delivery_assignments" ("id" SERIAL NOT NULL, "order_id" integer NOT NULL, "rider_id" integer NOT NULL, "status" "public"."delivery_assignments_status_enum" NOT NULL DEFAULT 'assigned', "assigned_at" TIMESTAMP NOT NULL DEFAULT NOW(), "accepted_at" TIMESTAMP, "picked_up_at" TIMESTAMP, "on_the_way_at" TIMESTAMP, "arrived_at" TIMESTAMP, "delivered_at" TIMESTAMP, "proof_type" "public"."delivery_proof_type_enum", "proof_file_id" integer, "proof_object_key" character varying, "proof_signature_data" text, "proof_captured_at" TIMESTAMP, "proof_captured_by_rider_id" integer, "decline_reason" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d1cfabf26db04a5282217fb7b83" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_delivery_assignments_status" ON "delivery_assignments" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_delivery_assignments_rider" ON "delivery_assignments" ("rider_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_delivery_assignments_order" ON "delivery_assignments" ("order_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "product_spec_options" ("id" SERIAL NOT NULL, "spec_definition_id" integer NOT NULL, "label" character varying(100) NOT NULL, "value" character varying(50) NOT NULL, "multiplier" numeric(8,3) NOT NULL DEFAULT '1', "fixed_fee" numeric(10,2) NOT NULL DEFAULT '0', "unit_cost" numeric(10,2) NOT NULL DEFAULT '0', "estimated_quantity" numeric(10,2), "is_default" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "sort_order" integer NOT NULL DEFAULT '0', "metadata" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "uq_product_spec_option_value" UNIQUE ("spec_definition_id", "value"), CONSTRAINT "PK_f0fb0e2200a24c8d66704ed1181" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "product_spec_definitions" ("id" SERIAL NOT NULL, "category_id" integer NOT NULL, "key" character varying(50) NOT NULL, "label" character varying(100) NOT NULL, "help_text" text, "input_type" character varying(30) NOT NULL, "value_type" character varying(30) NOT NULL, "is_required" boolean NOT NULL DEFAULT true, "is_active" boolean NOT NULL DEFAULT true, "default_value" character varying(100), "pricing_role" character varying(40) NOT NULL DEFAULT 'none', "unit_label" character varying(20), "placeholder" character varying(120), "min_value" numeric(10,3), "max_value" numeric(10,3), "step_value" numeric(10,3), "sort_order" integer NOT NULL DEFAULT '0', "metadata" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "uq_product_spec_key" UNIQUE ("category_id", "key"), CONSTRAINT "PK_dc2e39bc7ea142db9f1409f96fb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "product_categories" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "slug" character varying(50) NOT NULL, "description" text, "mobile_description" character varying(160), "icon" character varying(50), "file_processing_type" character varying(30) NOT NULL DEFAULT 'generic_file', "pricing_model" character varying(50) NOT NULL, "base_rate" numeric(10,2) NOT NULL, "quantity_unit" character varying(30) NOT NULL DEFAULT 'copy', "max_file_size_mb" integer NOT NULL DEFAULT '50', "allowed_extensions" jsonb NOT NULL DEFAULT '[]'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "sort_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_f314a8b42f88d87b2dcb7fc491a" UNIQUE ("slug"), CONSTRAINT "PK_7069dac60d88408eca56fdc9e0c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "service_addons" ("id" SERIAL NOT NULL, "category_id" integer, "name" character varying(100) NOT NULL, "description" text, "price" numeric(10,2) NOT NULL, "price_type" character varying(20) NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "sort_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_880297192a9485434563928ce83" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "service_categories" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "slug" character varying(50) NOT NULL, "description" text, "icon" character varying(50), "base_rate" numeric(10,2) NOT NULL, "max_file_size_mb" integer NOT NULL DEFAULT '50', "allowed_extensions" text NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "sort_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_88a33271b3d94a0c4bc14db3b76" UNIQUE ("slug"), CONSTRAINT "PK_fe4da5476c4ffe5aa2d3524ae68" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "spec_options" ("id" SERIAL NOT NULL, "category_id" integer NOT NULL, "option_group" character varying(50) NOT NULL, "label" character varying(100) NOT NULL, "value" character varying(50) NOT NULL, "multiplier" numeric(6,3) NOT NULL DEFAULT '1', "fixed_fee" numeric(10,2) NOT NULL DEFAULT '0', "unit_cost" numeric(10,2) NOT NULL DEFAULT '0', "estimated_grams" integer, "is_default" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "sort_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "uq_spec_option" UNIQUE ("category_id", "option_group", "value"), CONSTRAINT "PK_2c52a6576562abcf9d18e07af09" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "printer_profiles" ("id" SERIAL NOT NULL, "name" character varying(80) NOT NULL, "build_volume_width_mm" integer NOT NULL DEFAULT '180', "build_volume_depth_mm" integer NOT NULL DEFAULT '180', "build_volume_height_mm" integer NOT NULL DEFAULT '180', "max_file_size_mb" integer NOT NULL DEFAULT '200', "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e97c288512bc19aa6303adb44d8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "payment_transactions" ("id" SERIAL NOT NULL, "order_id" integer NOT NULL, "payment_method" character varying(10) NOT NULL, "amount" numeric(10,2) NOT NULL, "status" character varying(10) NOT NULL DEFAULT 'pending', "external_reference_id" character varying(255), "webhook_payload" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d32b3c6b0d2c1d22604cbcc8c49" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_payment_transactions_order" ON "payment_transactions" ("order_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "three_d_specs" ("id" SERIAL NOT NULL, "order_id" integer NOT NULL, "order_item_id" integer, "file_format" character varying(10) NOT NULL, "material" character varying(10) NOT NULL, "color" character varying(50) NOT NULL, "infill_percentage" integer NOT NULL, "layer_height" numeric(3,2) NOT NULL, "supports" boolean NOT NULL DEFAULT false, "notes" text, CONSTRAINT "REL_3dae48ebcc469343dcf8f7cb66" UNIQUE ("order_id"), CONSTRAINT "REL_6cd581ef7a29c6e2ad43597939" UNIQUE ("order_item_id"), CONSTRAINT "PK_9482246f27aaa6f6fc741da19c4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "paper_specs" ("id" SERIAL NOT NULL, "order_id" integer, "order_item_id" integer, "paper_size" character varying(20) NOT NULL, "color_mode" character varying(20) NOT NULL, "media_type" character varying(20) NOT NULL, "print_sides" character varying(20) NOT NULL, "binding" character varying(30) NOT NULL DEFAULT 'none', "print_mode" character varying(20) DEFAULT 'fitToPage', CONSTRAINT "REL_a7f24c0fab3b2b78c21b429338" UNIQUE ("order_id"), CONSTRAINT "REL_103893dcc99485e046bbc1ece5" UNIQUE ("order_item_id"), CONSTRAINT "PK_4a7e39c484305523d56391ca85a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "marketing_notifications" ("id" SERIAL NOT NULL, "description" character varying, "header" character varying NOT NULL, "body" character varying NOT NULL, "frequency" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "lastSentAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_506243e53f6669bb7b7c66e450e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "order_ref" character varying(20), "title" character varying(255) NOT NULL, "message" text NOT NULL, "type" character varying(30) NOT NULL, "is_read" boolean NOT NULL DEFAULT false, "metadata" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_created" ON "notifications" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_user_id" ON "notifications" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "file_metadata" ("id" SERIAL NOT NULL, "original_name" character varying NOT NULL, "mime_type" character varying NOT NULL, "size" integer NOT NULL, "width_pt" numeric(10,3), "height_pt" numeric(10,3), "width_px" integer, "height_px" integer, "color_space" character varying(20), "page_count" integer, "dpi" integer, "url" character varying NOT NULL, "object_key" character varying, "uploaded_by" integer, "expires_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "model_3d_width_mm" numeric(10,2), "model_3d_depth_mm" numeric(10,2), "model_3d_height_mm" numeric(10,2), "model_3d_triangle_count" integer, "preview_glb_object_key" character varying(512), CONSTRAINT "PK_b8805dd11c868561f260a0410ae" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "delivery_slot_templates" ("id" SERIAL NOT NULL, "day_of_week" integer NOT NULL, "start_time" TIME NOT NULL, "end_time" TIME NOT NULL, "capacity" integer NOT NULL DEFAULT '10', "is_active" boolean NOT NULL DEFAULT true, "allows_pickup" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9ce33f15dfc706fc6281da5605e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "delivery_slot_bookings" ("id" SERIAL NOT NULL, "slot_template_id" integer NOT NULL, "date" date NOT NULL, "batch_order_id" integer NOT NULL, "priority" boolean NOT NULL DEFAULT false, "priority_rank" integer, "booked_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "uq_slot_booking_batch" UNIQUE ("batch_order_id"), CONSTRAINT "PK_453be721e1a1d2d6e67dc56668a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_slot_booking_template_date" ON "delivery_slot_bookings" ("slot_template_id", "date") `,
    );
    await queryRunner.query(
      `CREATE TABLE "delivery_settings" ("id" SERIAL NOT NULL, "service_center_lat" numeric(10,7) NOT NULL, "service_center_lng" numeric(10,7) NOT NULL, "service_radius_km" numeric(6,2) NOT NULL DEFAULT '25', "priority_fee_amount" numeric(10,2) NOT NULL DEFAULT '50', "extra_destination_surcharge" numeric(10,2) NOT NULL DEFAULT '30', "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4e465b6ab6d5d228142f32ec5d5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "daily_grid_cards" ("id" SERIAL NOT NULL, "title" character varying NOT NULL, "subtitle" character varying, "imageUrl" character varying, "category" character varying NOT NULL DEFAULT 'paper', "sortOrder" integer NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, "specs" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3553d31f4419265ff72ddd05ad4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."credit_transactions_type_enum" AS ENUM('top_up', 'deduction')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."credit_transactions_status_enum" AS ENUM('pending', 'approved', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "credit_transactions" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "type" "public"."credit_transactions_type_enum" NOT NULL, "amountPhp" numeric(10,2), "amountCredits" numeric(10,2) NOT NULL, "status" "public"."credit_transactions_status_enum" NOT NULL DEFAULT 'pending', "proof_of_payment_url" text, "reference_id" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a408319811d1ab32832ec86fc2c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "credit_settings" ("id" SERIAL NOT NULL, "conversionRate" numeric(5,2) NOT NULL DEFAULT '1', "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "creditsOnlyMode" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_0ec93f35dc7f2b62fa8eeeaa60f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."chat_conversations_type_enum" AS ENUM('ai', 'admin', 'rider')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."chat_conversations_status_enum" AS ENUM('open', 'assigned', 'closed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "chat_conversations" ("id" SERIAL NOT NULL, "customer_id" integer NOT NULL, "type" "public"."chat_conversations_type_enum" NOT NULL, "order_id" integer, "assigned_admin_id" integer, "assigned_rider_id" integer, "status" "public"."chat_conversations_status_enum" NOT NULL DEFAULT 'open', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "closed_at" TIMESTAMP, CONSTRAINT "PK_ff117d9f57807c4f2e3034a39f3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conv_status_type" ON "chat_conversations" ("status", "type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conv_customer_status" ON "chat_conversations" ("customer_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."chat_messages_sender_role_enum" AS ENUM('customer', 'admin', 'rider', 'bot')`,
    );
    await queryRunner.query(
      `CREATE TABLE "chat_messages" ("id" SERIAL NOT NULL, "conversation_id" integer NOT NULL, "sender_id" integer, "sender_role" "public"."chat_messages_sender_role_enum" NOT NULL, "content" text, "attachment_file_id" integer, "attachment_mime_type" character varying(100), "is_read" boolean NOT NULL DEFAULT false, "read_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_40c55ee0e571e268b0d3cd37d10" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_chat_msg_conv_created" ON "chat_messages" ("conversation_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "beta_mode_settings" ("id" SERIAL NOT NULL, "is_enabled" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_d50bd5e83486948ca088532166f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "addresses" ADD CONSTRAINT "FK_16aac8a9f6f9c1dd6bcb75ec023" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_status_history" ADD CONSTRAINT "FK_1ca7d5228cf9dc589b60243933c" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "batch_orders" ADD CONSTRAINT "FK_e797e11685069c11ba755052645" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "batch_orders" ADD CONSTRAINT "FK_685db1dc302b3049e8393747ac2" FOREIGN KEY ("delivery_address_id") REFERENCES "addresses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_destinations" ADD CONSTRAINT "FK_3614958c42ec48a09d4a482486c" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item_spec_values" ADD CONSTRAINT "FK_31133e139a046e8dd34f2b7954e" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_145532db85752b29c57d2b7b1f1" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_fd2ce99fdbb9f47a0dc4e1a76bf" FOREIGN KEY ("destination_id") REFERENCES "delivery_destinations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_a922b820eeef29ac1c6800e826a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_0488b9a93537f5a2c2c44b0f3a6" FOREIGN KEY ("destination_id") REFERENCES "delivery_destinations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_dc0fe1df630904a0f2b33f2019b" FOREIGN KEY ("batch_order_id") REFERENCES "batch_orders"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_822c5ebe47e43ebe715f68968c4" FOREIGN KEY ("delivery_address_id") REFERENCES "addresses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_4880e77c6bc4b4dfe75112f5fcc" FOREIGN KEY ("assigned_rider_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tam_survey_requirements" ADD CONSTRAINT "FK_8c05fd5ca6f32fa358468f2c6a3" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tam_survey_requirements" ADD CONSTRAINT "FK_a982c70d95c563586b3f216d59e" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tam_survey_requirements" ADD CONSTRAINT "FK_fc8b9dac04a68e774241c8fa63a" FOREIGN KEY ("survey_id") REFERENCES "tam_surveys"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tam_surveys" ADD CONSTRAINT "FK_c544043144c124254b021f87cce" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tam_surveys" ADD CONSTRAINT "FK_490a83859ac55fbb5fb7f0f9ac2" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tam_surveys" ADD CONSTRAINT "FK_db9e4037bc30f096c61f4216f10" FOREIGN KEY ("requirement_id") REFERENCES "tam_survey_requirements"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rider_profiles" ADD CONSTRAINT "FK_eb61b4b5bcd3ad3a6c14f491dbb" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_assignments" ADD CONSTRAINT "FK_3442216f1a3836b6e3a97c3e729" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_assignments" ADD CONSTRAINT "FK_eb8780ee78d268c9c7caaba11c5" FOREIGN KEY ("rider_id") REFERENCES "rider_profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_spec_options" ADD CONSTRAINT "FK_9c8725d2a4ac15e6aebccd46eb3" FOREIGN KEY ("spec_definition_id") REFERENCES "product_spec_definitions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_spec_definitions" ADD CONSTRAINT "FK_1a4b929b0917d33189694524d16" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_addons" ADD CONSTRAINT "FK_2f041a59cfc5c4b85b2f04708d4" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "spec_options" ADD CONSTRAINT "FK_3d9c1e27aaf89b3af0bd7f5a86c" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" ADD CONSTRAINT "FK_0f581511ac19ecb02dab437cd41" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "three_d_specs" ADD CONSTRAINT "FK_3dae48ebcc469343dcf8f7cb665" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "three_d_specs" ADD CONSTRAINT "FK_6cd581ef7a29c6e2ad435979392" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "paper_specs" ADD CONSTRAINT "FK_a7f24c0fab3b2b78c21b429338b" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "paper_specs" ADD CONSTRAINT "FK_103893dcc99485e046bbc1ece52" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_9a8a82462cab47c73d25f49261f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_slot_bookings" ADD CONSTRAINT "FK_8b58b1e24d3055367132301f214" FOREIGN KEY ("slot_template_id") REFERENCES "delivery_slot_templates"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "credit_transactions" ADD CONSTRAINT "FK_9ac41a5292ef4d8356a86be30c2" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_conversations" ADD CONSTRAINT "FK_f78efda285469da358dc6189bbb" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_messages" ADD CONSTRAINT "FK_3d623662d4ee1219b23cf61e649" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_messages" DROP CONSTRAINT "FK_3d623662d4ee1219b23cf61e649"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_conversations" DROP CONSTRAINT "FK_f78efda285469da358dc6189bbb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "credit_transactions" DROP CONSTRAINT "FK_9ac41a5292ef4d8356a86be30c2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_slot_bookings" DROP CONSTRAINT "FK_8b58b1e24d3055367132301f214"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_9a8a82462cab47c73d25f49261f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "paper_specs" DROP CONSTRAINT "FK_103893dcc99485e046bbc1ece52"`,
    );
    await queryRunner.query(
      `ALTER TABLE "paper_specs" DROP CONSTRAINT "FK_a7f24c0fab3b2b78c21b429338b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "three_d_specs" DROP CONSTRAINT "FK_6cd581ef7a29c6e2ad435979392"`,
    );
    await queryRunner.query(
      `ALTER TABLE "three_d_specs" DROP CONSTRAINT "FK_3dae48ebcc469343dcf8f7cb665"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_transactions" DROP CONSTRAINT "FK_0f581511ac19ecb02dab437cd41"`,
    );
    await queryRunner.query(
      `ALTER TABLE "spec_options" DROP CONSTRAINT "FK_3d9c1e27aaf89b3af0bd7f5a86c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_addons" DROP CONSTRAINT "FK_2f041a59cfc5c4b85b2f04708d4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_spec_definitions" DROP CONSTRAINT "FK_1a4b929b0917d33189694524d16"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_spec_options" DROP CONSTRAINT "FK_9c8725d2a4ac15e6aebccd46eb3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_assignments" DROP CONSTRAINT "FK_eb8780ee78d268c9c7caaba11c5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_assignments" DROP CONSTRAINT "FK_3442216f1a3836b6e3a97c3e729"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rider_profiles" DROP CONSTRAINT "FK_eb61b4b5bcd3ad3a6c14f491dbb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tam_surveys" DROP CONSTRAINT "FK_db9e4037bc30f096c61f4216f10"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tam_surveys" DROP CONSTRAINT "FK_490a83859ac55fbb5fb7f0f9ac2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tam_surveys" DROP CONSTRAINT "FK_c544043144c124254b021f87cce"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tam_survey_requirements" DROP CONSTRAINT "FK_fc8b9dac04a68e774241c8fa63a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tam_survey_requirements" DROP CONSTRAINT "FK_a982c70d95c563586b3f216d59e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tam_survey_requirements" DROP CONSTRAINT "FK_8c05fd5ca6f32fa358468f2c6a3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_4880e77c6bc4b4dfe75112f5fcc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_822c5ebe47e43ebe715f68968c4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_dc0fe1df630904a0f2b33f2019b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_0488b9a93537f5a2c2c44b0f3a6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_a922b820eeef29ac1c6800e826a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_fd2ce99fdbb9f47a0dc4e1a76bf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_145532db85752b29c57d2b7b1f1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item_spec_values" DROP CONSTRAINT "FK_31133e139a046e8dd34f2b7954e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_destinations" DROP CONSTRAINT "FK_3614958c42ec48a09d4a482486c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "batch_orders" DROP CONSTRAINT "FK_685db1dc302b3049e8393747ac2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "batch_orders" DROP CONSTRAINT "FK_e797e11685069c11ba755052645"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_status_history" DROP CONSTRAINT "FK_1ca7d5228cf9dc589b60243933c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "addresses" DROP CONSTRAINT "FK_16aac8a9f6f9c1dd6bcb75ec023"`,
    );
    await queryRunner.query(`DROP TABLE "beta_mode_settings"`);
    await queryRunner.query(`DROP INDEX "public"."idx_chat_msg_conv_created"`);
    await queryRunner.query(`DROP TABLE "chat_messages"`);
    await queryRunner.query(
      `DROP TYPE "public"."chat_messages_sender_role_enum"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_conv_customer_status"`);
    await queryRunner.query(`DROP INDEX "public"."idx_conv_status_type"`);
    await queryRunner.query(`DROP TABLE "chat_conversations"`);
    await queryRunner.query(
      `DROP TYPE "public"."chat_conversations_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."chat_conversations_type_enum"`,
    );
    await queryRunner.query(`DROP TABLE "credit_settings"`);
    await queryRunner.query(`DROP TABLE "credit_transactions"`);
    await queryRunner.query(
      `DROP TYPE "public"."credit_transactions_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."credit_transactions_type_enum"`,
    );
    await queryRunner.query(`DROP TABLE "daily_grid_cards"`);
    await queryRunner.query(`DROP TABLE "delivery_settings"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_slot_booking_template_date"`,
    );
    await queryRunner.query(`DROP TABLE "delivery_slot_bookings"`);
    await queryRunner.query(`DROP TABLE "delivery_slot_templates"`);
    await queryRunner.query(`DROP TABLE "file_metadata"`);
    await queryRunner.query(`DROP INDEX "public"."idx_notifications_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_notifications_created"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TABLE "marketing_notifications"`);
    await queryRunner.query(`DROP TABLE "paper_specs"`);
    await queryRunner.query(`DROP TABLE "three_d_specs"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_payment_transactions_order"`,
    );
    await queryRunner.query(`DROP TABLE "payment_transactions"`);
    await queryRunner.query(`DROP TABLE "printer_profiles"`);
    await queryRunner.query(`DROP TABLE "spec_options"`);
    await queryRunner.query(`DROP TABLE "service_categories"`);
    await queryRunner.query(`DROP TABLE "service_addons"`);
    await queryRunner.query(`DROP TABLE "product_categories"`);
    await queryRunner.query(`DROP TABLE "product_spec_definitions"`);
    await queryRunner.query(`DROP TABLE "product_spec_options"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_delivery_assignments_order"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_delivery_assignments_rider"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_delivery_assignments_status"`,
    );
    await queryRunner.query(`DROP TABLE "delivery_assignments"`);
    await queryRunner.query(`DROP TYPE "public"."delivery_proof_type_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."delivery_assignments_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "support_tickets"`);
    await queryRunner.query(`DROP TYPE "public"."support_tickets_status_enum"`);
    await queryRunner.query(`DROP TABLE "rider_profiles"`);
    await queryRunner.query(`DROP TABLE "tam_surveys"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_tam_survey_requirements_user_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_tam_survey_requirements_order_reason"`,
    );
    await queryRunner.query(`DROP TABLE "tam_survey_requirements"`);
    await queryRunner.query(
      `DROP TYPE "public"."tam_survey_requirements_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."tam_survey_requirements_reason_enum"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_orders_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_orders_status"`);
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP TYPE "public"."orders_order_status_enum"`);
    await queryRunner.query(`DROP TABLE "order_items"`);
    await queryRunner.query(`DROP TABLE "order_item_spec_values"`);
    await queryRunner.query(`DROP INDEX "public"."idx_destination_batch"`);
    await queryRunner.query(`DROP TABLE "delivery_destinations"`);
    await queryRunner.query(`DROP TABLE "batch_orders"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_order_status_history_order"`,
    );
    await queryRunner.query(`DROP TABLE "order_status_history"`);
    await queryRunner.query(`DROP INDEX "public"."idx_addresses_user_id"`);
    await queryRunner.query(`DROP TABLE "addresses"`);
    await queryRunner.query(`DROP TABLE "tam_survey_settings"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(`DROP TYPE "public"."users_profile_field_enum"`);
    await queryRunner.query(`DROP TYPE "public"."users_profile_category_enum"`);
    await queryRunner.query(`DROP TYPE "public"."users_age_range_enum"`);
  }
}
