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
import AxeBuilder from "@axe-core/playwright";

import {
  betaActors,
  closeBetaActorContexts,
  createBetaActorContexts,
  enableFlutterSemantics,
  navigateMobile,
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
  configuredEvidenceOrigins,
  recordEvidenceArtifact,
  registerEvidenceSecrets,
  requiredEvidenceNetworkIssues,
  sanitizeEvidenceUrl,
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
  betaPreStoreLocation,
  betaRouteCheckpoints,
} from "../fixtures/beta-locations";
import { chromiumSecureContextArgs } from "../fixtures/browser-security";

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
    expect(
      new Set(Object.values(betaActors).map((actor) => actor.clientIp)).size,
    ).toBe(4);
  });

  test("keeps every visual actor rendering while other contexts are active", () => {
    const config = readFileSync(
      path.resolve(dirname, "../playwright.config.ts"),
      "utf8",
    );
    for (const flag of [
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
    ]) {
      expect(config).toContain(flag);
    }
    expect(config).toContain('channel: "chromium"');
  });

  test("grants simulated geolocation only to the configured LAN test origin", () => {
    expect(chromiumSecureContextArgs("http://127.0.0.1:8088")).toEqual([]);
    expect(chromiumSecureContextArgs("https://gridgo.test")).toEqual([]);
    expect(chromiumSecureContextArgs("http://192.168.40.201:8088")).toEqual([
      "--unsafely-treat-insecure-origin-as-secure=http://192.168.40.201:8088",
    ]);
  });

  test("treats configured LAN mobile, admin, and API failures as required network issues", () => {
    const requiredOrigins = configuredEvidenceOrigins({
      mobileURL: "http://192.168.40.201:8088",
      adminURL: "http://192.168.40.201:8189",
      apiBaseURL: "http://192.168.40.201:3000/api",
    });
    expect([...requiredOrigins]).toEqual([
      "http://192.168.40.201:8088",
      "http://192.168.40.201:8189",
      "http://192.168.40.201:3000",
    ]);

    const mobileTransportFailure = {
      method: "GET",
      url: "http://192.168.40.201:8088/main.dart.js",
      failure: "net::ERR_CONNECTION_RESET",
    };
    const adminServerFailure = {
      method: "GET",
      url: "http://192.168.40.201:8189/assets/index.js",
      status: 502,
    };
    const apiServerFailure = {
      method: "POST",
      url: "http://192.168.40.201:3000/api/orders",
      status: 503,
    };
    const issues = requiredEvidenceNetworkIssues(
      [
        mobileTransportFailure,
        adminServerFailure,
        apiServerFailure,
        {
          method: "GET",
          url: "https://c.basemaps.cartocdn.com/tile.png",
          failure: "net::ERR_ABORTED",
        },
        {
          method: "POST",
          url: "http://192.168.40.201:3000/api/auth/login",
          status: 403,
        },
      ],
      requiredOrigins,
    );

    expect(issues.transportFailures).toEqual([mobileTransportFailure]);
    expect(issues.serverResponses).toEqual([
      adminServerFailure,
      apiServerFailure,
    ]);
  });

  test("provides Chromium geolocation at the configured visual origin", async ({
    context,
    page,
  }) => {
    test.skip(
      process.env.GRIDGO_RUN_BETA_FLOW_VISUAL !== "1",
      "live visual origin preflight is opt-in",
    );
    const mobileURL = process.env.MOBILE_WEB_E2E_URL;
    expect(mobileURL, "configured mobile visual URL").toBeTruthy();
    const origin = new URL(mobileURL!).origin;
    const store = betaCheckpoint("store");
    await context.grantPermissions(["geolocation"], { origin });
    await context.setGeolocation(store);
    await page.goto(mobileURL!);
    const location = await page.evaluate(
      () =>
        new Promise<{ latitude: number; longitude: number }>(
          (resolve, reject) =>
            navigator.geolocation.getCurrentPosition(
              ({ coords }) =>
                resolve({
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                }),
              reject,
              { timeout: 10_000 },
            ),
        ),
    );
    expect(location.latitude).toBeCloseTo(store.latitude, 5);
    expect(location.longitude).toBeCloseTo(store.longitude, 5);
  });

  test("enables Flutter semantics when the empty host already exists", async ({
    page,
  }) => {
    await page.setContent(`
      <flt-semantics-host></flt-semantics-host>
      <flt-semantics-placeholder aria-label="Enable accessibility"></flt-semantics-placeholder>
    `);
    await page.locator("flt-semantics-placeholder").evaluate((placeholder) => {
      placeholder.addEventListener("click", () => {
        document
          .querySelector("flt-semantics-host")
          ?.append(document.createElement("flt-semantics"));
        placeholder.remove();
      });
    });

    await enableFlutterSemantics(page);

    await expect(page.locator("flt-semantics-placeholder")).toHaveCount(0);
    await expect(
      page.locator("flt-semantics-host > flt-semantics"),
    ).toHaveCount(1);
  });

  test("waits for Flutter's accessibility placeholder startup race", async ({
    page,
  }) => {
    await page.setContent("<flt-semantics-host></flt-semantics-host>");
    await page.evaluate(() => {
      window.setTimeout(() => {
        const placeholder = document.createElement("flt-semantics-placeholder");
        placeholder.setAttribute("aria-label", "Enable accessibility");
        placeholder.addEventListener("click", () => {
          document
            .querySelector("flt-semantics-host")
            ?.append(document.createElement("flt-semantics"));
          placeholder.remove();
        });
        document.body.append(placeholder);
      }, 50);
    });

    await enableFlutterSemantics(page);

    await expect(page.locator("flt-semantics-placeholder")).toHaveCount(0);
    await expect(
      page.locator("flt-semantics-host > flt-semantics"),
    ).toHaveCount(1);
  });

  test("labels Flutter web slider focus targets for assistive technology", async ({
    page,
  }) => {
    const bridge = readFileSync(
      path.resolve(
        dirname,
        "../../../apps/mobile/web/flutter_semantics_accessibility.js",
      ),
      "utf8",
    );
    await page.setContent(`<script>${bridge}</script>`);
    await page.evaluate(() => {
      const semantics = document.createElement("flt-semantics");
      semantics.setAttribute("aria-label", "Feedback rating for question 1");
      const slider = document.createElement("input");
      slider.type = "range";
      slider.setAttribute("role", "slider");
      semantics.append(slider);
      document.body.append(semantics);
    });

    const slider = page.locator('input[type="range"][role="slider"]');
    await expect(slider).toHaveAttribute(
      "aria-label",
      "Feedback rating for question 1",
    );

    await page.locator("flt-semantics").evaluate((semantics) => {
      semantics.setAttribute("aria-label", "Feedback rating for question 2");
    });
    await expect(slider).toHaveAttribute(
      "aria-label",
      "Feedback rating for question 2",
    );
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(accessibility.violations.filter(({ id }) => id === "label")).toEqual(
      [],
    );
  });

  test("asserts the required survey through its accessible route group", () => {
    const source = readFileSync(fileURLToPath(import.meta.url), "utf8");
    const reveal = source.slice(
      source.lastIndexOf("async function revealAutomaticSurvey"),
      source.lastIndexOf("async function assertPrivateQueueUi"),
    );
    expect(reveal).toContain('getByRole("group"');
    expect(reveal).toContain("Question 1 of 14");
    expect(reveal).not.toContain('goto("about:blank")');
    expect(reveal).not.toContain("textContent()");

    const completion = source.slice(
      source.lastIndexOf("async function completeSurveyUi"),
      source.lastIndexOf("async function launchSocialAndAbortExternal"),
    );
    expect(completion).toContain("await foregroundFlutterPage(page)");
    expect(completion).toContain('getByRole("group"');
    expect(completion).toContain('.getByRole("slider")');
    expect(completion).toContain('.press("ArrowRight")');
    expect(completion).toContain('toHaveAttribute("aria-valuetext"');
    expect(completion).toContain("slider availability");
    expect(completion).not.toContain("getByText(`Question");
  });

  test("proves beta checkout, rider eligibility, rendered maps, and immediate surveys", () => {
    const source = readFileSync(fileURLToPath(import.meta.url), "utf8");
    const orderFlow = source.slice(
      source.lastIndexOf("async function placeCustomerOrder"),
      source.lastIndexOf("async function advanceProductionAndAssign"),
    );
    expect(orderFlow).toContain("assertBetaOnlyPaymentOptions");
    expect(orderFlow).toContain("assertStandardCheckoutPayload");

    const assignmentFlow = source.slice(
      source.lastIndexOf("async function advanceProductionAndAssign"),
      source.lastIndexOf("async function loginMobile"),
    );
    expect(assignmentFlow).toContain("assignment_eligible");
    expect(assignmentFlow).toContain("is_available");
    expect(assignmentFlow).toContain("window.scrollTo(0, 0)");

    const liveAssertion = source.slice(
      source.lastIndexOf("async function assertLiveTrackingUi"),
      source.lastIndexOf("async function foregroundFlutterPage"),
    );
    expect(liveAssertion).toContain("await foregroundFlutterPage(actor.page)");
    expect(liveAssertion).toContain('getByRole("group"');
    expect(liveAssertion).toContain("LIVE MAP");
    expect(liveAssertion).toContain('.toContainText("Live delivery map")');
    expect(liveAssertion).toContain("Live delivery map");

    const shareFlow = source.slice(
      source.lastIndexOf("async function launchSocialAndAbortExternal"),
      source.lastIndexOf("async function uploadTestimonialAndHold"),
    );
    expect(shareFlow).toContain("route.request().url()");
    expect(shareFlow).not.toContain('popup.url() === "about:blank"');

    const liveJourney = source.slice(
      source.lastIndexOf("test.describe.serial"),
    );
    expect(liveJourney).toContain("await positionRiderAtStoreBeforePickup");
    const venDelivered = liveJourney.indexOf(
      "load Ven required survey state immediately after delivery",
    );
    const markDelivered = liveJourney.indexOf(
      "load Mark required survey state immediately after delivery",
    );
    expect(venDelivered).toBeGreaterThan(-1);
    expect(markDelivered).toBeGreaterThan(venDelivered);
  });

  test("opens an assigned delivery detail before Juan accepts it", () => {
    const source = readFileSync(fileURLToPath(import.meta.url), "utf8");
    const helper = source.slice(
      source.lastIndexOf("async function openRiderAssignment"),
      source.lastIndexOf("async function assertRiderPlannedStopOrder"),
    );
    expect(helper).toContain("`/rider/deliveries/${assignmentId}`");
    expect(helper).not.toContain("/active");
  });

  test("chooses testimonial photos through the browser file chooser", () => {
    const source = readFileSync(fileURLToPath(import.meta.url), "utf8");
    const helper = source.slice(
      source.lastIndexOf("async function uploadTestimonialAndHold"),
      source.lastIndexOf("test.describe.serial"),
    );

    expect(helper).toContain('waitForEvent("filechooser"');
    expect(helper).toContain("await chooser.setFiles(uploadFixture)");
    expect(helper).toContain("Tap to add a photo of your prints");
    expect(helper).not.toContain('locator("input[type=file]")');
  });

  test("acknowledges only the expected beta-held login console response", () => {
    const source = readFileSync(fileURLToPath(import.meta.url), "utf8");
    const heldFlow = source.slice(
      source.lastIndexOf("mark.testimonialFileId"),
      source.lastIndexOf("await setBetaThroughAdmin"),
    );

    expect(heldFlow).toMatch(
      /await acknowledgeExpectedHttpConsoleError\(\s*customer\.actor,\s*"\/api\/auth\/login",\s*403,\s*\)/,
    );
  });

  test("does not leave an unhandled response waiter when a UI action fails", () => {
    const apiSource = readFileSync(
      path.resolve(dirname, "../fixtures/beta-api.ts"),
      "utf8",
    );
    const helper = apiSource.slice(
      apiSource.indexOf("export async function waitForStrict2xx"),
      apiSource.indexOf("export function positiveId"),
    );
    expect(helper).toContain("await Promise.all([responsePromise, action()])");
  });

  test("mounts tracking before setting and refreshing geolocation", () => {
    const apiSource = readFileSync(
      path.resolve(dirname, "../fixtures/beta-api.ts"),
      "utf8",
    );
    const helper = apiSource.slice(
      apiSource.indexOf("export async function setAcknowledgedGeolocation"),
      apiSource.indexOf("export type AssignmentRecord"),
    );
    const mount = helper.indexOf("await mountRiderTracking?.()");
    const geolocation = helper.indexOf("setGeolocation(checkpoint)");
    const refresh = helper.indexOf("await refreshRiderTracking?.()");
    expect(mount).toBeGreaterThan(-1);
    expect(geolocation).toBeGreaterThan(-1);
    expect(refresh).toBeGreaterThan(-1);
    expect(mount).toBeLessThan(geolocation);
    expect(geolocation).toBeLessThan(refresh);
    expect(helper).toContain("navigator.geolocation.getCurrentPosition");
    expect(helper).toContain("postDataJSON()");
    expect(helper).toContain("await Promise.all([");
    expect(helper).toContain("responsePromise,");
    expect(helper).toContain("locationUpdate,");
    expect(helper).toContain("activationPromise,");
    expect(helper).toContain('socket.on("locationUpdate"');
    expect(helper).toContain("locationMatchesCheckpoint");
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
    const store = betaCheckpoint("store");
    expect(
      Math.hypot(
        betaPreStoreLocation.latitude - store.latitude,
        betaPreStoreLocation.longitude - store.longitude,
      ),
      "Juan must begin away from the first evidence checkpoint",
    ).toBeGreaterThan(0.0001);
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

    const sanitizedPresignedUrl = sanitizeEvidenceUrl(
      "https://storage.grid.test/evidence.png?X-Amz-Signature=amz-secret&X-Amz-Credential=credential-secret&X-Amz-Security-Token=session-secret&code=oauth-code&refresh_token=refresh-secret&id_token=id-secret&safe=ok",
    );
    for (const secret of [
      "amz-secret",
      "credential-secret",
      "session-secret",
      "oauth-code",
      "refresh-secret",
      "id-secret",
    ]) {
      expect(sanitizedPresignedUrl).not.toContain(secret);
    }
    expect(sanitizedPresignedUrl).toContain("safe=ok");
  });

  test("requires the exact GRIDGO beta URL in the Facebook share request", () => {
    expect(() =>
      validateFacebookShareRequest(
        "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fgridgoprint.ph%2Fbeta",
      ),
    ).not.toThrow();
    expect(() =>
      validateFacebookShareRequest(
        "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fexample.test%2Fwrong",
      ),
    ).toThrow(/shared GRIDGO URL/);
  });

  test("keeps visual evidence provenance and ephemeral MinIO credentials explicit", () => {
    const workflow = readFileSync(
      path.resolve(dirname, "../../../.github/workflows/visual-evidence.yml"),
      "utf8",
    );
    expect(workflow).toContain('"runLabel": raw_manifest.get("runLabel")');
    expect(workflow).not.toContain('"runId": raw_manifest.get("runId")');
    expect(workflow).toContain("MINIO_PUBLIC_URL: http://127.0.0.1:9000");
    expect(workflow).toMatch(
      /for variable in[^\n]*MINIO_ACCESS_KEY[^\n]*MINIO_SECRET_KEY/,
    );
    expect(workflow).toContain('"MINIO_ACCESS_KEY"');
    expect(workflow).toContain('"MINIO_SECRET_KEY"');
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
    const evidenceSource = readFileSync(
      path.join(e2eRoot, "fixtures/beta-evidence.ts"),
      "utf8",
    );
    const actorSource = readFileSync(
      path.join(e2eRoot, "fixtures/beta-actors.ts"),
      "utf8",
    );
    expect(config).toContain('trace: visualWorkflow ? "off"');
    const manualTracingApi = ["context", "tracing", ""].join(".");
    expect(visualSource).not.toContain(manualTracingApi);
    const liveAssertion = visualSource.slice(
      visualSource.lastIndexOf("async function assertLiveTrackingUi"),
      visualSource.lastIndexOf("async function assertPrivateQueueUi"),
    );
    expect(liveAssertion).toContain("Tracking real-time location");
    expect(liveAssertion).not.toContain('getByText("Open live tracking"');
    expect(liveAssertion).not.toContain('locator("canvas")');
    expect(liveAssertion).not.toContain("actor.network.some");
    const privateAssertion = visualSource.slice(
      visualSource.lastIndexOf("async function assertPrivateQueueUi"),
      visualSource.lastIndexOf("async function loginAdmin"),
    );
    expect(privateAssertion).toContain("Tracking real-time location");
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
    expect(registrationFlow).toContain(
      'actor.page.url().includes("/onboarding")',
    );
    expect(registrationFlow).toContain(
      "await completeCustomerOnboarding(actor.page)",
    );
    const onboardingFlow = visualSource.slice(
      visualSource.lastIndexOf("async function completeCustomerOnboarding"),
      visualSource.lastIndexOf("async function capture("),
    );
    expect(onboardingFlow).toContain("pageIndex < 4");
    expect(onboardingFlow).toContain('clickNamed(page, "Next")');
    expect(onboardingFlow).toContain('clickNamed(page, "Get Started")');
    const orderFlow = visualSource.slice(
      visualSource.lastIndexOf("async function placeCustomerOrder"),
      visualSource.lastIndexOf("async function advanceProductionAndAssign"),
    );
    expect(orderFlow).toContain("await beginFirstOrderTutorial(actor.page)");
    expect(orderFlow).toContain(
      "await completeCheckoutPipelineTutorial(actor.page)",
    );
    expect(orderFlow).not.toContain("dismissTutorials(actor.page)");
    expect(orderFlow).toContain('waitForEvent("filechooser"');
    expect(orderFlow).not.toContain("input[type=file]");
    expect(visualSource).toContain('clickNamed(page, "Show me how →")');
    expect(visualSource).toContain('clickNamed(page, "Add address →")');
    const captureHelper = visualSource.slice(
      visualSource.lastIndexOf("async function capture("),
      visualSource.lastIndexOf("async function assertLiveTrackingUi"),
    );
    expect(captureHelper).not.toContain("[11, 25, 27].includes(id)");
    expect(captureHelper).toContain("allowBlockingDialog = false");
    expect(evidenceSource).toContain("accepted evidence loading state");
    expect(evidenceSource).toContain("axeViolationSummary");
    expect(actorSource).toContain("context.route");
    expect(actorSource).not.toContain("extraHTTPHeaders");
    expect(actorSource).toContain("element.click()");
    expect(visualSource).toContain("navigateMobile");
    const directMobileGoto = ["page.goto(`", "${mobileURL}", "/"].join("");
    expect(visualSource).not.toContain(directMobileGoto);
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

  test("requires all 14 survey indexes and a durable held-account response", () => {
    expect(surveyQuestionIndexes).toEqual(
      Array.from({ length: 14 }, (_, index) => index),
    );
    expect(() =>
      validateSurveySubmission(
        { surveyId: 91, success: true, logoutRequired: true },
        { requirementId: 81, answeredIndexes: surveyQuestionIndexes },
      ),
    ).not.toThrow();
    expect(() =>
      validateSurveySubmission(
        { surveyId: 91, success: true, logoutRequired: true },
        {
          requirementId: 81,
          answeredIndexes: surveyQuestionIndexes.slice(0, 13),
        },
      ),
    ).toThrow();
    expect(() =>
      validateSurveySubmission(
        { surveyId: 0, success: true, logoutRequired: true },
        { requirementId: 81, answeredIndexes: surveyQuestionIndexes },
      ),
    ).toThrow();
    expect(() =>
      validateSurveySubmission(
        { surveyId: 91, success: true, logoutRequired: false },
        { requirementId: 81, answeredIndexes: surveyQuestionIndexes },
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

  test("routes both customer homes through the semantics-aware navigator", () => {
    const source = readFileSync(fileURLToPath(import.meta.url), "utf8");
    expect(source).toMatch(
      /await navigateMobile\(actors\.ven\.page, mobileURL, "\/customer\/home"\);\s*await navigateMobile\(actors\.mark\.page, mobileURL, "\/customer\/home"\);/,
    );
  });

  test("matches Flutter semantic labels that append descriptive punctuation", () => {
    expect(
      accessibleNamePattern("Mark beta route stop").test(
        "Mark beta route stop. Mark beta route address, Davao City",
      ),
    ).toBe(true);
  });

  test("uses keyboard activation for response-verified rider actions", () => {
    const source = readFileSync(fileURLToPath(import.meta.url), "utf8");
    const riderHelper = source.slice(
      source.lastIndexOf("async function riderAction"),
      source.lastIndexOf("async function openRiderAssignment"),
    );
    expect(riderHelper).toContain("activateNamedButtonWithKeyboard");
    expect(riderHelper).toContain("waitForStrict2xx");
    const trackingHelper = source.slice(
      source.lastIndexOf("async function mountRiderTracking"),
      source.lastIndexOf("async function drawAndSubmitSignature"),
    );
    expect(trackingHelper).toContain(
      'activateNamedButtonWithDomClick(actor.page, "Refresh GPS location")',
    );
  });

  test("allows enough time for the complete four-role visual journey", () => {
    expect(visualJourneyTimeoutMs).toBeGreaterThanOrEqual(10 * 60 * 1_000);
  });

  test("uses the Flutter login fields' actual accessible placeholders", () => {
    const source = readFileSync(fileURLToPath(import.meta.url), "utf8");
    expect(source).toMatch(
      /fillNamed\(actor\.page, "you@example\.com", email\);\s*await fillNamed\(actor\.page, "Enter your password", password\);/,
    );
  });

  test("clears each held client session before verifying restored login", () => {
    const source = readFileSync(fileURLToPath(import.meta.url), "utf8");
    expect(source).toMatch(
      /await setBetaThroughAdmin\(actors\.admin, adminURL, false\);[\s\S]*for \(const customer of \[ven, mark\]\) \{\s*await clickNamed\(customer\.actor\.page, "Sign out"\);\s*const restored = await loginMobile/,
    );
  });

  test("verifies restored customers on the actual home route and content", () => {
    const source = readFileSync(fileURLToPath(import.meta.url), "utf8");
    const restoredFlow = source.slice(
      source.lastIndexOf("await setBetaThroughAdmin"),
      source.lastIndexOf("assertCanonicalEvidenceComplete"),
    );
    expect(restoredFlow).toContain(
      "/Good morning|Catch the next batch|GRIDGO Credits|Delivery Status/i",
    );
    expect(restoredFlow).toMatch(
      /toHaveURL\(\s*\/#\\\/customer\\\/home/,
    );
    expect(restoredFlow).not.toContain("/Home|Orders|Hello|Hi/i");
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
const expectedGridShareURL = "https://gridgoprint.ph/beta";
const visualJourneyTimeoutMs = 15 * 60 * 1_000;

function apiPath(response: Response, suffix: string): boolean {
  return new URL(response.url()).pathname.endsWith(suffix);
}

function accessibleNamePattern(name: string | RegExp): RegExp {
  if (name instanceof RegExp) return name;
  return new RegExp(
    `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|[.,:;!?…—–-]|$)`,
    "i",
  );
}

async function clickNamed(page: Page, name: string | RegExp): Promise<void> {
  const buttonLocator = page.getByRole("button", {
    name: accessibleNamePattern(name),
  });
  const labelLocator = page.getByLabel(accessibleNamePattern(name));
  const textLocator = page.getByText(name, {
    exact: typeof name === "string",
  });
  await expect
    .poll(
      async () => {
        const buttons = await visibleLocators(buttonLocator);
        if (buttons.length > 0) return `buttons:${buttons.length}`;
        const labels = await visibleLocators(labelLocator);
        if (labels.length > 0) return `labels:${labels.length}`;
        const texts = await visibleLocators(textLocator);
        return `texts:${texts.length}`;
      },
      { message: `one visible control named ${String(name)}` },
    )
    .toMatch(/^(?:buttons|labels|texts):1$/);
  const buttons = await visibleLocators(buttonLocator);
  if (buttons.length > 0) {
    expect(buttons, `one visible button named ${String(name)}`).toHaveLength(1);
    await buttons[0].click({ timeout: 15_000 });
    return;
  }
  const labels = await visibleLocators(labelLocator);
  if (labels.length > 0) {
    expect(labels, `one visible label named ${String(name)}`).toHaveLength(1);
    await clickFlutterLabelCenter(page, labels[0], name);
    return;
  }
  const texts = await visibleLocators(textLocator);
  expect(texts, `one visible text control named ${String(name)}`).toHaveLength(
    1,
  );
  await texts[0].click({ timeout: 15_000 });
}

async function activateNamedButtonWithKeyboard(
  page: Page,
  name: string | RegExp,
): Promise<void> {
  const locator = page.getByRole("button", {
    name: accessibleNamePattern(name),
  });
  await expect
    .poll(async () => (await visibleLocators(locator)).length, {
      message: `one keyboard action named ${String(name)}`,
    })
    .toBe(1);
  const buttons = await visibleLocators(locator);
  expect(buttons, `one keyboard action named ${String(name)}`).toHaveLength(1);
  await buttons[0].focus();
  await buttons[0].press("Enter");
}

async function activateNamedButtonWithDomClick(
  page: Page,
  name: string | RegExp,
): Promise<void> {
  const locator = page.getByRole("button", {
    name: accessibleNamePattern(name),
  });
  await expect
    .poll(async () => (await visibleLocators(locator)).length, {
      message: `one semantic action named ${String(name)}`,
    })
    .toBe(1);
  const buttons = await visibleLocators(locator);
  expect(buttons, `one semantic action named ${String(name)}`).toHaveLength(1);
  await buttons[0].evaluate((element) => (element as HTMLElement).click());
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
    await buttons[0].click({ timeout: 15_000 });
    return true;
  }
  const labels = await visibleLocators(page.getByLabel(name));
  if (labels.length > 0) {
    expect(
      labels,
      `at most one visible optional label ${String(name)}`,
    ).toHaveLength(1);
    await clickFlutterLabelCenter(page, labels[0], name);
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
  await texts[0].click({ timeout: 15_000 });
  return true;
}

async function clickFlutterLabelCenter(
  page: Page,
  label: Locator,
  name: string | RegExp,
): Promise<void> {
  await label.scrollIntoViewIfNeeded({ timeout: 15_000 });
  await page.waitForTimeout(50);
  const box = await label.boundingBox();
  expect(box, `measurable Flutter control ${String(name)}`).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
}

async function fillNamed(
  page: Page,
  name: string | RegExp,
  value: string,
): Promise<void> {
  const textTargetLocator = page.getByText(name, {
    exact: typeof name === "string",
  });
  const labelLocator = page.getByLabel(accessibleNamePattern(name));
  const placeholderLocator = page.getByPlaceholder(name, {
    exact: typeof name === "string",
  });
  await expect
    .poll(
      async () => {
        const fields = await visibleLocators(labelLocator);
        if (fields.length > 0) return `labels:${fields.length}`;
        const placeholders = await visibleLocators(placeholderLocator);
        return `placeholders:${placeholders.length}`;
      },
      { message: `one visible field named ${String(name)}` },
    )
    .toMatch(/^(?:labels|placeholders):1$/);
  const fields = await visibleLocators(labelLocator);
  if (fields.length > 0) {
    expect(fields, `one visible field labeled ${String(name)}`).toHaveLength(1);
    const targets = await visibleLocators(textTargetLocator);
    expect(
      targets.length,
      `at most one visible text field target ${String(name)}`,
    ).toBeLessThanOrEqual(1);
    const interactionLocator =
      targets.length === 1 ? textTargetLocator : labelLocator;
    const interactionTarget = targets.length === 1 ? targets[0] : fields[0];
    await interactionTarget.scrollIntoViewIfNeeded({ timeout: 15_000 });
    await page.waitForTimeout(50);
    const scrolledFields = await visibleLocators(interactionLocator);
    expect(
      scrolledFields,
      `one re-resolved field target ${String(name)}`,
    ).toHaveLength(1);
    await enterFieldValue(page, scrolledFields[0], name, value);
    return;
  }
  const placeholders = await visibleLocators(placeholderLocator);
  expect(
    placeholders,
    `one visible field placeholder ${String(name)}`,
  ).toHaveLength(1);
  const targets = await visibleLocators(textTargetLocator);
  expect(
    targets.length,
    `at most one visible text field target ${String(name)}`,
  ).toBeLessThanOrEqual(1);
  const interactionLocator =
    targets.length === 1 ? textTargetLocator : placeholderLocator;
  const interactionTarget = targets.length === 1 ? targets[0] : placeholders[0];
  await interactionTarget.scrollIntoViewIfNeeded({ timeout: 15_000 });
  await page.waitForTimeout(50);
  const scrolledPlaceholders = await visibleLocators(interactionLocator);
  expect(
    scrolledPlaceholders,
    `one re-resolved field target ${String(name)}`,
  ).toHaveLength(1);
  await enterFieldValue(page, scrolledPlaceholders[0], name, value);
}

async function enterFieldValue(
  page: Page,
  target: Locator,
  name: string | RegExp,
  value: string,
): Promise<void> {
  const expectedName = accessibleNamePattern(name);
  const readActiveName = () =>
    page.evaluate(() => {
      const active = document.activeElement;
      return (
        active?.getAttribute("aria-label") ??
        active?.getAttribute("placeholder") ??
        ""
      );
    });
  // Flutter web syncs the semantic <input> asynchronously with framework
  // state and can recreate the input node after focus transitions, so a
  // single focus + insertText + immediate readback races in both
  // directions (DOM empty, or DOM filled while the framework missed it).
  // Each attempt re-establishes focus on the (possibly recreated) node,
  // types real key events, and polls until the DOM value settles.
  let accepted = false;
  for (let attempt = 0; attempt < 4 && !accepted; attempt += 1) {
    if (!expectedName.test(await readActiveName())) {
      const box = await target.boundingBox();
      expect(box, "measurable Flutter field target").not.toBeNull();
      await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await page.waitForTimeout(100);
    }
    if (!expectedName.test(await readActiveName())) continue;
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    await page.keyboard.type(value, { delay: 10 });
    accepted = await page
      .waitForFunction(
        (expected) => {
          const active = document.activeElement;
          const current =
            active instanceof HTMLInputElement ||
            active instanceof HTMLTextAreaElement
              ? active.value
              : null;
          return current === expected;
        },
        value,
        { timeout: 3_000 },
      )
      .then(() => true)
      .catch(() => false);
  }
  expect(accepted, `focused Flutter field value ${String(name)}`).toBe(true);
  await page.keyboard.press("Tab");
  await page.waitForTimeout(50);
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
  // Start away from the fixed center pin so the marker cannot win Flutter's
  // gesture arena and swallow a map-pan intended to move Ven's location.
  const mapDragStartX = mapCenterX + 80;
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
    await page.mouse.move(mapDragStartX, mapCenterY);
    await page.mouse.down();
    await page.mouse.move(mapDragStartX - dragX, mapCenterY - dragY, {
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

async function completeCustomerOnboarding(page: Page): Promise<void> {
  // The onboarding carousel can arrive mid-transition (e.g. right after the
  // beta reveal navigates here), so wait for its first control to be present.
  await expect
    .poll(async () => {
      const nexts = await visibleLocators(
        page.getByLabel(accessibleNamePattern("Next")),
      );
      return nexts.length;
    })
    .toBeGreaterThan(0);
  for (let pageIndex = 0; pageIndex < 4; pageIndex += 1) {
    await clickNamed(page, "Next");
    await page.waitForTimeout(450);
  }
  await clickNamed(page, "Get Started");
  await page.waitForURL(/\/customer\//);
}

async function capture(
  run: EvidenceRun,
  actor: BetaActorRuntime,
  id: number,
  state: string | RegExp,
  durableIds: DurableIds = {},
  options: {
    variant?: string;
    allowBlockingDialog?: boolean;
    assertState?: () => Promise<void>;
  } = {},
): Promise<void> {
  const { variant, allowBlockingDialog = false, assertState } = options;
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
      if (assertState) {
        await assertState();
        return;
      }
      await expect(actor.page.locator("body")).toContainText(state);
    },
  });
}

async function assertBetaOnlyPaymentOptions(page: Page): Promise<void> {
  for (const method of ["GCash", "Maya", "Cash on Delivery"]) {
    const option = page.getByRole("button", {
      name: new RegExp(`^${method}\\. .*Unavailable during beta testing`, "i"),
    });
    await expect(
      option,
      `${method} must be visible but unavailable in beta`,
    ).toBeVisible();
    await expect(option, `${method} must be disabled in beta`).toBeDisabled();
  }
  await expect(
    page.getByRole("button", { name: /^GRIDGO Credits\./i }),
    "GRIDGO Credits must be the only enabled beta payment option",
  ).toBeEnabled();
}

function assertStandardCheckoutPayload(payload: JsonRecord): void {
  expect(payload.paymentMethod, "beta checkout payment method").toBe(
    "gridCredits",
  );
  expect(payload.speedTier, "explicit checkout delivery mode").toBe("standard");
}

async function assertLiveTrackingUi(actor: BetaActorRuntime): Promise<void> {
  // Background Flutter canvases may defer their semantics update until the page
  // is foregrounded even though the pixels render when Playwright takes a
  // failure screenshot. Bring the customer context forward before asserting
  // the map so the accessibility tree and rendered state describe the same UI.
  await foregroundFlutterPage(actor.page);
  await expect(actor.page.locator("body")).toContainText(
    /Tracking real-time location/i,
    { timeout: 30_000 },
  );
  const map = actor.page.getByRole("group", {
    name: /^LIVE MAP(?:\s+~\d+\s+min)?$/i,
  });
  await expect(map).toContainText("Live delivery map");
  await expect(map, "rendered live delivery map semantics").toBeVisible({
    timeout: 30_000,
  });
  const bounds = await map.boundingBox();
  expect(bounds, "rendered live delivery map bounds").not.toBeNull();
  expect(bounds!.width, "rendered live delivery map width").toBeGreaterThan(
    100,
  );
  expect(bounds!.height, "rendered live delivery map height").toBeGreaterThan(
    100,
  );
}

async function positionRiderAtStoreBeforePickup(
  actor: BetaActorRuntime,
): Promise<{ latitude: number; longitude: number }> {
  const store = betaCheckpoint("store");
  await actor.context.setGeolocation(store);
  // Retry transient GeolocationPositionError while the override propagates.
  let location: { latitude: number; longitude: number } | null = null;
  let lastGeolocationError = "";
  for (let attempt = 0; attempt < 3 && !location; attempt += 1) {
    // Re-foreground: hidden pages get geolocation suspended (four contexts
    // share one browser and only one page is visible at a time).
    await actor.page.bringToFront();
    try {
      location = await actor.page.evaluate(
        () =>
          new Promise<{ latitude: number; longitude: number }>(
            (resolve, reject) =>
              navigator.geolocation.getCurrentPosition(
                (position) =>
                  resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                  }),
                (error) =>
                  reject(
                    new Error(
                      `geolocation error ${error.code}: ${error.message}`,
                    ),
                  ),
                { enableHighAccuracy: true, timeout: 10_000 },
              ),
          ),
      );
    } catch (error) {
      lastGeolocationError = String(error);
      await actor.page.waitForTimeout(1_000);
      await actor.context.setGeolocation(store);
    }
  }
  expect(
    location,
    `Juan geolocation resolves (${lastGeolocationError})`,
  ).not.toBeNull();
  expect(
    location!.latitude,
    "Juan reaches the store before pickup",
  ).toBeCloseTo(store.latitude, 5);
  expect(
    location!.longitude,
    "Juan reaches the store before pickup",
  ).toBeCloseTo(store.longitude, 5);
  return location!;
}

async function foregroundFlutterPage(page: Page): Promise<void> {
  await page.bringToFront();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  await page.waitForTimeout(350);
}

async function revealAutomaticSurvey(actor: BetaActorRuntime): Promise<void> {
  await foregroundFlutterPage(actor.page);
  await expect(actor.page).toHaveURL(/#\/customer\/survey\/required$/);
  await expect(
    actor.page.getByRole("group", { name: /Question 1 of 14/i }),
  ).toBeVisible({ timeout: 30_000 });
}

async function assertPrivateQueueUi(page: Page): Promise<void> {
  await expect(
    page.getByRole("button", { name: "Open live tracking", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(
    /Tracking real-time location/i,
  );
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
  const toggle = actor.page.getByRole("switch", { name: "Beta mode" });
  await expect(toggle, "visible beta-mode switch").toBeVisible();
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
    await expect(actor.page.locator(".ant-modal-wrap")).toBeHidden();
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
  await navigateMobile(actor.page, mobileURL, "/auth/register");
  if (registrationStep === 3)
    await capture(
      run,
      actor,
      3,
      /Register your\s+print account|WELCOME/i,
      {},
      { variant: "mark-registration-entry" },
    );
  // Step 1 — welcome + explicit consent.
  await clickNamed(actor.page, /I agree to keep my data mine/);
  await clickNamed(actor.page, "Continue");
  // Step 2 — account (moved up). Flutter's web renderer exposes the input
  // hints as accessible names even though the visible labels remain separate
  // semantics nodes.
  await fillNamed(actor.page, "Kai Reyes", `${name} Beta Visual`);
  await fillNamed(actor.page, "kai@example.com", email);
  await fillNamed(actor.page, "+63 917 123 4567", "+639171234567");
  await fillNamed(actor.page, "Min. 8 characters", password);
  await fillNamed(actor.page, "Re-enter your password", password);
  await clickNamed(actor.page, "Continue");
  // Step 3 — nickname (uses the robust filler; a plain .fill() does not
  // reliably update the Flutter text controller on web).
  await fillNamed(actor.page, "e.g. Kai", name);
  await clickNamed(actor.page, "Continue");
  // Step 4 — craft (category + field on one plate).
  await expect(actor.page.locator("body")).toContainText(/YOUR LANE/i);
  await clickNamed(actor.page, "Student");
  await clickNamed(actor.page, "Architecture");
  await clickNamed(actor.page, "Continue");
  // Step 5 — profile (gender + age, skippable). Fill them, then create.
  await clickNamed(actor.page, "Male");
  await clickNamed(actor.page, "18–24");
  const auth = await waitForStrict2xx<AuthPayload>(
    actor.page,
    (response) =>
      response.request().method() === "POST" &&
      apiPath(response, "/api/auth/register"),
    () => clickNamed(actor.page, "Create account"),
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
  // Beta-eligible signups land on the press-proof reveal before onboarding.
  await actor.page.waitForURL(/\/(?:auth\/beta-welcome|onboarding|customer\/)/);
  if (actor.page.url().includes("/auth/beta-welcome")) {
    await expect(actor.page.locator("body")).toContainText(/FOUNDING TESTER/i);
    await clickNamed(actor.page, "Start printing");
    await actor.page.waitForURL(/\/(?:onboarding|customer\/)/);
  }
  if (actor.page.url().includes("/onboarding")) {
    await completeCustomerOnboarding(actor.page);
  }
  await dismissTutorials(actor.page);
  if (registrationStep === 3) {
    await capture(run, actor, 3, /TODAY|NEXT BATCH/i, { userId });
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
  customer: Pick<CustomerRun, "actor" | "name" | "token">,
  mobileURL: string,
  options: { navigate?: boolean } = {},
): Promise<number> {
  const { actor, name } = customer;
  if (options.navigate ?? true) {
    await navigateMobile(actor.page, mobileURL, "/customer/addresses/new");
  }
  const address = name === "Ven" ? betaAddresses.ven : betaAddresses.mark;
  await fillNamed(actor.page, "e.g. Home, Office", address.label);
  await fillNamed(actor.page, "Street, Building, Unit", address.fullAddress);
  await fillNamed(actor.page, "Barangay name", "Poblacion");
  await fillNamed(actor.page, "City or Municipality", "Davao City");
  await fillNamed(actor.page, "Province", "Davao del Sur");
  await fillNamed(actor.page, "e.g. 1229", "8000");
  await fillNamed(
    actor.page,
    "e.g. Near Jollibee on Main St",
    `${name} deterministic beta pin`,
  );
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
  const addressId = positiveId(body.id, `${name} address id`);
  const recent = await strictJson<JsonRecord[]>(
    await actor.page.request.get(
      `${process.env.GRIDGO_API_URL ?? "http://127.0.0.1:3000/api"}/addresses`,
      { headers: { Authorization: `Bearer ${customer.token}` } },
    ),
    `${name} recent saved addresses`,
  );
  expect(recent[0], `${name} most-recent address`).toMatchObject({
    id: addressId,
    label: address.label,
  });
  assertAddressWithinTolerance(recent[0], address);
  return addressId;
}

async function beginFirstOrderTutorial(page: Page): Promise<void> {
  // The next-batch dialog is time-of-day dependent (midDay/missed variants),
  // so returning to home can surface it at any point in the journey.
  await closeNextBatchDialogIfShown(page);
  await expect(page.locator("body")).toContainText(/Let's print something/i);
  await clickNamed(page, "Show me how →");
  await expect(page.locator("body")).toContainText(
    /Tap here to start your first print order/i,
  );
}

async function closeNextBatchDialogIfShown(page: Page): Promise<void> {
  let readyState = "waiting";
  await expect
    .poll(
      async () => {
        const close = await visibleLocators(
          page.getByLabel("Close batch information"),
        );
        if (close.length === 1) {
          readyState = "dialog";
          return readyState;
        }
        const body = (await page.locator("body").textContent()) ?? "";
        readyState = /Let's print something/i.test(body)
          ? "ready"
          : /See how it works|No deliveries scheduled today|Catch the next batch|batches are full|last batch has departed/i.test(
                body,
              )
            ? "dialog"
            : "waiting";
        return readyState;
      },
      { message: "customer home or next-batch dialog is ready" },
    )
    .toMatch(/^(?:dialog|ready)$/);
  if (readyState === "dialog") {
    await activateNamedButtonWithDomClick(page, "Close batch information");
    await expect(
      page.getByRole("button", { name: /^Close batch information/i }),
    ).toHaveCount(0);
  }
  await expect(page.locator("body")).toContainText(/Let's print something/i);
}

async function completeCheckoutPipelineTutorial(page: Page): Promise<void> {
  for (const body of [
    /Quick review of what you're printing/i,
    /Choose Delivery, Pickup, or Multi-drop/i,
    /Review the available payment option/i,
    /That's the Place Order button/i,
  ]) {
    await expect(page.locator("body")).toContainText(body);
    await clickNamed(page, /Got it/);
    await page.waitForTimeout(450);
  }
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
  const expectedAddress =
    name === "Ven" ? betaAddresses.ven : betaAddresses.mark;
  if (name === "Mark") {
    await navigateMobile(actor.page, mobileURL, "/customer/profile/account");
    await expect(actor.page.locator("body")).toContainText(/Student/i);
    await expect(actor.page.locator("body")).toContainText(/Architecture/i);
    await capture(run, actor, 4, /Account Details/i, { userId });
    await navigateMobile(actor.page, mobileURL, "/customer/home");
    await closeNextBatchDialogIfShown(actor.page);
    await capture(
      run,
      actor,
      5,
      /Let's print something/i,
      {
        userId,
        betaRank: base.betaRank,
      },
      {
        // The session next-batch dialog fires whenever the slot fetch lands,
        // so it can pop between a close check and this capture — close it
        // inside the assertion so the two act atomically.
        assertState: async () => {
          await closeNextBatchDialogIfShown(actor.page);
        },
      },
    );
  } else {
    await navigateMobile(actor.page, mobileURL, "/customer/home");
    await closeNextBatchDialogIfShown(actor.page);
    await capture(
      run,
      actor,
      18,
      /Let's print something/i,
      {
        userId,
        betaRank: base.betaRank,
      },
      {
        variant: "ven-beta-credits",
        assertState: async () => {
          await closeNextBatchDialogIfShown(actor.page);
        },
      },
    );
  }

  await beginFirstOrderTutorial(actor.page);
  if (name === "Mark") {
    await capture(run, actor, 6, /Tap here to start your first print order/i, {
      userId,
    });
  }
  await clickNamed(actor.page, /Got it/);
  await expect(actor.page.locator("body")).toContainText(
    /Pick Paper Printing for documents, photos, and posters/i,
  );
  await clickNamed(actor.page, /Got it/);
  await expect(actor.page.locator("body")).toContainText(
    /Set your paper size, color mode, and copies/i,
  );
  if (name === "Mark") await capture(run, actor, 7, /Paper Specs/i, { userId });
  await clickNamed(actor.page, /Got it/);
  await expect(actor.page.locator("body")).toContainText(
    /Tap Continue when your specs look right/i,
  );
  await clickNamed(actor.page, /Got it/);
  await expect(actor.page.locator("body")).toContainText(/Upload your file/i);
  // The upload screen heading can paint one frame before its tutorial bubble.
  // Let the overlay mount, then dismiss it when this account receives it.
  await actor.page.waitForTimeout(600);
  await clickOptional(actor.page, /Got it/);
  await expect(
    actor.page.getByText(/Tap to select file/i).first(),
  ).toBeVisible();
  const uploadResponsePromise = actor.page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      apiPath(response, "/api/files/upload"),
    { timeout: 60_000 },
  );
  const fileChooserPromise = actor.page.waitForEvent("filechooser", {
    timeout: 15_000,
  });
  await clickNamed(actor.page, /Tap to select file/i);
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(uploadFixture);
  const uploadBody = await strictBrowserJson<JsonRecord>(
    await uploadResponsePromise,
    `${name} real print upload`,
  );
  const fileId = positiveId(uploadBody.id, `${name} file id`);
  let uploadTutorialState = "waiting";
  await expect
    .poll(async () => {
      const body = (await actor.page.locator("body").textContent()) ?? "";
      uploadTutorialState = /Drop a file here, or tap to browse/i.test(body)
        ? "select-file"
        : /File ready — tap Continue to checkout/i.test(body)
          ? "file-ready"
          : "waiting";
      return uploadTutorialState;
    })
    .toMatch(/^(?:select-file|file-ready)$/);
  if (uploadTutorialState === "select-file") {
    await clickNamed(actor.page, /Got it/);
  }
  await expect(actor.page.locator("body")).toContainText(
    /File ready — tap Continue to checkout/i,
  );
  if (name === "Mark")
    await capture(run, actor, 8, /Preview|Coin|beta-upload/i, {
      userId,
      fileId,
    });
  await clickNamed(actor.page, /Got it/);
  await expect(actor.page.locator("body")).toContainText(
    /Add a delivery address/i,
  );
  if (name === "Mark")
    await capture(run, actor, 9, /Add a delivery address/i, { userId, fileId });

  await clickNamed(actor.page, "Add address →");
  await expect(actor.page.locator("body")).toContainText(/Save Address/i);
  const addressId = await saveAddressThroughUi(base, mobileURL, {
    navigate: false,
  });
  await expect(actor.page.locator("body")).toContainText(
    /Quick review of what you're printing/i,
  );
  await completeCheckoutPipelineTutorial(actor.page);
  if (name === "Mark") {
    await navigateMobile(actor.page, mobileURL, "/customer/addresses");
    await expect(
      actor.page.getByRole("button", {
        name: accessibleNamePattern(`Edit ${expectedAddress.label}`),
      }),
    ).toBeVisible();
    await capture(
      run,
      actor,
      10,
      /Saved Addresses/i,
      {
        userId,
        fileId,
        addressId,
      },
      { variant: "mark-saved-recent-address" },
    );
  }
  await navigateMobile(actor.page, mobileURL, "/customer/order/checkout");
  if (name === "Mark")
    await capture(
      run,
      actor,
      10,
      /Pick a delivery address|Delivery/i,
      { userId, fileId, addressId },
      { variant: "mark-checkout-before-address" },
    );
  // Ven does not take the step-10 evidence pause, so give the same checkout
  // coach mark time to mount before asserting the repeated tutorial.
  await actor.page.waitForTimeout(600);
  const multiDropTutorial =
    /Tap Multi-drop to send prints to different addresses/i;
  if (name === "Mark") {
    await expect(actor.page.locator("body")).toContainText(multiDropTutorial);
    await clickNamed(actor.page, /Got it/);
  } else if (
    multiDropTutorial.test(await actor.page.locator("body").innerText())
  ) {
    await clickNamed(actor.page, /Got it/);
  }
  await clickNamed(actor.page, "Pick a delivery address");
  await expect(actor.page.locator("body")).toContainText(
    /Choose a delivery address/i,
  );
  await clickNamed(actor.page, expectedAddress.label);
  await expect(actor.page.locator("body")).toContainText(expectedAddress.label);
  if (name === "Mark")
    await capture(run, actor, 10, /Mark beta route stop/i, {
      userId,
      fileId,
      addressId,
    });
  await clickNamed(actor.page, "Standard");
  await clickNamed(actor.page, "Choose payment method");
  await expect(actor.page.locator("body")).toContainText(
    /Only GRIDGO Credits is available during beta testing/i,
  );
  await actor.page.waitForTimeout(600);
  const paymentTutorial = /Top up once and pay instantly/i;
  if (name === "Mark") {
    await expect(actor.page.locator("body")).toContainText(paymentTutorial);
    await clickNamed(actor.page, /Got it/);
  } else if (
    paymentTutorial.test(await actor.page.locator("body").innerText())
  ) {
    await clickNamed(actor.page, /Got it/);
  }
  await assertBetaOnlyPaymentOptions(actor.page);
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

  const orderRequestPromise = actor.page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/api/orders/batch"),
  );
  const orderBody = await waitForStrict2xx<JsonRecord>(
    actor.page,
    (response) =>
      response.request().method() === "POST" &&
      apiPath(response, "/api/orders/batch"),
    () => clickNamed(actor.page, "Place Order"),
    `${name} credits checkout`,
  );
  const orderPayload = (await orderRequestPromise).postDataJSON() as JsonRecord;
  assertStandardCheckoutPayload(orderPayload);
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
    await navigateMobile(actor.page, mobileURL, "/customer/orders");
    await capture(
      run,
      actor,
      14,
      orderRef,
      { userId, fileId, addressId, orderId, orderRef },
      { variant: "mark-order-list" },
    );
    await actor.page
      .getByRole("button", { name: new RegExp(`^Order ${orderRef}\\b`, "i") })
      .click();
    await capture(run, actor, 14, new RegExp(`Order #${orderRef}`, "i"), {
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
  const ridersResponsePromise = admin.page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      apiPath(response, "/api/admin/riders"),
  );
  await admin.page.goto(`${adminURL}/orders/show/${customer.orderId}`);
  const riders = await strictBrowserJson<JsonRecord[]>(
    await ridersResponsePromise,
    `load eligible riders before assigning ${customer.name}`,
  );
  const juan = riders.find((rider) => /Juan/i.test(String(rider.full_name)));
  expect(juan, "Juan must be returned by the admin rider API").toBeTruthy();
  expect(juan).toMatchObject({
    is_available: true,
    assignment_eligible: true,
  });
  await expect(admin.page.locator("body")).toContainText(customer.orderRef);
  for (const label of [
    "File Verified",
    "Printing",
    "Finishing",
    "Quality Checked",
    "Ready for Dispatch",
  ]) {
    await admin.page
      .getByLabel(`Update status for ${customer.orderRef}`)
      .first()
      .click({ timeout: 15_000 });
    await admin.page
      .locator(".ant-select-dropdown:visible")
      .getByText(label, { exact: true })
      .click({ timeout: 15_000 });
    const responsePromise = admin.page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        apiPath(response, `/api/admin/orders/${customer.orderId}/status`),
    );
    await admin.page
      .getByRole("button", { name: "OK" })
      .click({ timeout: 15_000 });
    await strictBrowserJson(
      await responsePromise,
      `${customer.name} production transition ${label}`,
    );
    await expect(admin.page.locator(".ant-modal-wrap:visible")).toHaveCount(0);
  }
  await admin.page.evaluate(() => window.scrollTo(0, 0));
  await expect(admin.page.getByText(customer.orderRef).first()).toBeVisible();
  await expect(
    admin.page.getByText("Ready for Dispatch", { exact: true }).first(),
  ).toBeVisible();
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
  await expect(admin.page.locator(".ant-modal-wrap:visible")).toHaveCount(0);
  await expect(admin.page.getByText(/Assigned rider: Juan/i)).toBeVisible();
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
  await navigateMobile(actor.page, mobileURL, "/auth/login");
  await fillNamed(actor.page, "you@example.com", email);
  await fillNamed(actor.page, "Enter your password", password);
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
    () => activateNamedButtonWithKeyboard(actor.page, label),
    `Juan action ${String(label)} for assignment ${assignmentId}`,
  );
}

async function openRiderAssignment(
  actor: BetaActorRuntime,
  mobileURL: string,
  assignmentId: number,
): Promise<void> {
  await navigateMobile(
    actor.page,
    mobileURL,
    `/rider/deliveries/${assignmentId}`,
  );
}

async function assertRiderPlannedStopOrder(
  page: Page,
  ven: CustomerRun,
  mark: CustomerRun,
): Promise<void> {
  const plannedStops = page.getByRole("button", { name: /^STOP \d+/i });
  await expect(plannedStops).toHaveCount(2);
  await expect(
    page.getByRole("button", {
      name: new RegExp(`^STOP 1\\b.*Ven.*${ven.orderRef}`, "i"),
    }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", {
      name: new RegExp(`^STOP 2\\b.*Mark.*${mark.orderRef}`, "i"),
    }),
  ).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^STOP 3\b/i })).toHaveCount(0);
}

async function mountRiderTracking(
  actor: BetaActorRuntime,
  mobileURL: string,
  assignmentId: number,
): Promise<void> {
  await navigateMobile(actor.page, mobileURL, "/rider/deliveries");
  await actor.page.waitForTimeout(250);
  await navigateMobile(
    actor.page,
    mobileURL,
    `/rider/deliveries/${assignmentId}/active`,
  );
  await expect(
    actor.page.getByRole("button", { name: /^Refresh GPS location/i }),
  ).toBeVisible();
}

async function refreshRiderTracking(actor: BetaActorRuntime): Promise<void> {
  await activateNamedButtonWithDomClick(actor.page, "Refresh GPS location");
}

async function drawAndSubmitSignature(
  actor: BetaActorRuntime,
  assignmentId: number,
  beforeSubmit?: () => Promise<void>,
): Promise<void> {
  const viewport = actor.page.viewportSize();
  expect(viewport, "rider proof viewport must be available").not.toBeNull();
  const proofButton = actor.page.getByRole("button", {
    name: /open proof of delivery/i,
  });
  // Arrival must reveal a keyboard/screen-reader-operable proof action without
  // requiring an undiscoverable drag. Since the rider map uplift the slider
  // itself is that action ("Swipe to open proof of delivery" exposes a
  // semantics button with onTap); the physical swipe remains covered by the
  // Flutter component regression test.
  await expect(proofButton).toHaveCount(1);
  await expect(proofButton).toBeVisible();
  await proofButton.click();
  await expect(actor.page.getByText("Proof of Delivery")).toBeVisible();
  const sign = actor.page.getByLabel(/^Signature pad/i);
  await expect(sign).toHaveCount(1);
  await sign.scrollIntoViewIfNeeded({ timeout: 15_000 });
  await expect(sign).toBeVisible();
  const signBox = await sign.boundingBox();
  expect(signBox).not.toBeNull();
  expect(signBox!.height).toBeGreaterThanOrEqual(180);
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
  await expect(actor.page.getByText("Sign here", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    actor.page.getByRole("button", { name: /^Submit proof/i }),
  ).toBeEnabled();
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
  await foregroundFlutterPage(page);
  const requirementId = positiveId(
    customer.surveyRequirementId,
    `${customer.name} recorded survey requirement id`,
  );
  const answeredIndexes: number[] = [];
  for (const index of surveyQuestionIndexes) {
    const question = page.getByRole("group", {
      name: new RegExp(`Question ${index + 1} of 14`, "i"),
    });
    await expect(question).toBeVisible();
    const sliderLocator = question.getByRole("slider");
    await expect
      .poll(async () => (await visibleLocators(sliderLocator)).length, {
        message: `${customer.name} question ${index + 1} slider availability`,
      })
      .toBe(1);
    const sliders = await visibleLocators(sliderLocator);
    expect(sliders, `${customer.name} question ${index} slider`).toHaveLength(
      1,
    );
    await expect(sliders[0]).toHaveAttribute(
      "aria-label",
      `Feedback rating for question ${index + 1}`,
    );
    await expect(question).toHaveAccessibleName(/NEUTRAL/i);
    await sliders[0].focus();
    await sliders[0].press("ArrowRight");
    await expect(sliders[0]).toHaveAttribute("aria-valuetext", "AGREE");
    await clickNamed(page, "Next");
    answeredIndexes.push(index);
  }
  expect(answeredIndexes).toEqual(surveyQuestionIndexes);
  await fillNamed(
    page,
    "Price feedback",
    `${customer.name} would pay for this delivery convenience.`,
  );
  await fillNamed(
    page,
    "Upload process feedback",
    `${customer.name} completed the upload without leaving the app.`,
  );
  await fillNamed(
    page,
    "Future feature feedback",
    "Keep route updates and saved print presets.",
  );
  await fillNamed(
    page,
    "Additional delivery feedback",
    "All fourteen required questions were answered through the UI.",
  );
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
  let requestedShareUrl: string | undefined;
  await actor.context.route(external, async (route) => {
    requestedShareUrl = route.request().url();
    await route.abort("aborted");
  });
  const existingPages = new Set(actor.context.pages());
  await clickNamed(actor.page, "Share to Facebook");
  await expect
    .poll(() => requestedShareUrl, {
      message: "social share must request a supported provider URL",
    })
    .toMatch(external);
  validateFacebookShareRequest(requestedShareUrl!);
  for (const page of actor.context.pages()) {
    if (!existingPages.has(page) && !page.isClosed()) await page.close();
  }
}

function validateFacebookShareRequest(requestedShareUrl: string): void {
  const requested = new URL(requestedShareUrl);
  expect(requested.hostname).toBe("www.facebook.com");
  expect(requested.pathname).toBe("/sharer/sharer.php");
  expect(requested.searchParams.get("u"), "shared GRIDGO URL").toBe(
    expectedGridShareURL,
  );
}

async function uploadTestimonialAndHold(
  customer: CustomerRun,
  afterShare?: () => Promise<void>,
): Promise<number> {
  const page = customer.actor.page;
  await launchSocialAndAbortExternal(customer);
  if (afterShare) await afterShare();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 15_000 }),
    clickNamed(page, "Tap to add a photo of your prints"),
  ]);
  await chooser.setFiles(uploadFixture);
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

async function acknowledgeExpectedHttpConsoleError(
  actor: BetaActorRuntime,
  pathname: string,
  status: number,
): Promise<void> {
  const matchingIndexes = () =>
    actor.console.flatMap((entry, index) => {
      if (entry.type !== "error" || entry.url == null) return [];
      const matchesPath = new URL(entry.url).pathname === pathname;
      const matchesStatus = new RegExp(`\\b${status}\\b`).test(entry.text);
      return matchesPath && matchesStatus ? [index] : [];
    });
  await expect
    .poll(() => matchingIndexes().length, {
      message: `expected ${status} console response for ${pathname}`,
      timeout: 5_000,
    })
    .toBe(1);
  actor.console.splice(matchingIndexes()[0], 1);
}

test.describe.serial("opt-in four-context visual beta release workflow", () => {
  test("drives admin, Mark, Ven, and Juan through the screenshot-backed release journey", async ({
    browser,
    request,
  }, testInfo) => {
    test.setTimeout(visualJourneyTimeoutMs);
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
    const run = beginEvidenceRun(runLabel, {
      mobileURL,
      adminURL,
      apiBaseURL,
    });
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
      apiBaseURL,
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
        email: `mark-${runLabel.slice(0, 8)}@example.test`,
        password: markPassword,
        mobileURL,
        run,
        registrationStep: 3,
      });
      expect(markBase.betaRank, "fresh-stack Mark beta rank").toBe(1);
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
      await capture(run, actors.admin, 16, /Assigned rider: Juan/i, {
        orderId: mark.orderId,
        orderRef: mark.orderRef,
        assignmentId: mark.assignmentId,
      });
      await navigateMobile(actors.juan.page, mobileURL, "/rider/deliveries");
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
        email: `ven-${runLabel.slice(0, 8)}@example.test`,
        password: venPassword,
        mobileURL,
        run,
        registrationStep: 18,
      });
      expect(venBase.betaRank, "Ven follows Mark in beta enrollment").toBe(
        mark.betaRank + 1,
      );
      expect(venBase.betaRank, "fresh-stack Ven beta rank").toBe(2);
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
        if ((await checkbox.isChecked()) !== Boolean(keep)) {
          await checkbox.locator("xpath=ancestor::label").click();
        }
        await expect(checkbox).toBeChecked({ checked: Boolean(keep) });
      }
      await expect(
        panel.getByText("2 stops selected", { exact: true }),
      ).toBeVisible();
      const planRequestPromise = actors.admin.page.waitForRequest(
        (candidate) =>
          candidate.method() === "POST" &&
          /\/api\/admin\/riders\/\d+\/dispatch-plan$/.test(
            new URL(candidate.url()).pathname,
          ),
      );
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
      const planRequestBody = (await planRequestPromise).postDataJSON() as {
        assignmentIds?: number[];
      };
      expect(
        [...(planRequestBody.assignmentIds ?? [])].sort((a, b) => a - b),
        "admin dispatch request contains only Mark and Ven",
      ).toEqual([mark.assignmentId, ven.assignmentId].sort((a, b) => a - b));
      validatePersistedDispatchPlan(planBody, {
        venAssignmentId: ven.assignmentId,
        markAssignmentId: mark.assignmentId,
      });
      const planId = positiveId(planBody.id, "dispatch plan id");
      const planVersion = positiveId(planBody.version, "dispatch plan version");

      await navigateMobile(actors.juan.page, mobileURL, "/rider/home");
      await assertRiderPlannedStopOrder(actors.juan.page, ven, mark);

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
      }
      const storePickupLocation = await positionRiderAtStoreBeforePickup(
        actors.juan,
      );
      for (const customer of [ven, mark]) {
        await openRiderAssignment(
          actors.juan,
          mobileURL,
          customer.assignmentId,
        );
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
      await navigateMobile(actors.juan.page, mobileURL, "/rider/home");
      await assertRiderPlannedStopOrder(actors.juan.page, ven, mark);
      await capture(run, actors.juan, 21, /Today's Route/i, {
        markOrderId: mark.orderId,
        venOrderId: ven.orderId,
        markAssignmentId: mark.assignmentId,
        venAssignmentId: ven.assignmentId,
        latitude: storePickupLocation.latitude,
        longitude: storePickupLocation.longitude,
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
      await persistedPanel.evaluate((element) =>
        element.scrollIntoView({ block: "center", inline: "nearest" }),
      );
      await expect(persistedPanel.getByTestId("dispatch-stop-1")).toBeVisible();
      await expect(persistedPanel.getByTestId("dispatch-stop-2")).toBeVisible();
      await capture(run, actors.admin, 22, /OSRM/i, {
        dispatchPlanId: planId,
        dispatchPlanVersion: planVersion,
        markAssignmentId: mark.assignmentId,
        venAssignmentId: ven.assignmentId,
      });
      await navigateMobile(actors.ven.page, mobileURL, "/customer/home");
      await navigateMobile(actors.mark.page, mobileURL, "/customer/home");
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

      const venFirstLiveLocation = await setAcknowledgedGeolocation({
        riderPage: actors.juan.page,
        apiBaseURL,
        customerToken: ven.token,
        checkpoint: betaCheckpoint("road-to-ven"),
        expectedAssignmentId: ven.assignmentId,
        expectedPlanVersion: planVersion,
        mountRiderTracking: () =>
          mountRiderTracking(actors.juan, mobileURL, ven.assignmentId),
        refreshRiderTracking: () => refreshRiderTracking(actors.juan),
        assertCustomerMarker: async () => {
          await assertLiveTrackingUi(actors.ven);
        },
      });
      await capture(run, actors.ven, 23, /1st (?:of \d+ )?in queue/i, {
        orderId: ven.orderId,
        assignmentId: ven.assignmentId,
        dispatchPlanVersion: planVersion,
        latitude: Number(venFirstLiveLocation.latitude),
        longitude: Number(venFirstLiveLocation.longitude),
      });

      await assertLocationPrivacyDenied({
        apiBaseURL,
        token: mark.token,
        assignmentId: mark.assignmentId,
      });
      await assertPrivateQueueUi(actors.mark.page);
      await capture(run, actors.mark, 24, /2nd (?:of \d+ )?in queue/i, {
        orderId: mark.orderId,
        dispatchPlanVersion: planVersion,
      });

      for (const checkpointId of ["ven"] as const) {
        await setAcknowledgedGeolocation({
          riderPage: actors.juan.page,
          apiBaseURL,
          customerToken: ven.token,
          checkpoint: betaCheckpoint(checkpointId),
          expectedAssignmentId: ven.assignmentId,
          expectedPlanVersion: planVersion,
          mountRiderTracking: () =>
            mountRiderTracking(actors.juan, mobileURL, ven.assignmentId),
          refreshRiderTracking: () => refreshRiderTracking(actors.juan),
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

      const venState = await authenticatedGet<{
        accountStatus: string;
        holds: Array<{ requirementId: number; orderId: number }>;
      }>(
        request,
        apiBaseURL,
        "/users/me/account-state",
        ven.token,
        "load Ven required survey state immediately after delivery",
      );
      expect(venState).toMatchObject({
        accountStatus: "survey_required",
        holds: [{ orderId: ven.orderId }],
      });
      ven.surveyRequirementId = positiveId(
        venState.holds[0].requirementId,
        "Ven survey requirement id",
      );
      await revealAutomaticSurvey(actors.ven);
      const assertRequiredSurvey = (page: Page) => async () => {
        await expect(
          page.getByRole("group", { name: /Question 1 of 14/i }),
        ).toBeVisible();
      };
      await capture(
        run,
        actors.ven,
        28,
        /survey|feedback/i,
        {
          orderId: ven.orderId,
          surveyRequirementId: ven.surveyRequirementId,
        },
        { assertState: assertRequiredSurvey(actors.ven.page) },
      );

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
      // Mark stays on the same document while Juan completes Ven. Chromium
      // throttles background CanvasKit frames, so foreground the preserved
      // document and let Flutter publish its newly promoted semantics tree.
      await foregroundFlutterPage(actors.mark.page);
      await expect(
        actors.mark.page.getByRole("button", {
          name: "Open live tracking",
          exact: true,
        }),
      ).toBeVisible();
      const markPromotedLocation = await setAcknowledgedGeolocation({
        riderPage: actors.juan.page,
        apiBaseURL,
        customerToken: mark.token,
        checkpoint: betaCheckpoint("road-to-mark"),
        expectedAssignmentId: mark.assignmentId,
        expectedPlanVersion: planVersion,
        mountRiderTracking: () =>
          mountRiderTracking(actors.juan, mobileURL, mark.assignmentId),
        refreshRiderTracking: () => refreshRiderTracking(actors.juan),
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
          mountRiderTracking: () =>
            mountRiderTracking(actors.juan, mobileURL, mark.assignmentId),
          refreshRiderTracking: () => refreshRiderTracking(actors.juan),
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

      const markState = await authenticatedGet<{
        accountStatus: string;
        holds: Array<{ requirementId: number; orderId: number }>;
      }>(
        request,
        apiBaseURL,
        "/users/me/account-state",
        mark.token,
        "load Mark required survey state immediately after delivery",
      );
      expect(markState).toMatchObject({
        accountStatus: "survey_required",
        holds: [{ orderId: mark.orderId }],
      });
      mark.surveyRequirementId = positiveId(
        markState.holds[0].requirementId,
        "Mark survey requirement id",
      );
      await revealAutomaticSurvey(actors.mark);
      await capture(
        run,
        actors.mark,
        28,
        /survey|feedback/i,
        {
          orderId: mark.orderId,
          surveyRequirementId: mark.surveyRequirementId,
        },
        {
          variant: "mark-automatic-survey",
          assertState: assertRequiredSurvey(actors.mark.page),
        },
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
        await navigateMobile(customer.actor.page, mobileURL, "/auth/login");
        await fillNamed(customer.actor.page, "you@example.com", customer.email);
        await fillNamed(
          customer.actor.page,
          "Enter your password",
          customer.password,
        );
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
        await acknowledgeExpectedHttpConsoleError(
          customer.actor,
          "/api/auth/login",
          403,
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
        await clickNamed(customer.actor.page, "Sign out");
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
          /Good morning|Catch the next batch|GRIDGO Credits|Delivery Status/i,
          { userId: customer.userId, orderId: customer.orderId },
          {
            variant:
              customer.name === "Mark"
                ? undefined
                : `${customer.name.toLowerCase()}-restored-login`,
            assertState: async () => {
              await expect(customer.actor.page).toHaveURL(
                /#\/customer\/home(?:\?|$)/,
              );
              await expect(customer.actor.page.locator("body")).toContainText(
                /Good morning|Catch the next batch|GRIDGO Credits|Delivery Status/i,
              );
            },
          },
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
