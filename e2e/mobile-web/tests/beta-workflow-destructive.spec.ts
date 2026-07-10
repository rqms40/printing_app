import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type AuthUser = {
  id: number;
  fullName: string;
  credits: number | string;
  isBetaUser: boolean;
  betaCreditsGranted: boolean;
};

type AuthResponse = {
  access_token: string;
  user: AuthUser;
};

type CreatedOrder = {
  id: number;
  orderId: string;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
};

type DeliveryAssignment = {
  id: number;
  orderId: number;
  status: string;
  order: { id: number; orderId: string };
};

type AccountState = {
  accountStatus: "active" | "survey_required";
  holds: Array<{ requirementId: number; orderId: number }>;
};

const apiBaseURL = process.env.GRIDGO_API_URL ?? "http://127.0.0.1:3000/api";
const destructiveEnabled = process.env.GRIDGO_RUN_BETA_FLOW_DESTRUCTIVE === "1";

const printTestPng = readFileSync(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../fixtures/beta-upload.png",
  ),
);

async function responseJson<T>(
  response: APIResponse,
  action: string,
): Promise<T> {
  const body = (await response.json()) as T;
  expect(response.ok(), `${action} failed with ${response.status()}`).toBe(
    true,
  );
  return body;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function login(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<AuthResponse> {
  return responseJson<AuthResponse>(
    await request.post(`${apiBaseURL}/auth/login`, {
      data: { email, password },
    }),
    "credentialed login",
  );
}

async function registerBetaCustomer(
  request: APIRequestContext,
  identity: string,
  fullName: string,
): Promise<{ email: string; password: string; auth: AuthResponse }> {
  const email = `beta-e2e-${identity}@example.test`;
  const password = `BetaE2e-${identity}!`;
  const auth = await responseJson<AuthResponse>(
    await request.post(`${apiBaseURL}/auth/register`, {
      data: {
        email,
        password,
        fullName,
        nickname: fullName.split(" ")[0],
        profileCategory: "student",
        profileField: "architecture",
        ageRange: "18_24",
        course: "QA Architecture",
        organization: "GRIDGO Beta QA",
        printingPreferences: ["document_printing"],
      },
    }),
    `register ${fullName}`,
  );

  expect(auth.user).toMatchObject({
    fullName,
    isBetaUser: true,
    betaCreditsGranted: true,
  });
  expect(Number(auth.user.credits)).toBe(100);
  return { email, password, auth };
}

async function uploadPrintFile(
  request: APIRequestContext,
  token: string,
  identity: string,
): Promise<number> {
  const file = await responseJson<{ id: number; objectKey: string }>(
    await request.post(`${apiBaseURL}/files/upload`, {
      headers: authHeaders(token),
      multipart: {
        file: {
          name: `${identity}-beta-print.png`,
          mimeType: "image/png",
          buffer: printTestPng,
        },
      },
    }),
    `upload print file for ${identity}`,
  );
  expect(file.id).toBeGreaterThan(0);
  expect(file.objectKey).toContain("uploads/general/");

  const preview = await request.get(
    `${apiBaseURL}/files/${file.id}/presigned-url`,
    { headers: authHeaders(token) },
  );
  expect(preview.ok()).toBe(true);
  return file.id;
}

async function uploadPurposeImage(
  request: APIRequestContext,
  token: string,
  identity: string,
  purpose: "proof_of_delivery" | "beta_testimonial",
): Promise<number> {
  const file = await responseJson<{ id: number; objectKey: string }>(
    await request.post(`${apiBaseURL}/files/upload`, {
      headers: authHeaders(token),
      multipart: {
        purpose,
        file: {
          name: `${identity}-${purpose}.png`,
          mimeType: "image/png",
          buffer: printTestPng,
        },
      },
    }),
    `upload ${purpose} image for ${identity}`,
  );
  expect(file.id).toBeGreaterThan(0);
  expect(file.objectKey).toContain(`uploads/${purpose}/`);
  return file.id;
}

async function savePinnedAddress(
  request: APIRequestContext,
  token: string,
  identity: string,
  latitude: number,
  longitude: number,
): Promise<number> {
  const address = await responseJson<{ id: number }>(
    await request.post(`${apiBaseURL}/addresses`, {
      headers: authHeaders(token),
      data: {
        label: `Beta QA ${identity}`,
        fullAddress: `${identity} beta route address, Davao City`,
        barangay: "Poblacion",
        city: "Davao City",
        province: "Davao del Sur",
        zipCode: "8000",
        landmark: "GRIDGO beta workflow",
        latitude,
        longitude,
        isDefault: true,
      },
    }),
    `save pinned address for ${identity}`,
  );

  const recent = await responseJson<Array<{ id: number }>>(
    await request.get(`${apiBaseURL}/addresses`, {
      headers: authHeaders(token),
    }),
    `load recent addresses for ${identity}`,
  );
  expect(recent.some((candidate) => candidate.id === address.id)).toBe(true);
  return address.id;
}

function orderPayload(
  fileMetadataId: number,
  deliveryAddressId: number,
  paymentMethod: string,
) {
  return {
    items: [
      {
        category: "paper",
        quantity: 1,
        totalPrice: 0,
        fileName: "beta-print.png",
        fileMetadataId,
        specs: {
          paper_size: "a4",
          color_mode: "black_and_white",
          media_type: "matte",
          print_sides: "front_only",
          binding: "none",
          print_mode: "fitToPage",
          page_count: 1,
        },
      },
    ],
    deliveryFee: 0,
    paymentMethod,
    paymentStatus: "paid",
    deliveryOption: "delivery",
    deliveryAddressId,
    speedTier: "priority",
  };
}

async function placeCreditOrder(
  request: APIRequestContext,
  token: string,
  fileMetadataId: number,
  deliveryAddressId: number,
  verifyCreditsOnly: boolean,
): Promise<CreatedOrder> {
  if (verifyCreditsOnly) {
    const denied = await request.post(`${apiBaseURL}/orders/batch`, {
      headers: authHeaders(token),
      data: orderPayload(fileMetadataId, deliveryAddressId, "gcash"),
    });
    expect(denied.status()).toBe(403);
    await expect(denied.json()).resolves.toMatchObject({
      code: "beta_credits_only",
    });
  }

  const created = await responseJson<{
    batchId: string;
    orders: CreatedOrder[];
  }>(
    await request.post(`${apiBaseURL}/orders/batch`, {
      headers: authHeaders(token),
      data: orderPayload(fileMetadataId, deliveryAddressId, "gridCredits"),
    }),
    "place GRIDGO Credits order",
  );
  expect(created.batchId).toMatch(/^BATCH-\d+$/);
  expect(created.orders).toHaveLength(1);
  expect(created.orders[0]).toMatchObject({
    paymentMethod: "gridCredits",
    paymentStatus: "paid",
    orderStatus: "order_placed",
  });
  return created.orders[0];
}

async function updateAssignment(
  request: APIRequestContext,
  riderToken: string,
  assignmentId: number,
  status: string,
  proof?: Record<string, unknown>,
): Promise<void> {
  await responseJson(
    await request.patch(
      `${apiBaseURL}/riders/assignments/${assignmentId}/status`,
      {
        headers: authHeaders(riderToken),
        data: { status, ...(proof ? { proof } : {}) },
      },
    ),
    `update assignment ${assignmentId} to ${status}`,
  );
}

async function getCustomerOrder(
  request: APIRequestContext,
  token: string,
  orderId: number,
): Promise<Record<string, unknown>> {
  const orders = await responseJson<Array<Record<string, unknown>>>(
    await request.get(`${apiBaseURL}/orders`, {
      headers: authHeaders(token),
    }),
    "load customer orders",
  );
  const order = orders.find((candidate) => candidate.id === orderId);
  expect(order).toBeDefined();
  return order!;
}

async function accountState(
  request: APIRequestContext,
  token: string,
): Promise<AccountState> {
  return responseJson<AccountState>(
    await request.get(`${apiBaseURL}/users/me/account-state`, {
      headers: authHeaders(token),
    }),
    "load beta account state",
  );
}

async function submitRequiredSurvey(
  request: APIRequestContext,
  token: string,
  requirementId: number,
): Promise<void> {
  const surveyData = Object.fromEntries(
    Array.from({ length: 14 }, (_, index) => [String(index), 4]),
  );
  await responseJson(
    await request.post(
      `${apiBaseURL}/tam-surveys/requirements/${requirementId}/submit`,
      {
        headers: authHeaders(token),
        data: {
          surveyData,
          openForumFeedback: {
            feature: "Beta workflow completed",
            delivery: "Route privacy behaved correctly",
            price_value: "Yes, at the displayed order price",
            upload_friction: "No blocking point",
          },
        },
      },
    ),
    "submit required beta survey",
  );
}

async function submitTestimonial(
  request: APIRequestContext,
  customer: { email: string; password: string; auth: AuthResponse },
  identity: string,
): Promise<number> {
  await responseJson(
    await request.patch(`${apiBaseURL}/beta-mode/me/share`, {
      headers: authHeaders(customer.auth.access_token),
    }),
    `record confirmed share callback for ${identity}`,
  );
  const fileId = await uploadPurposeImage(
    request,
    customer.auth.access_token,
    identity,
    "beta_testimonial",
  );
  await responseJson(
    await request.post(`${apiBaseURL}/beta-mode/testimonial`, {
      headers: authHeaders(customer.auth.access_token),
      data: { fileId, sharedOnSocial: true },
    }),
    `submit beta testimonial for ${identity}`,
  );
  return fileId;
}

test.describe("destructive GRIDGO beta workflow", () => {
  test("runs registration through delivery, survey, testimonial, and hold", async ({
    request,
  }, testInfo) => {
    test.skip(
      !destructiveEnabled,
      "Set GRIDGO_RUN_BETA_FLOW_DESTRUCTIVE=1 and provide admin/rider credentials.",
    );
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "The destructive API workflow runs once, not once per viewport project.",
    );

    const adminEmail = process.env.GRIDGO_ADMIN_EMAIL;
    const adminPassword = process.env.GRIDGO_ADMIN_PASSWORD;
    const riderEmail = process.env.GRIDGO_RIDER_EMAIL;
    const riderPassword = process.env.GRIDGO_RIDER_PASSWORD;
    expect(adminEmail, "GRIDGO_ADMIN_EMAIL is required").toBeTruthy();
    expect(adminPassword, "GRIDGO_ADMIN_PASSWORD is required").toBeTruthy();
    expect(riderEmail, "GRIDGO_RIDER_EMAIL is required").toBeTruthy();
    expect(riderPassword, "GRIDGO_RIDER_PASSWORD is required").toBeTruthy();

    const admin = await login(request, adminEmail!, adminPassword!);
    const rider = await login(request, riderEmail!, riderPassword!);
    const createdIds: Record<string, number | string> = {};

    try {
      await responseJson(
        await request.patch(`${apiBaseURL}/beta-mode/settings`, {
          headers: authHeaders(admin.access_token),
          data: { isEnabled: true },
        }),
        "enable beta mode",
      );
      const publicStatus = await responseJson<{ isEnabled: boolean }>(
        await request.get(`${apiBaseURL}/beta-mode/status`),
        "load public beta status",
      );
      expect(publicStatus.isEnabled).toBe(true);

      const riderProfile = await responseJson<{ id: number }>(
        await request.get(`${apiBaseURL}/riders/profile`, {
          headers: authHeaders(rider.access_token),
        }),
        "load rider profile",
      );
      await responseJson(
        await request.patch(`${apiBaseURL}/riders/availability`, {
          headers: authHeaders(rider.access_token),
          data: { isAvailable: true },
        }),
        "make rider available",
      );
      await responseJson(
        await request.patch(`${apiBaseURL}/riders/location`, {
          headers: authHeaders(rider.access_token),
          data: { latitude: 7.064, longitude: 125.6079 },
        }),
        "set rider route origin",
      );

      const runId = `${Date.now()}-${testInfo.workerIndex}`;
      const mark = await registerBetaCustomer(
        request,
        `${runId}-mark`,
        `Mark Beta QA ${runId}`,
      );
      createdIds.markUserId = mark.auth.user.id;
      const markBeta = await responseJson<{
        globallyEnabled: boolean;
        isBetaUser: boolean;
        rank: number;
      }>(
        await request.get(`${apiBaseURL}/beta-mode/me`, {
          headers: authHeaders(mark.auth.access_token),
        }),
        "verify Mark beta enrollment",
      );
      expect(markBeta).toMatchObject({
        globallyEnabled: true,
        isBetaUser: true,
      });
      expect(markBeta.rank).toBeGreaterThan(0);

      const markFileId = await uploadPrintFile(
        request,
        mark.auth.access_token,
        "mark",
      );
      createdIds.markFileId = markFileId;
      const markAddressId = await savePinnedAddress(
        request,
        mark.auth.access_token,
        "Mark",
        7.0731,
        125.6128,
      );
      createdIds.markAddressId = markAddressId;

      const markOrder = await placeCreditOrder(
        request,
        mark.auth.access_token,
        markFileId,
        markAddressId,
        true,
      );
      createdIds.markOrderId = markOrder.id;
      createdIds.markOrderRef = markOrder.orderId;

      // Ordering is intentional: Mark is fully registered and ordered before
      // Ven is registered, preserving deterministic beta rank and queue proof.
      const ven = await registerBetaCustomer(
        request,
        `${runId}-ven`,
        `Ven Beta QA ${runId}`,
      );
      createdIds.venUserId = ven.auth.user.id;
      const venBeta = await responseJson<{
        globallyEnabled: boolean;
        isBetaUser: boolean;
        rank: number;
      }>(
        await request.get(`${apiBaseURL}/beta-mode/me`, {
          headers: authHeaders(ven.auth.access_token),
        }),
        "verify Ven beta enrollment",
      );
      expect(venBeta).toMatchObject({
        globallyEnabled: true,
        isBetaUser: true,
      });
      expect(venBeta.rank).toBeGreaterThan(markBeta.rank);
      const venFileId = await uploadPrintFile(
        request,
        ven.auth.access_token,
        "ven",
      );
      createdIds.venFileId = venFileId;
      const venAddressId = await savePinnedAddress(
        request,
        ven.auth.access_token,
        "Ven",
        7.0641,
        125.6079,
      );
      createdIds.venAddressId = venAddressId;
      const venOrder = await placeCreditOrder(
        request,
        ven.auth.access_token,
        venFileId,
        venAddressId,
        false,
      );
      createdIds.venOrderId = venOrder.id;
      createdIds.venOrderRef = venOrder.orderId;

      for (const customer of [mark, ven]) {
        const profile = await responseJson<AuthUser>(
          await request.get(`${apiBaseURL}/users/profile`, {
            headers: authHeaders(customer.auth.access_token),
          }),
          "verify GRIDGO Credits debit",
        );
        expect(Number(profile.credits)).toBeGreaterThanOrEqual(0);
        expect(Number(profile.credits)).toBeLessThan(100);
      }

      for (const order of [markOrder, venOrder]) {
        for (const status of [
          "file_verified",
          "printing_in_progress",
          "finishing_mounting",
          "quality_checked",
          "ready_for_dispatch",
        ]) {
          await responseJson(
            await request.patch(
              `${apiBaseURL}/admin/orders/${order.id}/status`,
              {
                headers: authHeaders(admin.access_token),
                data: { status },
              },
            ),
            `move ${order.orderId} to ${status}`,
          );
        }
        await responseJson(
          await request.post(`${apiBaseURL}/admin/orders/${order.id}/assign`, {
            headers: authHeaders(admin.access_token),
            data: { riderId: riderProfile.id },
          }),
          `assign rider to ${order.orderId}`,
        );
      }

      const assignments = await responseJson<DeliveryAssignment[]>(
        await request.get(`${apiBaseURL}/riders/assignments`, {
          headers: authHeaders(rider.access_token),
        }),
        "load routed assignments",
      );
      const markAssignment = assignments.find(
        (assignment) => assignment.order.id === markOrder.id,
      );
      const venAssignment = assignments.find(
        (assignment) => assignment.order.id === venOrder.id,
      );
      expect(markAssignment).toBeDefined();
      expect(venAssignment).toBeDefined();
      createdIds.markAssignmentId = markAssignment!.id;
      createdIds.venAssignmentId = venAssignment!.id;
      expect(assignments.indexOf(venAssignment!)).toBeLessThan(
        assignments.indexOf(markAssignment!),
      );

      for (const assignment of [venAssignment!, markAssignment!]) {
        await updateAssignment(
          request,
          rider.access_token,
          assignment.id,
          "accepted",
        );
        await updateAssignment(
          request,
          rider.access_token,
          assignment.id,
          "picked_up",
        );
        await updateAssignment(
          request,
          rider.access_token,
          assignment.id,
          "on_the_way",
        );
      }

      const venQueued = await getCustomerOrder(
        request,
        ven.auth.access_token,
        venOrder.id,
      );
      expect(venQueued).toMatchObject({
        deliveryQueuePosition: 1,
        deliveryQueueSize: 2,
        canTrackDelivery: true,
        deliveryAssignmentId: venAssignment!.id,
      });
      const markQueued = await getCustomerOrder(
        request,
        mark.auth.access_token,
        markOrder.id,
      );
      expect(markQueued).toMatchObject({
        deliveryQueuePosition: 2,
        deliveryQueueSize: 2,
        canTrackDelivery: false,
        deliveryAssignmentId: null,
      });

      const earlyArrival = await request.patch(
        `${apiBaseURL}/riders/assignments/${markAssignment!.id}/status`,
        {
          headers: authHeaders(rider.access_token),
          data: { status: "arrived" },
        },
      );
      expect(earlyArrival.status()).toBe(400);

      await updateAssignment(
        request,
        rider.access_token,
        venAssignment!.id,
        "arrived",
      );
      await updateAssignment(
        request,
        rider.access_token,
        venAssignment!.id,
        "delivered",
        { type: "signature", signatureData: "beta-e2e-ven-signature" },
      );

      const markCurrent = await getCustomerOrder(
        request,
        mark.auth.access_token,
        markOrder.id,
      );
      expect(markCurrent).toMatchObject({
        deliveryQueuePosition: 1,
        deliveryQueueSize: 1,
        canTrackDelivery: true,
        deliveryAssignmentId: markAssignment!.id,
      });

      await updateAssignment(
        request,
        rider.access_token,
        markAssignment!.id,
        "arrived",
      );
      const missingProof = await request.patch(
        `${apiBaseURL}/riders/assignments/${markAssignment!.id}/status`,
        {
          headers: authHeaders(rider.access_token),
          data: { status: "delivered" },
        },
      );
      expect(missingProof.status()).toBe(400);
      const markProofFileId = await uploadPurposeImage(
        request,
        rider.access_token,
        "mark",
        "proof_of_delivery",
      );
      createdIds.markProofFileId = markProofFileId;
      await updateAssignment(
        request,
        rider.access_token,
        markAssignment!.id,
        "delivered",
        { type: "photo", fileId: markProofFileId },
      );

      const venState = await accountState(request, ven.auth.access_token);
      const markState = await accountState(request, mark.auth.access_token);
      expect(venState).toMatchObject({ accountStatus: "survey_required" });
      expect(markState).toMatchObject({ accountStatus: "survey_required" });
      expect(venState.holds[0].orderId).toBe(venOrder.id);
      expect(markState.holds[0].orderId).toBe(markOrder.id);
      createdIds.venSurveyRequirementId = venState.holds[0].requirementId;
      createdIds.markSurveyRequirementId = markState.holds[0].requirementId;

      await submitRequiredSurvey(
        request,
        ven.auth.access_token,
        venState.holds[0].requirementId,
      );
      await submitRequiredSurvey(
        request,
        mark.auth.access_token,
        markState.holds[0].requirementId,
      );

      for (const customer of [ven, mark]) {
        const heldOrders = await request.get(`${apiBaseURL}/orders`, {
          headers: authHeaders(customer.auth.access_token),
        });
        expect(heldOrders.status()).toBe(401);
      }

      const venTestimonialFileId = await submitTestimonial(request, ven, "ven");
      const markTestimonialFileId = await submitTestimonial(
        request,
        mark,
        "mark",
      );
      createdIds.venTestimonialFileId = venTestimonialFileId;
      createdIds.markTestimonialFileId = markTestimonialFileId;

      for (const customer of [ven, mark]) {
        const heldLogin = await request.post(`${apiBaseURL}/auth/login`, {
          data: { email: customer.email, password: customer.password },
        });
        expect(heldLogin.status()).toBe(403);
        await expect(heldLogin.json()).resolves.toMatchObject({
          code: "beta_held",
          user: { fullName: expect.stringMatching(/Beta QA/) },
          betaPhotoUploaded: true,
          betaSharedOnSocial: true,
          access_token: expect.any(String),
        });
      }

      await responseJson(
        await request.patch(`${apiBaseURL}/beta-mode/settings`, {
          headers: authHeaders(admin.access_token),
          data: { isEnabled: false },
        }),
        "disable beta mode before restored-login assertions",
      );
      for (const customer of [mark, ven]) {
        const restored = await login(
          request,
          customer.email,
          customer.password,
        );
        expect(restored.user.id).toBe(customer.auth.user.id);
      }
    } finally {
      await responseJson(
        await request.patch(`${apiBaseURL}/beta-mode/settings`, {
          headers: authHeaders(admin.access_token),
          data: { isEnabled: false },
        }),
        "finally disable beta mode",
      );
      await testInfo.attach("beta-destructive-created-ids", {
        body: Buffer.from(`${JSON.stringify(createdIds, null, 2)}\n`),
        contentType: "application/json",
      });
    }
  });
});
