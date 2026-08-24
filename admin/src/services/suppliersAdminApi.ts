import { apiClient } from "@/providers/api-client";
import {
  labelForServiceFocusKey,
  toRankedServices,
  type RankedServiceFocus,
} from "@/utils/supplier-service-focus";

export type SupplierDirectoryRow = {
  id: number;
  userId: number;
  businessName: string;
  description: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  logoUrl: string | null;
  attributes?: Record<string, string>;
  serviceZones: string[];
  serviceFocusRanks: string[];
  rankedServices: RankedServiceFocus[];
  isActive: boolean;
  verificationStatus: string | null;
  ratingAverage: number;
  ratingCount: number;
  ordersReceived: number;
  ordersAccepted: number;
  capabilities: Array<{
    id: number;
    productFamily: string;
    materials: string[];
    maxCapacity: number;
    leadTimeDays: number;
  }>;
  updatedAt: string | null;
};

export type SupplierLeaderboardRow = {
  rank: number;
  supplierId: number;
  userId: number;
  businessName: string;
  logoUrl: string | null;
  verificationStatus: string | null;
  ratingAverage: number;
  ratingCount: number;
  ordersReceived: number;
  ordersAccepted: number;
  topService: RankedServiceFocus | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function read(
  record: Record<string, unknown>,
  ...keys: string[]
): unknown {
  for (const key of keys) {
    if (key in record) return record[key];
  }
  return undefined;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function toStringOrNull(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function normalizeRankedService(raw: unknown): RankedServiceFocus | null {
  const r = asRecord(raw);
  const key = toStringOrNull(read(r, "key"));
  if (!key) return null;
  const rank = toNumber(read(r, "rank"), 0);
  return {
    rank: rank > 0 ? rank : 1,
    key,
    label:
      toStringOrNull(read(r, "label")) ?? labelForServiceFocusKey(key),
  };
}

export function normalizeDirectoryRow(input: unknown): SupplierDirectoryRow {
  const r = asRecord(input);
  const ranksRaw = read(r, "serviceFocusRanks", "service_focus_ranks");
  const ranks = Array.isArray(ranksRaw)
    ? ranksRaw.map((x) => String(x))
    : [];
  const rankedRaw = read(r, "rankedServices", "ranked_services");
  const rankedServices = Array.isArray(rankedRaw)
    ? rankedRaw
        .map(normalizeRankedService)
        .filter((x): x is RankedServiceFocus => x != null)
    : toRankedServices(ranks);

  const capsRaw = read(r, "capabilities");
  const capabilities: SupplierDirectoryRow["capabilities"] = [];
  if (Array.isArray(capsRaw)) {
    for (const cap of capsRaw) {
      const c = asRecord(cap);
      const materialsRaw = read(c, "materials");
      capabilities.push({
        id: toNumber(read(c, "id")),
        productFamily: String(
          read(c, "productFamily", "product_family") ?? "",
        ),
        materials: Array.isArray(materialsRaw)
          ? materialsRaw.map((m) => String(m))
          : [],
        maxCapacity: toNumber(read(c, "maxCapacity", "max_capacity")),
        leadTimeDays: toNumber(read(c, "leadTimeDays", "lead_time_days")),
      });
    }
  }

  const zonesRaw = read(r, "serviceZones", "service_zones");
  return {
    id: toNumber(read(r, "id")),
    userId: toNumber(read(r, "userId", "user_id")),
    businessName: String(
      read(r, "businessName", "business_name") ?? "Unnamed shop",
    ),
    description: toStringOrNull(read(r, "description")),
    contactPhone: toStringOrNull(read(r, "contactPhone", "contact_phone")),
    contactEmail: toStringOrNull(read(r, "contactEmail", "contact_email")),
    address: toStringOrNull(read(r, "address")),
    latitude: (() => {
      const value = read(r, "latitude");
      return value == null || value === "" ? null : toNumber(value);
    })(),
    longitude: (() => {
      const value = read(r, "longitude");
      return value == null || value === "" ? null : toNumber(value);
    })(),
    logoUrl: toStringOrNull(read(r, "logoUrl", "logo_url")),
    attributes: asRecord(read(r, "attributes")) as Record<string, string>,
    serviceZones: Array.isArray(zonesRaw)
      ? zonesRaw.map((z) => String(z))
      : [],
    serviceFocusRanks: ranks,
    rankedServices,
    isActive:
      read(r, "isActive", "is_active") === true ||
      read(r, "isActive", "is_active") === "true",
    verificationStatus: toStringOrNull(
      read(r, "verificationStatus", "verification_status"),
    ),
    ratingAverage: toNumber(read(r, "ratingAverage", "rating_average")),
    ratingCount: toNumber(read(r, "ratingCount", "rating_count")),
    ordersReceived: toNumber(read(r, "ordersReceived", "orders_received")),
    ordersAccepted: toNumber(read(r, "ordersAccepted", "orders_accepted")),
    capabilities,
    updatedAt: toStringOrNull(read(r, "updatedAt", "updated_at")),
  };
}

export function normalizeLeaderboardRow(input: unknown): SupplierLeaderboardRow {
  const r = asRecord(input);
  const top = normalizeRankedService(read(r, "topService", "top_service"));
  return {
    rank: toNumber(read(r, "rank"), 0),
    supplierId: toNumber(read(r, "supplierId", "supplier_id")),
    userId: toNumber(read(r, "userId", "user_id")),
    businessName: String(
      read(r, "businessName", "business_name") ?? "Unnamed shop",
    ),
    logoUrl: toStringOrNull(read(r, "logoUrl", "logo_url")),
    verificationStatus: toStringOrNull(
      read(r, "verificationStatus", "verification_status"),
    ),
    ratingAverage: toNumber(read(r, "ratingAverage", "rating_average")),
    ratingCount: toNumber(read(r, "ratingCount", "rating_count")),
    ordersReceived: toNumber(read(r, "ordersReceived", "orders_received")),
    ordersAccepted: toNumber(read(r, "ordersAccepted", "orders_accepted")),
    topService: top,
  };
}

export async function loadSupplierDirectory(): Promise<SupplierDirectoryRow[]> {
  const res = await apiClient.get("/suppliers/directory");
  const data = Array.isArray(res.data) ? res.data : [];
  return data.map(normalizeDirectoryRow);
}

export async function loadSupplierLeaderboard(
  metric: "reviews" | "orders",
  limit = 20,
): Promise<SupplierLeaderboardRow[]> {
  const res = await apiClient.get("/suppliers/leaderboard", {
    params: { metric, limit },
  });
  const data = Array.isArray(res.data) ? res.data : [];
  return data.map(normalizeLeaderboardRow);
}

export async function loadSupplierProfile(
  id: number,
): Promise<SupplierDirectoryRow | null> {
  const res = await apiClient.get(`/suppliers/${id}`);
  if (!res.data) return null;
  // Detail endpoint returns entity shape; normalize via directory-like fields.
  const r = asRecord(res.data);
  const ranksRaw = read(r, "serviceFocusRanks", "service_focus_ranks");
  const ranks = Array.isArray(ranksRaw)
    ? ranksRaw.map((x) => String(x))
    : [];
  return normalizeDirectoryRow({
    ...r,
    serviceFocusRanks: ranks,
    rankedServices: toRankedServices(ranks),
    verificationStatus:
      read(asRecord(read(r, "verification")), "status") ??
      read(r, "verificationStatus"),
    ratingAverage: read(r, "ratingAverage", "rating_average"),
    ratingCount: read(r, "ratingCount", "rating_count"),
    ordersReceived: 0,
  });
}

export async function loadMySupplierProfile(): Promise<SupplierDirectoryRow | null> {
  const res = await apiClient.get('/suppliers/me');
  if (!res.data) return null;
  const r = asRecord(res.data);
  const ranksRaw = read(r, "serviceFocusRanks", "service_focus_ranks");
  const ranks = Array.isArray(ranksRaw)
    ? ranksRaw.map((x) => String(x))
    : [];
  return normalizeDirectoryRow({
    ...r,
    serviceFocusRanks: ranks,
    rankedServices: toRankedServices(ranks),
    verificationStatus:
      read(asRecord(read(r, "verification")), "status") ??
      read(r, "verificationStatus"),
    ratingAverage: read(r, "ratingAverage", "rating_average"),
    ratingCount: read(r, "ratingCount", "rating_count"),
    ordersReceived: 0,
    ordersAccepted: 0,
  });
}

export async function updateMySupplierProfile(payload: Record<string, unknown>) {
  const res = await apiClient.patch('/suppliers/me', payload);
  return res.data;
}

export async function addMySupplierCapability(
  productFamily: string,
  materials: string[],
) {
  const res = await apiClient.post('/suppliers/me/capabilities', {
    productFamily,
    materials,
    maxCapacity: 1000,
    leadTimeDays: 1,
  });
  return res.data;
}

export async function removeMySupplierCapability(capabilityId: number) {
  const res = await apiClient.delete(`/suppliers/me/capabilities/${capabilityId}`);
  return res.data;
}

export type SupplierCatalogAddon = {
  name: string;
  price: number;
  priceType: "flat" | "per_unit";
};

export type SupplierCatalogOffering = {
  id: number;
  title: string;
  categorySlugs: string[];
  specOptions: Record<string, string[]>;
  addons: SupplierCatalogAddon[];
  notes: string[];
  baseRatePesos: number | null;
  pricingUnit: string | null;
  source: string;
  sourceFileName: string | null;
  isActive: boolean;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export function normalizeCatalogOffering(
  raw: unknown,
): SupplierCatalogOffering | null {
  const r = asRecord(raw);
  const id = toNumber(read(r, "id"), 0);
  if (id <= 0) return null;
  const specRaw = asRecord(read(r, "specOptions", "spec_options"));
  const specOptions: Record<string, string[]> = {};
  for (const [key, values] of Object.entries(specRaw)) {
    specOptions[key] = asStringArray(values);
  }
  const addonsRaw = read(r, "addons");
  const addons: SupplierCatalogAddon[] = Array.isArray(addonsRaw)
    ? addonsRaw.map((item) => {
        const a = asRecord(item);
        return {
          name: String(read(a, "name") ?? ""),
          price: toNumber(read(a, "price")),
          priceType:
            read(a, "priceType", "price_type") === "per_unit"
              ? "per_unit"
              : "flat",
        };
      })
    : [];
  return {
    id,
    title: String(read(r, "title") ?? "Catalog item"),
    categorySlugs: asStringArray(read(r, "categorySlugs", "category_slugs")),
    specOptions,
    addons,
    notes: asStringArray(read(r, "notes")),
    baseRatePesos:
      read(r, "baseRatePesos", "base_rate_pesos") == null
        ? null
        : toNumber(read(r, "baseRatePesos", "base_rate_pesos")),
    pricingUnit: toStringOrNull(read(r, "pricingUnit", "pricing_unit")),
    source: String(read(r, "source") ?? "manual"),
    sourceFileName: toStringOrNull(
      read(r, "sourceFileName", "source_file_name"),
    ),
    isActive: read(r, "isActive", "is_active") !== false,
  };
}

export async function listMyCatalogOfferings(): Promise<
  SupplierCatalogOffering[]
> {
  const res = await apiClient.get("/suppliers/me/catalog");
  const raw = Array.isArray(res.data) ? res.data : [];
  return raw
    .map(normalizeCatalogOffering)
    .filter((row): row is SupplierCatalogOffering => row != null);
}

export async function upsertMyCatalogOffering(payload: {
  title: string;
  categorySlugs: string[];
  specOptions?: Record<string, string[]>;
}): Promise<SupplierCatalogOffering[]> {
  const res = await apiClient.post("/suppliers/me/catalog", payload);
  const raw = Array.isArray(res.data) ? res.data : [];
  return raw
    .map(normalizeCatalogOffering)
    .filter((row): row is SupplierCatalogOffering => row != null);
}

export async function removeMyCatalogOffering(offeringId: number) {
  await apiClient.delete(`/suppliers/me/catalog/${offeringId}`);
}

export async function importMyCatalogFile(file: File): Promise<{
  warnings: string[];
  offerings: number;
}> {
  const form = new FormData();
  form.append("file", file);
  const res = await apiClient.post("/suppliers/me/catalog/import", form);
  const parsed = asRecord(res.data?.parsed);
  const applied = asRecord(res.data?.applied);
  const warnings = asStringArray(parsed.warnings);
  return {
    warnings,
    offerings: toNumber(applied.offerings),
  };
}

export type CatalogCategoryOption = {
  slug: string;
  name: string;
};

export async function listOrderableCatalogCategories(): Promise<
  CatalogCategoryOption[]
> {
  const res = await apiClient.get("/products/catalog");
  const cats = Array.isArray(res.data?.categories) ? res.data.categories : [];
  return cats
    .map((item: unknown) => {
      const r = asRecord(item);
      const slug = String(read(r, "slug") ?? "").trim();
      const name = String(read(r, "name") ?? slug).trim();
      const orderable = read(r, "isOrderable", "is_orderable");
      if (!slug || orderable === false) return null;
      return { slug, name };
    })
    .filter(Boolean) as CatalogCategoryOption[];
}
