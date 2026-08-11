import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
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
  latitude: number;
  longitude: number;
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
    slug: "catalog-flyers-selected",
    actor: "mark",
    assertion: "Marketing group and Flyers leaf selected",
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
    slug: "mark-catalog-requirements",
    actor: "mark",
    assertion: "Mark catalog requirements completed",
  },
  {
    id: 10,
    slug: "mark-pinned-saved-address",
    actor: "mark",
    assertion: "Mark pinned address is saved and reusable",
  },
  {
    id: 11,
    slug: "rfq-pending-no-payment",
    actor: "mark",
    assertion: "Pending RFQ shows no payment control or fabricated zero price",
    axe: true,
  },
  {
    id: 12,
    slug: "mark-rfq-submitted",
    actor: "mark",
    assertion: "Mark receives a durable RFQ submission confirmation",
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
    assertion: "Mark accepts the real supplier quote before payment approval",
  },
  {
    id: 15,
    slug: "mark-production-progress",
    actor: "admin",
    assertion: "Mark passed payment approval, supplier production, and self-QC",
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
    assertion:
      "Juan assignment list includes the exact run Mark assignment before Ven exists",
    axe: true,
  },
  {
    id: 18,
    slug: "ven-quote-accepted",
    actor: "ven",
    assertion: "Ven registered after Mark and accepted the real supplier quote",
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
  "client_secret",
  "code",
  "id_token",
  "oauth_token",
  "oauth_verifier",
  "refresh_token",
  "token",
  "jwt",
  "authorization",
  "password",
  "secret",
  "x-amz-credential",
  "x-amz-security-token",
  "x-amz-signature",
]);

export type EvidenceSurfaceURLs = {
  mobileURL: string;
  adminURL: string;
  apiBaseURL: string;
};

export function configuredEvidenceOrigins(
  urls: EvidenceSurfaceURLs,
): ReadonlySet<string> {
  return new Set(
    [urls.mobileURL, urls.adminURL, urls.apiBaseURL].map(
      (value) => new URL(value).origin,
    ),
  );
}

export function requiredEvidenceNetworkIssues(
  network: ReadonlyArray<ActorNetworkEntry>,
  requiredOrigins: ReadonlySet<string>,
): {
  transportFailures: ActorNetworkEntry[];
  serverResponses: ActorNetworkEntry[];
} {
  const isRequiredOrigin = (entry: ActorNetworkEntry) => {
    try {
      return requiredOrigins.has(new URL(entry.url).origin);
    } catch {
      return false;
    }
  };
  const isNavigationMediaAbort = (entry: ActorNetworkEntry) =>
    entry.method === "GET" &&
    entry.failure === "net::ERR_ABORTED" &&
    /\.(?:mp3|m4a|ogg|wav)(?:[?#]|$)/i.test(entry.url);

  return {
    transportFailures: network.filter(
      (entry) =>
        Boolean(entry.failure) &&
        isRequiredOrigin(entry) &&
        !isNavigationMediaAbort(entry),
    ),
    serverResponses: network.filter(
      (entry) => (entry.status ?? 0) >= 500 && isRequiredOrigin(entry),
    ),
  };
}

export function sanitizeEvidenceText(
  value: string,
  protectedSecrets: ReadonlySet<string> = new Set(),
): string {
  let sanitized = value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(
      /(["']?(?:access_?token|token|jwt|authorization|password|secret)["']?\s*[=:]\s*["']?)[^"'\s&;,}]+/gi,
      "$1[REDACTED]",
    );
  for (const secret of protectedSecrets) {
    if (secret) sanitized = sanitized.split(secret).join("[REDACTED]");
  }
  return sanitized;
}

export function sanitizeEvidenceUrl(
  value: string,
  protectedSecrets: ReadonlySet<string> = new Set(),
): string {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (SECRET_QUERY_KEYS.has(key.toLowerCase()))
        url.searchParams.set(key, "[REDACTED]");
    }
    url.username = "";
    url.password = "";
    return sanitizeEvidenceText(url.toString(), protectedSecrets);
  } catch {
    return sanitizeEvidenceText(value, protectedSecrets);
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

export function canonicalEvidenceFile(step: BetaEvidenceStep): string {
  return `${String(step.id).padStart(2, "0")}-${step.slug}.png`;
}

export function assertCanonicalEvidenceComplete(
  entries: ReadonlyArray<{ stepId: number; file: string; sha256: string }>,
): void {
  const canonical = entries.filter((entry) => {
    const step = betaEvidenceSteps.find(
      (candidate) => candidate.id === entry.stepId,
    );
    return step != null && entry.file === canonicalEvidenceFile(step);
  });
  expect(
    canonical,
    "one canonical screenshot is required for every evidence step",
  ).toHaveLength(29);
  expect(
    new Set(canonical.map((entry) => entry.stepId)).size,
    "canonical step ids must be unique",
  ).toBe(29);
  expect(
    new Set(canonical.map((entry) => entry.sha256)).size,
    "canonical PNG hashes must be unique",
  ).toBe(29);
  for (const entry of canonical) {
    expect(entry.sha256, `step ${entry.stepId} SHA-256`).toMatch(
      /^[a-f0-9]{64}$/,
    );
  }
}

export function validateEvidenceViewport(
  actual: { width: number; height: number } | null,
  expected: { width: number; height: number },
): void {
  expect(actual, "exact actor viewport").toEqual(expected);
}

export type EvidenceRun = {
  runLabel: string;
  root: string;
  screenshotsDir: string;
  logsDir: string;
  manifestPath: string;
  entries: EvidenceManifestEntry[];
  protectedSecrets: Set<string>;
  artifacts: Array<{
    kind: "console" | "network" | "video";
    actor: BetaActorName;
    file: string;
    bytes: number;
    sha256: string;
  }>;
  requiredOrigins: ReadonlySet<string>;
};

export function generateVisualCustomerPassword(): string {
  return `${randomBytes(24).toString("base64url")}Aa1!`;
}

export function beginEvidenceRun(
  runLabel: string,
  surfaceURLs: EvidenceSurfaceURLs,
): EvidenceRun {
  const root = path.resolve(
    process.env.GRIDGO_BETA_EVIDENCE_DIR ??
      `/tmp/gridgo-beta-visual/${runLabel}`,
  );
  const screenshotsDir = path.join(root, "screenshots");
  const logsDir = path.join(root, "logs");
  for (const directory of [root, screenshotsDir, logsDir])
    mkdirSync(directory, { recursive: true });
  const run: EvidenceRun = {
    runLabel,
    root,
    screenshotsDir,
    logsDir,
    manifestPath: path.join(root, "manifest.json"),
    entries: [],
    protectedSecrets: new Set(),
    artifacts: [],
    requiredOrigins: configuredEvidenceOrigins(surfaceURLs),
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

export function registerEvidenceSecrets(
  run: EvidenceRun,
  secrets: ReadonlyArray<string | undefined>,
): void {
  for (const secret of secrets) {
    if (secret) run.protectedSecrets.add(secret);
  }
  flushManifest(run);
}

export function serializeEvidenceManifest(
  run: Pick<
    EvidenceRun,
    "runLabel" | "entries" | "artifacts" | "protectedSecrets"
  >,
): string {
  const serialized = `${JSON.stringify(
    {
      runLabel: run.runLabel,
      generatedAt: new Date().toISOString(),
      entries: run.entries,
      artifacts: run.artifacts,
    },
    null,
    2,
  )}\n`;
  if (
    /password|access_?token|\btoken\b|authorization|bearer\s/i.test(serialized)
  ) {
    throw new Error("Evidence manifest contains a credential marker");
  }
  for (const secret of run.protectedSecrets) {
    if (secret && serialized.includes(secret)) {
      throw new Error("Evidence manifest contains a protected credential");
    }
  }
  return serialized;
}

function flushManifest(run: EvidenceRun): void {
  writeFileSync(run.manifestPath, serializeEvidenceManifest(run), {
    mode: 0o600,
  });
}

export function recordEvidenceArtifact(
  run: EvidenceRun,
  kind: "console" | "network" | "video",
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
  expectedViewport: { width: number; height: number };
  allowBlockingDialog?: boolean;
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
    expectedViewport,
    allowBlockingDialog = false,
  } = options;
  // Flutter route transitions are painted on CanvasKit rather than exposed as
  // DOM animations. Background Chromium pages can also retain partially
  // presented GPU tiles, so foreground the actor and require two fresh frames
  // before an evidence frame is validated and captured.
  await page.bringToFront();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/^https?:\/\//);
  const title = await page.title();
  expect(title.trim(), "page title must identify the app").not.toBe("");
  await expect(page.locator("body")).not.toBeEmpty();
  await expect(page.locator("body")).not.toContainText(
    /Unexpected Application Error|Vite.*Internal Server Error|webpack.*error|Something went wrong|Unhandled Runtime Error/i,
  );
  await expect(
    page.locator(
      "vite-error-overlay, nextjs-portal, #webpack-dev-server-client-overlay",
    ),
  ).toHaveCount(0);
  const visibleCount = async (selector: string) => {
    let count = 0;
    for (const locator of await page.locator(selector).all()) {
      if (await locator.isVisible()) count += 1;
    }
    return count;
  };
  if (!allowBlockingDialog) {
    expect(
      await visibleCount('[role="dialog"], .ant-modal-wrap'),
      "no blocking dialog may obscure accepted evidence",
    ).toBe(0);
  }
  await expect
    .poll(
      () =>
        visibleCount(
          '[aria-busy="true"], .ant-spin-spinning, [role="progressbar"]:not([aria-valuenow])',
        ),
      { message: "accepted evidence loading state", timeout: 15_000 },
    )
    .toBe(0);
  await expect
    .poll(() => visibleCount(".ant-message-notice, .ant-notification-notice"), {
      message: "accepted evidence transient notifications",
      timeout: 15_000,
    })
    .toBe(0);
  expect(
    relevantConsoleErrors(console),
    "relevant browser console errors",
  ).toEqual([]);
  const requiredNetworkIssues = requiredEvidenceNetworkIssues(
    network,
    run.requiredOrigins,
  );
  expect(
    requiredNetworkIssues.transportFailures,
    "required app/API requests must not fail at transport level",
  ).toEqual([]);
  expect(
    requiredNetworkIssues.serverResponses,
    "required configured app/API requests must not return server errors",
  ).toEqual([]);
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow, "page must not overflow horizontally").toBeLessThanOrEqual(
    1,
  );
  validateEvidenceViewport(page.viewportSize(), expectedViewport);
  await assertState();

  let accessibility: EvidenceManifestEntry["accessibility"];
  // Signature/photo proof dialogs contain a live CanvasKit drawing surface.
  // Axe cannot inspect those pixels and can hang while Flutter continuously
  // mutates their transient semantics tree. The canonical post-submit frame
  // for the same step still runs the full Axe gate.
  if (step.axe && !allowBlockingDialog) {
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const axeViolationSummary = result.violations
      .filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical",
      )
      .map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          html: node.html,
          failureSummary: node.failureSummary,
        })),
      }));
    const serious = result.violations.filter(
      (violation) => violation.impact === "serious",
    ).length;
    const critical = result.violations.filter(
      (violation) => violation.impact === "critical",
    ).length;
    expect(
      { serious, critical },
      `Axe serious/critical violations: ${sanitizeEvidenceText(
        JSON.stringify(axeViolationSummary),
        run.protectedSecrets,
      )}`,
    ).toEqual({ serious: 0, critical: 0 });
    accessibility = {
      serious,
      critical,
      passes: result.passes.length,
      limitation:
        "Flutter CanvasKit pixels are not inspected by Axe; assertions cover the enabled Flutter semantics DOM.",
    };
  }

  const prefix = String(step.id).padStart(2, "0");
  const file = variant
    ? `${prefix}-${variant}.png`
    : canonicalEvidenceFile(step);
  const screenshotPath = path.join(run.screenshotsDir, file);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  const buffer = readFileSync(screenshotPath);
  const dimensions = pngDimensions(buffer);
  expect(dimensions).toEqual(expectedViewport);
  const entry: EvidenceManifestEntry = {
    stepId: step.id,
    actor,
    file,
    url: sanitizeEvidenceUrl(page.url(), run.protectedSecrets),
    title: sanitizeEvidenceText(title, run.protectedSecrets),
    sha256: createHash("sha256").update(buffer).digest("hex"),
    png: { ...dimensions, bytes: buffer.length },
    durableIds,
    assertionSummary: [step.assertion, ...(options.assertionSummary ?? [])].map(
      (summary) => sanitizeEvidenceText(summary, run.protectedSecrets),
    ),
    ...(accessibility ? { accessibility } : {}),
  };
  run.entries.push(entry);
  flushManifest(run);
  writeFileSync(
    path.join(run.logsDir, `${actor}-console.json`),
    `${sanitizeEvidenceText(
      JSON.stringify(console, null, 2),
      run.protectedSecrets,
    )}\n`,
    { mode: 0o600 },
  );
  writeFileSync(
    path.join(run.logsDir, `${actor}-network.json`),
    `${sanitizeEvidenceText(
      JSON.stringify(network, null, 2),
      run.protectedSecrets,
    )}\n`,
    { mode: 0o600 },
  );
  return entry;
}

export function evidenceStep(id: number): BetaEvidenceStep {
  const step = betaEvidenceSteps.find((candidate) => candidate.id === id);
  if (!step) throw new Error(`Unknown evidence step ${id}`);
  return step;
}
