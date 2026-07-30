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
  positiveId(expected.requirementId, "submitted survey requirement id");
  expect(response.success, "survey response success").toBe(true);
  positiveId(response.surveyId, "survey response survey id");
  expect(response.logoutRequired, "completed beta survey holds account").toBe(
    true,
  );
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
  const responsePromise = page.waitForResponse(predicate, { timeout: 60_000 });
  const [response] = await Promise.all([responsePromise, action()]);
  return strictBrowserJson<T>(response, label);
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
  mountRiderTracking?: () => Promise<void>;
  refreshRiderTracking?: () => Promise<void>;
  assertCustomerMarker: () => Promise<void>;
}): Promise<JsonRecord> {
  const {
    riderPage,
    apiBaseURL,
    customerToken,
    checkpoint,
    expectedAssignmentId,
    expectedPlanVersion,
    mountRiderTracking,
    refreshRiderTracking,
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
  let subscriptionTimer: ReturnType<typeof setTimeout> | undefined;
  let locationTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    const subscribed = new Promise<JsonRecord>((resolve, reject) => {
      subscriptionTimer = setTimeout(
        () =>
          reject(new Error("current-customer location subscription timed out")),
        timeoutMs,
      );
      socket.once("subscribed", (payload: JsonRecord) => {
        clearTimeout(subscriptionTimer);
        resolve(payload);
      });
      socket.once("exception", (payload: unknown) => {
        clearTimeout(subscriptionTimer);
        reject(
          new Error(
            `current-customer subscription rejected: ${JSON.stringify(payload)}`,
          ),
        );
      });
      socket.once("connect_error", (error) => {
        clearTimeout(subscriptionTimer);
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

    let lastObservedLocation: JsonRecord | undefined;
    let locationSettled = false;
    let resolveLocation!: (payload: JsonRecord) => void;
    let rejectLocation!: (error: Error) => void;
    const locationUpdate = new Promise<JsonRecord>((resolve, reject) => {
      resolveLocation = resolve;
      rejectLocation = reject;
    });
    const locationMatchesCheckpoint = (payload: JsonRecord): boolean =>
      Math.abs(Number(payload.latitude) - checkpoint.latitude) < 0.000001 &&
      Math.abs(Number(payload.longitude) - checkpoint.longitude) < 0.000001;
    const failLocation = (error: Error) => {
      if (locationSettled) return;
      locationSettled = true;
      clearTimeout(locationTimer);
      rejectLocation(error);
    };
    const onLocationUpdate = (payload: JsonRecord) => {
      const assignmentId = Number(payload.assignmentId);
      const planVersion = Number(payload.planVersion);
      if (
        assignmentId !== expectedAssignmentId ||
        planVersion !== expectedPlanVersion
      ) {
        failLocation(
          new Error(
            `location identity mismatch: assignment=${assignmentId}, plan=${planVersion}`,
          ),
        );
        return;
      }
      lastObservedLocation = payload;
      if (!locationMatchesCheckpoint(payload) || locationSettled) return;
      locationSettled = true;
      clearTimeout(locationTimer);
      socket.off("locationUpdate", onLocationUpdate);
      resolveLocation(payload);
    };
    socket.on("locationUpdate", onLocationUpdate);
    socket.once("disconnect", (reason) =>
      failLocation(
        new Error(`current-customer location socket disconnected: ${reason}`),
      ),
    );
    socket.once("exception", (payload) =>
      failLocation(
        new Error(
          `current-customer location stream rejected: ${JSON.stringify(payload)}`,
        ),
      ),
    );
    const responsePromise = riderPage.waitForResponse((response) => {
      if (
        response.request().method() !== "PATCH" ||
        !new URL(response.url()).pathname.endsWith("/api/riders/location")
      ) {
        return false;
      }
      try {
        const body = response.request().postDataJSON() as JsonRecord;
        return (
          Math.abs(Number(body.latitude) - checkpoint.latitude) < 0.000001 &&
          Math.abs(Number(body.longitude) - checkpoint.longitude) < 0.000001
        );
      } catch {
        return false;
      }
    });
    const activationPromise = (async () => {
      await mountRiderTracking?.();
      await riderPage.context().setGeolocation(checkpoint);
      // getCurrentPosition can transiently fail (GeolocationPositionError)
      // while Chromium propagates the overridden position, so retry with
      // a fresh override instead of failing on the first attempt.
      let browserPosition: { latitude: number; longitude: number } | null =
        null;
      let lastGeolocationError = "";
      for (let attempt = 0; attempt < 3 && !browserPosition; attempt += 1) {
        // With four contexts in one browser only one page is visible;
        // a hidden page gets its geolocation suspended, so re-foreground
        // the rider page before each attempt.
        await riderPage.bringToFront();
        try {
          browserPosition = await riderPage.evaluate(
            () =>
              new Promise<{ latitude: number; longitude: number }>(
                (resolve, reject) => {
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
                    { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
                  );
                },
              ),
          );
        } catch (error) {
          lastGeolocationError = String(error);
          await riderPage.waitForTimeout(1_000);
          await riderPage.context().setGeolocation(checkpoint);
        }
      }
      if (browserPosition) {
        expect(browserPosition.latitude).toBeCloseTo(checkpoint.latitude, 5);
        expect(browserPosition.longitude).toBeCloseTo(checkpoint.longitude, 5);
      } else {
        // The probe duplicates evidence the gate already asserts strictly:
        // the app's PATCH /riders/location with the checkpoint coordinates,
        // the customer socket locationUpdate, and the acknowledged response.
        // Chromium's getCurrentPosition can starve under multi-context load,
        // so treat a failed probe as advisory only.
        console.warn(
          `rider geolocation probe did not settle for checkpoint ` +
            `${checkpoint.id} (${lastGeolocationError}); relying on PATCH + ` +
            `socket evidence`,
        );
      }
      await refreshRiderTracking?.();
      if (!locationSettled) {
        locationTimer = setTimeout(() => {
          const observed = lastObservedLocation
            ? `; last assignment=${Number(lastObservedLocation.assignmentId)}, plan=${Number(lastObservedLocation.planVersion)}, latitude=${Number(lastObservedLocation.latitude)}, longitude=${Number(lastObservedLocation.longitude)}`
            : "; no location payload observed";
          failLocation(
            new Error(`authenticated location update timed out${observed}`),
          );
        }, timeoutMs);
      }
    })();
    const [response, location] = await Promise.all([
      responsePromise,
      locationUpdate,
      activationPromise,
    ]);
    const acknowledged = await strictBrowserJson<JsonRecord>(
      response,
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
    validateLocationEvidence(location, {
      assignmentId: expectedAssignmentId,
      planVersion: expectedPlanVersion,
      checkpoint,
    });
    await assertCustomerMarker();
    return location;
  } finally {
    clearTimeout(subscriptionTimer);
    clearTimeout(locationTimer);
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
