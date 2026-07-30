// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App as AntApp } from "antd";

import {
  HomeFeedPage,
  normalizeHomeFeedMode,
  normalizePromoCard,
} from "./index";

const { mockGet, mockPatch } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPatch: vi.fn(),
}));

vi.mock("@/providers/api-client", () => ({
  apiClient: {
    get: mockGet,
    patch: mockPatch,
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("normalizers", () => {
  it("defaults unknown modes to auto", () => {
    expect(normalizeHomeFeedMode({ mode: "promo" })).toBe("promo");
    expect(normalizeHomeFeedMode({ mode: "seasonal" })).toBe("auto");
    expect(normalizeHomeFeedMode({})).toBe("auto");
  });

  it("normalizes camelCase and snake_case card payloads", () => {
    const camel = normalizePromoCard({
      id: 1,
      title: "Camel",
      ctaLabel: "Go",
      ctaTarget: "/customer/order/new",
      imageUrl: "https://x/y.png",
      sortOrder: 2,
      isActive: false,
    });
    expect(camel.ctaLabel).toBe("Go");
    expect(camel.sortOrder).toBe(2);
    expect(camel.isActive).toBe(false);

    const snake = normalizePromoCard({
      id: 2,
      title: "Snake",
      cta_label: "Run",
      cta_target: "https://gridgo.ph",
      image_url: null,
      sort_order: 1,
      is_active: true,
    });
    expect(snake.ctaLabel).toBe("Run");
    expect(snake.imageUrl).toBeNull();
    expect(snake.isActive).toBe(true);
  });
});

describe("HomeFeedPage", () => {
  const settle = (settings: unknown, cards: unknown) => {
    mockGet.mockImplementation((url: string) => {
      if (url === "/home-feed/settings") {
        return Promise.resolve({ data: settings });
      }
      if (url === "/home-feed/promo-cards") {
        return Promise.resolve({ data: cards });
      }
      return Promise.reject(new Error(`unexpected GET ${url}`));
    });
  };

  it("renders campaigns with live count", async () => {
    settle({ mode: "auto" }, [
      { id: 1, title: "First", body: "A", sortOrder: 1, isActive: true },
      { id: 2, title: "Second", body: null, sortOrder: 2, isActive: false },
    ]);

    render(
      <AntApp>
        <HomeFeedPage />
      </AntApp>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("home-feed-page")).toBeInTheDocument(),
    );
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.getByText("1/5 live")).toBeInTheDocument();
  });

  it("shows the empty state when no campaigns exist", async () => {
    settle({ mode: "community" }, []);

    render(
      <AntApp>
        <HomeFeedPage />
      </AntApp>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("home-feed-page")).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/No campaigns yet/),
    ).toBeInTheDocument();
  });
});
