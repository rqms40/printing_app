// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { TamSurveyShow } from "./show";

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock("@/providers/api-client", () => ({
  apiClient: { get: mockGet },
}));

vi.mock("@/components/show-page", () => ({
  ShowPage: ({ title, children }: { title: string; children: ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));

describe("TamSurveyShow", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("displays the beta price-value and upload-friction answers", async () => {
    mockGet.mockResolvedValue({
      data: {
        id: 42,
        user_name: "Beta Tester",
        created_at: "2026-04-30T12:00:00.000Z",
        survey_data: Object.fromEntries(
          Array.from({ length: 14 }, (_, index) => [index, 3]),
        ),
        open_forum_feedback: JSON.stringify({
          price_value: "Yes, I would pay the quoted order price.",
          upload_friction: "The 3D preview wait almost made me leave.",
          feature: "Saved print presets.",
          delivery: "Delivery updates were clear.",
        }),
      },
    });

    render(
      <MemoryRouter
        initialEntries={["/tam-surveys/show/42"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/tam-surveys/show/:id" element={<TamSurveyShow />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Survey - SURV-42" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("WOULD THEY PAY THE ORDER PRICE FOR THE CONVENIENCE?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Yes, I would pay the quoted order price.", {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("WHERE DID THE UPLOAD PROCESS CREATE FRICTION?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The 3D preview wait almost made me leave.", {
        exact: false,
      }),
    ).toBeInTheDocument();
  });
});
