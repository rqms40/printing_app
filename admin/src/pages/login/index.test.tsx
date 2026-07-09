// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginPage } from "./index";

vi.mock("@refinedev/core", () => ({
  useLogin: () => ({ mutate: vi.fn(), isLoading: false }),
}));

describe("LoginPage", () => {
  afterEach(cleanup);

  it("does not expose hard-coded credentials", () => {
    render(<LoginPage />);

    expect(screen.getByPlaceholderText("admin@gridgo.ph")).toHaveValue("");
    expect(screen.getByPlaceholderText("Enter password")).toHaveValue("");
  });
});
