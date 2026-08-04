import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  UserRole,
  VehicleType,
} from "@/types/enums";
import type {
  AssignedRiderContact,
  DeliveryProof,
  Order,
  OrderItem,
  OrderStatusHistory,
  PaperSpecs,
  ThreeDSpecs,
} from "@/types/order";
import type {
  DispatchPlan,
  DispatchPlanStatus,
  DispatchPlanStop,
  DispatchStopStatus,
  LineStringGeometry,
} from "@/types/dispatch-plan";
import type {
  ProductFileProcessingType,
  ProductInputType,
  ProductPricingModel,
  ProductPricingRole,
  ProductSpecDefinition,
  ProductValueType,
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
  client_account_type: string | null;
  printing_preferences: string[];
  created_at: string;
  updated_at: string;
}

export interface AdminUserDetailRecord extends AdminUserRecord {
  gender: string | null;
  date_of_birth: string | null;
}

export interface AdminUserMetricsRecord {
  total_orders: number;
  paid_orders: number;
  total_spend: number;
  average_order_value: number;
  last_order_at: string | null;
  last_paid_order_at: string | null;
}

export interface AdminUserRecentOrderRecord {
  id: number;
  order_id: string;
  category: "paper" | "3d" | "batch";
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  total_price: number;
  created_at: string;
}

export interface AdminUserDetailPayload {
  user: AdminUserDetailRecord;
  metrics: AdminUserMetricsRecord;
  recent_orders: AdminUserRecentOrderRecord[];
}

export interface AdminRiderRecord {
  id: number;
  user_id: number | null;
  full_name: string | null;
  email: string | null;
  vehicle_type: VehicleType | string;
  plate_number: string | null;
  is_available: boolean;
  assignment_eligible: boolean;
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
const ADMIN_USER_DETAIL_ORDER_CATEGORIES = new Set(["paper", "3d"]);
const ADMIN_USER_DETAIL_ORDER_STATUSES = new Set<OrderStatus>([
  "order_placed",
  "file_verified",
  "file_declined",
  "printing_in_progress",
  "finishing_mounting",
  "quality_checked",
  "ready_for_dispatch",
  "rider_assigned",
  "picked_up",
  "on_the_way",
  "arrived_at_destination",
  "delivered",
  "completed_pickup",
  "cancelled",
]);
const ADMIN_USER_DETAIL_PAYMENT_STATUSES = new Set<PaymentStatus>([
  "pending",
  "paid",
  "failed",
  "refunded",
]);
const ORDER_STATUSES = new Set<OrderStatus>(ADMIN_USER_DETAIL_ORDER_STATUSES);
const DISPATCH_PLAN_STATUSES = new Set<DispatchPlanStatus>([
  "active",
  "superseded",
  "completed",
]);
const DISPATCH_STOP_STATUSES = new Set<DispatchStopStatus>([
  "pending",
  "completed",
  "skipped",
]);

function asRecord(value: unknown): ApiRecord {
  return value !== null && typeof value === "object"
    ? (value as ApiRecord)
    : {};
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

function toOrderStatusArray(value: unknown): OrderStatus[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is OrderStatus =>
      typeof item === "string" && ORDER_STATUSES.has(item as OrderStatus),
  );
}

function requiredNumber(
  record: ApiRecord,
  label: string,
  ...keys: string[]
): number {
  const value = read(record, ...keys);
  const number = typeof value === "number" ? value : Number(value);
  if (value === null || value === "" || !Number.isFinite(number)) {
    throw new Error(`Invalid dispatch ${label}`);
  }
  return number;
}

function requiredInteger(
  record: ApiRecord,
  label: string,
  ...keys: string[]
): number {
  const number = requiredNumber(record, label, ...keys);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`Invalid dispatch ${label}`);
  }
  return number;
}

function requiredDispatchString(
  record: ApiRecord,
  label: string,
  ...keys: string[]
): string {
  const value = toOptionalString(record, ...keys);
  if (!value) throw new Error(`Invalid dispatch ${label}`);
  return value;
}

function requiredBoolean(
  record: ApiRecord,
  label: string,
  ...keys: string[]
): boolean {
  const value = read(record, ...keys);
  if (typeof value !== "boolean") {
    throw new Error(`Invalid dispatch ${label}`);
  }
  return value;
}

function normalizeLineString(value: unknown): LineStringGeometry {
  const record = asRecord(value);
  if (record.type !== "LineString") {
    throw new Error("Dispatch route geometry must be a LineString");
  }
  if (!Array.isArray(record.coordinates) || record.coordinates.length < 2) {
    throw new Error("Dispatch route geometry requires two coordinates");
  }

  const coordinates = record.coordinates.map((position) => {
    if (
      !Array.isArray(position) ||
      position.length !== 2 ||
      typeof position[0] !== "number" ||
      typeof position[1] !== "number" ||
      !Number.isFinite(position[0]) ||
      !Number.isFinite(position[1]) ||
      position[0] < -180 ||
      position[0] > 180 ||
      position[1] < -90 ||
      position[1] > 90
    ) {
      throw new Error("Invalid dispatch route coordinate");
    }
    return [position[0], position[1]] as [number, number];
  });

  return { type: "LineString", coordinates };
}

function normalizeDispatchPlanStop(value: unknown): DispatchPlanStop {
  const record = asRecord(value);
  const status = requiredDispatchString(record, "stop status", "status");
  if (!DISPATCH_STOP_STATUSES.has(status as DispatchStopStatus)) {
    throw new Error("Invalid dispatch stop status");
  }
  const assignment = asRecord(read(record, "assignment"));
  const order = asRecord(read(assignment, "order"));
  const destinationLatitude = requiredNumber(
    record,
    "destination latitude",
    "destination_latitude",
    "destinationLatitude",
  );
  const destinationLongitude = requiredNumber(
    record,
    "destination longitude",
    "destinationLongitude",
  );
  if (
    destinationLatitude < -90 ||
    destinationLatitude > 90 ||
    destinationLongitude < -180 ||
    destinationLongitude > 180
  ) {
    throw new Error("Invalid dispatch destination coordinate");
  }

  const duration = requiredNumber(
    record,
    "leg duration",
    "leg_duration_seconds",
    "legDurationSeconds",
  );
  const distance = requiredNumber(
    record,
    "leg distance",
    "leg_distance_meters",
    "legDistanceMeters",
  );
  if (duration < 0 || distance < 0) {
    throw new Error("Invalid dispatch leg metrics");
  }

  return {
    id: requiredInteger(record, "stop id", "id"),
    plan_id: requiredInteger(record, "plan id", "plan_id", "planId"),
    assignment_id: requiredInteger(
      record,
      "assignment id",
      "assignment_id",
      "assignmentId",
    ),
    sequence: requiredInteger(record, "stop sequence", "sequence"),
    status: status as DispatchStopStatus,
    destination_latitude: destinationLatitude,
    destination_longitude: destinationLongitude,
    leg_duration_seconds: duration,
    leg_distance_meters: distance,
    leg_geometry: normalizeLineString(
      read(record, "leg_geometry", "legGeometry"),
    ),
    order_ref:
      toOptionalString(order, "order_id", "orderId") ??
      toOptionalString(assignment, "order_ref", "orderRef") ??
      null,
    completed_at:
      toOptionalString(record, "completed_at", "completedAt") ?? null,
    skipped_at: toOptionalString(record, "skipped_at", "skippedAt") ?? null,
  };
}

export function normalizeDispatchPlan(input: unknown): DispatchPlan | null {
  if (input == null) return null;
  const record = asRecord(input);
  const status = requiredDispatchString(record, "plan status", "status");
  if (!DISPATCH_PLAN_STATUSES.has(status as DispatchPlanStatus)) {
    throw new Error("Invalid dispatch plan status");
  }
  const originLatitude = requiredNumber(
    record,
    "origin latitude",
    "origin_latitude",
    "originLatitude",
  );
  const originLongitude = requiredNumber(
    record,
    "origin longitude",
    "originLongitude",
  );
  const duration = requiredNumber(
    record,
    "total duration",
    "total_duration_seconds",
    "totalDurationSeconds",
  );
  const distance = requiredNumber(
    record,
    "total distance",
    "total_distance_meters",
    "totalDistanceMeters",
  );
  if (
    originLatitude < -90 ||
    originLatitude > 90 ||
    originLongitude < -180 ||
    originLongitude > 180 ||
    duration < 0 ||
    distance < 0
  ) {
    throw new Error("Invalid dispatch plan metrics");
  }
  const stopsValue = read(record, "stops");
  if (!Array.isArray(stopsValue) || stopsValue.length === 0) {
    throw new Error("Invalid dispatch plan stops");
  }
  const stops = stopsValue.map(normalizeDispatchPlanStop).sort(
    (left, right) => left.sequence - right.sequence,
  );
  if (new Set(stops.map((stop) => stop.sequence)).size !== stops.length) {
    throw new Error("Duplicate dispatch stop sequence");
  }
  if (new Set(stops.map((stop) => stop.assignment_id)).size !== stops.length) {
    throw new Error("Duplicate dispatch assignment id");
  }
  const planId = requiredInteger(record, "plan id", "id");
  if (stops.some((stop) => stop.plan_id !== planId)) {
    throw new Error("Dispatch stop plan id does not match plan");
  }
  const plannedAt = requiredDispatchString(
    record,
    "planned at",
    "planned_at",
    "plannedAt",
  );
  if (Number.isNaN(Date.parse(plannedAt))) {
    throw new Error("Invalid dispatch planned timestamp");
  }

  return {
    id: planId,
    rider_profile_id: requiredInteger(
      record,
      "rider profile id",
      "rider_profile_id",
      "riderId",
    ),
    version: requiredInteger(record, "plan version", "version"),
    status: status as DispatchPlanStatus,
    origin_latitude: originLatitude,
    origin_longitude: originLongitude,
    provider: requiredDispatchString(record, "provider", "provider"),
    profile: requiredDispatchString(record, "profile", "profile"),
    total_duration_seconds: duration,
    total_distance_meters: distance,
    routing_data_stale: requiredBoolean(
      record,
      "routing stale flag",
      "routing_data_stale",
      "routingDataStale",
    ),
    planned_at: plannedAt,
    stops,
  };
}

function hasFiniteNumberField(record: ApiRecord, ...keys: string[]) {
  const value = read(record, ...keys);
  if (value === undefined || value === null || value === "") {
    return false;
  }

  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number);
}

function hasNonEmptyStringField(record: ApiRecord, ...keys: string[]) {
  const value = toOptionalString(record, ...keys);
  return typeof value === "string" && value.length > 0;
}

function hasAllowedStringField(
  record: ApiRecord,
  allowedValues: Set<string>,
  ...keys: string[]
) {
  const value = toOptionalString(record, ...keys);
  return typeof value === "string" && allowedValues.has(value);
}

function isValidAdminUserMetrics(input: unknown): input is ApiRecord {
  const record = asRecord(input);

  return (
    hasFiniteNumberField(record, "total_orders", "totalOrders") &&
    hasFiniteNumberField(record, "paid_orders", "paidOrders") &&
    hasFiniteNumberField(record, "total_spend", "totalSpend") &&
    hasFiniteNumberField(record, "average_order_value", "averageOrderValue")
  );
}

function isValidAdminUserRecentOrder(input: unknown): input is ApiRecord {
  const record = asRecord(input);

  return (
    hasFiniteNumberField(record, "id") &&
    hasNonEmptyStringField(record, "order_id", "orderId") &&
    hasAllowedStringField(
      record,
      ADMIN_USER_DETAIL_ORDER_CATEGORIES,
      "category",
    ) &&
    hasAllowedStringField(
      record,
      ADMIN_USER_DETAIL_ORDER_STATUSES,
      "order_status",
      "orderStatus",
    ) &&
    hasAllowedStringField(
      record,
      ADMIN_USER_DETAIL_PAYMENT_STATUSES,
      "payment_status",
      "paymentStatus",
    ) &&
    hasFiniteNumberField(record, "total_price", "totalPrice") &&
    hasNonEmptyStringField(record, "created_at", "createdAt")
  );
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

function normalizeStatusHistory(
  value: unknown,
): OrderStatusHistory[] | undefined {
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
      created_at: toRequiredString(
        record,
        EMPTY_DATE,
        "created_at",
        "createdAt",
      ),
    };
  });
}

function normalizeOrderDestination(value: unknown): Order["delivery_address"] {
  const record = asRecord(value);
  const fullAddress =
    toOptionalString(record, "full_address", "fullAddress") ??
    toOptionalString(record, "address");
  const latitudeValue = read(record, "latitude");
  const longitudeValue = read(record, "longitude");
  const latitude = latitudeValue == null ? null : Number(latitudeValue);
  const longitude = longitudeValue == null ? null : Number(longitudeValue);

  if (
    !fullAddress &&
    !Number.isFinite(latitude) &&
    !Number.isFinite(longitude)
  ) {
    return undefined;
  }

  return {
    id:
      read(record, "id") === undefined
        ? undefined
        : toNumberValue(record, 0, "id"),
    address_id:
      read(record, "address_id", "addressId") === undefined
        ? undefined
        : toNumberValue(record, 0, "address_id", "addressId") || null,
    label: toOptionalString(record, "label") ?? null,
    address: fullAddress ?? null,
    full_address: fullAddress ?? null,
    barangay: toOptionalString(record, "barangay") ?? null,
    city: toOptionalString(record, "city") ?? null,
    province: toOptionalString(record, "province") ?? null,
    zip_code: toOptionalString(record, "zip_code", "zipCode") ?? null,
    landmark: toOptionalString(record, "landmark") ?? null,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    sort_order:
      read(record, "sort_order", "sortOrder") === undefined
        ? undefined
        : toNumberValue(record, 0, "sort_order", "sortOrder"),
  };
}

function normalizeOrderDestinations(value: unknown): Order["destinations"] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map(normalizeOrderDestination)
    .filter((item): item is NonNullable<Order["delivery_address"]> =>
      Boolean(item),
    );
}

function normalizeAssignedRiderContact(
  value: unknown,
): AssignedRiderContact | null {
  const record = asRecord(value);
  if (Object.keys(record).length === 0) return null;

  return {
    user_id: toOptionalString(record, "user_id", "userId"),
    rider_profile_id: toOptionalString(
      record,
      "rider_profile_id",
      "riderProfileId",
    ),
    display_name: toOptionalString(record, "display_name", "displayName"),
    full_name: toOptionalString(record, "full_name", "fullName"),
    nickname: toOptionalString(record, "nickname"),
    phone_number: toOptionalString(record, "phone_number", "phoneNumber"),
    vehicle_type: toOptionalString(record, "vehicle_type", "vehicleType"),
    plate_number: toOptionalString(record, "plate_number", "plateNumber"),
    delivery_assignment_id: toOptionalString(
      record,
      "delivery_assignment_id",
      "deliveryAssignmentId",
    ),
    delivery_status: toOptionalString(
      record,
      "delivery_status",
      "deliveryStatus",
    ),
  };
}

function normalizeDeliveryProof(value: unknown): DeliveryProof | null {
  const record = asRecord(value);
  if (Object.keys(record).length === 0) return null;

  return {
    type: toOptionalString(record, "type"),
    file_id:
      read(record, "file_id", "fileId") == null
        ? null
        : toNumberValue(record, 0, "file_id", "fileId"),
    object_key: toOptionalString(record, "object_key", "objectKey"),
    signature_data: toOptionalString(record, "signature_data", "signatureData"),
    captured_at: toOptionalString(record, "captured_at", "capturedAt"),
    captured_by_rider_id:
      read(record, "captured_by_rider_id", "capturedByRiderId") == null
        ? null
        : toNumberValue(record, 0, "captured_by_rider_id", "capturedByRiderId"),
  };
}

function normalizeOrderItems(value: unknown): OrderItem[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.map((item) => {
    const record = asRecord(item);
    const category = toRequiredString(record, "paper", "category");

    return {
      id: toRequiredString(record, "", "id"),
      order_id: toOptionalString(record, "order_id", "orderId"),
      category: category === "3d" ? "3d" : "paper",
      file_url: toOptionalString(record, "file_url", "fileUrl"),
      file_name: toOptionalString(record, "file_name", "fileName"),
      file_metadata_id:
        read(record, "file_metadata_id", "fileMetadataId") !== undefined
          ? toNumberValue(record, 0, "file_metadata_id", "fileMetadataId")
          : undefined,
      paper_specs: normalizePaperSpecs(
        read(record, "paper_specs", "paperSpec"),
      ),
      three_d_specs: normalizeThreeDSpecs(
        read(record, "three_d_specs", "threeDSpec"),
      ),
      quantity: toNumberValue(record, 1, "quantity"),
      total_price: toNumberValue(record, 0, "total_price", "totalPrice"),
      delivery_address:
        normalizeOrderDestination(
          read(record, "delivery_address", "deliveryAddress", "destination"),
        ) ?? null,
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
    category: (() => {
      const category = toRequiredString(record, "paper", "category");
      if (category === "3d") return "3d";
      if (category === "batch") return "batch";
      return "paper";
    })(),
    file_url: toOptionalString(record, "file_url", "fileUrl"),
    file_name: toOptionalString(record, "file_name", "fileName"),
    file_metadata_id:
      read(record, "file_metadata_id", "fileMetadataId") != null
        ? toNumberValue(record, 0, "file_metadata_id", "fileMetadataId") || null
        : null,
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
    allowed_next_statuses: toOrderStatusArray(
      read(record, "allowed_next_statuses", "allowedNextStatuses"),
    ),
    decline_reason: toOptionalString(record, "decline_reason", "declineReason"),
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
    delivery_address:
      normalizeOrderDestination(
        read(record, "delivery_address", "deliveryAddress", "destination"),
      ) ?? null,
    assigned_rider_id: toOptionalString(
      record,
      "assigned_rider_id",
      "assignedRiderId",
    ),
    assigned_rider_contact: normalizeAssignedRiderContact(
      read(
        record,
        "assigned_rider_contact",
        "assignedRiderContact",
        "assignedRider",
      ),
    ),
    delivery_proof: normalizeDeliveryProof(
      read(record, "delivery_proof", "deliveryProof"),
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
    items: normalizeOrderItems(read(record, "items")),
    status_history: normalizeStatusHistory(
      read(record, "status_history", "statusHistory"),
    ),
    customer_id:
      read(record, "customer_id", "customerId") !== undefined
        ? toNumberValue(record, 0, "customer_id", "customerId")
        : undefined,
    customer_name:
      toOptionalString(record, "customer_name", "customerName") ?? null,
    customer_email:
      toOptionalString(record, "customer_email", "customerEmail") ?? null,
    adminStatusNote: toOptionalString(record, "adminStatusNote") ?? null,
    estimatedCompletionAt:
      toOptionalString(record, "estimatedCompletionAt") ?? null,
    adminStatusSetAt: toOptionalString(record, "adminStatusSetAt") ?? null,
    deliverySlotBookingId:
      read(record, "delivery_slot_booking_id", "deliverySlotBookingId") ===
      undefined
        ? undefined
        : toNumberValue(
            record,
            0,
            "delivery_slot_booking_id",
            "deliverySlotBookingId",
          ),
    priority: toBooleanValue(record, false, "priority"),
    priorityFee:
      read(record, "priority_fee", "priorityFee") === undefined
        ? undefined
        : toNumberValue(record, 0, "priority_fee", "priorityFee"),
    speedTier: toOptionalString(record, "speed_tier", "speedTier"),
    deliveryType:
      toOptionalString(record, "delivery_type", "deliveryType") === "external"
        ? "external"
        : toOptionalString(record, "delivery_type", "deliveryType") === "local"
          ? "local"
          : undefined,
    extraDestinationFee:
      read(record, "extra_destination_fee", "extraDestinationFee") === undefined
        ? undefined
        : toNumberValue(
            record,
            0,
            "extra_destination_fee",
            "extraDestinationFee",
          ),
    destinations: normalizeOrderDestinations(read(record, "destinations")),
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
    phone_number:
      toOptionalString(record, "phone_number", "phoneNumber") ?? null,
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
    client_account_type:
      toOptionalString(
        record,
        "client_account_type",
        "clientAccountType",
      ) ?? null,
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

export function normalizeAdminUserDetailRecord(
  input: unknown,
): AdminUserDetailRecord {
  const record = asRecord(input);

  return {
    ...normalizeAdminUser(record),
    gender: toOptionalString(record, "gender") ?? null,
    date_of_birth:
      toOptionalString(record, "date_of_birth", "dateOfBirth") ?? null,
  };
}

export function normalizeAdminUserMetrics(
  input: unknown,
): AdminUserMetricsRecord {
  const record = asRecord(input);

  return {
    total_orders: toNumberValue(record, 0, "total_orders", "totalOrders"),
    paid_orders: toNumberValue(record, 0, "paid_orders", "paidOrders"),
    total_spend: toNumberValue(record, 0, "total_spend", "totalSpend"),
    average_order_value: toNumberValue(
      record,
      0,
      "average_order_value",
      "averageOrderValue",
    ),
    last_order_at:
      toOptionalString(record, "last_order_at", "lastOrderAt") ?? null,
    last_paid_order_at:
      toOptionalString(record, "last_paid_order_at", "lastPaidOrderAt") ?? null,
  };
}

export function normalizeAdminUserRecentOrder(
  input: unknown,
): AdminUserRecentOrderRecord {
  const record = asRecord(input);

  return {
    id: toNumberValue(record, 0, "id"),
    order_id: toRequiredString(record, "", "order_id", "orderId"),
    category: (() => {
      const category = toRequiredString(record, "paper", "category");
      if (category === "3d") return "3d";
      if (category === "batch") return "batch";
      return "paper";
    })(),
    order_status: toRequiredString(
      record,
      "order_placed",
      "order_status",
      "orderStatus",
    ) as OrderStatus,
    payment_status: toRequiredString(
      record,
      "pending",
      "payment_status",
      "paymentStatus",
    ) as PaymentStatus,
    total_price: toNumberValue(record, 0, "total_price", "totalPrice"),
    created_at: toRequiredString(record, EMPTY_DATE, "created_at", "createdAt"),
  };
}

export function normalizeAdminUserDetail(
  payload: unknown,
): AdminUserDetailPayload | null {
  const record = asRecord(payload);
  const userValue = read(record, "user");
  const metricsValue = read(record, "metrics");
  const recentOrdersValue = read(record, "recent_orders", "recentOrders");

  if (
    userValue === undefined ||
    userValue === null ||
    !isValidAdminUserMetrics(metricsValue) ||
    !Array.isArray(recentOrdersValue) ||
    !recentOrdersValue.every(isValidAdminUserRecentOrder)
  ) {
    return null;
  }

  return {
    user: normalizeAdminUserDetailRecord(userValue),
    metrics: normalizeAdminUserMetrics(metricsValue),
    recent_orders: recentOrdersValue.map(normalizeAdminUserRecentOrder),
  };
}

export function normalizeAdminRider(input: unknown): AdminRiderRecord {
  const record = asRecord(input);
  const user = asRecord(read(record, "user"));

  return {
    id: toNumberValue(record, 0, "id"),
    user_id:
      read(record, "user_id", "userId") === undefined
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
    plate_number:
      toOptionalString(record, "plate_number", "plateNumber") ?? null,
    is_available: toBooleanValue(record, false, "is_available", "isAvailable"),
    assignment_eligible: toBooleanValue(
      record,
      false,
      "assignment_eligible",
      "assignmentEligible",
    ),
    last_latitude:
      read(record, "last_latitude", "lastLatitude") === undefined
        ? null
        : toNumberValue(record, 0, "last_latitude", "lastLatitude"),
    last_longitude:
      read(record, "last_longitude", "lastLongitude") === undefined
        ? null
        : toNumberValue(record, 0, "last_longitude", "lastLongitude"),
    last_location_update:
      toOptionalString(record, "last_location_update", "lastLocationUpdate") ??
      null,
    created_at: toRequiredString(record, EMPTY_DATE, "created_at", "createdAt"),
    updated_at: toRequiredString(record, EMPTY_DATE, "updated_at", "updatedAt"),
  };
}

export function normalizeAdminRiders(payload: unknown): AdminRiderRecord[] {
  return Array.isArray(payload) ? payload.map(normalizeAdminRider) : [];
}

export function normalizeServiceCategory(input: unknown): ServiceCategory {
  const record = asRecord(input);

  return {
    id: toRequiredString(record, "", "id"),
    name: toRequiredString(record, "", "name"),
    slug: toRequiredString(record, "", "slug"),
    description: toOptionalString(record, "description"),
    mobile_description: toOptionalString(
      record,
      "mobile_description",
      "mobileDescription",
    ),
    icon: toOptionalString(record, "icon"),
    file_processing_type: toRequiredString(
      record,
      "generic_file",
      "file_processing_type",
      "fileProcessingType",
    ) as ProductFileProcessingType,
    pricing_model: toRequiredString(
      record,
      "per_page_modifiers",
      "pricing_model",
      "pricingModel",
    ) as ProductPricingModel,
    base_rate: toNumberValue(record, 0, "base_rate", "baseRate"),
    quantity_unit: toRequiredString(
      record,
      "copy",
      "quantity_unit",
      "quantityUnit",
    ),
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
    specs: normalizeProductSpecDefinitions(read(record, "specs")),
    created_at: toRequiredString(record, EMPTY_DATE, "created_at", "createdAt"),
    updated_at: toRequiredString(record, EMPTY_DATE, "updated_at", "updatedAt"),
  };
}

export function normalizeServiceCategories(
  payload: unknown,
): ServiceCategory[] {
  return Array.isArray(payload) ? payload.map(normalizeServiceCategory) : [];
}

export function normalizeProductSpecDefinition(
  input: unknown,
): ProductSpecDefinition {
  const record = asRecord(input);

  return {
    id: toRequiredString(record, "", "id"),
    category_id: toRequiredString(record, "", "category_id", "categoryId"),
    key: toRequiredString(record, "", "key"),
    label: toRequiredString(record, "", "label"),
    help_text: toOptionalString(record, "help_text", "helpText"),
    input_type: toRequiredString(
      record,
      "select",
      "input_type",
      "inputType",
    ) as ProductInputType,
    value_type: toRequiredString(
      record,
      "string",
      "value_type",
      "valueType",
    ) as ProductValueType,
    is_required: toBooleanValue(record, true, "is_required", "isRequired"),
    is_active: toBooleanValue(record, true, "is_active", "isActive"),
    default_value: toOptionalString(record, "default_value", "defaultValue"),
    pricing_role: toRequiredString(
      record,
      "none",
      "pricing_role",
      "pricingRole",
    ) as ProductPricingRole,
    unit_label: toOptionalString(record, "unit_label", "unitLabel"),
    placeholder: toOptionalString(record, "placeholder"),
    min_value:
      read(record, "min_value", "minValue") === undefined ||
      read(record, "min_value", "minValue") === null
        ? undefined
        : toNumberValue(record, 0, "min_value", "minValue"),
    max_value:
      read(record, "max_value", "maxValue") === undefined ||
      read(record, "max_value", "maxValue") === null
        ? undefined
        : toNumberValue(record, 0, "max_value", "maxValue"),
    step_value:
      read(record, "step_value", "stepValue") === undefined ||
      read(record, "step_value", "stepValue") === null
        ? undefined
        : toNumberValue(record, 0, "step_value", "stepValue"),
    sort_order: toNumberValue(record, 0, "sort_order", "sortOrder"),
    metadata: asRecord(read(record, "metadata")),
    options: normalizeSpecOptions(read(record, "options")),
    created_at: toRequiredString(record, EMPTY_DATE, "created_at", "createdAt"),
    updated_at: toRequiredString(record, EMPTY_DATE, "updated_at", "updatedAt"),
  };
}

export function normalizeProductSpecDefinitions(
  payload: unknown,
): ProductSpecDefinition[] {
  return Array.isArray(payload)
    ? payload.map(normalizeProductSpecDefinition)
    : [];
}

export function normalizeSpecOption(input: unknown): SpecOption {
  const record = asRecord(input);
  const specDefinition = asRecord(
    read(record, "specDefinition", "spec_definition"),
  );
  const estimatedQuantity = read(
    record,
    "estimated_quantity",
    "estimatedQuantity",
    "estimated_grams",
    "estimatedGrams",
  );

  return {
    id: toRequiredString(record, "", "id"),
    category_id:
      toOptionalString(record, "category_id", "categoryId") ??
      toRequiredString(specDefinition, "", "category_id", "categoryId"),
    spec_definition_id:
      toOptionalString(record, "spec_definition_id", "specDefinitionId") ??
      toOptionalString(specDefinition, "id"),
    option_group:
      toOptionalString(record, "option_group", "optionGroup") ??
      toRequiredString(specDefinition, "", "key"),
    label: toRequiredString(record, "", "label"),
    value: toRequiredString(record, "", "value"),
    multiplier: toNumberValue(record, 1, "multiplier"),
    fixed_fee: toNumberValue(record, 0, "fixed_fee", "fixedFee"),
    unit_cost: toNumberValue(record, 0, "unit_cost", "unitCost"),
    estimated_quantity:
      estimatedQuantity === undefined || estimatedQuantity === null
        ? undefined
        : toNumberValue(
            record,
            0,
            "estimated_quantity",
            "estimatedQuantity",
            "estimated_grams",
            "estimatedGrams",
          ),
    estimated_grams:
      estimatedQuantity === undefined || estimatedQuantity === null
        ? undefined
        : toNumberValue(
            record,
            0,
            "estimated_quantity",
            "estimatedQuantity",
            "estimated_grams",
            "estimatedGrams",
          ),
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
