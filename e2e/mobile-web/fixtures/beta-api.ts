import {
  expect,
  type APIRequestContext,
  type APIResponse,
  type Page,
  type Response,
} from "@playwright/test";
import { io } from "socket.io-client";

import type { BetaRouteCheckpoint } from "./beta-locations";

export type JsonRecord = Record<string, unknown>;

const EXPECTED_PRIVACY_DENIAL = "Live tracking is not available for this stop";

function numericField(source: JsonRecord, ...keys: string[]): number {
  for (const key of keys) {
    if (source[key] != null) return Number(source[key]);
  }
  return Number.NaN;
}

export function assertExpectedPrivacyDenial(payload: unknown): void {
  const message =
    typeof payload === "string"
      ? payload
      : typeof payload === "object" && payload !== null && "message" in payload
        ? String((payload as { message: unknown }).message)
        : "";
  expect(
    message,
    "later-stop socket must return the calibrated privacy denial",
  ).toBe(EXPECTED_PRIVACY_DENIAL);
}

export function validateLocationEvidence(
  payload: JsonRecord,
  expected: {
    assignmentId: number;
    planVersion: number;
    checkpoint: BetaRouteCheckpoint;
  },
): void {
  expect(positiveId(payload.assignmentId, "location assignment id")).toBe(
    expected.assignmentId,
  );
  expect(positiveId(payload.planVersion, "location plan version")).toBe(
    expected.planVersion,
  );
  expect(Number(payload.latitude)).toBeCloseTo(expected.checkpoint.latitude, 5);
  expect(Number(payload.longitude)).toBeCloseTo(
    expected.checkpoint.longitude,
    5,
  );
}

export function validatePersistedDispatchPlan(
  value: JsonRecord,
  expected: { venAssignmentId: number; markAssignmentId: number },
): void {
  positiveId(value.id, "dispatch plan id");
  positiveId(value.version, "dispatch plan version");
  expect(String(value.provider).toLowerCase(), "routing provider").toBe("osrm");
  expect(
    numericField(value, "total_duration_seconds", "totalDurationSeconds"),
    "total road duration",
  ).toBeGreaterThan(0);
  expect(
    numericField(value, "total_distance_meters", "totalDistanceMeters"),
    "total road distance",
  ).toBeGreaterThan(0);
  const stops = value.stops as JsonRecord[];
  expect(
    stops,
    "persisted route must contain exactly two run stops",
  ).toHaveLength(2);
  const expectedAssignments = [
    expected.venAssignmentId,
    expected.markAssignmentId,
  ];
  stops.forEach((stop, index) => {
    expect(numericField(stop, "sequence"), `stop ${index + 1} sequence`).toBe(
      index + 1,
    );
    expect(
      numericField(stop, "assignment_id", "assignmentId"),
      `stop ${index + 1} assignment`,
    ).toBe(expectedAssignments[index]);
    expect(
      numericField(stop, "leg_duration_seconds", "legDurationSeconds"),
      `stop ${index + 1} road duration`,
    ).toBeGreaterThan(0);
    expect(
      numericField(stop, "leg_distance_meters", "legDistanceMeters"),
      `stop ${index + 1} road distance`,
    ).toBeGreaterThan(0);
    const geometry = (stop.leg_geometry ?? stop.legGeometry) as JsonRecord;
    expect(geometry?.type, `stop ${index + 1} geometry type`).toBe(
      "LineString",
    );
    const coordinates = geometry?.coordinates as unknown[];
    expect(
      coordinates?.length,
      `stop ${index + 1} geometry coordinates`,
    ).toBeGreaterThan(1);
  });
}

export function assertAddressWithinTolerance(
  actual: JsonRecord,
  expected: { latitude: number; longitude: number },
  tolerance = 0.00015,
): void {
  const latitude = numericField(actual, "latitude", "lat");
  const longitude = numericField(actual, "longitude", "lng", "lon");
  expect(
    Math.abs(latitude - expected.latitude),
    "pinned address latitude tolerance",
  ).toBeLessThanOrEqual(tolerance);
  expect(
    Math.abs(longitude - expected.longitude),
    "pinned address longitude tolerance",
  ).toBeLessThanOrEqual(tolerance);
}

export const surveyQuestionIndexes = Object.freeze(
  Array.from({ length: 14 }, (_, index) => index),
);

export function validateSurveySubmission(
  response: JsonRecord,
  expected: { requirementId: number; answeredIndexes: readonly number[] },
): void {
  expect(expected.answeredIndexes, "all required survey indexes").toEqual(
    surveyQuestionIndexes,
  );
  expect(response.success, "survey response success").toBe(true);
  expect(
    positiveId(response.requirementId, "survey response requirement id"),
  ).toBe(expected.requirementId);
}

export async function strictJson<T>(
  response: APIResponse,
  action: string,
): Promise<T> {
  const status = response.status();
  const body = (await response.json()) as T;
  expect(status, `${action} must return 2xx`).toBeGreaterThanOrEqual(200);
  expect(status, `${action} must return 2xx`).toBeLessThan(300);
  return body;
}

export async function strictBrowserJson<T>(
  response: Response,
  action: string,
): Promise<T> {
  const status = response.status();
  const body = (await response.json()) as T;
  expect(status, `${action} must return 2xx`).toBeGreaterThanOrEqual(200);
  expect(status, `${action} must return 2xx`).toBeLessThan(300);
  return body;
}

export async function waitForStrict2xx<T>(
  page: Page,
  predicate: (response: Response) => boolean,
  action: () => Promise<void>,
  label: string,
): Promise<T> {
  const responsePromise = page.waitForResponse(predicate);
  await action();
  return strictBrowserJson<T>(await responsePromise, label);
}

export function positiveId(value: unknown, label: string): number {
  const id = Number(value);
  expect(
    Number.isInteger(id) && id > 0,
    `${label} must be a positive durable id`,
  ).toBe(true);
  return id;
}

export function orderIdentity(body: JsonRecord): {
  id: number;
  orderRef: string;
} {
  const source = Array.isArray(body.orders)
    ? (body.orders[0] as JsonRecord)
    : body;
  const id = positiveId(source.id, "order id");
  const orderRef = String(source.orderId ?? source.order_id ?? "");
  expect(orderRef, "order reference must be durable").toMatch(
    /^(?:ORD|GRID|BATCH)-|\d{4}/i,
  );
  return { id, orderRef };
}

export async function authenticatedGet<T>(
  request: APIRequestContext,
  apiBaseURL: string,
  endpoint: string,
  token: string,
  action: string,
): Promise<T> {
  return strictJson<T>(
    await request.get(`${apiBaseURL}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    action,
  );
}

export async function setAcknowledgedGeolocation(options: {
  riderPage: Page;
  apiBaseURL: string;
  customerToken: string;
  checkpoint: BetaRouteCheckpoint;
  expectedAssignmentId: number;
  expectedPlanVersion: number;
  assertCustomerMarker: () => Promise<void>;
}): Promise<JsonRecord> {
  const {
    riderPage,
    apiBaseURL,
    customerToken,
    checkpoint,
    expectedAssignmentId,
    expectedPlanVersion,
    assertCustomerMarker,
  } = options;
  const socketRoot = apiBaseURL.replace(/\/api\/?$/, "");
  const socket = io(`${socketRoot}/ws/location`, {
    auth: { token: customerToken },
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
  const timeoutMs = 10_000;
  const subscribed = new Promise<JsonRecord>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(new Error("current-customer location subscription timed out")),
      timeoutMs,
    );
    socket.once("subscribed", (payload: JsonRecord) => {
      clearTimeout(timer);
      resolve(payload);
    });
    socket.once("exception", (payload: unknown) => {
      clearTimeout(timer);
      reject(
        new Error(
          `current-customer subscription rejected: ${JSON.stringify(payload)}`,
        ),
      );
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      reject(new Error(`current-customer socket failed: ${error.message}`));
    });
    socket.once("connect", () =>
      socket.emit("subscribe", String(expectedAssignmentId)),
    );
  });
  const subscribedPayload = await subscribed;
  expect(
    positiveId(subscribedPayload.assignmentId, "subscribed assignment id"),
  ).toBe(expectedAssignmentId);
  expect(
    positiveId(subscribedPayload.planVersion, "subscribed plan version"),
  ).toBe(expectedPlanVersion);
  const locationUpdate = new Promise<JsonRecord>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("authenticated location update timed out")),
      timeoutMs,
    );
    socket.once("locationUpdate", (payload: JsonRecord) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
  const responsePromise = riderPage.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname.endsWith("/api/riders/location"),
  );
  try {
    await riderPage.context().setGeolocation(checkpoint);
    const acknowledged = await strictBrowserJson<JsonRecord>(
      await responsePromise,
      `acknowledge rider checkpoint ${checkpoint.id}`,
    );
    positiveId(acknowledged.id, "acknowledged rider profile id");
    expect(
      Number(
        acknowledged.lastLatitude ??
          acknowledged.last_latitude ??
          acknowledged.latitude,
      ),
    ).toBeCloseTo(checkpoint.latitude, 5);
    expect(
      Number(
        acknowledged.lastLongitude ??
          acknowledged.last_longitude ??
          acknowledged.longitude,
      ),
    ).toBeCloseTo(checkpoint.longitude, 5);
    const location = await locationUpdate;
    validateLocationEvidence(location, {
      assignmentId: expectedAssignmentId,
      planVersion: expectedPlanVersion,
      checkpoint,
    });
    await assertCustomerMarker();
    return location;
  } finally {
    socket.removeAllListeners();
    socket.disconnect();
  }
}

export type AssignmentRecord = {
  id: number;
  order?: { id?: number; orderId?: string; order_id?: string };
  orderId?: number;
  status?: string;
};

export function onlyRunAssignments(
  assignments: readonly AssignmentRecord[],
  orderIds: readonly number[],
): AssignmentRecord[] {
  const expected = new Set(orderIds);
  const selected = assignments.filter((assignment) => {
    const orderId = Number(assignment.order?.id ?? assignment.orderId);
    return expected.has(orderId);
  });
  expect(
    selected,
    "Juan plan must include each run order exactly once",
  ).toHaveLength(orderIds.length);
  expect(
    new Set(
      selected.map((assignment) =>
        Number(assignment.order?.id ?? assignment.orderId),
      ),
    ),
  ).toEqual(expected);
  return selected;
}

export async function assertLocationPrivacyDenied(options: {
  apiBaseURL: string;
  token: string;
  assignmentId: number;
  timeoutMs?: number;
}): Promise<void> {
  const socketRoot = options.apiBaseURL.replace(/\/api\/?$/, "");
  await new Promise<void>((resolve, reject) => {
    const socket = io(`${socketRoot}/ws/location`, {
      auth: { token: options.token },
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });
    let receivedLocation = false;
    const timeout = setTimeout(
      () => finish(new Error("location privacy denial was not acknowledged")),
      options.timeoutMs ?? 8_000,
    );
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      socket.removeAllListeners();
      socket.disconnect();
      if (error) reject(error);
      else resolve();
    };
    socket.on("locationUpdate", () => {
      receivedLocation = true;
      finish(
        new Error("later-stop customer received private rider coordinates"),
      );
    });
    socket.on("subscribed", () =>
      finish(new Error("later-stop customer joined a private location room")),
    );
    socket.on("exception", (payload: unknown) => {
      try {
        assertExpectedPrivacyDenial(payload);
        expect(receivedLocation).toBe(false);
        finish();
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    });
    socket.on("connect_error", (error) =>
      finish(new Error(`location socket connection failed: ${error.message}`)),
    );
    socket.on("connect", () =>
      socket.emit("subscribe", String(options.assignmentId)),
    );
  });
}
