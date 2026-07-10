// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BetaModePage, betaModeConfirmation } from "./index";

const { mockConfirm, mockGetSettings, mockSearch } = vi.hoisted(() => ({
  mockConfirm: vi.fn(),
  mockGetSettings: vi.fn(),
  mockSearch: vi.fn(),
}));

vi.mock("@/services/betaModeApi", () => ({
  getSettings: mockGetSettings,
  searchBetaMembers: mockSearch,
  enrollUser: vi.fn(),
  getBetaUsers: vi.fn(),
  resetOrderLimit: vi.fn(),
  setBetaSurveyExempt: vi.fn(),
  unenrollUser: vi.fn(),
  updateSettings: vi.fn(),
}));
vi.mock("@/providers/api-client", () => ({
  apiClient: { get: vi.fn() },
}));
vi.mock("antd", async () => {
  const actual = await vi.importActual<typeof import("antd")>("antd");
  return {
    ...actual,
    App: {
      useApp: () => ({
        modal: { confirm: mockConfirm },
        message: { success: vi.fn(), error: vi.fn() },
      }),
    },
  };
});

describe("BetaModePage", () => {
  beforeEach(() => {
    mockSearch.mockResolvedValue({ rows: [], total: 0 });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("states every enable consequence and exposes a stable switch label", async () => {
    const confirmation = betaModeConfirmation(true);
    expect(confirmation.content).toContain("auto-enrolled in order");
    expect(confirmation.content).toContain("one-time 100 GRID Credits");
    expect(confirmation.content).toContain("GRID Credits only");
    expect(confirmation.content).toContain("mandatory 14-question feedback");
    expect(confirmation.content).toContain("held from login");
    expect(confirmation.content).toContain("history is retained");

    mockGetSettings.mockResolvedValue({ isEnabled: false });
    render(<BetaModePage />);
    fireEvent.click(await screen.findByRole("switch", { name: "Beta mode" }));

    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining(confirmation),
    );
  });

  it("states immediate account restoration and retained history on disable", async () => {
    const confirmation = betaModeConfirmation(false);
    expect(confirmation.content).toContain("immediately restores held beta accounts");
    expect(confirmation.content).toContain("history is retained");

    mockGetSettings.mockResolvedValue({ isEnabled: true });
    render(<BetaModePage />);
    fireEvent.click(await screen.findByRole("switch", { name: "Beta mode" }));

    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining(confirmation),
    );
  });
});
