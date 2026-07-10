import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  ConsoleMessage,
  Page,
} from "@playwright/test";

import { betaCheckpoint } from "./beta-locations";
import { sanitizeEvidenceText, sanitizeEvidenceUrl } from "./beta-evidence";

export type BetaActorName = "admin" | "mark" | "ven" | "juan";

export type BetaActorDefinition = {
  role: "admin" | "customer" | "rider";
  surface: "admin" | "mobile";
  viewport: { width: number; height: number };
  storageKey: string;
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

export const betaActors: Record<BetaActorName, BetaActorDefinition> = {
  admin: {
    role: "admin",
    surface: "admin",
    viewport: { width: 1440, height: 900 },
    storageKey: "beta-admin",
  },
  mark: {
    role: "customer",
    surface: "mobile",
    viewport: { width: 393, height: 852 },
    storageKey: "beta-mark",
  },
  ven: {
    role: "customer",
    surface: "mobile",
    viewport: { width: 393, height: 852 },
    storageKey: "beta-ven",
  },
  juan: {
    role: "rider",
    surface: "mobile",
    viewport: { width: 393, height: 852 },
    storageKey: "beta-juan",
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
    const store = betaCheckpoint("store");
    options.geolocation = store;
    options.permissions = definition.permissions;
  }
  return options;
}

export async function enableFlutterSemantics(page: Page): Promise<void> {
  const placeholder = page.locator("flt-semantics-placeholder");
  if (await placeholder.count()) {
    await placeholder.click({ position: { x: 1, y: 1 } });
  }
  await page.locator("flt-semantics-host, [role]").first().waitFor({
    state: "attached",
    timeout: 20_000,
  });
}

export async function createBetaActorContexts(
  browser: Browser,
  options: {
    mobileURL: string;
    adminURL: string;
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
