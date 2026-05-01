// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";

import { authProvider } from "./auth-provider";
import { TOKEN_KEY } from "./api-client";

describe("authProvider", () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("fails closed when profile check cannot reach the API", async () => {
    localStorage.setItem(TOKEN_KEY, "stale-token");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(authProvider.check?.({})).resolves.toMatchObject({
      authenticated: false,
      redirectTo: "/login",
    });
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("does not fabricate an identity when profile fetch fails", async () => {
    localStorage.setItem(TOKEN_KEY, "stale-token");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(authProvider.getIdentity?.({})).resolves.toBeNull();
  });
});
