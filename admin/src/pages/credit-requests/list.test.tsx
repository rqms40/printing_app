// @vitest-environment happy-dom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { CreditRequestsList } from "./list";

const {
  mockMutate,
  mockOpen,
  mockRefetch,
  mockRefreshBadges,
  mockUseTable,
} = vi.hoisted(() => ({
  mockMutate: vi.fn(),
  mockOpen: vi.fn(),
  mockRefetch: vi.fn(),
  mockRefreshBadges: vi.fn(),
  mockUseTable: vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useApiUrl: () => "http://localhost:3000/api",
  useCustomMutation: () => ({ mutate: mockMutate }),
  useNotification: () => ({ open: mockOpen }),
}));

vi.mock("@refinedev/antd", () => ({
  DateField: ({ value }: { value: string }) => <span>{value}</span>,
  List: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <section aria-label={title}>{children}</section>
  ),
  NumberField: ({ value }: { value: number }) => <span>{value}</span>,
  useTable: mockUseTable,
}));

vi.mock("@/context/notifications-context", () => ({
  useNotificationsContext: () => ({
    badgeCounts: { newOrders: 0, pendingTopUps: 1 },
    clearNotifications: vi.fn(),
    markAllRead: vi.fn(),
    markRead: vi.fn(),
    notifications: [],
    refreshBadges: mockRefreshBadges,
    unreadCount: 0,
  }),
}));

vi.mock("antd", () => {
  function readValue(record: Record<string, unknown>, dataIndex?: string | string[]) {
    if (!dataIndex) return undefined;
    if (Array.isArray(dataIndex)) {
      return dataIndex.reduce<unknown>(
        (value, key) =>
          value && typeof value === "object"
            ? (value as Record<string, unknown>)[key]
            : undefined,
        record,
      );
    }
    return record[dataIndex];
  }

  function Table({
    children,
    dataSource = [],
  }: {
    children: React.ReactNode;
    dataSource?: Record<string, unknown>[];
  }) {
    const columns = React.Children.toArray(children).filter(
      React.isValidElement,
    ) as React.ReactElement[];

    return (
      <div>
        {dataSource.map((record) => (
          <div key={String(record.id)}>
            {columns.map((column, index) => {
              const props = column.props as {
                dataIndex?: string | string[];
                render?: (value: unknown, record: Record<string, unknown>) => React.ReactNode;
                title?: string;
              };
              const value = readValue(record, props.dataIndex);
              return (
                <div key={props.title ?? index}>
                  {props.render ? props.render(value, record) : String(value ?? "")}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  Table.Column = () => null;

  return {
    Button: ({
      children,
      onClick,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
    }) => <button onClick={onClick}>{children}</button>,
    Image: ({ alt }: { alt: string }) => <img alt={alt} />,
    Space: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Table,
    Typography: {
      Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
    },
  };
});

vi.mock("@ant-design/icons", () => ({
  CheckCircleOutlined: () => <span aria-hidden="true" />,
  CloseCircleOutlined: () => <span aria-hidden="true" />,
}));

const pendingRequest = {
  id: 42,
  amountCredits: 500,
  amountPhp: 500,
  createdAt: "2026-04-21T05:00:00.000Z",
  proofOfPaymentUrl: "/uploads/proof.png",
  user: { email: "customer@example.com" },
};

function setupMutationSuccess() {
  mockMutate.mockImplementation(
    async (_params: unknown, options?: { onSuccess?: () => void | Promise<void> }) => {
      await options?.onSuccess?.();
    },
  );
}

describe("CreditRequestsList", () => {
  beforeEach(() => {
    mockMutate.mockReset();
    mockOpen.mockReset();
    mockRefetch.mockReset();
    mockRefreshBadges.mockReset();
    mockRefetch.mockResolvedValue(undefined);
    mockRefreshBadges.mockResolvedValue(undefined);
    mockUseTable.mockReturnValue({
      tableProps: { dataSource: [pendingRequest] },
      tableQueryResult: { refetch: mockRefetch },
    });
    setupMutationSuccess();
  });

  afterEach(() => cleanup());

  it("refreshes the sidebar badge count after approving a pending top-up", async () => {
    render(<CreditRequestsList />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /approve/i }));
    });

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "post",
        url: "http://localhost:3000/api/credits/approve/42",
      }),
      expect.any(Object),
    );
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    expect(mockRefreshBadges).toHaveBeenCalledTimes(1);
  });

  it("refreshes the sidebar badge count after rejecting a pending top-up", async () => {
    render(<CreditRequestsList />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /reject/i }));
    });

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "post",
        url: "http://localhost:3000/api/credits/reject/42",
      }),
      expect.any(Object),
    );
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    expect(mockRefreshBadges).toHaveBeenCalledTimes(1);
  });
});
