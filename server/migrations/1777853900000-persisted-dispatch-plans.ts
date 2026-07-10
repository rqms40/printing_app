import { MigrationInterface, QueryRunner } from 'typeorm';
import { isBaselineOwned } from '../src/database/migration-ownership';

const PLAN_COLUMNS: Record<string, string[]> = {
  id: ['integer'],
  rider_id: ['integer'],
  version: ['integer'],
  status: ['enum'],
  origin_latitude: ['numeric'],
  origin_longitude: ['numeric'],
  provider: ['character varying', 'varchar'],
  profile: ['character varying', 'varchar'],
  total_duration_seconds: ['integer'],
  total_distance_meters: ['integer'],
  routing_data_stale: ['boolean'],
  planned_at: ['timestamp without time zone', 'timestamp'],
  superseded_at: ['timestamp without time zone', 'timestamp'],
  completed_at: ['timestamp without time zone', 'timestamp'],
  created_at: ['timestamp without time zone', 'timestamp'],
  updated_at: ['timestamp without time zone', 'timestamp'],
};

const STOP_COLUMNS: Record<string, string[]> = {
  id: ['integer'],
  plan_id: ['integer'],
  assignment_id: ['integer'],
  sequence: ['integer'],
  status: ['enum'],
  destination_latitude: ['numeric'],
  destination_longitude: ['numeric'],
  leg_duration_seconds: ['integer'],
  leg_distance_meters: ['integer'],
  leg_geometry: ['jsonb'],
  completed_at: ['timestamp without time zone', 'timestamp'],
  skipped_at: ['timestamp without time zone', 'timestamp'],
  created_at: ['timestamp without time zone', 'timestamp'],
  updated_at: ['timestamp without time zone', 'timestamp'],
};

const NULLABLE_COLUMNS = new Set([
  'superseded_at',
  'completed_at',
  'skipped_at',
]);

async function assertCompatibleTable(
  queryRunner: QueryRunner,
  tableName: string,
  requiredColumns: Record<string, string[]>,
): Promise<void> {
  const table = await queryRunner.getTable(tableName);
  if (!table) throw new Error(`Incompatible adopted ${tableName} table`);
  for (const [name, acceptedTypes] of Object.entries(requiredColumns)) {
    const column = table.findColumnByName(name);
    if (!column || !acceptedTypes.includes(column.type.toLowerCase())) {
      throw new Error(
        `Incompatible adopted ${tableName} table: expected ${name} (${acceptedTypes.join(' or ')})`,
      );
    }
    if (
      typeof column.isNullable === 'boolean' &&
      column.isNullable !== NULLABLE_COLUMNS.has(name)
    ) {
      throw new Error(
        `Incompatible adopted ${tableName} table: invalid nullability for ${name}`,
      );
    }
    if (
      name === 'status' &&
      Array.isArray(column.enum) &&
      (tableName === 'dispatch_plans'
        ? !['active', 'superseded', 'completed'].every((value) =>
            column.enum?.includes(value),
          )
        : !['pending', 'completed', 'skipped'].every((value) =>
            column.enum?.includes(value),
          ))
    ) {
      throw new Error(
        `Incompatible adopted ${tableName} table: invalid status enum`,
      );
    }
  }
}

export class PersistedDispatchPlans1777853900000 implements MigrationInterface {
  name = 'PersistedDispatchPlans1777853900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('dispatch_plans')) {
      await assertCompatibleTable(queryRunner, 'dispatch_plans', PLAN_COLUMNS);
    } else {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispatch_plan_status_enum') THEN
            CREATE TYPE "dispatch_plan_status_enum" AS ENUM ('active', 'superseded', 'completed');
          END IF;
        END $$
      `);
      await queryRunner.query(`
        CREATE TABLE "dispatch_plans" (
          "id" SERIAL NOT NULL,
          "rider_id" integer NOT NULL,
          "version" integer NOT NULL,
          "status" "dispatch_plan_status_enum" NOT NULL DEFAULT 'active',
          "origin_latitude" numeric(10,7) NOT NULL,
          "origin_longitude" numeric(10,7) NOT NULL,
          "provider" character varying(40) NOT NULL,
          "profile" character varying(40) NOT NULL,
          "total_duration_seconds" integer NOT NULL,
          "total_distance_meters" integer NOT NULL,
          "routing_data_stale" boolean NOT NULL DEFAULT false,
          "planned_at" TIMESTAMP NOT NULL,
          "superseded_at" TIMESTAMP,
          "completed_at" TIMESTAMP,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_dispatch_plans" PRIMARY KEY ("id"),
          CONSTRAINT "CHK_dispatch_plans_version" CHECK ("version" > 0),
          CONSTRAINT "CHK_dispatch_plans_origin" CHECK (
            "origin_latitude" BETWEEN -90 AND 90
            AND "origin_longitude" BETWEEN -180 AND 180
          ),
          CONSTRAINT "CHK_dispatch_plans_totals" CHECK (
            "total_duration_seconds" >= 0 AND "total_distance_meters" >= 0
          ),
          CONSTRAINT "FK_dispatch_plans_rider" FOREIGN KEY ("rider_id")
            REFERENCES "rider_profiles"("id") ON DELETE RESTRICT
        )
      `);
    }
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_dispatch_plans_rider' AND conrelid = '"dispatch_plans"'::regclass) THEN
          ALTER TABLE "dispatch_plans" ADD CONSTRAINT "FK_dispatch_plans_rider"
            FOREIGN KEY ("rider_id") REFERENCES "rider_profiles"("id") ON DELETE RESTRICT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_dispatch_plans_version' AND conrelid = '"dispatch_plans"'::regclass) THEN
          ALTER TABLE "dispatch_plans" ADD CONSTRAINT "CHK_dispatch_plans_version" CHECK ("version" > 0);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_dispatch_plans_origin' AND conrelid = '"dispatch_plans"'::regclass) THEN
          ALTER TABLE "dispatch_plans" ADD CONSTRAINT "CHK_dispatch_plans_origin" CHECK (
            "origin_latitude" BETWEEN -90 AND 90 AND "origin_longitude" BETWEEN -180 AND 180
          );
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_dispatch_plans_totals' AND conrelid = '"dispatch_plans"'::regclass) THEN
          ALTER TABLE "dispatch_plans" ADD CONSTRAINT "CHK_dispatch_plans_totals" CHECK (
            "total_duration_seconds" >= 0 AND "total_distance_meters" >= 0
          );
        END IF;
      END $$
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_dispatch_plans_rider_version"
        ON "dispatch_plans" ("rider_id", "version")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_dispatch_plans_rider_status"
        ON "dispatch_plans" ("rider_id", "status")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_dispatch_plans_active_rider"
        ON "dispatch_plans" ("rider_id") WHERE "status" = 'active'
    `);

    if (await queryRunner.hasTable('dispatch_plan_stops')) {
      await assertCompatibleTable(
        queryRunner,
        'dispatch_plan_stops',
        STOP_COLUMNS,
      );
    } else {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispatch_stop_status_enum') THEN
            CREATE TYPE "dispatch_stop_status_enum" AS ENUM ('pending', 'completed', 'skipped');
          END IF;
        END $$
      `);
      await queryRunner.query(`
        CREATE TABLE "dispatch_plan_stops" (
          "id" SERIAL NOT NULL,
          "plan_id" integer NOT NULL,
          "assignment_id" integer NOT NULL,
          "sequence" integer NOT NULL,
          "status" "dispatch_stop_status_enum" NOT NULL DEFAULT 'pending',
          "destination_latitude" numeric(10,7) NOT NULL,
          "destination_longitude" numeric(10,7) NOT NULL,
          "leg_duration_seconds" integer NOT NULL,
          "leg_distance_meters" integer NOT NULL,
          "leg_geometry" jsonb NOT NULL,
          "completed_at" TIMESTAMP,
          "skipped_at" TIMESTAMP,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_dispatch_plan_stops" PRIMARY KEY ("id"),
          CONSTRAINT "CHK_dispatch_plan_stops_sequence" CHECK ("sequence" > 0),
          CONSTRAINT "CHK_dispatch_plan_stops_destination" CHECK (
            "destination_latitude" BETWEEN -90 AND 90
            AND "destination_longitude" BETWEEN -180 AND 180
          ),
          CONSTRAINT "CHK_dispatch_plan_stops_leg" CHECK (
            "leg_duration_seconds" >= 0 AND "leg_distance_meters" >= 0
          ),
          CONSTRAINT "FK_dispatch_plan_stops_plan" FOREIGN KEY ("plan_id")
            REFERENCES "dispatch_plans"("id") ON DELETE CASCADE,
          CONSTRAINT "FK_dispatch_plan_stops_assignment" FOREIGN KEY ("assignment_id")
            REFERENCES "delivery_assignments"("id") ON DELETE RESTRICT
        )
      `);
    }
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_dispatch_plan_stops_plan' AND conrelid = '"dispatch_plan_stops"'::regclass) THEN
          ALTER TABLE "dispatch_plan_stops" ADD CONSTRAINT "FK_dispatch_plan_stops_plan"
            FOREIGN KEY ("plan_id") REFERENCES "dispatch_plans"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_dispatch_plan_stops_assignment' AND conrelid = '"dispatch_plan_stops"'::regclass) THEN
          ALTER TABLE "dispatch_plan_stops" ADD CONSTRAINT "FK_dispatch_plan_stops_assignment"
            FOREIGN KEY ("assignment_id") REFERENCES "delivery_assignments"("id") ON DELETE RESTRICT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_dispatch_plan_stops_sequence' AND conrelid = '"dispatch_plan_stops"'::regclass) THEN
          ALTER TABLE "dispatch_plan_stops" ADD CONSTRAINT "CHK_dispatch_plan_stops_sequence" CHECK ("sequence" > 0);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_dispatch_plan_stops_destination' AND conrelid = '"dispatch_plan_stops"'::regclass) THEN
          ALTER TABLE "dispatch_plan_stops" ADD CONSTRAINT "CHK_dispatch_plan_stops_destination" CHECK (
            "destination_latitude" BETWEEN -90 AND 90 AND "destination_longitude" BETWEEN -180 AND 180
          );
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_dispatch_plan_stops_leg' AND conrelid = '"dispatch_plan_stops"'::regclass) THEN
          ALTER TABLE "dispatch_plan_stops" ADD CONSTRAINT "CHK_dispatch_plan_stops_leg" CHECK (
            "leg_duration_seconds" >= 0 AND "leg_distance_meters" >= 0
          );
        END IF;
      END $$
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_dispatch_plan_stops_sequence"
        ON "dispatch_plan_stops" ("plan_id", "sequence")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_dispatch_plan_stops_assignment"
        ON "dispatch_plan_stops" ("plan_id", "assignment_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_dispatch_plan_stops_assignment"
        ON "dispatch_plan_stops" ("assignment_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await isBaselineOwned(queryRunner))) return;
    await queryRunner.query('DROP TABLE IF EXISTS "dispatch_plan_stops"');
    await queryRunner.query('DROP TABLE IF EXISTS "dispatch_plans"');
    await queryRunner.query('DROP TYPE IF EXISTS "dispatch_stop_status_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "dispatch_plan_status_enum"');
  }
}
