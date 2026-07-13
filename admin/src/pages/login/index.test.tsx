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

  it("uses accessible contrast for muted login guidance", () => {
    render(<LoginPage />);

    expect(screen.getByText("Printing Services")).toHaveStyle({
      color: "#A0A0A0",
    });
    expect(screen.getByText("Enter your credentials to continue")).toHaveStyle({
      color: "#A0A0A0",
    });
  });
});
