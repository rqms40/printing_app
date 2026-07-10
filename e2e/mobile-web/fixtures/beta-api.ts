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
  checkpoint: BetaRouteCheckpoint;
  expectedAssignmentId: number;
  assertCustomerMarker: () => Promise<void>;
}): Promise<JsonRecord> {
  const { riderPage, checkpoint, expectedAssignmentId, assertCustomerMarker } =
    options;
  const responsePromise = riderPage.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname.endsWith("/api/riders/location"),
  );
  await riderPage.context().setGeolocation(checkpoint);
  const acknowledged = await strictBrowserJson<JsonRecord>(
    await responsePromise,
    `acknowledge rider checkpoint ${checkpoint.id}`,
  );
  positiveId(acknowledged.id, "acknowledged rider profile id");
  const responseAssignmentId =
    acknowledged.currentAssignmentId ?? acknowledged.assignmentId;
  if (responseAssignmentId != null) {
    expect(positiveId(responseAssignmentId, "acknowledged assignment id")).toBe(
      expectedAssignmentId,
    );
  }
  expect(
    Number(
      acknowledged.lastLatitude ??
        acknowledged.last_latitude ??
        acknowledged.latitude,
    ),
  ).toBeCloseTo(checkpoint.latitude, 4);
  expect(
    Number(
      acknowledged.lastLongitude ??
        acknowledged.last_longitude ??
        acknowledged.longitude,
    ),
  ).toBeCloseTo(checkpoint.longitude, 4);
  await assertCustomerMarker();
  return acknowledged;
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
      const message =
        typeof payload === "string" ? payload : JSON.stringify(payload);
      if (
        !/Forbidden|Live tracking is not available|Delivery not found|Unauthorized/i.test(
          message,
        )
      ) {
        finish(new Error(`unexpected socket denial: ${message}`));
        return;
      }
      expect(receivedLocation).toBe(false);
      finish();
    });
    socket.on("connect_error", (error) =>
      finish(new Error(`location socket connection failed: ${error.message}`)),
    );
    socket.on("connect", () =>
      socket.emit("subscribe", String(options.assignmentId)),
    );
  });
}
