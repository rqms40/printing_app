import { apiClient } from "@/providers/api-client";
import type { DispatchPlan } from "@/types/dispatch-plan";
import { normalizeDispatchPlan } from "@/utils/api-normalizers";

type ApiErrorShape = {
  response?: {
    status?: unknown;
    data?: { code?: unknown; message?: unknown };
  };
};

function errorDetails(cause: unknown) {
  const error = cause as ApiErrorShape;
  const code = error?.response?.data?.code;
  const message = error?.response?.data?.message;
  return {
    code: typeof code === "string" ? code : "dispatch_plan_failed",
    message:
      typeof message === "string" ? message : "Dispatch plan request failed",
    status:
      typeof error?.response?.status === "number"
        ? error.response.status
        : undefined,
  };
}

export class DispatchPlanApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly preservedPlan: DispatchPlan | null;

  constructor(cause: unknown, preservedPlan: DispatchPlan | null = null) {
    const details = errorDetails(cause);
    super(details.message);
    this.name = "DispatchPlanApiError";
    Object.assign(this, { cause });
    this.code = details.code;
    this.status = details.status;
    this.preservedPlan = preservedPlan;
  }
}

function missingPersistedPlan(): DispatchPlanApiError {
  return new DispatchPlanApiError({
    response: {
      data: {
        code: "dispatch_plan_missing",
        message: "Persisted dispatch plan was not returned",
      },
    },
  });
}

export async function getDispatchPlan(
  riderProfileId: number,
): Promise<DispatchPlan | null> {
  const response = await apiClient.get(
    `/admin/riders/${riderProfileId}/dispatch-plan`,
  );
  return normalizeDispatchPlan(response.data);
}

export async function createDispatchPlan(
  riderProfileId: number,
  assignmentIds: number[],
): Promise<DispatchPlan> {
  try {
    await apiClient.post(`/admin/riders/${riderProfileId}/dispatch-plan`, {
      assignmentIds,
    });
  } catch (cause) {
    throw new DispatchPlanApiError(cause);
  }
  const plan = await getDispatchPlan(riderProfileId);
  if (!plan) throw missingPersistedPlan();
  return plan;
}

export async function reoptimizeDispatchPlan(
  riderProfileId: number,
  assignmentIds?: number[],
): Promise<DispatchPlan> {
  try {
    await apiClient.post(
      `/admin/riders/${riderProfileId}/dispatch-plan/re-optimize`,
      assignmentIds?.length ? { assignmentIds } : {},
    );
  } catch (cause) {
    let preservedPlan: DispatchPlan | null = null;
    try {
      preservedPlan = await getDispatchPlan(riderProfileId);
    } catch {
      // Preserve the routing error as the actionable failure.
    }
    throw new DispatchPlanApiError(cause, preservedPlan);
  }
  const plan = await getDispatchPlan(riderProfileId);
  if (!plan) throw missingPersistedPlan();
  return plan;
}
