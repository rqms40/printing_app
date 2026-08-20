import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Marketplace workflow contract (non-mutating by default).
 *
 * Documents the pilot happy path for Super Admin → Ops → Client → Supplier →
 * Rider → payout. Default CI mode only asserts this checklist + plan/README
 * presence — it does **not** require a live stack.
 *
 * Live / destructive runs (when implemented) should gate behind explicit env
 * flags, mirroring beta-workflow.spec.ts.
 */

type FlowActor =
  | "super_admin"
  | "ops_admin"
  | "client"
  | "supplier"
  | "rider";

type FlowSurface =
  | "admin-web"
  | "supplier-portal"
  | "mobile-client"
  | "mobile-supplier"
  | "mobile-rider"
  | "api";

type MarketplaceWorkflowStep = {
  id: number;
  actor: FlowActor;
  surface: FlowSurface;
  action: string;
  expected: string;
};

type KnownGap = {
  id: string;
  title: string;
  affectedSteps: number[];
};

const marketplaceWorkflowSteps: MarketplaceWorkflowStep[] = [
  {
    id: 1,
    actor: "super_admin",
    surface: "admin-web",
    action: "Verify supplier and rider accounts for the pilot cast.",
    expected:
      "Supplier and rider are verification-approved and eligible for assignment.",
  },
  {
    id: 2,
    actor: "ops_admin",
    surface: "admin-web",
    action: "Grant Pilot Credits to the client (grant-only ledger).",
    expected: "Client balance increases; no top-up / purchase path is used.",
  },
  {
    id: 3,
    actor: "client",
    surface: "mobile-client",
    action: "Submit a structured print order with artwork upload.",
    expected:
      "Order enters needs_qa (or submitted→needs_qa) with file metadata attached.",
  },
  {
    id: 4,
    actor: "ops_admin",
    surface: "admin-web",
    action: "Complete Ops QualityReview and approve artwork for matching.",
    expected:
      "Order is approved_for_matching; supplier never saw unapproved artwork.",
  },
  {
    id: 5,
    actor: "ops_admin",
    surface: "admin-web",
    action: "Match and assign a ranked supplier to the order.",
    expected:
      "Order is supplier_assigned with acceptance SLA / deadline recorded.",
  },
  {
    id: 6,
    actor: "supplier",
    surface: "supplier-portal",
    action: "Accept the job with committed price and production date.",
    expected:
      "Order advances to supplier_accepted / awaiting_payment as designed.",
  },
  {
    id: 7,
    actor: "ops_admin",
    surface: "admin-web",
    action:
      "Authorize payment with Pilot Credits (or eligible COD) after supplier accept.",
    expected:
      "payment_authorized; production remains gated until ops authorization.",
  },
  {
    id: 8,
    actor: "supplier",
    surface: "mobile-supplier",
    action: "Advance production milestones and upload self-QC evidence.",
    expected:
      "Order reaches ready_for_dispatch after supplier_self_qc with evidence.",
  },
  {
    id: 9,
    actor: "ops_admin",
    surface: "admin-web",
    action: "Dispatch order to an available verified rider.",
    expected:
      "rider_assigned; rider map shows the supplier pickup pin as the first stop, then the customer delivery.",
  },
  {
    id: 10,
    actor: "rider",
    surface: "mobile-rider",
    action: "Confirm pickup (OTP/proof gates) and start the active trip.",
    expected:
      "picked_up / out_for_delivery; rider map switches the active route to the customer; live tracking window opens after pickup only.",
  },
  {
    id: 11,
    actor: "rider",
    surface: "mobile-rider",
    action: "Deliver with proof of delivery (photo or signature).",
    expected:
      "delivered; 24-hour material issue window opens; tracking stops at terminal.",
  },
  {
    id: 12,
    actor: "ops_admin",
    surface: "api",
    action:
      "Close issue window with no claim (or hold payout if issue filed).",
    expected:
      "No issue → payout releasable; open issue → payout frozen until resolved.",
  },
];

/** Documented gaps for the skeleton — fill as live harness lands. */
const knownGaps: KnownGap[] = [
  {
    id: "live-preflight",
    title:
      "Opt-in live marketplace preflight against docker-compose is not wired yet",
    affectedSteps: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  },
  {
    id: "destructive-flag",
    title:
      "Destructive marketplace API workflow (GRIDGO_RUN_MARKETPLACE_FLOW_DESTRUCTIVE) not implemented",
    affectedSteps: [3, 7, 8, 10, 11, 12],
  },
  {
    id: "beta-coexistence",
    title:
      "Beta workflow contract remains until marketplace live path fully covers pilot",
    affectedSteps: [2, 7],
  },
];

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const marketplacePlanRel =
  "docs/superpowers/plans/2026-08-04-managed-marketplace-migration.md";

test.describe("GRIDGO marketplace workflow contract", () => {
  test("records the complete super/ops/client/supplier/rider pilot flow", () => {
    expect(marketplaceWorkflowSteps).toHaveLength(12);
    expect(marketplaceWorkflowSteps.map((step) => step.id)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    );
    expect(new Set(marketplaceWorkflowSteps.map((step) => step.actor))).toEqual(
      new Set<FlowActor>([
        "super_admin",
        "ops_admin",
        "client",
        "supplier",
        "rider",
      ]),
    );
    expect(
      new Set(marketplaceWorkflowSteps.map((step) => step.surface)),
    ).toEqual(
      new Set<FlowSurface>([
        "admin-web",
        "supplier-portal",
        "mobile-client",
        "mobile-supplier",
        "mobile-rider",
        "api",
      ]),
    );
    expect(marketplaceWorkflowSteps[0]).toMatchObject({
      actor: "super_admin",
      surface: "admin-web",
    });
    expect(marketplaceWorkflowSteps[11].expected.toLowerCase()).toContain(
      "payout",
    );
  });

  test("keeps known gaps tied to documented steps", () => {
    expect(knownGaps.map((gap) => gap.id).sort()).toEqual([
      "beta-coexistence",
      "destructive-flag",
      "live-preflight",
    ]);
    for (const gap of knownGaps) {
      expect(gap.title).toBeTruthy();
      expect(gap.affectedSteps.length).toBeGreaterThan(0);
      for (const stepId of gap.affectedSteps) {
        expect(
          marketplaceWorkflowSteps.some((step) => step.id === stepId),
        ).toBe(true);
      }
    }
  });

  test("documents marketplace acceptance steps in the migration plan", () => {
    const plan = readFileSync(path.join(repoRoot, marketplacePlanRel), "utf8");

    expect(plan).toContain("# Phase 11 — Testing harness");
    expect(plan).toContain("marketplace-workflow.spec.ts");
    expect(plan).toContain("Super verifies supplier + rider");
    expect(plan).toContain("Ops grants Pilot Credits");
    expect(plan).toContain("Supplier accept price/date");
    expect(plan).toContain("No issue → payout releasable");
  });

  test("documents the marketplace workflow command in the mobile web E2E README", () => {
    const readme = readFileSync(
      path.join(repoRoot, "e2e/mobile-web/README.md"),
      "utf8",
    );

    expect(readme).toContain("Marketplace Workflow Contract");
    expect(readme).toContain("npm test -- tests/marketplace-workflow.spec.ts");
    expect(readme).toContain("MOBILE_WEB_E2E_NO_SERVER=1");
  });

  test("keeps AGENTS.md development commands pointing at e2e surfaces", () => {
    const agentsGuide = readFileSync(path.join(repoRoot, "AGENTS.md"), "utf8");

    expect(agentsGuide).toContain("e2e/mobile-web");
    // Beta remains until full marketplace live harness lands (Phase 11 decision).
    expect(agentsGuide).toContain("Beta Workflow Regression");
    expect(agentsGuide).toContain("e2e/mobile-web/tests/beta-workflow.spec.ts");
  });

  test("default CI mode does not require a live stack", () => {
    // This file is the non-mutating contract. Live/destructive gates must not
    // run unless an explicit env flag is set (none are required here).
    expect(process.env.GRIDGO_RUN_MARKETPLACE_FLOW_E2E).toBeFalsy();
    expect(process.env.GRIDGO_RUN_MARKETPLACE_FLOW_DESTRUCTIVE).toBeFalsy();
    expect(marketplaceWorkflowSteps.length).toBeGreaterThan(0);
  });
});
