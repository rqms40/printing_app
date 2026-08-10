import { expect, test, type Page } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CATALOG_V1_10_GROUPS } from "../../../server/src/products/catalog-v1-10.definition";

import {
  enableFlutterSemantics,
  navigateMobile,
  refreshExternallyUpdatedOrder,
} from "../fixtures/beta-actors";
import {
  sanitizeEvidenceText,
  sanitizeEvidenceUrl,
} from "../fixtures/beta-evidence";

type CatalogVisualStep = {
  id: number;
  slug: string;
  surface: "mobile-client" | "admin-web";
  assertion: string;
};

type JsonRecord = Record<string, unknown>;

const catalogVisualSteps: readonly CatalogVisualStep[] = [
  {
    id: 1,
    slug: "catalog-groups-light",
    surface: "mobile-client",
    assertion: "Light Mode group grid shows exactly four catalog groups",
  },
  {
    id: 2,
    slug: "catalog-groups-dark",
    surface: "mobile-client",
    assertion: "Dark Mode group grid shows exactly four catalog groups",
  },
  {
    id: 3,
    slug: "catalog-products-examples",
    surface: "mobile-client",
    assertion: "Leaf products retain API examples and RFQ availability copy",
  },
  {
    id: 4,
    slug: "flyers-requirements",
    surface: "mobile-client",
    assertion: "Flyers requirements are rendered from catalog definitions",
  },
  {
    id: 5,
    slug: "rfq-review-pending",
    surface: "mobile-client",
    assertion: "RFQ review has no payment control and no fabricated zero quote",
  },
  {
    id: 6,
    slug: "quoted-order-acceptance",
    surface: "mobile-client",
    assertion:
      "Quoted order displays goods, promised date, and customer acceptance",
  },
  {
    id: 7,
    slug: "admin-grouped-catalog",
    surface: "admin-web",
    assertion: "Admin catalog is grouped into the four server-owned groups",
  },
  {
    id: 8,
    slug: "admin-dynamic-order",
    surface: "admin-web",
    assertion:
      "Admin order preserves dynamic leaf, specification label, and exact quote",
  },
] as const;

const groupContract = CATALOG_V1_10_GROUPS;

const evidenceRoot = path.resolve(
  process.env.GRIDGO_CATALOG_RFQ_EVIDENCE_DIR ??
    `/tmp/gridgo-catalog-rfq-visual/${randomUUID()}`,
);

function evidenceFile(step: CatalogVisualStep): string {
  return `${String(step.id).padStart(2, "0")}-${step.slug}.png`;
}

test.describe("GRIDGO catalog RFQ visual contract", () => {
  test("keeps catalog artifacts in the catalog output when both visual flags are present", async ({}, testInfo) => {
    test.skip(
      process.env.GRIDGO_TEST_DUAL_VISUAL_OUTPUT !== "1",
      "dual-flag output regression is exercised by its focused command",
    );
    expect(testInfo.project.outputDir).toBe(
      path.resolve(process.env.GRIDGO_CATALOG_RFQ_PLAYWRIGHT_OUTPUT!),
    );
  });

  test("defines the required eight release captures", () => {
    expect(catalogVisualSteps.map(({ id }) => id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(catalogVisualSteps.map(({ slug }) => slug)).toEqual([
      "catalog-groups-light",
      "catalog-groups-dark",
      "catalog-products-examples",
      "flyers-requirements",
      "rfq-review-pending",
      "quoted-order-acceptance",
      "admin-grouped-catalog",
      "admin-dynamic-order",
    ]);
    expect(catalogVisualSteps.map(evidenceFile)).toHaveLength(8);
  });

  test("freezes the visual catalog at four groups and seventeen leaves", () => {
    expect(groupContract.map(({ slug }) => slug)).toEqual([
      "marketing-promo",
      "corporate-merch",
      "awards-signages",
      "specialized-prototyping",
    ]);
    expect(groupContract.map(({ products }) => products.length)).toEqual([
      6, 4, 4, 3,
    ]);
    expect(
      groupContract.reduce((sum, { products }) => sum + products.length, 0),
    ).toBe(17);
  });

  test("keeps evidence outside source with sanitized URLs, hashes, manifest, and videos", () => {
    const source = readFileSync(new URL(import.meta.url), "utf8");
    const config = readFileSync(path.resolve("playwright.config.ts"), "utf8");
    expect(
      evidenceRoot.startsWith("/tmp/") ||
        process.env.GRIDGO_CATALOG_RFQ_EVIDENCE_DIR,
    ).toBeTruthy();
    expect(source).toContain("sanitizeEvidenceUrl");
    expect(source).toContain("sanitizeEvidenceText");
    expect(source).toContain('createHash("sha256")');
    expect(source).toContain('path.join(evidenceRoot, "manifest.json")');
    expect(source).toContain('path.join(evidenceRoot, "videos")');
    expect(config).toContain('trace: visualWorkflow ? "off"');
  });

  test("registers the quoted order before provider bootstrap and executes acceptance", async ({
    page,
  }) => {
    await bootstrapQuotedCustomerEvidence(page, async () => {
      await page.route("https://mobile.gridgo.test/bootstrap", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: `
            <main id="order"></main>
            <script>
              fetch("/api/orders")
                .then((response) => response.json())
                .then((orders) => {
                  const order = orders.find(({ id }) => id === 910001);
                  document.querySelector("#order").innerHTML =
                    '<h1>Order #' + order.id + '</h1>' +
                    '<p>' + order.orderStatus + ' / ' + order.pricingStatus + '</p>' +
                    '<button id="accept">Accept quote</button>';
                  document.querySelector("#accept").addEventListener("click", async () => {
                    const accepted = await fetch("/api/orders/910001/accept-quote", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        supplierAssignmentId: order.quoteAssignmentId,
                        paymentMethod: "pilot_credit",
                      }),
                    }).then((response) => response.json());
                    document.querySelector("#order").dataset.status = accepted.orderStatus;
                    document.querySelector("#order").append("Quote accepted");
                  });
                });
            </script>
          `,
        }),
      );
      await page.goto("https://mobile.gridgo.test/bootstrap");
    });
    await expect(
      page.getByRole("heading", { name: "Order #910001" }),
    ).toBeVisible();
    await expect(page.locator("body")).toContainText(
      "supplier_accepted / quoted",
    );
    await page.getByRole("button", { name: "Accept quote" }).click();
    await expect(page.locator("#order")).toHaveAttribute(
      "data-status",
      "awaiting_payment",
    );
    await expect(page.locator("body")).toContainText("Quote accepted");
    expect((await page.screenshot()).byteLength).toBeGreaterThan(0);
  });

  test("keeps an external quote invisible until the provider-backed page reloads", async ({
    page,
  }) => {
    let externalOrder = pendingOrderFixture();
    await page.route("**/api/orders", (route) =>
      route.fulfill({ json: [externalOrder] }),
    );
    await page.route("**/api/orders/910001/accept-quote", (route) =>
      route.fulfill({
        json: {
          ...quotedOrderFixture(),
          pricingStatus: "accepted",
          orderStatus: "awaiting_payment",
        },
      }),
    );
    await page.route("https://mobile.gridgo.test/provider-refresh", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: providerRefreshFixture(),
      }),
    );
    await page.goto("https://mobile.gridgo.test/provider-refresh");
    await expect(page.locator("body")).toContainText("pending_quote");
    await expect(
      page.getByRole("button", { name: "Accept quote" }),
    ).toHaveCount(0);

    externalOrder = quotedOrderFixture();
    await expect(page.locator("body")).toContainText("pending_quote");
    await expect(
      page.getByRole("button", { name: "Accept quote" }),
    ).toHaveCount(0);

    await refreshExternallyUpdatedOrder({
      page,
      readOrderState: () =>
        page.evaluate(async () => {
          const [order] = await fetch("/api/orders").then((response) =>
            response.json(),
          );
          return {
            orderStatus: order.orderStatus,
            pricingStatus: order.pricingStatus,
            quoteAssignmentId: Number(order.quoteAssignmentId),
          };
        }),
      expectedOrderState: {
        orderStatus: "supplier_accepted",
        pricingStatus: "quoted",
        quoteAssignmentId: 77,
      },
      enableSemantics: false,
      message: "fixture quote transition is durable before provider reload",
    });
    await expect(page.locator("body")).toContainText("quoted");
    await expect(
      page.getByRole("button", { name: "Accept quote" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Accept quote" }).click();
    await expect(page.locator("body")).toContainText("awaiting_payment");
  });
});

test.describe.serial("opt-in catalog RFQ screenshot evidence", () => {
  test("captures the eight catalog and quote surfaces", async ({
    browser,
  }, testInfo) => {
    test.skip(
      process.env.GRIDGO_RUN_CATALOG_RFQ_VISUAL !== "1",
      "Set GRIDGO_RUN_CATALOG_RFQ_VISUAL=1 against the isolated release stack.",
    );
    test.skip(
      testInfo.project.name !== "catalog-rfq-visual",
      "Runs once in the dedicated visual project.",
    );

    const mobileURL = process.env.MOBILE_WEB_E2E_URL ?? "http://127.0.0.1:8088";
    const adminURL = process.env.GRIDGO_ADMIN_URL ?? "http://127.0.0.1:8189";
    const customerPassword = process.env.GRIDGO_SEED_CUSTOMER_PASSWORD;
    const adminPassword = process.env.GRIDGO_ADMIN_PASSWORD;
    expect(
      customerPassword,
      "GRIDGO_SEED_CUSTOMER_PASSWORD is required",
    ).toBeTruthy();
    expect(adminPassword, "GRIDGO_ADMIN_PASSWORD is required").toBeTruthy();

    const screenshots = path.join(evidenceRoot, "screenshots");
    const videos = path.join(evidenceRoot, "videos");
    mkdirSync(screenshots, { recursive: true, mode: 0o700 });
    mkdirSync(videos, { recursive: true, mode: 0o700 });
    const entries: Array<Record<string, unknown>> = [];

    const mobile = await browser.newContext({
      viewport: { width: 393, height: 852 },
      colorScheme: "light",
      recordVideo: { dir: videos, size: { width: 393, height: 852 } },
    });
    const admin = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: { dir: videos, size: { width: 1440, height: 900 } },
    });
    try {
      const customerPage = await mobile.newPage();
      await loginMobile(
        customerPage,
        mobileURL,
        "maria@gridgo.ph",
        customerPassword!,
      );
      await navigateMobile(customerPage, mobileURL, "/customer/order/new");
      await capture(
        customerPage,
        catalogVisualSteps[0],
        screenshots,
        entries,
        /Browse by product group/i,
      );
      for (const { name } of groupContract) {
        await expect(customerPage.locator("body")).toContainText(name);
      }

      await customerPage.emulateMedia({ colorScheme: "dark" });
      await customerPage.reload();
      await enableFlutterSemantics(customerPage);
      await capture(
        customerPage,
        catalogVisualSteps[1],
        screenshots,
        entries,
        /Browse by product group/i,
      );
      for (const { name } of groupContract) {
        await expect(customerPage.locator("body")).toContainText(name);
      }

      await customerPage
        .getByText("Marketing & Promotional Collateral", { exact: true })
        .click();
      await capture(
        customerPage,
        catalogVisualSteps[2],
        screenshots,
        entries,
        /Single sheets|Event promos/i,
      );
      await customerPage.getByText("Flyers", { exact: true }).click();
      await capture(
        customerPage,
        catalogVisualSteps[3],
        screenshots,
        entries,
        /Flyers requirements/i,
      );

      await fillFlyerRequirements(customerPage);
      await customerPage
        .getByRole("button", { name: "Continue to artwork" })
        .click();
      await uploadArtwork(customerPage);
      await customerPage.getByRole("button", { name: "Continue" }).click();
      await expect(customerPage.locator("body")).toContainText(
        /Quote request/i,
      );
      await capture(
        customerPage,
        catalogVisualSteps[4],
        screenshots,
        entries,
        /Price and turnaround pending review/i,
        {
          forbidden: [/₱\s*0(?:\.00)?/, /Choose payment method/i],
        },
      );

      await bootstrapQuotedCustomerEvidence(customerPage, async () => {
        await customerPage.reload();
        await enableFlutterSemantics(customerPage);
      });
      await navigateMobile(customerPage, mobileURL, "/customer/orders/910001");
      await customerPage.getByRole("button", { name: "Accept quote" }).click();
      await capture(
        customerPage,
        catalogVisualSteps[5],
        screenshots,
        entries,
        /Quote accepted/i,
      );

      const adminPage = await admin.newPage();
      await loginAdmin(adminPage, adminURL, "admin@gridgo.ph", adminPassword!);
      await adminPage.goto(`${adminURL}/products`);
      await capture(
        adminPage,
        catalogVisualSteps[6],
        screenshots,
        entries,
        /Products & Services/i,
      );
      for (const { name } of groupContract)
        await expect(adminPage.locator("body")).toContainText(name);

      await mockAdminDynamicOrder(adminPage);
      await adminPage.goto(`${adminURL}/orders/show/910001`);
      await capture(
        adminPage,
        catalogVisualSteps[7],
        screenshots,
        entries,
        /UV-DTF \/ CMYK\+W|Soft-touch matte/i,
      );
      await expect(adminPage.locator("body")).toContainText("Flyers");
      await expect(adminPage.locator("body")).toContainText("₱1,750.00");

      writeFileSync(
        path.join(evidenceRoot, "manifest.json"),
        `${JSON.stringify({ runLabel: path.basename(evidenceRoot), generatedAt: new Date().toISOString(), entries }, null, 2)}\n`,
        { mode: 0o600 },
      );
      expect(new Set(entries.map(({ sha256 }) => sha256)).size).toBe(8);
      await testInfo.attach("catalog-rfq-visual-manifest", {
        path: path.join(evidenceRoot, "manifest.json"),
      });
    } finally {
      await Promise.all([mobile.close(), admin.close()]);
    }
  });
});

async function capture(
  page: Page,
  step: CatalogVisualStep,
  screenshots: string,
  entries: Array<Record<string, unknown>>,
  required: RegExp,
  options: { forbidden?: RegExp[] } = {},
): Promise<void> {
  await page.bringToFront();
  await expect(page.locator("body")).toContainText(required);
  for (const forbidden of options.forbidden ?? [])
    await expect(page.locator("body")).not.toContainText(forbidden);
  await expect(page.locator("body")).not.toContainText(
    /Unexpected Application Error|Internal Server Error|Something went wrong/i,
  );
  const file = evidenceFile(step);
  const target = path.join(screenshots, file);
  await page.screenshot({ path: target, fullPage: false });
  const data = readFileSync(target);
  expect(data.subarray(1, 4).toString("ascii")).toBe("PNG");
  entries.push({
    stepId: step.id,
    surface: step.surface,
    file,
    url: sanitizeEvidenceUrl(page.url()),
    title: sanitizeEvidenceText(await page.title()),
    sha256: createHash("sha256").update(data).digest("hex"),
    png: {
      width: data.readUInt32BE(16),
      height: data.readUInt32BE(20),
      bytes: data.length,
    },
    assertionSummary: [step.assertion],
  });
}

async function loginMobile(
  page: Page,
  baseURL: string,
  email: string,
  password: string,
): Promise<void> {
  await navigateMobile(page, baseURL, "/auth/login");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("Enter your password").fill(password);
  await page.getByRole("button", { name: /Sign In|Login/i }).click();
  await expect(page).toHaveURL(/\/customer\//);
}

async function loginAdmin(
  page: Page,
  baseURL: string,
  email: string,
  password: string,
): Promise<void> {
  await page.goto(`${baseURL}/login`);
  await page.getByLabel(/Email/i).fill(email);
  await page.getByLabel(/Password/i).fill(password);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function fillFlyerRequirements(page: Page): Promise<void> {
  const requiredDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const fields: Array<[string, string]> = [
    ["Dimensions or standard size *", "A5"],
    ["Stock or material *", "C2S 100gsm"],
    ["Color *", "Full color"],
    ["Sides *", "2"],
    ["Finish *", "Soft-touch matte"],
    ["Quantity *", "100"],
    ["Required date *", requiredDate],
  ];
  for (const [label, value] of fields) await page.getByLabel(label).fill(value);
}

async function uploadArtwork(page: Page): Promise<void> {
  const chooserPromise = page.waitForEvent("filechooser");
  await page
    .getByText(/Tap to select file/i)
    .first()
    .click();
  const chooser = await chooserPromise;
  await chooser.setFiles(path.resolve("fixtures/beta-upload.png"));
  await expect(page.locator("body")).toContainText(/File ready|Preview/i);
}

async function mockQuotedOrder(page: Page): Promise<void> {
  const fixture = quotedOrderFixture();
  let accepted = false;
  await page.route("**/api/orders", (route) =>
    route.fulfill({
      json: [
        accepted
          ? {
              ...fixture,
              pricingStatus: "accepted",
              orderStatus: "awaiting_payment",
            }
          : fixture,
      ],
    }),
  );
  await page.route("**/api/orders/910001", (route) =>
    route.fulfill({
      json: accepted
        ? {
            ...fixture,
            pricingStatus: "accepted",
            orderStatus: "awaiting_payment",
          }
        : fixture,
    }),
  );
  await page.route("**/api/orders/910001/accept-quote", (route) => {
    accepted = true;
    return route.fulfill({
      json: {
        ...fixture,
        pricingStatus: "accepted",
        orderStatus: "awaiting_payment",
      },
    });
  });
}

async function bootstrapQuotedCustomerEvidence(
  page: Page,
  bootstrapProvider: () => Promise<void>,
): Promise<void> {
  await mockQuotedOrder(page);
  await bootstrapProvider();
}

function pendingOrderFixture() {
  return {
    ...quotedOrderFixture(),
    pricingStatus: "pending_quote",
    orderStatus: "submitted",
    quotedTotalMinor: null,
    promisedCompletionAt: null,
    quoteAssignmentId: null,
  };
}

function providerRefreshFixture(): string {
  return `
    <main id="order"></main>
    <script>
      fetch("/api/orders")
        .then((response) => response.json())
        .then(([order]) => {
          const root = document.querySelector("#order");
          root.append(order.pricingStatus);
          if (order.pricingStatus === "quoted") {
            root.insertAdjacentHTML("beforeend", '<button id="accept">Accept quote</button>');
            document.querySelector("#accept").addEventListener("click", async () => {
              const accepted = await fetch("/api/orders/910001/accept-quote", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  supplierAssignmentId: order.quoteAssignmentId,
                  paymentMethod: "pilot_credit",
                }),
              }).then((response) => response.json());
              root.append(accepted.orderStatus);
            });
          }
        });
    </script>
  `;
}

async function mockAdminDynamicOrder(page: Page): Promise<void> {
  await page.route("**/api/admin/orders/910001", (route) =>
    route.fulfill({ json: adminOrderFixture() }),
  );
  await page.route("**/api/admin/riders", (route) =>
    route.fulfill({ json: [] }),
  );
}

function quotedOrderFixture() {
  return {
    id: 910001,
    orderId: "ORD-CATALOG-RFQ",
    userId: 1,
    category: "flyers",
    categoryName: "Flyers",
    groupSlug: "marketing-promo",
    groupName: "Marketing & Promotional Collateral",
    quantity: 100,
    totalPrice: null,
    deliveryFee: "50.00",
    deliveryFeeMinor: "5000",
    pricingStatus: "quoted",
    quotedTotalMinor: "175000",
    quotedAt: "2026-08-10T10:00:00.000Z",
    promisedCompletionAt: "2026-08-15T10:00:00.000Z",
    quoteAssignmentId: 77,
    codEligible: false,
    paymentMethod: "pending_quote",
    paymentStatus: "pending",
    orderStatus: "supplier_accepted",
    deliveryOption: "delivery",
    createdAt: "2026-08-10T09:00:00.000Z",
    updatedAt: "2026-08-10T10:00:00.000Z",
    items: [
      {
        id: 1,
        orderId: "ORD-CATALOG-RFQ",
        category: "flyers",
        categorySlug: "flyers",
        categoryName: "Flyers",
        groupSlug: "marketing-promo",
        groupName: "Marketing & Promotional Collateral",
        pricingModel: "quote_required",
        quantity: 100,
        totalPrice: null,
        specs: [
          {
            key: "finish",
            label: "UV-DTF / CMYK+W",
            value: "matte",
            displayValue: "Soft-touch matte",
          },
        ],
      },
    ],
  };
}

function adminOrderFixture() {
  return {
    id: 910001,
    order_id: "ORD-CATALOG-RFQ",
    user_id: 1,
    customer_name: "Catalog Visual Client",
    customer_email: "visual@example.test",
    category: "flyers",
    quantity: 100,
    total_price: null,
    delivery_fee: 50,
    pricing_status: "quoted",
    quoted_total_minor: "175000",
    payment_method: "pending_quote",
    payment_status: "pending",
    order_status: "supplier_accepted",
    delivery_option: "delivery",
    allowed_next_statuses: [],
    status_history: [],
    created_at: "2026-08-10T09:00:00.000Z",
    updated_at: "2026-08-10T10:00:00.000Z",
    current_supplier_assignment: {
      id: 77,
      supplier_id: 4,
      decision: "accepted",
      rank_position: 1,
      acceptance_deadline: "2026-08-11T10:00:00.000Z",
      final_price_minor: "170000",
      promised_date: "2026-08-15T10:00:00.000Z",
    },
    items: [
      {
        id: 1,
        category: "flyers",
        category_name: "Flyers",
        group_name: "Marketing & Promotional Collateral",
        quantity: 100,
        total_price: null,
        specs: [
          {
            key: "finish",
            label: "UV-DTF / CMYK+W",
            value: "matte",
            display_value: "Soft-touch matte",
          },
        ],
      },
    ],
  };
}
