import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type FlowActor = "admin" | "customer:mark" | "customer:ven" | "rider:juan";
type FlowSurface = "admin-web" | "mobile-customer" | "mobile-rider" | "api";

type BetaWorkflowStep = {
  id: number;
  actor: FlowActor;
  surface: FlowSurface;
  action: string;
  expected: string;
};

type RegressionIssue = {
  issue: number;
  title: string;
  affectedSteps: number[];
};

const betaWorkflowSteps: BetaWorkflowStep[] = [
  {
    id: 1,
    actor: "admin",
    surface: "admin-web",
    action: "Log in to the admin website.",
    expected: "Admin reaches the operations dashboard.",
  },
  {
    id: 2,
    actor: "admin",
    surface: "admin-web",
    action: "Open Beta Testing and enable beta testing.",
    expected: "Beta mode is enabled for new customer testers.",
  },
  {
    id: 3,
    actor: "customer:mark",
    surface: "mobile-customer",
    action: "Create a customer account.",
    expected: "Account is created without needing admin-only setup.",
  },
  {
    id: 4,
    actor: "customer:mark",
    surface: "mobile-customer",
    action: "Complete required profile details.",
    expected: "Customer profile is complete and can enter the ordering flow.",
  },
  {
    id: 5,
    actor: "customer:mark",
    surface: "api",
    action: "Verify beta tester enrollment and starting credits.",
    expected:
      "Customer is automatically assigned a beta number and 100 GRIDGO credits.",
  },
  {
    id: 6,
    actor: "customer:mark",
    surface: "mobile-customer",
    action: "Complete the order tutorial.",
    expected:
      "Tutorial does not block active delivery state later in the session.",
  },
  {
    id: 7,
    actor: "customer:mark",
    surface: "mobile-customer",
    action: "Choose paper print.",
    expected: "Paper print specs are shown before upload.",
  },
  {
    id: 8,
    actor: "customer:mark",
    surface: "mobile-customer",
    action: "Upload a file and open preview.",
    expected:
      "A real uploaded file metadata id is used and preview behavior is clear.",
  },
  {
    id: 9,
    actor: "customer:mark",
    surface: "mobile-customer",
    action: "Follow checkout and print-order steps.",
    expected: "Checkout can continue without invalid mock file metadata.",
  },
  {
    id: 10,
    actor: "customer:mark",
    surface: "mobile-customer",
    action: "Select and pin a delivery address.",
    expected:
      "Pinned address is usable for the order and saved to recent addresses.",
  },
  {
    id: 11,
    actor: "customer:mark",
    surface: "mobile-customer",
    action: "Select payment option.",
    expected: "Only GRIDGO Credits is available while beta mode is enabled.",
  },
  {
    id: 12,
    actor: "customer:mark",
    surface: "mobile-customer",
    action: "Select the best delivery/print mode.",
    expected: "Mode selection is visible and carried into checkout.",
  },
  {
    id: 13,
    actor: "customer:mark",
    surface: "mobile-customer",
    action: "Place the order.",
    expected: "Order is created with paid GRIDGO Credits status.",
  },
  {
    id: 14,
    actor: "customer:mark",
    surface: "mobile-customer",
    action: "Open order visibility after checkout.",
    expected: "Customer can see the placed order and current status.",
  },
  {
    id: 15,
    actor: "admin",
    surface: "admin-web",
    action: "Update Mark order production status.",
    expected:
      "Customer-facing status advances through the production pipeline.",
  },
  {
    id: 16,
    actor: "admin",
    surface: "admin-web",
    action: "Assign an available rider.",
    expected: "Rider Juan is assigned and the order enters dispatch workflow.",
  },
  {
    id: 17,
    actor: "rider:juan",
    surface: "mobile-rider",
    action: "Open rider assignments.",
    expected: "Juan sees the assigned Mark delivery.",
  },
  {
    id: 18,
    actor: "customer:ven",
    surface: "mobile-customer",
    action:
      "Register and repeat Mark's customer order flow through placing an order.",
    expected:
      "Ven receives beta credits, completes checkout, and has a visible order.",
  },
  {
    id: 19,
    actor: "admin",
    surface: "admin-web",
    action: "Update Ven order production status.",
    expected: "Ven order reaches ready-for-dispatch state.",
  },
  {
    id: 20,
    actor: "admin",
    surface: "admin-web",
    action: "Assign Ven order to Juan.",
    expected: "Juan has two active delivery stops.",
  },
  {
    id: 21,
    actor: "rider:juan",
    surface: "mobile-rider",
    action: "Dispatch from store with both delivery items.",
    expected: "Route is optimized by distance, not by order creation time.",
  },
  {
    id: 22,
    actor: "customer:ven",
    surface: "mobile-customer",
    action: "Open home while first in the route queue.",
    expected: "Ven sees first-in-queue state and live map/tracking.",
  },
  {
    id: 23,
    actor: "customer:mark",
    surface: "mobile-customer",
    action: "Open home while second in the route queue.",
    expected:
      "Mark sees second-in-queue state and no live map until he is next.",
  },
  {
    id: 24,
    actor: "rider:juan",
    surface: "mobile-rider",
    action: "Arrive at Ven and capture proof of delivery.",
    expected:
      "Signature or photo proof is required before delivery completion.",
  },
  {
    id: 25,
    actor: "customer:mark",
    surface: "mobile-customer",
    action: "Open home after Ven delivery completes.",
    expected: "Mark becomes current stop and map/tracking becomes available.",
  },
  {
    id: 26,
    actor: "rider:juan",
    surface: "mobile-rider",
    action: "Deliver to Mark and capture proof.",
    expected: "Signature or photo proof completes the second delivery.",
  },
  {
    id: 27,
    actor: "customer:ven",
    surface: "mobile-customer",
    action: "Open app after delivery completion.",
    expected: "Required beta survey appears automatically.",
  },
  {
    id: 28,
    actor: "customer:mark",
    surface: "mobile-customer",
    action: "Open app after delivery completion.",
    expected: "Required beta survey appears automatically.",
  },
  {
    id: 29,
    actor: "customer:mark",
    surface: "mobile-customer",
    action: "Submit survey and return to auth while beta is still enabled.",
    expected:
      "Share/photo wall is shown, then login is blocked with beta-held messaging until beta mode is off.",
  },
];

const regressionIssues: RegressionIssue[] = [
  {
    issue: 72,
    title:
      "Mobile web checkout submits mock upload with invalid fileMetadataId",
    affectedSteps: [8, 9, 13],
  },
  {
    issue: 73,
    title:
      "Batch order reference generation collides when refs are non-contiguous",
    affectedSteps: [13],
  },
  {
    issue: 74,
    title:
      "Beta mode registration should auto-enroll customer testers with 100 credits",
    affectedSteps: [3, 4, 5, 18],
  },
  {
    issue: 75,
    title:
      "Beta checkout should only allow GRIDGO Credits while beta mode is enabled",
    affectedSteps: [11],
  },
  {
    issue: 76,
    title:
      "Customer delivery tracking should show queue position and hide map access for later stops",
    affectedSteps: [21, 22, 23, 25],
  },
  {
    issue: 77,
    title:
      "Customer education overlays block active delivery status and tracking controls",
    affectedSteps: [6, 22, 23, 25],
  },
  {
    issue: 78,
    title: "Beta locked screen drops customer name after beta_held login",
    affectedSteps: [29],
  },
  {
    issue: 79,
    title:
      "Checkout pinned temporary address should be saved to recent addresses",
    affectedSteps: [10],
  },
];

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

test.describe("GRIDGO beta workflow regression contract", () => {
  test("records the complete admin, customer, and rider beta test flow", () => {
    expect(betaWorkflowSteps).toHaveLength(29);
    expect(betaWorkflowSteps.map((step) => step.id)).toEqual(
      Array.from({ length: 29 }, (_, index) => index + 1),
    );
    expect(new Set(betaWorkflowSteps.map((step) => step.actor))).toEqual(
      new Set<FlowActor>([
        "admin",
        "customer:mark",
        "customer:ven",
        "rider:juan",
      ]),
    );
    expect(new Set(betaWorkflowSteps.map((step) => step.surface))).toEqual(
      new Set<FlowSurface>([
        "admin-web",
        "mobile-customer",
        "mobile-rider",
        "api",
      ]),
    );
    expect(betaWorkflowSteps[0]).toMatchObject({
      actor: "admin",
      surface: "admin-web",
    });
    expect(betaWorkflowSteps[28].expected).toContain("login is blocked");
  });

  test("keeps audited regressions tied to GitHub issues", () => {
    expect(
      regressionIssues.map((gap) => gap.issue).sort((a, b) => a - b),
    ).toEqual([72, 73, 74, 75, 76, 77, 78, 79]);
    for (const gap of regressionIssues) {
      expect(gap.title).toBeTruthy();
      expect(gap.affectedSteps.length).toBeGreaterThan(0);
      for (const stepId of gap.affectedSteps) {
        expect(betaWorkflowSteps.some((step) => step.id === stepId)).toBe(true);
      }
    }
  });

  test("documents this regression flow in AGENTS.md", () => {
    const agentsGuide = readFileSync(path.join(repoRoot, "AGENTS.md"), "utf8");

    expect(agentsGuide).toContain("Beta Workflow Regression");
    expect(agentsGuide).toContain("e2e/mobile-web/tests/beta-workflow.spec.ts");
    expect(agentsGuide).toContain("GRIDGO_RUN_BETA_FLOW_E2E=1");
    expect(agentsGuide).toContain("GRIDGO_RUN_BETA_FLOW_DESTRUCTIVE=1");
    expect(agentsGuide).toContain("beta-workflow-destructive.spec.ts");
  });

  test("documents the beta workflow command in the mobile web E2E README", () => {
    const readme = readFileSync(
      path.join(repoRoot, "e2e/mobile-web/README.md"),
      "utf8",
    );

    expect(readme).toContain("Beta Workflow Regression");
    expect(readme).toContain("npm test -- tests/beta-workflow.spec.ts");
    expect(readme).toContain("GRIDGO_RUN_BETA_FLOW_E2E=1");
    expect(readme).toContain("GRIDGO_RUN_BETA_FLOW_DESTRUCTIVE=1");
    expect(readme).toContain("beta-workflow-destructive.spec.ts");
  });

  test("persists an optimized dispatch plan before asserting rider queue order", () => {
    const destructiveFlow = readFileSync(
      path.join(
        repoRoot,
        "e2e/mobile-web/tests/beta-workflow-destructive.spec.ts",
      ),
      "utf8",
    );

    expect(destructiveFlow).toContain("persist optimized dispatch plan");
    expect(destructiveFlow).toContain("assignmentIds:");
  });

  test("records social sharing only after testimonial evidence exists", () => {
    const destructiveFlow = readFileSync(
      path.join(
        repoRoot,
        "e2e/mobile-web/tests/beta-workflow-destructive.spec.ts",
      ),
      "utf8",
    );
    const testimonialIndex = destructiveFlow.indexOf(
      "submit beta testimonial for ${identity}",
    );
    const shareIndex = destructiveFlow.indexOf(
      "confirm persisted share after testimonial for ${identity}",
    );

    expect(testimonialIndex).toBeGreaterThan(-1);
    expect(shareIndex).toBeGreaterThan(testimonialIndex);
  });

  test("isolates Admin, Mark, Ven, and Juan as four trusted-proxy clients", () => {
    const destructiveFlow = readFileSync(
      path.join(
        repoRoot,
        "e2e/mobile-web/tests/beta-workflow-destructive.spec.ts",
      ),
      "utf8",
    );
    const visualActors = readFileSync(
      path.join(repoRoot, "e2e/mobile-web/fixtures/beta-actors.ts"),
      "utf8",
    );
    const actorAddresses = [
      "198.51.100.10",
      "198.51.100.20",
      "198.51.100.30",
      "198.51.100.40",
    ];

    for (const address of actorAddresses) {
      expect(destructiveFlow).toContain(address);
      expect(visualActors).toContain(address);
    }
    expect(destructiveFlow).toContain('"X-Forwarded-For"');
    expect(visualActors).toContain('"X-Forwarded-For"');
  });
});

test.describe("opt-in live beta workflow preflight", () => {
  test.skip(
    process.env.GRIDGO_RUN_BETA_FLOW_E2E !== "1",
    "Set GRIDGO_RUN_BETA_FLOW_E2E=1 against docker-compose.dev.yml to run live preflight checks.",
  );

  test("checks the dev stack surfaces before a destructive beta workflow run", async ({
    page,
    request,
  }) => {
    const apiBaseURL =
      process.env.GRIDGO_API_URL ?? "http://127.0.0.1:3000/api";

    const health = await request.get(`${apiBaseURL}/health`);
    expect(health.ok()).toBe(true);
    await expect(await health.json()).toMatchObject({
      status: "ok",
      database: "connected",
    });

    const betaStatus = await request.get(`${apiBaseURL}/beta-mode/status`);
    expect(betaStatus.ok()).toBe(true);
    expect(await betaStatus.json()).toMatchObject({
      isEnabled: expect.any(Boolean),
    });

    await page.goto("/");
    await expect(page).toHaveTitle("GRIDGO");
    await expect(page.getByText("DEV LOGIN", { exact: true })).toHaveCount(0);

    const adminURL = process.env.GRIDGO_ADMIN_URL ?? "http://127.0.0.1:8189";
    await page.setViewportSize({ width: 393, height: 727 });
    await page.goto(adminURL);
    await expect(page).toHaveTitle("GRIDGO Admin");
    await expect(page.getByPlaceholder("admin@gridgo.ph")).toHaveValue("");
    await expect(page.getByPlaceholder("Enter password")).toHaveValue("");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    test.info().annotations.push({
      type: "beta-workflow",
      description: betaWorkflowSteps
        .map((step) => `${step.id}. ${step.action}`)
        .join("\n"),
    });
  });
});
