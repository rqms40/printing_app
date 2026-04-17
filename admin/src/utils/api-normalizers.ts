import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  UserRole,
  VehicleType,
} from "@/types/enums";
import type {
  Order,
  OrderStatusHistory,
  PaperSpecs,
  ThreeDSpecs,
} from "@/types/order";
import type {
  ServiceAddon,
  ServiceCategory,
  SpecOption,
} from "@/types/products";

type ApiRecord = Record<string, unknown>;

export interface AdminUserRecord {
  id: number;
  full_name: string | null;
  email: string;
  phone_number: string | null;
  role: UserRole;
  is_active: boolean;
  is_profile_complete: boolean;
  profile_category: string | null;
  profile_field: string | null;
  course: string | null;
  organization: string | null;
  printing_preferences: string[];
  created_at: string;
  updated_at: string;
}

export interface AdminDriverRecord {
  id: number;
  user_id: number | null;
  full_name: string | null;
  email: string | null;
  vehicle_type: VehicleType | string;
  plate_number: string | null;
  is_available: boolean;
  last_latitude: number | null;
  last_longitude: number | null;
  last_location_update: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminIdentity {
  id: string;
  name: string;
  email: string;
  role?: UserRole;
}

const EMPTY_DATE = "1970-01-01T00:00:00.000Z";

function asRecord(value: unknown): ApiRecord {
  return value !== null && typeof value === "object" ? (value as ApiRecord) : {};
}

function read(record: ApiRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

function toStringValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }

  return undefined;
}

function toOptionalString(record: ApiRecord, ...keys: string[]) {
  return toStringValue(read(record, ...keys));
}

function toRequiredString(
  record: ApiRecord,
  fallback: string,
  ...keys: string[]
) {
  return toOptionalString(record, ...keys) ?? fallback;
}

function toNumberValue(record: ApiRecord, fallback: number, ...keys: string[]) {
  const value = read(record, ...keys);
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toBooleanValue(
  record: ApiRecord,
  fallback: boolean,
  ...keys: string[]
) {
  const value = read(record, ...keys);

  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => toStringValue(item))
      .filter((item): item is string => Boolean(item));
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => toStringValue(item))
          .filter((item): item is string => Boolean(item));
      }
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function normalizePaperSpecs(value: unknown): PaperSpecs | undefined {
  const record = asRecord(value);
  const paperSize = toOptionalString(record, "paper_size", "paperSize");

  if (!paperSize) {
    return undefined;
  }

  return {
    paper_size: paperSize as PaperSpecs["paper_size"],
    color_mode: toRequiredString(
      record,
      "black_and_white",
      "color_mode",
      "colorMode",
    ) as PaperSpecs["color_mode"],
    media_type: toRequiredString(
      record,
      "matte",
      "media_type",
      "mediaType",
    ) as PaperSpecs["media_type"],
    print_sides: toRequiredString(
      record,
      "front_only",
      "print_sides",
      "printSides",
    ) as PaperSpecs["print_sides"],
    binding: toRequiredString(
      record,
      "none",
      "binding",
    ) as PaperSpecs["binding"],
  };
}

function normalizeThreeDSpecs(value: unknown): ThreeDSpecs | undefined {
  const record = asRecord(value);
  const fileFormat = toOptionalString(record, "file_format", "fileFormat");

  if (!fileFormat) {
    return undefined;
  }

  return {
    file_format: fileFormat as ThreeDSpecs["file_format"],
    material: toRequiredString(
      record,
      "pla",
      "material",
    ) as ThreeDSpecs["material"],
    color: toRequiredString(record, "Unknown", "color"),
    infill_percentage: toNumberValue(
      record,
      0,
      "infill_percentage",
      "infillPercentage",
    ),
    layer_height: toNumberValue(record, 0, "layer_height", "layerHeight"),
    supports: toBooleanValue(record, false, "supports"),
    notes: toOptionalString(record, "notes"),
  };
}

function normalizeStatusHistory(value: unknown): OrderStatusHistory[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.map((item) => {
    const record = asRecord(item);

    return {
      id: toRequiredString(record, "", "id"),
      order_id: toRequiredString(record, "", "order_id", "orderId"),
      from_status: toRequiredString(
        record,
        "order_placed",
        "from_status",
        "fromStatus",
      ) as OrderStatus,
      to_status: toRequiredString(
        record,
        "order_placed",
        "to_status",
        "toStatus",
      ) as OrderStatus,
      changed_by_user_id: toOptionalString(
        record,
        "changed_by_user_id",
        "changedByUserId",
      ),
      notes: toOptionalString(record, "notes"),
      created_at: toRequiredString(record, EMPTY_DATE, "created_at", "createdAt"),
    };
  });
}

export function humanizeEnumValue(
  value?: string | null,
  fallback = "—",
): string {
  if (!value) {
    return fallback;
  }

  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function normalizeOrder(input: unknown): Order & {
  status_history?: OrderStatusHistory[];
} {
  const record = asRecord(input);

  return {
    id: toRequiredString(record, "", "id"),
    order_id: toRequiredString(record, "", "order_id", "orderId"),
    user_id: toRequiredString(record, "", "user_id", "userId"),
    category:
      toRequiredString(record, "paper", "category") === "3d" ? "3d" : "paper",
    file_url: toOptionalString(record, "file_url", "fileUrl"),
    file_name: toOptionalString(record, "file_name", "fileName"),
    paper_specs: normalizePaperSpecs(read(record, "paper_specs", "paperSpec")),
    three_d_specs: normalizeThreeDSpecs(
      read(record, "three_d_specs", "threeDSpec"),
    ),
    quantity: toNumberValue(record, 0, "quantity"),
    total_price: toNumberValue(record, 0, "total_price", "totalPrice"),
    delivery_fee: toNumberValue(record, 0, "delivery_fee", "deliveryFee"),
    payment_method: toRequiredString(
      record,
      "cod",
      "payment_method",
      "paymentMethod",
    ) as PaymentMethod,
    payment_status: toRequiredString(
      record,
      "pending",
      "payment_status",
      "paymentStatus",
    ) as PaymentStatus,
    order_status: toRequiredString(
      record,
      "order_placed",
      "order_status",
      "orderStatus",
    ) as OrderStatus,
    decline_reason: toOptionalString(
      record,
      "decline_reason",
      "declineReason",
    ),
    cancellation_reason: toOptionalString(
      record,
      "cancellation_reason",
      "cancellationReason",
    ),
    cancelled_at: toOptionalString(record, "cancelled_at", "cancelledAt"),
    delivery_option: toRequiredString(
      record,
      "pickup",
      "delivery_option",
      "deliveryOption",
    ) as Order["delivery_option"],
    delivery_address_id: toOptionalString(
      record,
      "delivery_address_id",
      "deliveryAddressId",
    ),
    assigned_driver_id: toOptionalString(
      record,
      "assigned_driver_id",
      "assignedDriverId",
    ),
    estimated_completion_at: toOptionalString(
      record,
      "estimated_completion_at",
      "estimatedCompletionAt",
    ),
    admin_notes: toOptionalString(record, "admin_notes", "adminNotes"),
    tracking_link: toOptionalString(record, "tracking_link", "trackingLink"),
    created_at: toRequiredString(record, EMPTY_DATE, "created_at", "createdAt"),
    updated_at: toRequiredString(record, EMPTY_DATE, "updated_at", "updatedAt"),
    status_history: normalizeStatusHistory(
      read(record, "status_history", "statusHistory"),
    ),
  };
}

export function normalizeOrders(payload: unknown): Order[] {
  return Array.isArray(payload) ? payload.map(normalizeOrder) : [];
}

export function normalizeAdminUser(input: unknown): AdminUserRecord {
  const record = asRecord(input);

  return {
    id: toNumberValue(record, 0, "id"),
    full_name: toOptionalString(record, "full_name", "fullName") ?? null,
    email: toRequiredString(record, "", "email"),
    phone_number: toOptionalString(record, "phone_number", "phoneNumber") ?? null,
    role: toRequiredString(record, "customer", "role") as UserRole,
    is_active: toBooleanValue(record, true, "is_active", "isActive"),
    is_profile_complete: toBooleanValue(
      record,
      false,
      "is_profile_complete",
      "isProfileComplete",
    ),
    profile_category:
      toOptionalString(record, "profile_category", "profileCategory") ?? null,
    profile_field:
      toOptionalString(record, "profile_field", "profileField") ?? null,
    course: toOptionalString(record, "course") ?? null,
    organization: toOptionalString(record, "organization") ?? null,
    printing_preferences: toStringArray(
      read(record, "printing_preferences", "printingPreferences"),
    ),
    created_at: toRequiredString(record, EMPTY_DATE, "created_at", "createdAt"),
    updated_at: toRequiredString(record, EMPTY_DATE, "updated_at", "updatedAt"),
  };
}

export function normalizeAdminUsers(payload: unknown): AdminUserRecord[] {
  return Array.isArray(payload) ? payload.map(normalizeAdminUser) : [];
}

export function normalizeAdminDriver(input: unknown): AdminDriverRecord {
  const record = asRecord(input);
  const user = asRecord(read(record, "user"));

  return {
    id: toNumberValue(record, 0, "id"),
    user_id: read(record, "user_id", "userId") === undefined
      ? null
      : toNumberValue(record, 0, "user_id", "userId"),
    full_name:
      toOptionalString(record, "full_name", "fullName") ??
      toOptionalString(user, "full_name", "fullName") ??
      null,
    email:
      toOptionalString(record, "email") ??
      toOptionalString(user, "email") ??
      null,
    vehicle_type: toRequiredString(
      record,
      "motorcycle",
      "vehicle_type",
      "vehicleType",
    ),
    plate_number: toOptionalString(record, "plate_number", "plateNumber") ?? null,
    is_available: toBooleanValue(record, false, "is_available", "isAvailable"),
    last_latitude:
      read(record, "last_latitude", "lastLatitude") === undefined
        ? null
        : toNumberValue(record, 0, "last_latitude", "lastLatitude"),
    last_longitude:
      read(record, "last_longitude", "lastLongitude") === undefined
        ? null
        : toNumberValue(record, 0, "last_longitude", "lastLongitude"),
    last_location_update:
      toOptionalString(
        record,
        "last_location_update",
        "lastLocationUpdate",
      ) ?? null,
    created_at: toRequiredString(record, EMPTY_DATE, "created_at", "createdAt"),
    updated_at: toRequiredString(record, EMPTY_DATE, "updated_at", "updatedAt"),
  };
}

export function normalizeAdminDrivers(payload: unknown): AdminDriverRecord[] {
  return Array.isArray(payload) ? payload.map(normalizeAdminDriver) : [];
}

export function normalizeServiceCategory(input: unknown): ServiceCategory {
  const record = asRecord(input);

  return {
    id: toRequiredString(record, "", "id"),
    name: toRequiredString(record, "", "name"),
    slug: toRequiredString(record, "", "slug"),
    description: toOptionalString(record, "description"),
    icon: toOptionalString(record, "icon"),
    base_rate: toNumberValue(record, 0, "base_rate", "baseRate"),
    max_file_size_mb: toNumberValue(
      record,
      0,
      "max_file_size_mb",
      "maxFileSizeMb",
    ),
    allowed_extensions: toStringArray(
      read(record, "allowed_extensions", "allowedExtensions"),
    ),
    is_active: toBooleanValue(record, true, "is_active", "isActive"),
    sort_order: toNumberValue(record, 0, "sort_order", "sortOrder"),
    created_at: toRequiredString(record, EMPTY_DATE, "created_at", "createdAt"),
    updated_at: toRequiredString(record, EMPTY_DATE, "updated_at", "updatedAt"),
  };
}

export function normalizeServiceCategories(payload: unknown): ServiceCategory[] {
  return Array.isArray(payload) ? payload.map(normalizeServiceCategory) : [];
}

export function normalizeSpecOption(input: unknown): SpecOption {
  const record = asRecord(input);

  return {
    id: toRequiredString(record, "", "id"),
    category_id: toRequiredString(record, "", "category_id", "categoryId"),
    option_group: toRequiredString(
      record,
      "",
      "option_group",
      "optionGroup",
    ),
    label: toRequiredString(record, "", "label"),
    value: toRequiredString(record, "", "value"),
    multiplier: toNumberValue(record, 1, "multiplier"),
    fixed_fee: toNumberValue(record, 0, "fixed_fee", "fixedFee"),
    unit_cost: toNumberValue(record, 0, "unit_cost", "unitCost"),
    estimated_grams:
      read(record, "estimated_grams", "estimatedGrams") === undefined ||
      read(record, "estimated_grams", "estimatedGrams") === null
        ? undefined
        : toNumberValue(record, 0, "estimated_grams", "estimatedGrams"),
    is_default: toBooleanValue(record, false, "is_default", "isDefault"),
    is_active: toBooleanValue(record, true, "is_active", "isActive"),
    sort_order: toNumberValue(record, 0, "sort_order", "sortOrder"),
    created_at: toRequiredString(record, EMPTY_DATE, "created_at", "createdAt"),
    updated_at: toRequiredString(record, EMPTY_DATE, "updated_at", "updatedAt"),
  };
}

export function normalizeSpecOptions(payload: unknown): SpecOption[] {
  return Array.isArray(payload) ? payload.map(normalizeSpecOption) : [];
}

export function normalizeServiceAddon(input: unknown): ServiceAddon {
  const record = asRecord(input);
  const categoryId = read(record, "category_id", "categoryId");

  return {
    id: toRequiredString(record, "", "id"),
    category_id:
      categoryId === undefined || categoryId === null
        ? undefined
        : toStringValue(categoryId),
    name: toRequiredString(record, "", "name"),
    description: toOptionalString(record, "description"),
    price: toNumberValue(record, 0, "price"),
    price_type:
      toRequiredString(record, "flat", "price_type", "priceType") === "per_unit"
        ? "per_unit"
        : "flat",
    is_active: toBooleanValue(record, true, "is_active", "isActive"),
    sort_order: toNumberValue(record, 0, "sort_order", "sortOrder"),
    created_at: toRequiredString(record, EMPTY_DATE, "created_at", "createdAt"),
    updated_at: toRequiredString(record, EMPTY_DATE, "updated_at", "updatedAt"),
  };
}

export function normalizeServiceAddons(payload: unknown): ServiceAddon[] {
  return Array.isArray(payload) ? payload.map(normalizeServiceAddon) : [];
}

export function normalizeIdentity(input: unknown): AdminIdentity {
  const record = asRecord(input);
  const email = toRequiredString(record, "", "email");
  const name =
    toOptionalString(record, "name") ??
    toOptionalString(record, "full_name", "fullName") ??
    "Admin";

  return {
    id: toRequiredString(record, email || "0", "id"),
    name,
    email,
    role: toOptionalString(record, "role") as UserRole | undefined,
  };
}
