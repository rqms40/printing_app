import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
  type Response,
} from "@playwright/test";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  betaActors,
  closeBetaActorContexts,
  createBetaActorContexts,
  enableFlutterSemantics,
  type BetaActorRuntime,
} from "../fixtures/beta-actors";
import {
  assertAddressWithinTolerance,
  assertExpectedPrivacyDenial,
  assertLocationPrivacyDenied,
  authenticatedGet,
  onlyRunAssignments,
  orderIdentity,
  positiveId,
  setAcknowledgedGeolocation,
  strictBrowserJson,
  strictJson,
  surveyQuestionIndexes,
  validateLocationEvidence,
  validatePersistedDispatchPlan,
  validateSurveySubmission,
  waitForStrict2xx,
  type AssignmentRecord,
  type JsonRecord,
} from "../fixtures/beta-api";
import {
  beginEvidenceRun,
  assertCanonicalEvidenceComplete,
  betaEvidenceSteps,
  captureStep,
  evidenceStep,
  canonicalEvidenceFile,
  recordEvidenceArtifact,
  registerEvidenceSecrets,
  sanitizeEvidenceText,
  validateEvidenceViewport,
  generateVisualCustomerPassword,
  serializeEvidenceManifest,
  type DurableIds,
  type EvidenceRun,
} from "../fixtures/beta-evidence";
import {
  betaAddresses,
  betaCheckpoint,
  betaRouteCheckpoints,
} from "../fixtures/beta-locations";

test.describe("GRIDGO visual beta workflow harness contract", () => {
  test("defines four actors and all evidence steps", () => {
    expect(Object.keys(betaActors).sort()).toEqual([
      "admin",
      "juan",
      "mark",
      "ven",
    ]);
    expect(betaEvidenceSteps.map((step) => step.id)).toEqual(
      Array.from({ length: 29 }, (_, index) => index + 1),
    );
  });

  test("keeps independent release viewports and Juan geolocation permissions", () => {
    expect(betaActors.admin).toMatchObject({
      role: "admin",
      viewport: { width: 1440, height: 900 },
    });
    for (const actor of [betaActors.mark, betaActors.ven, betaActors.juan]) {
      expect(actor.viewport).toEqual({ width: 393, height: 852 });
    }
    expect(betaActors.juan.permissions).toContain("geolocation");
    expect(
      new Set(Object.values(betaActors).map((actor) => actor.storageKey)).size,
    ).toBe(4);
  });

  test("preserves the approved evidence meanings for steps 21 through 29", () => {
    expect(
      betaEvidenceSteps.slice(20).map(({ id, slug }) => `${id}-${slug}`),
    ).toEqual([
      "21-juan-two-destination-dispatch-pickup",
      "22-osrm-ven-before-mark-plan",
      "23-ven-current-live-map",
      "24-mark-second-private-no-map",
      "25-ven-proof-accepted",
      "26-mark-promoted-without-reload",
      "27-mark-proof-accepted",
      "28-automatic-surveys",
      "29-share-testimonial-held-beta-off-restored",
    ]);
    expect(
      betaEvidenceSteps.filter((step) => step.axe).map((step) => step.id),
    ).toEqual(expect.arrayContaining([1, 11, 23, 24, 25, 28, 29]));
  });

  test("defines the five deterministic acknowledged geolocation checkpoints", () => {
    expect(betaRouteCheckpoints.map((checkpoint) => checkpoint.id)).toEqual([
      "store",
      "road-to-ven",
      "ven",
      "road-to-mark",
      "mark",
    ]);
    for (const checkpoint of betaRouteCheckpoints) {
      expect(checkpoint.latitude).toBeGreaterThan(6);
      expect(checkpoint.longitude).toBeGreaterThan(124);
      expect(checkpoint.accuracy).toBeGreaterThan(0);
    }
  });

  test("sanitizes tokens, credentials, and tokenized URLs from evidence", () => {
    const rawPassword = "independent-raw-password-Aa1!";
    const sanitized = sanitizeEvidenceText(
      `Bearer abc.def.ghi password=hunter2 {"access_token":"json-secret"} https://grid.test/x?access_token=top-secret&safe=ok ${rawPassword}`,
      new Set([rawPassword]),
    );
    expect(sanitized).not.toContain("abc.def.ghi");
    expect(sanitized).not.toContain("hunter2");
    expect(sanitized).not.toContain("top-secret");
    expect(sanitized).not.toContain("json-secret");
    expect(sanitized).not.toContain(rawPassword);
    expect(sanitized).toContain("[REDACTED]");
    expect(sanitized).toContain("safe=ok");
  });

  test("keeps credentials independent from the run label and out of manifests", () => {
    const runLabel = randomUUID();
    const markPassword = generateVisualCustomerPassword();
    const venPassword = generateVisualCustomerPassword();
    expect(markPassword).not.toBe(venPassword);
    expect(markPassword).not.toContain(runLabel);
    expect(venPassword).not.toContain(runLabel);
    expect(markPassword).not.toBe(`BetaVisual-Mark-${runLabel}!`);
    expect(venPassword).not.toBe(`BetaVisual-Ven-${runLabel}!`);

    const serialized = serializeEvidenceManifest({
      runLabel,
      entries: [],
      artifacts: [],
      protectedSecrets: new Set([
        markPassword,
        venPassword,
        "admin-secret",
        "rider-secret",
        "access-token-value",
      ]),
    });
    for (const secret of [
      markPassword,
      venPassword,
      "admin-secret",
      "rider-secret",
      "access-token-value",
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(serialized).not.toMatch(
      /password|access_?token|\btoken\b|authorization|bearer\s/i,
    );
    for (const forbiddenPayload of [
      "password=unsafe",
      "token=unsafe",
      "access_token=unsafe",
      "Authorization: unsafe",
      "Bearer unsafe",
    ]) {
      expect(() =>
        serializeEvidenceManifest({
          runLabel: forbiddenPayload,
          entries: [],
          artifacts: [],
          protectedSecrets: new Set(),
        }),
      ).toThrow();
    }
    expect(() =>
      serializeEvidenceManifest({
        runLabel: markPassword,
        entries: [],
        artifacts: [],
        protectedSecrets: new Set([markPassword]),
      }),
    ).toThrow();
  });

  test("scrubs a bare registration token even when the next flow action throws", () => {
    const protectedSecrets = new Set<string>();
    const bareToken = "bare-registration-token-without-a-label";
    expect(() => {
      protectedSecrets.add(bareToken);
      throw new Error("order flow failed before its first capture");
    }).toThrow("order flow failed");
    expect(
      sanitizeEvidenceText(`console emitted ${bareToken}`, protectedSecrets),
    ).not.toContain(bareToken);
  });

  test("publishes the visual command, dependencies, fixture, and operator docs", () => {
    const e2eRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
    );
    const repoRoot = path.resolve(e2eRoot, "../..");
    const packageJson = JSON.parse(
      readFileSync(path.join(e2eRoot, "package.json"), "utf8"),
    ) as {
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(packageJson.scripts["test:beta:visual"]).toContain(
      "beta-workflow-visual.spec.ts",
    );
    expect(packageJson.devDependencies).toHaveProperty("@axe-core/playwright");
    expect(packageJson.devDependencies["socket.io-client"]).toBeTruthy();
    expect(
      statSync(path.join(e2eRoot, "fixtures/beta-upload.png")).size,
    ).toBeGreaterThan(4_096);
    const config = readFileSync(
      path.join(e2eRoot, "playwright.config.ts"),
      "utf8",
    );
    const visualSource = readFileSync(
      path.join(e2eRoot, "tests/beta-workflow-visual.spec.ts"),
      "utf8",
    );
    expect(config).toContain('trace: visualWorkflow ? "off"');
    const manualTracingApi = ["context", "tracing", ""].join(".");
    expect(visualSource).not.toContain(manualTracingApi);
    const liveAssertion = visualSource.slice(
      visualSource.lastIndexOf("async function assertLiveTrackingUi"),
      visualSource.lastIndexOf("async function assertPrivateQueueUi"),
    );
    expect(liveAssertion).toContain('getByLabel("Live delivery map"');
    expect(liveAssertion).toContain(
      'getByLabel("Rider current location marker"',
    );
    expect(liveAssertion).not.toContain('locator("canvas")');
    expect(liveAssertion).not.toContain("actor.network.some");
    const privateAssertion = visualSource.slice(
      visualSource.lastIndexOf("async function assertPrivateQueueUi"),
      visualSource.lastIndexOf("async function loginAdmin"),
    );
    expect(privateAssertion).toContain('getByLabel("Live delivery map"');
    expect(privateAssertion).toContain(
      'getByLabel("Rider current location marker"',
    );
    const registrationFlow = visualSource.slice(
      visualSource.lastIndexOf("async function registerCustomerThroughUi"),
      visualSource.lastIndexOf("async function saveAddressThroughUi"),
    );
    const registrationResponse = registrationFlow.indexOf(
      "const auth = await waitForStrict2xx<AuthPayload>",
    );
    const tokenRegistration = registrationFlow.indexOf(
      "registerEvidenceSecrets(run, [auth.access_token]);",
    );
    const betaLookup = registrationFlow.indexOf(
      "const beta = await strictJson",
    );
    expect(registrationResponse).toBeGreaterThanOrEqual(0);
    expect(tokenRegistration).toBeGreaterThan(registrationResponse);
    expect(tokenRegistration).toBeLessThan(betaLookup);
    const captureHelper = visualSource.slice(
      visualSource.lastIndexOf("async function capture("),
      visualSource.lastIndexOf("async function assertLiveTrackingUi"),
    );
    expect(captureHelper).not.toContain("[11, 25, 27].includes(id)");
    expect(captureHelper).toContain("allowBlockingDialog = false");
    for (const file of [
      path.join(e2eRoot, "README.md"),
      path.join(repoRoot, "AGENTS.md"),
    ]) {
      const docs = readFileSync(file, "utf8");
      expect(docs).toContain("GRIDGO_RUN_BETA_FLOW_VISUAL=1");
      expect(docs).toContain("npm run test:beta:visual");
    }
    expect(readFileSync(path.join(e2eRoot, "README.md"), "utf8")).toContain(
      "traces are deliberately disabled",
    );
  });

  test("accepts only the intended later-stop privacy denial", () => {
    expect(() =>
      assertExpectedPrivacyDenial(
        "Live tracking is not available for this stop",
      ),
    ).not.toThrow();
    for (const looseFailure of [
      "Unauthorized",
      "Delivery not found",
      "Forbidden",
    ]) {
      expect(() => assertExpectedPrivacyDenial(looseFailure)).toThrow();
    }
  });

  test("requires exact assignment and plan identity on every GPS acknowledgement", () => {
    expect(() =>
      validateLocationEvidence(
        {
          assignmentId: "202",
          planVersion: 7,
          latitude: betaAddresses.ven.latitude,
          longitude: betaAddresses.ven.longitude,
        },
        {
          assignmentId: 202,
          planVersion: 7,
          checkpoint: betaCheckpoint("ven"),
        },
      ),
    ).not.toThrow();
    expect(() =>
      validateLocationEvidence(
        {
          latitude: betaAddresses.ven.latitude,
          longitude: betaAddresses.ven.longitude,
        },
        {
          assignmentId: 202,
          planVersion: 7,
          checkpoint: betaCheckpoint("ven"),
        },
      ),
    ).toThrow();
  });

  test("requires a persisted positive OSRM Ven then Mark plan", () => {
    const plan = {
      id: 91,
      version: 3,
      provider: "osrm",
      total_duration_seconds: 420,
      total_distance_meters: 3100,
      stops: [
        {
          assignment_id: 22,
          sequence: 1,
          leg_duration_seconds: 120,
          leg_distance_meters: 700,
          leg_geometry: {
            type: "LineString",
            coordinates: [
              [125.6079, 7.064],
              [125.6082, 7.0645],
            ],
          },
        },
        {
          assignment_id: 11,
          sequence: 2,
          leg_duration_seconds: 300,
          leg_distance_meters: 2400,
          leg_geometry: {
            type: "LineString",
            coordinates: [
              [125.6082, 7.0645],
              [125.6128, 7.0731],
            ],
          },
        },
      ],
    };
    expect(() =>
      validatePersistedDispatchPlan(plan, {
        venAssignmentId: 22,
        markAssignmentId: 11,
      }),
    ).not.toThrow();
    expect(() =>
      validatePersistedDispatchPlan(
        { ...plan, provider: "fallback" },
        { venAssignmentId: 22, markAssignmentId: 11 },
      ),
    ).toThrow();
  });

  test("requires verified UI pin coordinates within tolerance", () => {
    expect(() =>
      assertAddressWithinTolerance(
        {
          latitude: betaAddresses.ven.latitude,
          longitude: betaAddresses.ven.longitude,
        },
        betaAddresses.ven,
      ),
    ).not.toThrow();
    expect(() =>
      assertAddressWithinTolerance(
        {
          latitude: betaAddresses.mark.latitude,
          longitude: betaAddresses.mark.longitude,
        },
        betaAddresses.ven,
      ),
    ).toThrow();
  });

  test("requires all 14 survey indexes and the exact requirement response", () => {
    expect(surveyQuestionIndexes).toEqual(
      Array.from({ length: 14 }, (_, index) => index),
    );
    expect(() =>
      validateSurveySubmission(
        { requirementId: 81, success: true },
        { requirementId: 81, answeredIndexes: surveyQuestionIndexes },
      ),
    ).not.toThrow();
    expect(() =>
      validateSurveySubmission(
        { requirementId: 82, success: true },
        {
          requirementId: 81,
          answeredIndexes: surveyQuestionIndexes.slice(0, 13),
        },
      ),
    ).toThrow();
  });

  test("requires one unique canonical screenshot and hash for every step", () => {
    const canonical = betaEvidenceSteps.map((step) => ({
      stepId: step.id,
      file: canonicalEvidenceFile(step),
      sha256: String(step.id).padStart(64, "0"),
    }));
    expect(() => assertCanonicalEvidenceComplete(canonical)).not.toThrow();
    expect(() => assertCanonicalEvidenceComplete(canonical.slice(1))).toThrow();
    expect(() =>
      assertCanonicalEvidenceComplete(
        canonical.map((entry, index) =>
          index === 1 ? { ...entry, sha256: canonical[0].sha256 } : entry,
        ),
      ),
    ).toThrow();
  });

  test("requires the exact configured actor viewport", () => {
    expect(() =>
      validateEvidenceViewport(
        { width: 393, height: 852 },
        betaActors.mark.viewport,
      ),
    ).not.toThrow();
    expect(() =>
      validateEvidenceViewport(
        { width: 393, height: 727 },
        betaActors.mark.viewport,
      ),
    ).toThrow();
  });

  test("reactivates Flutter semantics after both full customer home navigations", () => {
    const source = readFileSync(fileURLToPath(import.meta.url), "utf8");
    expect(source).toMatch(
      /await actors\.ven\.page\.goto\(`\$\{mobileURL\}\/customer\/home`\);\s*await enableFlutterSemantics\(actors\.ven\.page\);\s*await actors\.mark\.page\.goto\(`\$\{mobileURL\}\/customer\/home`\);\s*await enableFlutterSemantics\(actors\.mark\.page\);/,
    );
  });
});

type AuthPayload = {
  access_token: string;
  user: { id: number; fullName: string; credits: number | string };
};

type CustomerRun = {
  actor: BetaActorRuntime;
  name: "Mark" | "Ven";
  email: string;
  password: string;
  token: string;
  userId: number;
  betaRank: number;
  fileId: number;
  addressId: number;
  orderId: number;
  orderRef: string;
  assignmentId: number;
  surveyRequirementId?: number;
  testimonialFileId?: number;
};

const dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadFixture = path.resolve(dirname, "../fixtures/beta-upload.png");

function apiPath(response: Response, suffix: string): boolean {
  return new URL(response.url()).pathname.endsWith(suffix);
}

async function clickNamed(page: Page, name: string | RegExp): Promise<void> {
  const buttons = await visibleLocators(page.getByRole("button", { name }));
  if (buttons.length > 0) {
    expect(buttons, `one visible button named ${String(name)}`).toHaveLength(1);
    await buttons[0].scrollIntoViewIfNeeded();
    await buttons[0].click();
    return;
  }
  const texts = await visibleLocators(
    page.getByText(name, { exact: typeof name === "string" }),
  );
  expect(texts, `one visible text control named ${String(name)}`).toHaveLength(
    1,
  );
  await texts[0].scrollIntoViewIfNeeded();
  await texts[0].click();
}

async function visibleLocators(locator: Locator): Promise<Locator[]> {
  const matches: Locator[] = [];
  for (const candidate of await locator.all()) {
    if (await candidate.isVisible()) matches.push(candidate);
  }
  return matches;
}

async function clickOptional(
  page: Page,
  name: string | RegExp,
): Promise<boolean> {
  const buttons = await visibleLocators(page.getByRole("button", { name }));
  if (buttons.length > 0) {
    expect(
      buttons,
      `at most one visible optional button ${String(name)}`,
    ).toHaveLength(1);
    await buttons[0].scrollIntoViewIfNeeded();
    await buttons[0].click();
    return true;
  }
  const texts = await visibleLocators(
    page.getByText(name, { exact: typeof name === "string" }),
  );
  if (texts.length === 0) return false;
  expect(
    texts,
    `at most one visible optional text ${String(name)}`,
  ).toHaveLength(1);
  await texts[0].scrollIntoViewIfNeeded();
  await texts[0].click();
  return true;
}

async function fillNamed(
  page: Page,
  name: string | RegExp,
  value: string,
): Promise<void> {
  const fields = await visibleLocators(
    typeof name === "string"
      ? page.getByLabel(name, { exact: true })
      : page.getByLabel(name),
  );
  if (fields.length > 0) {
    expect(fields, `one visible field labeled ${String(name)}`).toHaveLength(1);
    await fields[0].fill(value);
    return;
  }
  const placeholders = await visibleLocators(
    page.getByPlaceholder(name, { exact: typeof name === "string" }),
  );
  expect(
    placeholders,
    `one visible field placeholder ${String(name)}`,
  ).toHaveLength(1);
  await placeholders[0].fill(value);
}

function webMercatorPoint(latitude: number, longitude: number, zoom: number) {
  const scale = 256 * 2 ** zoom;
  const sin = Math.sin((latitude * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

async function pinAddressThroughMap(
  page: Page,
  target: { latitude: number; longitude: number },
): Promise<void> {
  const coordinate = page.getByText(/\d+\.\d{5},\s*\d+\.\d{5}/).first();
  const instruction = page.getByText("Drag map to set location", {
    exact: true,
  });
  await expect(coordinate).toBeVisible();
  await expect(instruction).toBeVisible();
  const coordinateBox = await coordinate.boundingBox();
  const instructionBox = await instruction.boundingBox();
  expect(coordinateBox, "map coordinate overlay bounds").not.toBeNull();
  expect(instructionBox, "map instruction bounds").not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport, "address viewport").not.toBeNull();
  const mapCenterX = viewport!.width / 2;
  const mapTop = coordinateBox!.y - 8;
  const mapBottom = instructionBox!.y + instructionBox!.height + 8;
  const mapCenterY = (mapTop + mapBottom) / 2;
  const desired = webMercatorPoint(target.latitude, target.longitude, 15);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const currentText = (await coordinate.textContent())?.trim() ?? "";
    const match = currentText.match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/);
    expect(match, "rendered map coordinate overlay").not.toBeNull();
    const current = webMercatorPoint(Number(match![1]), Number(match![2]), 15);
    const deltaX = desired.x - current.x;
    const deltaY = desired.y - current.y;
    if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
      await page.mouse.click(mapCenterX, mapCenterY);
      break;
    }
    const dragX = Math.max(-70, Math.min(70, deltaX));
    const dragY = Math.max(-70, Math.min(70, deltaY));
    await page.mouse.move(mapCenterX, mapCenterY);
    await page.mouse.down();
    await page.mouse.move(mapCenterX - dragX, mapCenterY - dragY, {
      steps: 20,
    });
    await page.mouse.up();
    await expect(coordinate).not.toHaveText(currentText);
  }
  await expect
    .poll(async () => {
      const text = (await coordinate.textContent())?.trim() ?? "";
      const match = text.match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/);
      if (!match) return Number.POSITIVE_INFINITY;
      return Math.max(
        Math.abs(Number(match[1]) - target.latitude),
        Math.abs(Number(match[2]) - target.longitude),
      );
    })
    .toBeLessThanOrEqual(0.00015);
}

async function dismissTutorials(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (
      await clickOptional(page, /Got it|Skip|Continue to app|Start printing/i)
    ) {
      await page.waitForTimeout(150);
      continue;
    }
    break;
  }
}

async function capture(
  run: EvidenceRun,
  actor: BetaActorRuntime,
  id: number,
  state: string | RegExp,
  durableIds: DurableIds = {},
  options: { variant?: string; allowBlockingDialog?: boolean } = {},
): Promise<void> {
  const { variant, allowBlockingDialog = false } = options;
  await captureStep({
    run,
    page: actor.page,
    actor: actor.name,
    step: evidenceStep(id),
    console: actor.console,
    network: actor.network,
    durableIds,
    variant,
    expectedViewport: actor.definition.viewport,
    allowBlockingDialog,
    assertionSummary: [`Visible state: ${String(state)}`],
    assertState: async () => {
      await expect(actor.page.locator("body")).toContainText(state);
    },
  });
}

async function assertLiveTrackingUi(actor: BetaActorRuntime): Promise<void> {
  await expect(
    actor.page.getByText("Open live tracking", { exact: true }),
  ).toBeVisible();
  await expect(
    actor.page.getByText("Tracking real-time location", { exact: true }),
  ).toBeVisible();
  await expect(
    actor.page.getByText("Rider is on the way", { exact: true }),
  ).toBeVisible();
  await expect(
    actor.page.getByLabel("Live delivery map", { exact: true }),
  ).toBeVisible();
  await expect(
    actor.page.getByLabel("Rider current location marker", { exact: true }),
  ).toBeVisible();
}

async function assertPrivateQueueUi(page: Page): Promise<void> {
  await expect(page.getByText("2nd in queue", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Open live tracking", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Tracking real-time location", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Rider is on the way", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Live delivery map", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Rider current location marker", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/-?\d{1,2}\.\d{4,}\s*,\s*-?\d{2,3}\.\d{4,}/),
  ).toHaveCount(0);
}

async function loginAdmin(
  actor: BetaActorRuntime,
  adminURL: string,
  email: string,
  password: string,
  run: EvidenceRun,
): Promise<AuthPayload> {
  await actor.page.goto(`${adminURL}/login`);
  await capture(
    run,
    actor,
    1,
    /Admin Sign In/,
    {},
    {
      variant: "admin-login",
    },
  );
  await actor.page.getByPlaceholder("admin@gridgo.ph").fill(email);
  await actor.page.getByPlaceholder("Enter password").fill(password);
  const auth = await waitForStrict2xx<AuthPayload>(
    actor.page,
    (response) =>
      response.request().method() === "POST" &&
      apiPath(response, "/api/auth/login"),
    () => clickNamed(actor.page, "Sign In"),
    "admin UI login",
  );
  await expect(actor.page).toHaveURL(`${adminURL}/`);
  await capture(run, actor, 1, /Dashboard|Orders|Operations/, {
    userId: auth.user.id,
  });
  return auth;
}

async function setBetaThroughAdmin(
  actor: BetaActorRuntime,
  adminURL: string,
  enabled: boolean,
  run?: EvidenceRun,
): Promise<void> {
  await actor.page.goto(`${adminURL}/beta-mode`);
  await expect(
    actor.page.getByText("Beta Mode", { exact: true }),
  ).toBeVisible();
  const toggles = await visibleLocators(
    actor.page.locator("button[role=switch]"),
  );
  expect(toggles, "one visible beta-mode switch").toHaveLength(1);
  const toggle = toggles[0];
  const current = (await toggle.getAttribute("aria-checked")) === "true";
  if (run && enabled) {
    expect(current, "fresh release stack must begin with beta disabled").toBe(
      false,
    );
    await capture(
      run,
      actor,
      2,
      /Beta Mode/,
      {},
      {
        variant: "beta-before-enable",
      },
    );
  }
  if (current !== enabled) {
    const responsePromise = actor.page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        apiPath(response, "/api/beta-mode/settings"),
    );
    await toggle.click();
    await actor.page
      .getByRole("button", {
        name: enabled ? "Enable" : "Disable",
        exact: true,
      })
      .click();
    await strictBrowserJson(
      await responsePromise,
      `${enabled ? "enable" : "disable"} beta through admin UI`,
    );
  }
  await expect(toggle).toHaveAttribute("aria-checked", String(enabled));
  if (run && enabled) await capture(run, actor, 2, /Enabled|Beta Mode/i);
}

async function registerCustomerThroughUi(options: {
  actor: BetaActorRuntime;
  name: "Mark" | "Ven";
  email: string;
  password: string;
  mobileURL: string;
  run: EvidenceRun;
  registrationStep: 3 | 18;
}): Promise<
  Pick<
    CustomerRun,
    "actor" | "name" | "email" | "password" | "token" | "userId" | "betaRank"
  >
> {
  const { actor, name, email, password, mobileURL, run, registrationStep } =
    options;
  await actor.page.goto(`${mobileURL}/auth/register`);
  await enableFlutterSemantics(actor.page);
  if (registrationStep === 3)
    await capture(
      run,
      actor,
      3,
      /Your data, your rules/,
      {},
      { variant: "mark-registration-entry" },
    );
  await clickNamed(actor.page, "Agree & Continue");
  await actor.page.locator("input").last().fill(name);
  await clickNamed(actor.page, "Continue");
  await clickNamed(actor.page, "Student");
  await clickNamed(actor.page, "Continue");
  await clickNamed(actor.page, "Architecture");
  await clickNamed(actor.page, "Continue");
  await clickNamed(actor.page, "Male");
  await clickNamed(actor.page, "Continue");
  await clickNamed(actor.page, "18–24");
  await clickNamed(actor.page, "Continue");
  await fillNamed(actor.page, "Full Name", `${name} Beta Visual`);
  await fillNamed(actor.page, "Email", email);
  await fillNamed(actor.page, "Phone Number", "+639171234567");
  await fillNamed(actor.page, "Password", password);
  await fillNamed(actor.page, "Confirm Password", password);
  const auth = await waitForStrict2xx<AuthPayload>(
    actor.page,
    (response) =>
      response.request().method() === "POST" &&
      apiPath(response, "/api/auth/register"),
    () => clickNamed(actor.page, "Create Account"),
    `${name} UI registration`,
  );
  registerEvidenceSecrets(run, [auth.access_token]);
  const userId = positiveId(auth.user.id, `${name} user id`);
  expect(Number(auth.user.credits)).toBe(100);
  const beta = await strictJson<{ rank: number; isBetaUser: boolean }>(
    await actor.page.request.get(
      `${process.env.GRIDGO_API_URL ?? "http://127.0.0.1:3000/api"}/beta-mode/me`,
      { headers: { Authorization: `Bearer ${auth.access_token}` } },
    ),
    `${name} beta enrollment details`,
  );
  expect(beta.isBetaUser).toBe(true);
  const betaRank = positiveId(beta.rank, `${name} beta rank`);
  await actor.page.waitForURL(/\/customer\//);
  await dismissTutorials(actor.page);
  if (registrationStep === 3) {
    await capture(run, actor, 3, new RegExp(name, "i"), { userId });
  }
  return {
    actor,
    name,
    email,
    password,
    token: auth.access_token,
    userId,
    betaRank,
  };
}

async function saveAddressThroughUi(
  customer: Pick<CustomerRun, "actor" | "name">,
  mobileURL: string,
): Promise<number> {
  const { actor, name } = customer;
  await actor.page.goto(`${mobileURL}/customer/addresses/new`);
  await enableFlutterSemantics(actor.page);
  const address = name === "Ven" ? betaAddresses.ven : betaAddresses.mark;
  await fillNamed(actor.page, "Label", address.label);
  await fillNamed(actor.page, "Full Address", address.fullAddress);
  await fillNamed(actor.page, "Barangay", "Poblacion");
  await fillNamed(actor.page, /City/, "Davao City");
  await fillNamed(actor.page, "Province", "Davao del Sur");
  await fillNamed(actor.page, "Zip Code", "8000");
  await fillNamed(actor.page, /Landmark/, `${name} deterministic beta pin`);
  await pinAddressThroughMap(actor.page, address);
  const body = await waitForStrict2xx<JsonRecord>(
    actor.page,
    (response) =>
      response.request().method() === "POST" &&
      apiPath(response, "/api/addresses"),
    () => clickNamed(actor.page, "Save Address"),
    `${name} saved-address UI action`,
  );
  assertAddressWithinTolerance(body, address);
  return positiveId(body.id, `${name} address id`);
}

async function placeCustomerOrder(options: {
  base: Pick<
    CustomerRun,
    "actor" | "name" | "email" | "password" | "token" | "userId" | "betaRank"
  >;
  mobileURL: string;
  run: EvidenceRun;
  firstStep: 4 | 18;
}): Promise<CustomerRun> {
  const { base, mobileURL, run, firstStep } = options;
  const { actor, name, userId } = base;
  if (name === "Mark") {
    await actor.page.goto(`${mobileURL}/customer/profile/account`);
    await expect(actor.page.locator("body")).toContainText(/Student/i);
    await expect(actor.page.locator("body")).toContainText(/Architecture/i);
    await capture(run, actor, 4, /Mark Beta Visual/, { userId });
    await actor.page.goto(`${mobileURL}/customer/home`);
    await expect(actor.page.locator("body")).toContainText(
      String(base.betaRank),
    );
    await expect(actor.page.locator("body")).toContainText(/100/);
    await capture(run, actor, 5, /100|Beta #|GRIDGO Credits/i, {
      userId,
      betaRank: base.betaRank,
    });
  } else {
    await actor.page.goto(`${mobileURL}/customer/home`);
    await expect(actor.page.locator("body")).toContainText(
      String(base.betaRank),
    );
    await expect(actor.page.locator("body")).toContainText(/100/);
    await capture(
      run,
      actor,
      18,
      /100|Beta #|GRIDGO Credits/i,
      {
        userId,
        betaRank: base.betaRank,
      },
      { variant: "ven-beta-credits" },
    );
  }

  await actor.page.goto(`${mobileURL}/customer/order/new`);
  await enableFlutterSemantics(actor.page);
  await dismissTutorials(actor.page);
  if (name === "Mark")
    await capture(run, actor, 6, /Choose|Paper Printing/i, { userId });
  await clickNamed(actor.page, /Paper Printing/i);
  await actor.page.waitForURL(/paper-specs/);
  if (name === "Mark") await capture(run, actor, 7, /Paper Specs/i, { userId });
  await clickNamed(actor.page, "Continue");
  await actor.page.waitForURL(/upload/);
  const uploadResponsePromise = actor.page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      apiPath(response, "/api/files/upload"),
  );
  await actor.page.locator("input[type=file]").setInputFiles(uploadFixture);
  const uploadBody = await strictBrowserJson<JsonRecord>(
    await uploadResponsePromise,
    `${name} real print upload`,
  );
  const fileId = positiveId(uploadBody.id, `${name} file id`);
  await clickOptional(actor.page, /Preview file/i);
  if (name === "Mark")
    await capture(run, actor, 8, /Preview|Coin|beta-upload/i, {
      userId,
      fileId,
    });
  await clickOptional(actor.page, /Close|Done/i);
  await clickNamed(actor.page, "Continue");
  await actor.page.waitForURL(/checkout/);
  await dismissTutorials(actor.page);
  if (name === "Mark")
    await capture(run, actor, 9, /A4|Paper|Checkout/i, { userId, fileId });

  const addressId = await saveAddressThroughUi(base, mobileURL);
  if (name === "Mark") {
    await actor.page.goto(`${mobileURL}/customer/addresses`);
    await capture(
      run,
      actor,
      10,
      /Mark beta route stop/i,
      {
        userId,
        fileId,
        addressId,
      },
      { variant: "mark-saved-recent-address" },
    );
  }
  await actor.page.goto(`${mobileURL}/customer/order/checkout`);
  await enableFlutterSemantics(actor.page);
  await dismissTutorials(actor.page);
  if (name === "Mark")
    await capture(run, actor, 10, /Mark beta route stop|Delivery/i, {
      userId,
      fileId,
      addressId,
    });
  await clickOptional(actor.page, "Delivery");
  await clickOptional(actor.page, /Priority|Standard/i);
  await clickNamed(actor.page, /Choose payment method|GRIDGO Credits/i);
  await expect(actor.page.locator("body")).toContainText(
    /Only GRIDGO Credits is available during beta testing/i,
  );
  await clickNamed(actor.page, /GRIDGO Credits/i);
  if (name === "Mark")
    await capture(
      run,
      actor,
      11,
      /GRIDGO Credits/i,
      {
        userId,
        fileId,
        addressId,
      },
      { allowBlockingDialog: true },
    );
  else
    await capture(
      run,
      actor,
      18,
      /GRIDGO Credits/i,
      {
        userId,
        betaRank: base.betaRank,
        fileId,
        addressId,
      },
      { variant: "ven-credits-checkout", allowBlockingDialog: true },
    );
  await clickNamed(actor.page, "Use this");
  if (name === "Mark")
    await capture(run, actor, 12, /Delivery|Priority|Standard|Order Summary/i, {
      userId,
      fileId,
      addressId,
    });
  else
    await capture(
      run,
      actor,
      18,
      /Delivery|Priority|Standard|Order Summary/i,
      {
        userId,
        betaRank: base.betaRank,
        fileId,
        addressId,
      },
      { variant: "ven-order-summary" },
    );

  const orderBody = await waitForStrict2xx<JsonRecord>(
    actor.page,
    (response) =>
      response.request().method() === "POST" &&
      apiPath(response, "/api/orders/batch"),
    () => clickNamed(actor.page, "Place Order"),
    `${name} credits checkout`,
  );
  const { id: orderId, orderRef } = orderIdentity(orderBody);
  await expect(actor.page.locator("body")).toContainText(orderRef);
  if (name === "Mark") {
    await capture(run, actor, 13, orderRef, {
      userId,
      fileId,
      addressId,
      orderId,
      orderRef,
    });
    await actor.page.goto(`${mobileURL}/customer/orders`);
    await capture(run, actor, 14, orderRef, {
      userId,
      fileId,
      addressId,
      orderId,
      orderRef,
    });
  } else {
    await capture(run, actor, firstStep, /Ven|GRIDGO Credits|Order/i, {
      userId,
      betaRank: base.betaRank,
      fileId,
      addressId,
      orderId,
      orderRef,
    });
  }
  return { ...base, fileId, addressId, orderId, orderRef, assignmentId: 0 };
}

async function advanceProductionAndAssign(options: {
  admin: BetaActorRuntime;
  adminURL: string;
  customer: CustomerRun;
  productionStep: 15 | 19;
  assignmentStep: 16 | 20;
  run: EvidenceRun;
}): Promise<void> {
  const { admin, adminURL, customer, productionStep, assignmentStep, run } =
    options;
  await admin.page.goto(`${adminURL}/orders/show/${customer.orderId}`);
  await expect(admin.page.locator("body")).toContainText(customer.orderRef);
  for (const label of [
    "File Verified",
    "Printing",
    "Finishing",
    "Quality Checked",
    "Ready for Dispatch",
  ]) {
    const responsePromise = admin.page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        apiPath(response, `/api/admin/orders/${customer.orderId}/status`),
    );
    await admin.page
      .getByLabel(`Update status for ${customer.orderRef}`)
      .click();
    await admin.page.getByRole("option", { name: label }).click();
    await admin.page.getByRole("button", { name: "OK" }).click();
    await strictBrowserJson(
      await responsePromise,
      `${customer.name} production transition ${label}`,
    );
  }
  await capture(run, admin, productionStep, /Ready for Dispatch/i, {
    orderId: customer.orderId,
    orderRef: customer.orderRef,
  });
  const assignmentResponse = admin.page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      apiPath(response, `/api/admin/orders/${customer.orderId}/assign`),
  );
  await admin.page
    .getByRole("button", { name: `Assign rider for ${customer.orderRef}` })
    .click();
  const row = admin.page.getByRole("row").filter({ hasText: /Juan/i });
  await row.getByRole("button", { name: "Assign" }).click();
  const assignmentBody = await strictBrowserJson<JsonRecord>(
    await assignmentResponse,
    `assign ${customer.name} to Juan`,
  );
  expect(
    positiveId(assignmentBody.id, `${customer.name} assigned order id`),
  ).toBe(customer.orderId);
  await capture(
    run,
    admin,
    assignmentStep,
    /Juan|Rider assigned/i,
    { orderId: customer.orderId, orderRef: customer.orderRef },
    { variant: `${customer.name.toLowerCase()}-assignment-confirmed` },
  );
}

async function loginMobile(
  actor: BetaActorRuntime,
  mobileURL: string,
  email: string,
  password: string,
): Promise<AuthPayload> {
  await actor.page.goto(`${mobileURL}/auth/login`);
  await enableFlutterSemantics(actor.page);
  await fillNamed(actor.page, "Email", email);
  await fillNamed(actor.page, "Password", password);
  return waitForStrict2xx<AuthPayload>(
    actor.page,
    (response) =>
      response.request().method() === "POST" &&
      apiPath(response, "/api/auth/login"),
    () => clickNamed(actor.page, /Sign In|Login/i),
    `${actor.name} UI login`,
  );
}

async function riderAction(
  actor: BetaActorRuntime,
  label: string | RegExp,
  assignmentId: number,
): Promise<JsonRecord> {
  return waitForStrict2xx<JsonRecord>(
    actor.page,
    (response) =>
      response.request().method() === "PATCH" &&
      apiPath(response, `/api/riders/assignments/${assignmentId}/status`),
    () => clickNamed(actor.page, label),
    `Juan action ${String(label)} for assignment ${assignmentId}`,
  );
}

async function openRiderAssignment(
  actor: BetaActorRuntime,
  mobileURL: string,
  assignmentId: number,
): Promise<void> {
  await actor.page.goto(`${mobileURL}/rider/deliveries/${assignmentId}/active`);
  await enableFlutterSemantics(actor.page);
}

async function drawAndSubmitSignature(
  actor: BetaActorRuntime,
  assignmentId: number,
  beforeSubmit?: () => Promise<void>,
): Promise<void> {
  const slider = actor.page.getByText("Swipe to confirm delivery");
  const box = await slider.boundingBox();
  expect(box, "delivery confirmation slider must be visible").not.toBeNull();
  await actor.page.mouse.move(box!.x + 28, box!.y + box!.height / 2);
  await actor.page.mouse.down();
  await actor.page.mouse.move(
    box!.x + box!.width - 20,
    box!.y + box!.height / 2,
    { steps: 12 },
  );
  await actor.page.mouse.up();
  await expect(actor.page.getByText("Proof of Delivery")).toBeVisible();
  const sign = actor.page.getByText("Sign here");
  const signBox = await sign.locator("..").boundingBox();
  expect(signBox).not.toBeNull();
  await actor.page.mouse.move(signBox!.x + 30, signBox!.y + 50);
  await actor.page.mouse.down();
  await actor.page.mouse.move(
    signBox!.x + signBox!.width - 30,
    signBox!.y + signBox!.height - 50,
    { steps: 10 },
  );
  await actor.page.mouse.move(
    signBox!.x + 40,
    signBox!.y + signBox!.height - 45,
    { steps: 10 },
  );
  await actor.page.mouse.up();
  if (beforeSubmit) await beforeSubmit();
  await waitForStrict2xx<JsonRecord>(
    actor.page,
    (response) =>
      response.request().method() === "PATCH" &&
      apiPath(response, `/api/riders/assignments/${assignmentId}/status`),
    () => clickNamed(actor.page, "Submit proof"),
    `signature proof for assignment ${assignmentId}`,
  );
}

async function completeSurveyUi(customer: CustomerRun): Promise<void> {
  const page = customer.actor.page;
  const requirementId = positiveId(
    customer.surveyRequirementId,
    `${customer.name} recorded survey requirement id`,
  );
  await expect(page.locator("body")).toContainText(/survey|feedback/i);
  const answeredIndexes: number[] = [];
  for (const index of surveyQuestionIndexes) {
    await expect(
      page.getByText(`Question ${index + 1} of 14`, { exact: true }),
    ).toBeVisible();
    const sliders = await visibleLocators(page.getByRole("slider"));
    expect(sliders, `${customer.name} question ${index} slider`).toHaveLength(
      1,
    );
    await sliders[0].focus();
    await sliders[0].press("End");
    await clickNamed(page, "Next");
    answeredIndexes.push(index);
  }
  expect(answeredIndexes).toEqual(surveyQuestionIndexes);
  await page
    .getByPlaceholder("Share your thoughts...", { exact: true })
    .fill(`${customer.name} completed the full release workflow.`);
  await page
    .getByPlaceholder("Optional comments...", { exact: true })
    .fill("All fourteen required questions were answered through the UI.");
  const response = await waitForStrict2xx<JsonRecord>(
    page,
    (candidate) =>
      candidate.request().method() === "POST" &&
      new URL(candidate.url()).pathname.endsWith(
        `/api/tam-surveys/requirements/${requirementId}/submit`,
      ),
    () => clickNamed(page, "Submit Feedback"),
    `${customer.name} required survey submission`,
  );
  validateSurveySubmission(response, { requirementId, answeredIndexes });
}

async function launchSocialAndAbortExternal(
  customer: CustomerRun,
): Promise<void> {
  const { actor } = customer;
  const external = /facebook\.com|linkedin\.com|twitter\.com|x\.com/i;
  await actor.context.route(external, (route) => route.abort("aborted"));
  const popupPromise = actor.context.waitForEvent("page");
  await clickNamed(actor.page, /Facebook|LinkedIn|X \(Twitter\)|More/i);
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded").catch(() => undefined);
  expect(
    external.test(popup.url()) || popup.url() === "about:blank",
    "social share must invoke a popup callback",
  ).toBe(true);
  await popup.close();
}

async function uploadTestimonialAndHold(
  customer: CustomerRun,
  afterShare?: () => Promise<void>,
): Promise<number> {
  const page = customer.actor.page;
  await launchSocialAndAbortExternal(customer);
  if (afterShare) await afterShare();
  await page.locator("input[type=file]").setInputFiles(uploadFixture);
  const uploadPromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      apiPath(response, "/api/files/upload"),
  );
  const testimonialPromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      apiPath(response, "/api/beta-mode/testimonial"),
  );
  await clickNamed(page, /Upload photo & complete beta/i);
  const upload = await strictBrowserJson<JsonRecord>(
    await uploadPromise,
    `${customer.name} testimonial photo upload`,
  );
  await strictBrowserJson(
    await testimonialPromise,
    `${customer.name} testimonial submission`,
  );
  return positiveId(upload.id, `${customer.name} testimonial file id`);
}

test.describe.serial("opt-in four-context visual beta release workflow", () => {
  test("drives admin, Mark, Ven, and Juan through the screenshot-backed release journey", async ({
    browser,
    request,
  }, testInfo) => {
    test.skip(
      process.env.GRIDGO_RUN_BETA_FLOW_VISUAL !== "1",
      "Set GRIDGO_RUN_BETA_FLOW_VISUAL=1 against a fresh isolated stack.",
    );
    test.skip(
      testInfo.project.name !== "beta-visual",
      "The sequential visual journey runs once in its dedicated Chromium project.",
    );

    const mobileURL = process.env.MOBILE_WEB_E2E_URL ?? "http://127.0.0.1:8088";
    const adminURL = process.env.GRIDGO_ADMIN_URL ?? "http://127.0.0.1:8189";
    const apiBaseURL =
      process.env.GRIDGO_API_URL ?? "http://127.0.0.1:3000/api";
    const adminEmail = process.env.GRIDGO_ADMIN_EMAIL;
    const adminPassword = process.env.GRIDGO_ADMIN_PASSWORD;
    const riderEmail = process.env.GRIDGO_RIDER_EMAIL;
    const riderPassword = process.env.GRIDGO_RIDER_PASSWORD;
    expect(adminEmail, "GRIDGO_ADMIN_EMAIL is required").toBeTruthy();
    expect(adminPassword, "GRIDGO_ADMIN_PASSWORD is required").toBeTruthy();
    expect(riderEmail, "GRIDGO_RIDER_EMAIL is required").toBeTruthy();
    expect(riderPassword, "GRIDGO_RIDER_PASSWORD is required").toBeTruthy();

    const runLabel = randomUUID();
    const markPassword = generateVisualCustomerPassword();
    const venPassword = generateVisualCustomerPassword();
    const run = beginEvidenceRun(runLabel);
    registerEvidenceSecrets(run, [
      adminPassword,
      riderPassword,
      markPassword,
      venPassword,
    ]);
    process.env.GRIDGO_BETA_VIDEO_DIR = path.join(run.root, "videos");
    const actors = await createBetaActorContexts(browser, {
      mobileURL,
      adminURL,
      protectedSecrets: run.protectedSecrets,
    });
    let adminAuth: AuthPayload | undefined;
    try {
      adminAuth = await loginAdmin(
        actors.admin,
        adminURL,
        adminEmail!,
        adminPassword!,
        run,
      );
      registerEvidenceSecrets(run, [adminAuth.access_token]);
      await setBetaThroughAdmin(actors.admin, adminURL, true, run);

      const markBase = await registerCustomerThroughUi({
        actor: actors.mark,
        name: "Mark",
        email: `${runLabel}-mark@example.test`,
        password: markPassword,
        mobileURL,
        run,
        registrationStep: 3,
      });
      const mark = await placeCustomerOrder({
        base: markBase,
        mobileURL,
        run,
        firstStep: 4,
      });
      await advanceProductionAndAssign({
        admin: actors.admin,
        adminURL,
        customer: mark,
        productionStep: 15,
        assignmentStep: 16,
        run,
      });

      const riderAuth = await loginMobile(
        actors.juan,
        mobileURL,
        riderEmail!,
        riderPassword!,
      );
      registerEvidenceSecrets(run, [riderAuth.access_token]);
      const markAssignments = await authenticatedGet<AssignmentRecord[]>(
        request,
        apiBaseURL,
        "/riders/assignments",
        riderAuth.access_token,
        "load exact Mark assignment id",
      );
      const markAssignment = markAssignments.find(
        (assignment) =>
          Number(assignment.order?.id ?? assignment.orderId) === mark.orderId,
      );
      expect(markAssignment).toBeDefined();
      mark.assignmentId = positiveId(markAssignment!.id, "Mark assignment id");
      await capture(run, actors.admin, 16, /Juan|Rider assigned/i, {
        orderId: mark.orderId,
        orderRef: mark.orderRef,
        assignmentId: mark.assignmentId,
      });
      await actors.juan.page.goto(`${mobileURL}/rider/deliveries`);
      await expect(actors.juan.page.locator("body")).toContainText(
        mark.orderRef,
      );
      await capture(run, actors.juan, 17, mark.orderRef, {
        orderId: mark.orderId,
        orderRef: mark.orderRef,
        assignmentId: mark.assignmentId,
      });

      // Mark's registration and order are durably complete before Ven exists.
      const venBase = await registerCustomerThroughUi({
        actor: actors.ven,
        name: "Ven",
        email: `${runLabel}-ven@example.test`,
        password: venPassword,
        mobileURL,
        run,
        registrationStep: 18,
      });
      const ven = await placeCustomerOrder({
        base: venBase,
        mobileURL,
        run,
        firstStep: 18,
      });
      await advanceProductionAndAssign({
        admin: actors.admin,
        adminURL,
        customer: ven,
        productionStep: 19,
        assignmentStep: 20,
        run,
      });
      const venAssignments = await authenticatedGet<AssignmentRecord[]>(
        request,
        apiBaseURL,
        "/riders/assignments",
        riderAuth.access_token,
        "load exact Ven assignment id",
      );
      const venAssignment = venAssignments.find(
        (assignment) =>
          Number(assignment.order?.id ?? assignment.orderId) === ven.orderId,
      );
      expect(venAssignment).toBeDefined();
      ven.assignmentId = positiveId(venAssignment!.id, "Ven assignment id");
      await capture(run, actors.admin, 20, /Juan|Rider assigned/i, {
        orderId: ven.orderId,
        orderRef: ven.orderRef,
        assignmentId: ven.assignmentId,
      });

      const assignments = await authenticatedGet<AssignmentRecord[]>(
        request,
        apiBaseURL,
        "/riders/assignments",
        riderAuth.access_token,
        "load Juan assignments for run filtering",
      );
      const runAssignments = onlyRunAssignments(assignments, [
        ven.orderId,
        mark.orderId,
      ]);
      expect(
        new Set(runAssignments.map((assignment) => assignment.id)),
      ).toEqual(new Set([ven.assignmentId, mark.assignmentId]));
      await actors.admin.page.goto(`${adminURL}/riders`);
      await actors.admin.page
        .getByRole("button", { name: /Dispatch plan for Juan/i })
        .click();
      const panel = actors.admin.page.getByRole("region", {
        name: /Dispatch plan for Juan/i,
      });
      for (const checkbox of await panel.getByRole("checkbox").all()) {
        const label = await checkbox.getAttribute("aria-label");
        const keep =
          label?.includes(ven.orderRef) || label?.includes(mark.orderRef);
        if ((await checkbox.isChecked()) !== Boolean(keep))
          await checkbox.click();
      }
      const planBody = await waitForStrict2xx<JsonRecord>(
        actors.admin.page,
        (response) =>
          response.request().method() === "POST" &&
          /\/api\/admin\/riders\/\d+\/dispatch-plan$/.test(
            new URL(response.url()).pathname,
          ),
        () => panel.getByRole("button", { name: /Create road route/i }).click(),
        "persist two-stop OSRM dispatch plan",
      );
      validatePersistedDispatchPlan(planBody, {
        venAssignmentId: ven.assignmentId,
        markAssignmentId: mark.assignmentId,
      });
      const planId = positiveId(planBody.id, "dispatch plan id");
      const planVersion = positiveId(planBody.version, "dispatch plan version");

      for (const customer of [ven, mark]) {
        await openRiderAssignment(
          actors.juan,
          mobileURL,
          customer.assignmentId,
        );
        const accepted = await riderAction(
          actors.juan,
          /Accept/i,
          customer.assignmentId,
        );
        expect(accepted).toMatchObject({
          id: customer.assignmentId,
          status: "accepted",
        });
        const pickedUp = await riderAction(
          actors.juan,
          /Mark as picked up/i,
          customer.assignmentId,
        );
        expect(pickedUp).toMatchObject({
          id: customer.assignmentId,
          status: "picked_up",
        });
        const onTheWay = await riderAction(
          actors.juan,
          /Start delivery/i,
          customer.assignmentId,
        );
        expect(onTheWay).toMatchObject({
          id: customer.assignmentId,
          status: "on_the_way",
        });
      }
      const dispatchedAssignments = onlyRunAssignments(
        await authenticatedGet<AssignmentRecord[]>(
          request,
          apiBaseURL,
          "/riders/assignments",
          riderAuth.access_token,
          "reload Juan dispatched run assignments",
        ),
        [ven.orderId, mark.orderId],
      );
      expect(dispatchedAssignments).toHaveLength(2);
      expect(
        dispatchedAssignments.every(
          (assignment) => assignment.status === "on_the_way",
        ),
      ).toBe(true);
      await actors.juan.page.goto(`${mobileURL}/rider/home`);
      await expect(
        actors.juan.page.getByText(ven.orderRef, { exact: true }),
      ).toBeVisible();
      await expect(
        actors.juan.page.getByText(mark.orderRef, { exact: true }),
      ).toBeVisible();
      await expect(
        actors.juan.page.getByText("STOP 1", { exact: true }),
      ).toBeVisible();
      await expect(
        actors.juan.page.getByText("STOP 2", { exact: true }),
      ).toBeVisible();
      await expect(
        actors.juan.page.getByText("STOP 3", { exact: true }),
      ).toHaveCount(0);
      await capture(run, actors.juan, 21, /Today's Route/i, {
        markOrderId: mark.orderId,
        venOrderId: ven.orderId,
        markAssignmentId: mark.assignmentId,
        venAssignmentId: ven.assignmentId,
      });

      await actors.admin.page.reload();
      const persistedResponse = actors.admin.page.waitForResponse(
        (response) =>
          response.request().method() === "GET" &&
          /\/api\/admin\/riders\/\d+\/dispatch-plan$/.test(
            new URL(response.url()).pathname,
          ),
      );
      await actors.admin.page
        .getByRole("button", { name: /Dispatch plan for Juan/i })
        .click();
      const persistedPlan = await strictBrowserJson<JsonRecord>(
        await persistedResponse,
        "reload persisted OSRM dispatch plan",
      );
      validatePersistedDispatchPlan(persistedPlan, {
        venAssignmentId: ven.assignmentId,
        markAssignmentId: mark.assignmentId,
      });
      expect(positiveId(persistedPlan.id, "persisted plan id")).toBe(planId);
      expect(positiveId(persistedPlan.version, "persisted plan version")).toBe(
        planVersion,
      );
      const persistedPanel = actors.admin.page.getByRole("region", {
        name: /Dispatch plan for Juan/i,
      });
      await expect(persistedPanel.getByTestId("dispatch-stop-1")).toContainText(
        "#1",
      );
      await expect(persistedPanel.getByTestId("dispatch-stop-1")).toContainText(
        "Ven",
      );
      await expect(persistedPanel.getByTestId("dispatch-stop-1")).toContainText(
        ven.orderRef,
      );
      await expect(persistedPanel.getByTestId("dispatch-stop-2")).toContainText(
        "#2",
      );
      await expect(persistedPanel.getByTestId("dispatch-stop-2")).toContainText(
        "Mark",
      );
      await expect(persistedPanel.getByTestId("dispatch-stop-2")).toContainText(
        mark.orderRef,
      );
      await capture(run, actors.admin, 22, /OSRM/i, {
        dispatchPlanId: planId,
        dispatchPlanVersion: planVersion,
        markAssignmentId: mark.assignmentId,
        venAssignmentId: ven.assignmentId,
      });
      await actors.ven.page.goto(`${mobileURL}/customer/home`);
      await enableFlutterSemantics(actors.ven.page);
      await actors.mark.page.goto(`${mobileURL}/customer/home`);
      await enableFlutterSemantics(actors.mark.page);
      const markDocumentMarker = `mark-document-${runLabel}`;
      await actors.mark.page.evaluate((marker) => {
        Object.defineProperty(window, "__gridgoBetaDocumentMarker", {
          value: marker,
          configurable: false,
          writable: false,
        });
      }, markDocumentMarker);
      const venOrders = await authenticatedGet<JsonRecord[]>(
        request,
        apiBaseURL,
        "/orders",
        ven.token,
        "load Ven current queue state",
      );
      const markOrders = await authenticatedGet<JsonRecord[]>(
        request,
        apiBaseURL,
        "/orders",
        mark.token,
        "load Mark private queue state",
      );
      const venQueue = venOrders.find(
        (order) => Number(order.id) === ven.orderId,
      );
      const markQueue = markOrders.find(
        (order) => Number(order.id) === mark.orderId,
      );
      expect(venQueue).toMatchObject({
        deliveryQueuePosition: 1,
        deliveryQueueSize: 2,
        canTrackDelivery: true,
        deliveryAssignmentId: ven.assignmentId,
      });
      expect(markQueue).toMatchObject({
        deliveryQueuePosition: 2,
        deliveryQueueSize: 2,
        canTrackDelivery: false,
        deliveryAssignmentId: null,
      });
      await assertPrivateQueueUi(actors.mark.page);

      const venStoreLocation = await setAcknowledgedGeolocation({
        riderPage: actors.juan.page,
        apiBaseURL,
        customerToken: ven.token,
        checkpoint: betaCheckpoint("store"),
        expectedAssignmentId: ven.assignmentId,
        expectedPlanVersion: planVersion,
        assertCustomerMarker: async () => {
          await assertLiveTrackingUi(actors.ven);
        },
      });
      await capture(run, actors.ven, 23, /Tracking real-time location/i, {
        orderId: ven.orderId,
        assignmentId: ven.assignmentId,
        dispatchPlanVersion: planVersion,
        latitude: Number(venStoreLocation.latitude),
        longitude: Number(venStoreLocation.longitude),
      });

      await assertLocationPrivacyDenied({
        apiBaseURL,
        token: mark.token,
        assignmentId: mark.assignmentId,
      });
      await assertPrivateQueueUi(actors.mark.page);
      await capture(run, actors.mark, 24, /2nd in queue/i, {
        orderId: mark.orderId,
        dispatchPlanVersion: planVersion,
      });

      for (const checkpointId of ["road-to-ven", "ven"] as const) {
        await setAcknowledgedGeolocation({
          riderPage: actors.juan.page,
          apiBaseURL,
          customerToken: ven.token,
          checkpoint: betaCheckpoint(checkpointId),
          expectedAssignmentId: ven.assignmentId,
          expectedPlanVersion: planVersion,
          assertCustomerMarker: async () => {
            await assertLiveTrackingUi(actors.ven);
          },
        });
      }
      await openRiderAssignment(actors.juan, mobileURL, ven.assignmentId);
      await riderAction(actors.juan, /Mark as arrived/i, ven.assignmentId);
      await drawAndSubmitSignature(actors.juan, ven.assignmentId, () =>
        capture(
          run,
          actors.juan,
          25,
          /Proof of Delivery|Signature/i,
          { orderId: ven.orderId, assignmentId: ven.assignmentId },
          { variant: "ven-proof-ready", allowBlockingDialog: true },
        ),
      );
      await capture(run, actors.juan, 25, /Delivered|Proof|Ven/i, {
        orderId: ven.orderId,
        assignmentId: ven.assignmentId,
      });

      expect(
        await actors.mark.page.evaluate(
          () =>
            (window as typeof window & { __gridgoBetaDocumentMarker?: string })
              .__gridgoBetaDocumentMarker,
        ),
        "Mark document marker must survive automatic promotion",
      ).toBe(markDocumentMarker);
      const promotedOrders = await authenticatedGet<JsonRecord[]>(
        request,
        apiBaseURL,
        "/orders",
        mark.token,
        "load Mark promoted queue state",
      );
      expect(
        promotedOrders.find((order) => Number(order.id) === mark.orderId),
      ).toMatchObject({
        deliveryQueuePosition: 1,
        deliveryQueueSize: 1,
        canTrackDelivery: true,
        deliveryAssignmentId: mark.assignmentId,
      });
      await expect(
        actors.mark.page.getByText("Open live tracking", { exact: true }),
      ).toBeVisible();
      const markPromotedLocation = await setAcknowledgedGeolocation({
        riderPage: actors.juan.page,
        apiBaseURL,
        customerToken: mark.token,
        checkpoint: betaCheckpoint("road-to-mark"),
        expectedAssignmentId: mark.assignmentId,
        expectedPlanVersion: planVersion,
        assertCustomerMarker: async () => {
          await assertLiveTrackingUi(actors.mark);
        },
      });
      expect(
        await actors.mark.page.evaluate(
          () =>
            (window as typeof window & { __gridgoBetaDocumentMarker?: string })
              .__gridgoBetaDocumentMarker,
        ),
        "Mark must gain live tracking without a document reload",
      ).toBe(markDocumentMarker);
      await capture(run, actors.mark, 26, /Tracking real-time location/i, {
        orderId: mark.orderId,
        assignmentId: mark.assignmentId,
        dispatchPlanVersion: planVersion,
        latitude: Number(markPromotedLocation.latitude),
        longitude: Number(markPromotedLocation.longitude),
      });
      for (const checkpointId of ["mark"] as const) {
        await setAcknowledgedGeolocation({
          riderPage: actors.juan.page,
          apiBaseURL,
          customerToken: mark.token,
          checkpoint: betaCheckpoint(checkpointId),
          expectedAssignmentId: mark.assignmentId,
          expectedPlanVersion: planVersion,
          assertCustomerMarker: async () => {
            await assertLiveTrackingUi(actors.mark);
          },
        });
      }
      await openRiderAssignment(actors.juan, mobileURL, mark.assignmentId);
      await riderAction(actors.juan, /Mark as arrived/i, mark.assignmentId);
      await drawAndSubmitSignature(actors.juan, mark.assignmentId, () =>
        capture(
          run,
          actors.juan,
          27,
          /Proof of Delivery|Signature/i,
          { orderId: mark.orderId, assignmentId: mark.assignmentId },
          { variant: "mark-proof-ready", allowBlockingDialog: true },
        ),
      );
      await capture(run, actors.juan, 27, /Delivered|Proof|Mark/i, {
        orderId: mark.orderId,
        assignmentId: mark.assignmentId,
      });

      const venState = await authenticatedGet<{
        accountStatus: string;
        holds: Array<{ requirementId: number; orderId: number }>;
      }>(
        request,
        apiBaseURL,
        "/users/me/account-state",
        ven.token,
        "load Ven required survey state",
      );
      const markState = await authenticatedGet<{
        accountStatus: string;
        holds: Array<{ requirementId: number; orderId: number }>;
      }>(
        request,
        apiBaseURL,
        "/users/me/account-state",
        mark.token,
        "load Mark required survey state",
      );
      expect(venState).toMatchObject({
        accountStatus: "survey_required",
        holds: [{ orderId: ven.orderId }],
      });
      expect(markState).toMatchObject({
        accountStatus: "survey_required",
        holds: [{ orderId: mark.orderId }],
      });
      ven.surveyRequirementId = positiveId(
        venState.holds[0].requirementId,
        "Ven survey requirement id",
      );
      mark.surveyRequirementId = positiveId(
        markState.holds[0].requirementId,
        "Mark survey requirement id",
      );
      await expect(actors.ven.page.locator("body")).toContainText(
        /survey|feedback/i,
      );
      await expect(actors.mark.page.locator("body")).toContainText(
        /survey|feedback/i,
      );
      await capture(run, actors.ven, 28, /survey|feedback/i, {
        orderId: ven.orderId,
        surveyRequirementId: ven.surveyRequirementId,
      });
      await capture(
        run,
        actors.mark,
        28,
        /survey|feedback/i,
        {
          orderId: mark.orderId,
          surveyRequirementId: mark.surveyRequirementId,
        },
        { variant: "mark-automatic-survey" },
      );
      await completeSurveyUi(ven);
      await completeSurveyUi(mark);
      ven.testimonialFileId = await uploadTestimonialAndHold(ven, () =>
        capture(
          run,
          actors.ven,
          29,
          /YOU MADE|SPREAD THE WORD|YOUR PHOTO/i,
          { userId: ven.userId, orderId: ven.orderId },
          { variant: "ven-share-popup-confirmed" },
        ),
      );
      mark.testimonialFileId = await uploadTestimonialAndHold(mark, () =>
        capture(
          run,
          actors.mark,
          29,
          /YOU MADE|SPREAD THE WORD|YOUR PHOTO/i,
          { userId: mark.userId, orderId: mark.orderId },
          { variant: "mark-share-popup-confirmed" },
        ),
      );

      for (const customer of [ven, mark]) {
        await customer.actor.page.goto(`${mobileURL}/auth/login`);
        await enableFlutterSemantics(customer.actor.page);
        await fillNamed(customer.actor.page, "Email", customer.email);
        await fillNamed(customer.actor.page, "Password", customer.password);
        const held = customer.actor.page.waitForResponse(
          (response) =>
            response.request().method() === "POST" &&
            apiPath(response, "/api/auth/login"),
        );
        await clickNamed(customer.actor.page, /Sign In|Login/i);
        const response = await held;
        expect(response.status(), `${customer.name} held login`).toBe(403);
        await expect(await response.json()).toMatchObject({
          code: "beta_held",
          betaPhotoUploaded: true,
          betaSharedOnSocial: true,
        });
        await expect(customer.actor.page.locator("body")).toContainText(
          /beta|held|thank/i,
        );
        await capture(
          run,
          customer.actor,
          29,
          /beta|held|thank/i,
          {
            userId: customer.userId,
            orderId: customer.orderId,
            testimonialFileId: customer.testimonialFileId,
          },
          { variant: `${customer.name.toLowerCase()}-held` },
        );
      }

      await setBetaThroughAdmin(actors.admin, adminURL, false);
      await capture(
        run,
        actors.admin,
        29,
        /Beta Mode|Disabled/i,
        {},
        { variant: "beta-disabled" },
      );
      for (const customer of [ven, mark]) {
        const restored = await loginMobile(
          customer.actor,
          mobileURL,
          customer.email,
          customer.password,
        );
        expect(restored.user.id).toBe(customer.userId);
        await capture(
          run,
          customer.actor,
          29,
          /Home|Orders|Hello|Hi/i,
          { userId: customer.userId, orderId: customer.orderId },
          customer.name === "Mark"
            ? undefined
            : { variant: `${customer.name.toLowerCase()}-restored-login` },
        );
      }
      assertCanonicalEvidenceComplete(run.entries);
    } finally {
      if (adminAuth) {
        const cleanup = await request.patch(
          `${apiBaseURL}/beta-mode/settings`,
          {
            headers: { Authorization: `Bearer ${adminAuth.access_token}` },
            data: { isEnabled: false },
          },
        );
        await strictJson(cleanup, "finally disable beta mode");
      }
      const videos = Object.values(actors).map((actor) => ({
        actor: actor.name,
        video: actor.page.video(),
      }));
      await closeBetaActorContexts(actors);
      for (const { actor, video } of videos) {
        if (!video) continue;
        const videoPath = await video.path();
        recordEvidenceArtifact(run, "video", actor, videoPath);
      }
      for (const actor of Object.values(actors)) {
        writeFileSync(
          path.join(run.logsDir, `${actor.name}-console.json`),
          `${sanitizeEvidenceText(
            JSON.stringify(actor.console, null, 2),
            run.protectedSecrets,
          )}\n`,
          { mode: 0o600 },
        );
        writeFileSync(
          path.join(run.logsDir, `${actor.name}-network.json`),
          `${sanitizeEvidenceText(
            JSON.stringify(actor.network, null, 2),
            run.protectedSecrets,
          )}\n`,
          { mode: 0o600 },
        );
        recordEvidenceArtifact(
          run,
          "console",
          actor.name,
          path.join(run.logsDir, `${actor.name}-console.json`),
        );
        recordEvidenceArtifact(
          run,
          "network",
          actor.name,
          path.join(run.logsDir, `${actor.name}-network.json`),
        );
      }
      await testInfo.attach("beta-visual-manifest", {
        path: run.manifestPath,
        contentType: "application/json",
      });
    }
  });
});
