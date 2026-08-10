import { MigrationInterface, QueryRunner } from 'typeorm';
import { isBaselineOwned } from '../src/database/migration-ownership';

/**
 * Marketplace Phase 1 Task 1.3:
 * quality_reviews, supplier_assignments, issues, payouts,
 * cod_collections, audit_events.
 *
 * Money columns use bigint PHP minor units (centavos).
 */
export class MarketplaceCoreEntities1784333000000
  implements MigrationInterface
{
  name = 'MarketplaceCoreEntities1784333000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regtype('public.quality_reviews_decision_enum') IS NULL THEN
          CREATE TYPE "public"."quality_reviews_decision_enum" AS ENUM (
            'needs_correction',
            'proof_approval',
            'approved_for_matching',
            'blocked'
          );
        END IF;
        IF to_regtype('public.quality_reviews_risk_level_enum') IS NULL THEN
          CREATE TYPE "public"."quality_reviews_risk_level_enum" AS ENUM (
            'low',
            'medium',
            'high'
          );
        END IF;
        IF to_regtype('public.supplier_assignments_decision_enum') IS NULL THEN
          CREATE TYPE "public"."supplier_assignments_decision_enum" AS ENUM (
            'pending',
            'accepted',
            'declined',
            'expired',
            'cancelled'
          );
        END IF;
        IF to_regtype('public.issues_status_enum') IS NULL THEN
          CREATE TYPE "public"."issues_status_enum" AS ENUM (
            'open',
            'under_review',
            'resolved_refund',
            'resolved_reprint',
            'resolved_adjustment',
            'rejected',
            'closed'
          );
        END IF;
        IF to_regtype('public.issues_payout_impact_enum') IS NULL THEN
          CREATE TYPE "public"."issues_payout_impact_enum" AS ENUM (
            'none',
            'hold',
            'freeze',
            'release'
          );
        END IF;
        IF to_regtype('public.payouts_settlement_state_enum') IS NULL THEN
          CREATE TYPE "public"."payouts_settlement_state_enum" AS ENUM (
            'pending',
            'held',
            'released',
            'settled',
            'cancelled'
          );
        END IF;
        IF to_regtype('public.cod_collections_status_enum') IS NULL THEN
          CREATE TYPE "public"."cod_collections_status_enum" AS ENUM (
            'pending',
            'collected',
            'failed',
            'reconciled'
          );
        END IF;
      END $$;
    `);

    if (!(await queryRunner.hasTable('quality_reviews'))) {
      await queryRunner.query(`
        CREATE TABLE "quality_reviews" (
          "id" SERIAL NOT NULL,
          "order_id" integer NOT NULL,
          "reviewer_id" integer NOT NULL,
          "checklist_results" jsonb NOT NULL DEFAULT '{}',
          "decision" "public"."quality_reviews_decision_enum" NOT NULL,
          "risk_level" "public"."quality_reviews_risk_level_enum"
            NOT NULL DEFAULT 'low',
          "correction_request" text,
          "proof_required" boolean NOT NULL DEFAULT false,
          "evidence" jsonb,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_quality_reviews" PRIMARY KEY ("id"),
          CONSTRAINT "FK_quality_reviews_order_id"
            FOREIGN KEY ("order_id") REFERENCES "orders"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION,
          CONSTRAINT "FK_quality_reviews_reviewer_id"
            FOREIGN KEY ("reviewer_id") REFERENCES "users"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION
        )
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_quality_reviews_order_id"
          ON "quality_reviews" ("order_id")
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_quality_reviews_reviewer_id"
          ON "quality_reviews" ("reviewer_id")
      `);
    }

    if (!(await queryRunner.hasTable('supplier_assignments'))) {
      await queryRunner.query(`
        CREATE TABLE "supplier_assignments" (
          "id" SERIAL NOT NULL,
          "order_id" integer NOT NULL,
          "supplier_id" integer NOT NULL,
          "ranking_inputs" jsonb NOT NULL DEFAULT '{}',
          "rank_position" integer NOT NULL DEFAULT 1,
          "acceptance_deadline" TIMESTAMPTZ NOT NULL,
          "decision" "public"."supplier_assignments_decision_enum"
            NOT NULL DEFAULT 'pending',
          "decision_reason" text,
          "final_price_minor" bigint,
          "promised_date" TIMESTAMPTZ,
          "decided_at" TIMESTAMPTZ,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_supplier_assignments" PRIMARY KEY ("id"),
          CONSTRAINT "FK_supplier_assignments_order_id"
            FOREIGN KEY ("order_id") REFERENCES "orders"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION,
          CONSTRAINT "FK_supplier_assignments_supplier_id"
            FOREIGN KEY ("supplier_id") REFERENCES "supplier_profiles"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION
        )
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_supplier_assignments_order_id"
          ON "supplier_assignments" ("order_id")
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_supplier_assignments_supplier_id"
          ON "supplier_assignments" ("supplier_id")
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_supplier_assignments_decision"
          ON "supplier_assignments" ("decision")
      `);
    }

    if (!(await queryRunner.hasTable('issues'))) {
      await queryRunner.query(`
        CREATE TABLE "issues" (
          "id" SERIAL NOT NULL,
          "order_id" integer NOT NULL,
          "category" character varying(80) NOT NULL,
          "evidence" jsonb NOT NULL DEFAULT '[]',
          "deadline" TIMESTAMPTZ,
          "status" "public"."issues_status_enum" NOT NULL DEFAULT 'open',
          "payout_impact" "public"."issues_payout_impact_enum"
            NOT NULL DEFAULT 'hold',
          "refund_amount_minor" bigint,
          "adjustment_amount_minor" bigint,
          "opened_by_user_id" integer NOT NULL,
          "resolved_by_user_id" integer,
          "resolution_notes" text,
          "within_window" boolean NOT NULL DEFAULT true,
          "opened_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "resolved_at" TIMESTAMPTZ,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_issues" PRIMARY KEY ("id"),
          CONSTRAINT "FK_issues_order_id"
            FOREIGN KEY ("order_id") REFERENCES "orders"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION,
          CONSTRAINT "FK_issues_opened_by_user_id"
            FOREIGN KEY ("opened_by_user_id") REFERENCES "users"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION,
          CONSTRAINT "FK_issues_resolved_by_user_id"
            FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION
        )
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_issues_order_id" ON "issues" ("order_id")
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_issues_status" ON "issues" ("status")
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_issues_opened_by" ON "issues" ("opened_by_user_id")
      `);
    }

    if (!(await queryRunner.hasTable('payouts'))) {
      await queryRunner.query(`
        CREATE TABLE "payouts" (
          "id" SERIAL NOT NULL,
          "supplier_id" integer NOT NULL,
          "order_id" integer NOT NULL,
          "gross_minor" bigint NOT NULL,
          "commission_minor" bigint NOT NULL,
          "net_minor" bigint NOT NULL,
          "hold_reason" text,
          "hold_expires_at" TIMESTAMPTZ,
          "release_authority_id" integer,
          "settlement_state" "public"."payouts_settlement_state_enum"
            NOT NULL DEFAULT 'pending',
          "settlement_reference" character varying(255),
          "released_at" TIMESTAMPTZ,
          "settled_at" TIMESTAMPTZ,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_payouts" PRIMARY KEY ("id"),
          CONSTRAINT "FK_payouts_supplier_id"
            FOREIGN KEY ("supplier_id") REFERENCES "supplier_profiles"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION,
          CONSTRAINT "FK_payouts_order_id"
            FOREIGN KEY ("order_id") REFERENCES "orders"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION,
          CONSTRAINT "FK_payouts_release_authority_id"
            FOREIGN KEY ("release_authority_id") REFERENCES "users"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION
        )
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_payouts_order_id" ON "payouts" ("order_id")
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_payouts_supplier_id" ON "payouts" ("supplier_id")
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_payouts_settlement_state"
          ON "payouts" ("settlement_state")
      `);
    }

    if (!(await queryRunner.hasTable('cod_collections'))) {
      await queryRunner.query(`
        CREATE TABLE "cod_collections" (
          "id" SERIAL NOT NULL,
          "order_id" integer NOT NULL,
          "rider_id" integer,
          "eligible" boolean NOT NULL DEFAULT false,
          "eligibility_reason" text,
          "amount_minor" bigint NOT NULL,
          "status" "public"."cod_collections_status_enum"
            NOT NULL DEFAULT 'pending',
          "otp_ref" character varying(255),
          "photo_file_id" integer,
          "receipt_refs" jsonb,
          "collected_at" TIMESTAMPTZ,
          "failed_at" TIMESTAMPTZ,
          "reconciled_at" TIMESTAMPTZ,
          "reconciled_by_user_id" integer,
          "discrepancy_reason" text,
          "return_reason" text,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_cod_collections" PRIMARY KEY ("id"),
          CONSTRAINT "FK_cod_collections_order_id"
            FOREIGN KEY ("order_id") REFERENCES "orders"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION,
          CONSTRAINT "FK_cod_collections_rider_id"
            FOREIGN KEY ("rider_id") REFERENCES "rider_profiles"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION,
          CONSTRAINT "FK_cod_collections_reconciled_by_user_id"
            FOREIGN KEY ("reconciled_by_user_id") REFERENCES "users"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION
        )
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_cod_collections_order_id"
          ON "cod_collections" ("order_id")
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_cod_collections_rider_id"
          ON "cod_collections" ("rider_id")
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_cod_collections_status"
          ON "cod_collections" ("status")
      `);
    }

    if (!(await queryRunner.hasTable('audit_events'))) {
      await queryRunner.query(`
        CREATE TABLE "audit_events" (
          "id" SERIAL NOT NULL,
          "actor_id" integer,
          "actor_role" character varying(40),
          "action" character varying(80) NOT NULL,
          "entity_type" character varying(80) NOT NULL,
          "entity_id" character varying(64) NOT NULL,
          "order_id" integer,
          "from_state" character varying(60),
          "to_state" character varying(60),
          "reason" text,
          "metadata" jsonb NOT NULL DEFAULT '{}',
          "idempotency_key" character varying(255),
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_audit_events" PRIMARY KEY ("id"),
          CONSTRAINT "FK_audit_events_actor_id"
            FOREIGN KEY ("actor_id") REFERENCES "users"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION,
          CONSTRAINT "FK_audit_events_order_id"
            FOREIGN KEY ("order_id") REFERENCES "orders"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION
        )
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_audit_events_entity"
          ON "audit_events" ("entity_type", "entity_id")
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_audit_events_order_id"
          ON "audit_events" ("order_id")
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_audit_events_actor_id"
          ON "audit_events" ("actor_id")
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_audit_events_action"
          ON "audit_events" ("action")
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX "uq_audit_events_idempotency_key"
          ON "audit_events" ("idempotency_key")
          WHERE "idempotency_key" IS NOT NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await isBaselineOwned(queryRunner))) return;

    await queryRunner.query(`DROP TABLE IF EXISTS "audit_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cod_collections"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payouts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "issues"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "supplier_assignments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "quality_reviews"`);

    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."cod_collections_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."payouts_settlement_state_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."issues_payout_impact_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."issues_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."supplier_assignments_decision_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."quality_reviews_risk_level_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."quality_reviews_decision_enum"`,
    );
  }
}
