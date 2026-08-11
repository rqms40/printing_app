import {
  expect,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type ConsoleMessage,
  type Page,
} from "@playwright/test";

import { betaPreStoreLocation } from "./beta-locations";
import { sanitizeEvidenceText, sanitizeEvidenceUrl } from "./beta-evidence";

export type BetaActorName = "admin" | "mark" | "ven" | "juan";

export type BetaActorDefinition = {
  role: "admin" | "customer" | "rider";
  surface: "admin" | "mobile";
  viewport: { width: number; height: number };
  storageKey: string;
  clientIp: string;
  permissions?: string[];
};

export type ActorConsoleEntry = {
  type: string;
  text: string;
  url?: string;
};

export type ActorNetworkEntry = {
  method: string;
  url: string;
  status?: number;
  failure?: string;
};

export type BetaActorRuntime = {
  name: BetaActorName;
  definition: BetaActorDefinition;
  context: BrowserContext;
  page: Page;
  console: ActorConsoleEntry[];
  network: ActorNetworkEntry[];
};

export async function reloadProviderBackedPage(
  page: Page,
  options: { enableSemantics?: boolean } = {},
): Promise<void> {
  await page.reload({ waitUntil: "domcontentloaded" });
  if (options.enableSemantics !== false) await enableFlutterSemantics(page);
}

export type ExternallyUpdatedOrderState = {
  orderStatus: unknown;
  pricingStatus: unknown;
  quoteAssignmentId: number;
};

export async function refreshExternallyUpdatedOrder(options: {
  page: Page;
  readOrderState: () => Promise<ExternallyUpdatedOrderState>;
  expectedOrderState: ExternallyUpdatedOrderState;
  afterReload?: () => Promise<void>;
  enableSemantics?: boolean;
  message: string;
}): Promise<void> {
  await expect
    .poll(options.readOrderState, { message: options.message })
    .toEqual(options.expectedOrderState);
  await reloadProviderBackedPage(options.page, {
    enableSemantics: options.enableSemantics,
  });
  await options.afterReload?.();
}

export const betaActors: Record<BetaActorName, BetaActorDefinition> = {
  admin: {
    role: "admin",
    surface: "admin",
    viewport: { width: 1440, height: 900 },
    storageKey: "beta-admin",
    clientIp: "198.51.100.10",
  },
  mark: {
    role: "customer",
    surface: "mobile",
    viewport: { width: 393, height: 852 },
    storageKey: "beta-mark",
    clientIp: "198.51.100.20",
  },
  ven: {
    role: "customer",
    surface: "mobile",
    viewport: { width: 393, height: 852 },
    storageKey: "beta-ven",
    clientIp: "198.51.100.30",
  },
  juan: {
    role: "rider",
    surface: "mobile",
    viewport: { width: 393, height: 852 },
    storageKey: "beta-juan",
    clientIp: "198.51.100.40",
    permissions: ["geolocation"],
  },
};

function consoleEntry(
  message: ConsoleMessage,
  protectedSecrets: ReadonlySet<string>,
): ActorConsoleEntry {
  const location = message.location();
  return {
    type: message.type(),
    text: sanitizeEvidenceText(message.text(), protectedSecrets),
    ...(location.url
      ? { url: sanitizeEvidenceUrl(location.url, protectedSecrets) }
      : {}),
  };
}

function actorContextOptions(
  definition: BetaActorDefinition,
  mobileURL: string,
  adminURL: string,
): BrowserContextOptions {
  const origin = definition.surface === "admin" ? adminURL : mobileURL;
  const options: BrowserContextOptions = {
    baseURL: origin,
    viewport: definition.viewport,
    recordVideo: {
      dir:
        process.env.GRIDGO_BETA_VIDEO_DIR ?? "/tmp/gridgo-beta-visual-videos",
    },
  };
  if (definition.role === "rider") {
    options.geolocation = betaPreStoreLocation;
    options.permissions = definition.permissions;
  }
  return options;
}

export async function enableFlutterSemantics(page: Page): Promise<void> {
  const semanticsHost = page.locator("flt-semantics-host");
  const placeholder = page.locator("flt-semantics-placeholder");
  await page.waitForFunction(
    () =>
      document.querySelector("flt-semantics-placeholder") !== null ||
      (document.querySelector("flt-semantics-host")?.childElementCount ?? 0) >
        0,
    undefined,
    { timeout: 20_000 },
  );
  if (await placeholder.count()) {
    await placeholder.waitFor({ state: "attached", timeout: 20_000 });
    await placeholder.evaluate((element) => {
      if (element instanceof HTMLElement) {
        element.click();
      } else {
        element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
    });
    await placeholder.waitFor({ state: "detached", timeout: 20_000 });
  }
  await semanticsHost.waitFor({
    state: "attached",
    timeout: 20_000,
  });
  await page.waitForFunction(
    () =>
      (document.querySelector("flt-semantics-host")?.childElementCount ?? 0) >
      0,
    undefined,
    { timeout: 20_000 },
  );
}

export async function navigateMobile(
  page: Page,
  mobileURL: string,
  route: string,
): Promise<void> {
  const baseURL = mobileURL.replace(/\/$/, "");
  const origin = new URL(baseURL).origin;
  const normalizedRoute = route.startsWith("/") ? route : `/${route}`;
  const expectedHash = `#${normalizedRoute}`;
  const currentURL = new URL(page.url());
  if (
    currentURL.origin !== origin ||
    (await page.locator("flutter-view").count()) === 0
  ) {
    await page.goto(`${baseURL}/`);
    await enableFlutterSemantics(page);
  }
  if (["", "#/splash"].includes(new URL(page.url()).hash)) {
    await page.waitForURL(
      (url) =>
        url.origin === origin && url.hash !== "" && url.hash !== "#/splash",
      { timeout: 30_000 },
    );
  }
  if (new URL(page.url()).hash !== expectedHash) {
    await page.evaluate((hash) => {
      window.location.hash = hash.slice(1);
    }, expectedHash);
  }
  await page.waitForURL(
    (url) => url.origin === origin && url.hash === expectedHash,
    { timeout: 20_000 },
  );
  await enableFlutterSemantics(page);
}

export async function createBetaActorContexts(
  browser: Browser,
  options: {
    mobileURL: string;
    adminURL: string;
    apiBaseURL: string;
    protectedSecrets?: ReadonlySet<string>;
  },
): Promise<Record<BetaActorName, BetaActorRuntime>> {
  const runtimes = {} as Record<BetaActorName, BetaActorRuntime>;
  const protectedSecrets = options.protectedSecrets ?? new Set<string>();
  for (const name of Object.keys(betaActors) as BetaActorName[]) {
    const definition = betaActors[name];
    const context = await browser.newContext(
      actorContextOptions(definition, options.mobileURL, options.adminURL),
    );
    const apiPrefix = `${options.apiBaseURL.replace(/\/$/, "")}/`;
    await context.route(
      (url) => url.href.startsWith(apiPrefix),
      async (route) => {
        await route.continue({
          headers: {
            ...route.request().headers(),
            "X-Forwarded-For": definition.clientIp,
          },
        });
      },
    );
    const page = await context.newPage();
    const console: ActorConsoleEntry[] = [];
    const network: ActorNetworkEntry[] = [];
    page.on("console", (message) =>
      console.push(consoleEntry(message, protectedSecrets)),
    );
    page.on("pageerror", (error) =>
      console.push({
        type: "pageerror",
        text: sanitizeEvidenceText(error.message, protectedSecrets),
      }),
    );
    page.on("response", (response) => {
      network.push({
        method: response.request().method(),
        url: sanitizeEvidenceUrl(response.url(), protectedSecrets),
        status: response.status(),
      });
    });
    page.on("requestfailed", (request) => {
      network.push({
        method: request.method(),
        url: sanitizeEvidenceUrl(request.url(), protectedSecrets),
        failure: sanitizeEvidenceText(
          request.failure()?.errorText ?? "request failed",
          protectedSecrets,
        ),
      });
    });
    runtimes[name] = { name, definition, context, page, console, network };
  }
  return runtimes;
}

export async function closeBetaActorContexts(
  actors: Partial<Record<BetaActorName, BetaActorRuntime>>,
): Promise<void> {
  await Promise.all(
    Object.values(actors).map(async (actor) => {
      if (actor) await actor.context.close();
    }),
  );
}
