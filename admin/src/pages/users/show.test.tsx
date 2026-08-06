// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import userEvent from "@testing-library/user-event";

import { UserShow } from "./show";

const { mockLoadAdminUserDetail } = vi.hoisted(() => ({
  mockLoadAdminUserDetail: vi.fn(),
}));

vi.mock("@refinedev/antd", () => ({
  Show: ({
    title,
    headerButtons,
    children,
  }: {
    title: string;
    headerButtons?: ReactNode | ((props: { listButtonProps: { resource: string } }) => ReactNode);
    children: ReactNode;
  }) => (
    <section>
      <h1>{title}</h1>
      <div>
        {typeof headerButtons === "function"
          ? headerButtons({ listButtonProps: { resource: "users" } })
          : headerButtons}
      </div>
      <div>{children}</div>
    </section>
  ),
  ListButton: ({ resource }: { resource: string }) => (
    <a href={`/${resource}`}>Back to list</a>
  ),
}));

vi.mock("@refinedev/core", () => ({
  useGetIdentity: () => ({ data: { id: 1, role: "ops_admin" } }),
}));

vi.mock("antd", async () => {
  const actual = await vi.importActual<typeof import("antd")>("antd");
  return {
    ...actual,
    App: {
      ...actual.App,
      useApp: () => ({
        message: {
          success: vi.fn(),
          error: vi.fn(),
        },
      }),
    },
  };
});

vi.mock("./data", async () => {
  const actual = await vi.importActual<typeof import("./data")>("./data");

  return {
    ...actual,
    loadAdminUserDetail: mockLoadAdminUserDetail,
  };
});

describe("UserShow", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders sparse profile placeholders when optional fields are missing", async () => {
    mockLoadAdminUserDetail.mockResolvedValue({
      user: {
        id: 7,
        full_name: "Casey Customer",
        email: "casey@example.com",
        phone_number: "+639171111111",
        role: "client",
        is_active: true,
        is_profile_complete: false,
        profile_category: "student",
        profile_field: "architecture",
        course: null,
        organization: null,
        client_account_type: null,
        printing_preferences: [],
        gender: null,
        date_of_birth: null,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-15T00:00:00.000Z",
      },
      metrics: {
        total_orders: 2,
        paid_orders: 1,
        total_spend: 800,
        average_order_value: 400,
        last_order_at: "2026-04-10T09:30:00.000Z",
        last_paid_order_at: "2026-04-08T15:00:00.000Z",
      },
      recent_orders: [],
      supplier_profile: null,
    });

    render(
      <MemoryRouter
        initialEntries={["/users/show/7"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/users/show/:id" element={<UserShow />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Casey Customer", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("No course provided")).toBeInTheDocument();
    expect(screen.getByText("No organization provided")).toBeInTheDocument();
    expect(screen.getByText("No print preferences yet")).toBeInTheDocument();
    expect(screen.queryByText("Supplier shop profile")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to list" })).toHaveAttribute(
      "href",
      "/users",
    );
    expect(mockLoadAdminUserDetail).toHaveBeenCalledWith("7");
  });

  it("renders supplier shop profile when API returns supplier_profile", async () => {
    mockLoadAdminUserDetail.mockResolvedValue({
      user: {
        id: 9,
        full_name: "Print Co Owner",
        email: "supplier@gridgo.ph",
        phone_number: "+639171234567",
        role: "supplier",
        is_active: true,
        is_profile_complete: true,
        profile_category: null,
        profile_field: null,
        course: null,
        organization: null,
        client_account_type: null,
        printing_preferences: [],
        gender: null,
        date_of_birth: null,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-15T00:00:00.000Z",
      },
      metrics: {
        total_orders: 0,
        paid_orders: 0,
        total_spend: 0,
        average_order_value: 0,
        last_order_at: null,
        last_paid_order_at: null,
      },
      recent_orders: [],
      supplier_profile: {
        id: 1,
        user_id: 9,
        business_name: "Davao Print Co",
        description: "Large format shop",
        contact_phone: "+639179999999",
        contact_email: "hello@printco.ph",
        address: "Quimpo Blvd",
        logo_file_id: null,
        logo_url: null,
        attributes: { equipment: "HP Latex" },
        service_zones: ["Davao City"],
        is_active: true,
        verification_status: "verified",
        capabilities: [
          {
            id: 3,
            product_family: "flyers",
            materials: ["glossy"],
            max_capacity: 100,
            lead_time_days: 2,
          },
        ],
        updated_at: "2026-08-06T05:00:00.000Z",
      },
    });

    render(
      <MemoryRouter
        initialEntries={["/users/show/9"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/users/show/:id" element={<UserShow />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Supplier shop profile"),
    ).toBeInTheDocument();
    expect(screen.getByText("Davao Print Co")).toBeInTheDocument();
    expect(screen.getByText("Large format shop")).toBeInTheDocument();
    expect(screen.getByText("equipment: HP Latex")).toBeInTheDocument();
    expect(screen.getByText("flyers")).toBeInTheDocument();
    expect(screen.getByText("Davao City")).toBeInTheDocument();
  });

  it("renders an error state inside the Show shell and retries loading", async () => {
    mockLoadAdminUserDetail
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({
        user: {
          id: 7,
          full_name: "Retry User",
          email: "retry@example.com",
          phone_number: null,
          role: "client",
          is_active: true,
          is_profile_complete: true,
          profile_category: null,
          profile_field: null,
          course: null,
          organization: null,
          client_account_type: null,
          printing_preferences: [],
          gender: null,
          date_of_birth: null,
          created_at: "2026-03-01T00:00:00.000Z",
          updated_at: "2026-03-15T00:00:00.000Z",
        },
        metrics: {
          total_orders: 0,
          paid_orders: 0,
          total_spend: 0,
          average_order_value: 0,
          last_order_at: null,
          last_paid_order_at: null,
        },
        recent_orders: [],
        supplier_profile: null,
      });

    const user = userEvent.setup();

    render(
      <MemoryRouter
        initialEntries={["/users/show/7"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/users/show/:id" element={<UserShow />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "User", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Unable to load user")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to list" })).toHaveAttribute(
      "href",
      "/users",
    );

    await user.click(screen.getByRole("link", { name: "Retry" }));

    expect(
      await screen.findByRole("heading", { name: "Retry User", level: 1 }),
    ).toBeInTheDocument();
    expect(mockLoadAdminUserDetail).toHaveBeenCalledTimes(2);
  });
});
