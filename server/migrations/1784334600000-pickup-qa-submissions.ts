import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pickup QA checklist submissions from suppliers and riders
 * (physical gate before ready-for-dispatch / picked_up).
 */
export class PickupQaSubmissions1784334600000 implements MigrationInterface {
  name = 'PickupQaSubmissions1784334600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('pickup_qa_submissions')) {
      return;
    }

    await queryRunner.query(`
      CREATE TABLE "pickup_qa_submissions" (
        "id" SERIAL PRIMARY KEY,
        "order_id" integer NOT NULL
          REFERENCES "orders"("id") ON DELETE CASCADE,
        "actor_role" varchar(20) NOT NULL,
        "actor_user_id" integer NOT NULL
          REFERENCES "users"("id") ON DELETE CASCADE,
        "supplier_assignment_id" integer NULL,
        "delivery_assignment_id" integer NULL,
        "checklist_results" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "notes" text NULL,
        "evidence_file_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_pickup_qa_order_id"
      ON "pickup_qa_submissions" ("order_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_pickup_qa_actor_role"
      ON "pickup_qa_submissions" ("actor_role")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_pickup_qa_created_at"
      ON "pickup_qa_submissions" ("created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('pickup_qa_submissions'))) {
      return;
    }
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_pickup_qa_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_pickup_qa_actor_role"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_pickup_qa_order_id"`);
    await queryRunner.query(`DROP TABLE "pickup_qa_submissions"`);
  }
}
