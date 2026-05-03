// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildFrequencyValue,
  formatFrequencyLabel,
  MarketingSettings,
  parseFrequencyValue,
} from "./marketing-settings";

const { mockMutate, mockRefetch, mockUseCustom, mockUseCustomMutation } =
  vi.hoisted(() => ({
    mockMutate: vi.fn(),
    mockRefetch: vi.fn(),
    mockUseCustom: vi.fn(),
    mockUseCustomMutation: vi.fn(),
  }));

vi.mock("@refinedev/core", () => ({
  useCustom: mockUseCustom,
  useCustomMutation: mockUseCustomMutation,
}));

vi.mock("@/components/grid-logo", () => ({
  GridLogo: () => <span data-testid="grid-logo" />,
}));

describe("marketing notification frequency controls", () => {
  beforeEach(() => {
    mockMutate.mockReset();
    mockRefetch.mockReset();
    mockUseCustom.mockReset();
    mockUseCustomMutation.mockReset();
    mockUseCustom.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            description: "Retention reminder",
            header: "Need prints?",
            body: "Come back today.",
            frequency: "2w",
            isActive: true,
          },
        ],
      },
      isLoading: false,
      refetch: mockRefetch,
    });
    mockUseCustomMutation.mockReturnValue({ mutate: mockMutate });
  });

  afterEach(() => {
    cleanup();
  });

  it("parses, builds, and labels interval frequencies", () => {
    expect(parseFrequencyValue("daily")).toEqual({
      intervalCount: 1,
      intervalUnit: "days",
    });
    expect(parseFrequencyValue("monthly")).toEqual({
      intervalCount: 1,
      intervalUnit: "months",
    });
    expect(parseFrequencyValue("2w")).toEqual({
      intervalCount: 2,
      intervalUnit: "weeks",
    });

    expect(buildFrequencyValue({ intervalCount: 3, intervalUnit: "months" }))
      .toBe("3m");
    expect(formatFrequencyLabel("2w")).toBe("Every 2 weeks");
    expect(formatFrequencyLabel("1d")).toBe("Every day");
  });

  it("renders interval controls and human-readable list frequency", () => {
    render(<MarketingSettings />);

    expect(screen.getByText("Repeat every")).toBeInTheDocument();
    expect(screen.getByText("Interval unit")).toBeInTheDocument();
    expect(screen.getByText("Runs every day.")).toBeInTheDocument();
    expect(
      screen.getByText("Frequency: Every 2 weeks | Active: Yes"),
    ).toBeInTheDocument();
  });

  it("submits compact interval frequency without UI-only fields", async () => {
    render(<MarketingSettings />);

    fireEvent.change(screen.getByPlaceholderText("e.g., Plane Available"), {
      target: { value: "Promo ready" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("e.g., The plane you requested..."),
      {
        target: { value: "Your print promo is ready." },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mockMutate).toHaveBeenCalled());

    expect(mockMutate.mock.calls[0][0]).toMatchObject({
      url: "/notifications/marketing",
      method: "post",
      values: {
        header: "Promo ready",
        body: "Your print promo is ready.",
        frequency: "1d",
        isActive: true,
      },
    });
    expect(mockMutate.mock.calls[0][0].values).not.toHaveProperty(
      "intervalCount",
    );
    expect(mockMutate.mock.calls[0][0].values).not.toHaveProperty(
      "intervalUnit",
    );
  });
});
