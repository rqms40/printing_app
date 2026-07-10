import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type {
  ActorConsoleEntry,
  ActorNetworkEntry,
  BetaActorName,
} from "./beta-actors";

export type DurableIds = Partial<{
  userId: number;
  fileId: number;
  addressId: number;
  orderId: number;
  orderRef: string;
  assignmentId: number;
  dispatchPlanId: number;
  dispatchPlanVersion: number;
  surveyRequirementId: number;
  testimonialFileId: number;
  betaRank: number;
  markOrderId: number;
  venOrderId: number;
  markAssignmentId: number;
  venAssignmentId: number;
}>;

export type BetaEvidenceStep = {
  id: number;
  slug: string;
  actor: BetaActorName;
  assertion: string;
  axe?: boolean;
};

export const betaEvidenceSteps: readonly BetaEvidenceStep[] = [
  {
    id: 1,
    slug: "admin-login-dashboard",
    actor: "admin",
    assertion: "Admin login and authenticated operations dashboard",
    axe: true,
  },
  {
    id: 2,
    slug: "beta-enabled",
    actor: "admin",
    assertion:
      "Beta disabled before toggle and enabled after confirmed UI action",
  },
  {
    id: 3,
    slug: "mark-registration",
    actor: "mark",
    assertion: "Mark registration completed through Flutter semantics",
    axe: true,
  },
  {
    id: 4,
    slug: "mark-profile",
    actor: "mark",
    assertion: "Mark profile details persisted",
  },
  {
    id: 5,
    slug: "mark-beta-credits",
    actor: "mark",
    assertion: "Mark beta number and 100 GRIDGO Credits visible",
  },
  {
    id: 6,
    slug: "mark-order-tutorial",
    actor: "mark",
    assertion: "Mark completed the order tutorial",
  },
  {
    id: 7,
    slug: "paper-print-selected",
    actor: "mark",
    assertion: "Paper-print category selected",
  },
  {
    id: 8,
    slug: "real-upload-preview",
    actor: "mark",
    assertion:
      "Real PNG upload returned a durable file id and preview is visible",
  },
  {
    id: 9,
    slug: "mark-paper-specifications",
    actor: "mark",
    assertion: "Mark paper specifications completed",
  },
  {
    id: 10,
    slug: "mark-pinned-saved-address",
    actor: "mark",
    assertion: "Mark pinned address is saved and reusable",
  },
  {
    id: 11,
    slug: "credits-only-payment",
    actor: "mark",
    assertion: "GRIDGO Credits is the only enabled beta payment option",
    axe: true,
  },
  {
    id: 12,
    slug: "mark-order-summary",
    actor: "mark",
    assertion: "Print and delivery mode summary matches checkout",
  },
  {
    id: 13,
    slug: "mark-order-placed",
    actor: "mark",
    assertion: "Mark order placement returned exact order id and reference",
  },
  {
    id: 14,
    slug: "mark-order-details",
    actor: "mark",
    assertion: "Mark order list and detail show the exact reference",
  },
  {
    id: 15,
    slug: "mark-production-progress",
    actor: "admin",
    assertion: "Mark progressed through every allowed production state",
  },
  {
    id: 16,
    slug: "mark-assigned-to-juan",
    actor: "admin",
    assertion: "Mark assignment to Juan returned a durable assignment id",
  },
  {
    id: 17,
    slug: "juan-sees-mark",
    actor: "juan",
    assertion: "Juan assignment list includes only the run's Mark assignment",
    axe: true,
  },
  {
    id: 18,
    slug: "ven-order-placed",
    actor: "ven",
    assertion: "Ven registered after Mark and placed a credits order",
  },
  {
    id: 19,
    slug: "ven-production-progress",
    actor: "admin",
    assertion: "Ven progressed through every allowed production state",
  },
  {
    id: 20,
    slug: "ven-assigned-to-juan",
    actor: "admin",
    assertion: "Ven assignment to Juan returned a durable assignment id",
  },
  {
    id: 21,
    slug: "juan-two-destination-dispatch-pickup",
    actor: "juan",
    assertion:
      "Juan accepted and picked up exactly Ven and Mark in the run plan",
  },
  {
    id: 22,
    slug: "osrm-ven-before-mark-plan",
    actor: "admin",
    assertion:
      "Persisted OSRM plan orders Ven before Mark and exposes exact plan/version ids",
  },
  {
    id: 23,
    slug: "ven-current-live-map",
    actor: "ven",
    assertion: "Ven is current and receives acknowledged live-map updates",
    axe: true,
  },
  {
    id: 24,
    slug: "mark-second-private-no-map",
    actor: "mark",
    assertion:
      "Mark is second with no assignment id, map, coordinates, or location-room access",
    axe: true,
  },
  {
    id: 25,
    slug: "ven-proof-accepted",
    actor: "juan",
    assertion: "Ven arrived and signature proof was durably accepted",
    axe: true,
  },
  {
    id: 26,
    slug: "mark-promoted-without-reload",
    actor: "mark",
    assertion: "Mark becomes current with map without page reload",
  },
  {
    id: 27,
    slug: "mark-proof-accepted",
    actor: "juan",
    assertion: "Mark arrived and signature proof was durably accepted",
    axe: true,
  },
  {
    id: 28,
    slug: "automatic-surveys",
    actor: "ven",
    assertion: "Both required 14-question surveys opened automatically",
    axe: true,
  },
  {
    id: 29,
    slug: "share-testimonial-held-beta-off-restored",
    actor: "mark",
    assertion:
      "Both share callbacks, testimonial photos, held logins, beta-off toggle, and restored logins succeeded",
    axe: true,
  },
];

const SECRET_QUERY_KEYS = new Set([
  "access_token",
  "token",
  "jwt",
  "authorization",
  "password",
  "secret",
]);

export function sanitizeEvidenceText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(
      /(["']?(?:access_?token|token|jwt|authorization|password|secret)["']?\s*[=:]\s*["']?)[^"'\s&;,}]+/gi,
      "$1[REDACTED]",
    );
}

export function sanitizeEvidenceUrl(value: string): string {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (SECRET_QUERY_KEYS.has(key.toLowerCase()))
        url.searchParams.set(key, "[REDACTED]");
    }
    url.username = "";
    url.password = "";
    return sanitizeEvidenceText(url.toString());
  } catch {
    return sanitizeEvidenceText(value);
  }
}

export type EvidenceManifestEntry = {
  stepId: number;
  actor: BetaActorName;
  file: string;
  url: string;
  title: string;
  sha256: string;
  png: { width: number; height: number; bytes: number };
  durableIds: DurableIds;
  assertionSummary: string[];
  accessibility?: {
    serious: number;
    critical: number;
    passes: number;
    limitation: string;
  };
};

export type EvidenceRun = {
  runId: string;
  root: string;
  screenshotsDir: string;
  logsDir: string;
  tracesDir: string;
  manifestPath: string;
  entries: EvidenceManifestEntry[];
  artifacts: Array<{
    kind: "console" | "network" | "trace" | "video";
    actor: BetaActorName;
    file: string;
    bytes: number;
    sha256: string;
  }>;
};

export function beginEvidenceRun(runId: string): EvidenceRun {
  const root = path.resolve(
    process.env.GRIDGO_BETA_EVIDENCE_DIR ?? `/tmp/gridgo-beta-visual/${runId}`,
  );
  const screenshotsDir = path.join(root, "screenshots");
  const logsDir = path.join(root, "logs");
  const tracesDir = path.join(root, "traces");
  for (const directory of [root, screenshotsDir, logsDir, tracesDir])
    mkdirSync(directory, { recursive: true });
  const run: EvidenceRun = {
    runId,
    root,
    screenshotsDir,
    logsDir,
    tracesDir,
    manifestPath: path.join(root, "manifest.json"),
    entries: [],
    artifacts: [],
  };
  flushManifest(run);
  return run;
}

function pngDimensions(buffer: Buffer): { width: number; height: number } {
  expect(
    buffer.subarray(1, 4).toString("ascii"),
    "screenshot must be PNG",
  ).toBe("PNG");
  expect(buffer.length, "screenshot must have nonzero bytes").toBeGreaterThan(
    1024,
  );
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function flushManifest(run: EvidenceRun): void {
  writeFileSync(
    run.manifestPath,
    `${JSON.stringify({ runId: run.runId, generatedAt: new Date().toISOString(), entries: run.entries, artifacts: run.artifacts }, null, 2)}\n`,
    { mode: 0o600 },
  );
}

export function recordEvidenceArtifact(
  run: EvidenceRun,
  kind: "console" | "network" | "trace" | "video",
  actor: BetaActorName,
  filePath: string,
): void {
  const buffer = readFileSync(filePath);
  expect(
    buffer.length,
    `${kind} artifact must have nonzero bytes`,
  ).toBeGreaterThan(0);
  const file = path.relative(run.root, filePath);
  const artifact = {
    kind,
    actor,
    file,
    bytes: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
  const index = run.artifacts.findIndex(
    (candidate) =>
      candidate.kind === kind &&
      candidate.actor === actor &&
      candidate.file === file,
  );
  if (index >= 0) run.artifacts[index] = artifact;
  else run.artifacts.push(artifact);
  flushManifest(run);
}

function relevantConsoleErrors(
  entries: ActorConsoleEntry[],
): ActorConsoleEntry[] {
  return entries.filter(
    (entry) =>
      ["error", "assert", "pageerror"].includes(entry.type) &&
      !/favicon\.ico|ERR_ABORTED.*(?:facebook|linkedin|twitter|x\.com)/i.test(
        entry.text,
      ),
  );
}

export async function captureStep(options: {
  run: EvidenceRun;
  page: Page;
  actor: BetaActorName;
  step: BetaEvidenceStep;
  console: ActorConsoleEntry[];
  network: ActorNetworkEntry[];
  durableIds?: DurableIds;
  variant?: string;
  assertionSummary?: string[];
  assertState: () => Promise<void>;
}): Promise<EvidenceManifestEntry> {
  const {
    run,
    page,
    actor,
    step,
    console,
    network,
    durableIds = {},
    variant,
    assertState,
  } = options;
  await expect(page).toHaveURL(/^https?:\/\//);
  const title = await page.title();
  expect(title.trim(), "page title must identify the app").not.toBe("");
  await expect(page.locator("body")).not.toBeEmpty();
  await expect(page.locator("body")).not.toContainText(
    /Unexpected Application Error|Vite.*Internal Server Error|webpack.*error/i,
  );
  expect(
    relevantConsoleErrors(console),
    "relevant browser console errors",
  ).toEqual([]);
  const requiredRequestFailures = network.filter(
    (entry) =>
      entry.failure &&
      /^https?:\/\/(?:127\.0\.0\.1|localhost)/.test(entry.url) &&
      !/facebook\.com|linkedin\.com|twitter\.com|x\.com/i.test(entry.url),
  );
  expect(
    requiredRequestFailures,
    "required app/API requests must not fail at transport level",
  ).toEqual([]);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow, "page must not overflow horizontally").toBeLessThanOrEqual(
    1,
  );
  await assertState();

  let accessibility: EvidenceManifestEntry["accessibility"];
  if (step.axe) {
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = result.violations.filter(
      (violation) => violation.impact === "serious",
    ).length;
    const critical = result.violations.filter(
      (violation) => violation.impact === "critical",
    ).length;
    expect({ serious, critical }, "Axe serious/critical violations").toEqual({
      serious: 0,
      critical: 0,
    });
    accessibility = {
      serious,
      critical,
      passes: result.passes.length,
      limitation:
        "Flutter CanvasKit pixels are not inspected by Axe; assertions cover the enabled Flutter semantics DOM.",
    };
  }

  const prefix = String(step.id).padStart(2, "0");
  const file = `${prefix}-${variant ?? step.slug}.png`;
  const screenshotPath = path.join(run.screenshotsDir, file);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const buffer = readFileSync(screenshotPath);
  const dimensions = pngDimensions(buffer);
  expect(dimensions.width).toBeGreaterThan(300);
  expect(dimensions.height).toBeGreaterThan(600);
  const entry: EvidenceManifestEntry = {
    stepId: step.id,
    actor,
    file,
    url: sanitizeEvidenceUrl(page.url()),
    title: sanitizeEvidenceText(title),
    sha256: createHash("sha256").update(buffer).digest("hex"),
    png: { ...dimensions, bytes: buffer.length },
    durableIds,
    assertionSummary: [step.assertion, ...(options.assertionSummary ?? [])].map(
      sanitizeEvidenceText,
    ),
    ...(accessibility ? { accessibility } : {}),
  };
  run.entries.push(entry);
  flushManifest(run);
  writeFileSync(
    path.join(run.logsDir, `${actor}-console.json`),
    `${JSON.stringify(console, null, 2)}\n`,
    { mode: 0o600 },
  );
  writeFileSync(
    path.join(run.logsDir, `${actor}-network.json`),
    `${JSON.stringify(network, null, 2)}\n`,
    { mode: 0o600 },
  );
  return entry;
}

export function evidenceStep(id: number): BetaEvidenceStep {
  const step = betaEvidenceSteps.find((candidate) => candidate.id === id);
  if (!step) throw new Error(`Unknown evidence step ${id}`);
  return step;
}
