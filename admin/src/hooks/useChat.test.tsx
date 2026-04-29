// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useChatInbox } from "./useChat";
import type { Conversation, NewConversationEvent } from "@/types/chat";

const { mockGet, mockPatch, mockSubscribeToNewConversations } = vi.hoisted(
  () => ({
    mockGet: vi.fn(),
    mockPatch: vi.fn(),
    mockSubscribeToNewConversations: vi.fn(),
  }),
);

vi.mock("@/providers/api-client", () => ({
  apiClient: {
    get: mockGet,
    patch: mockPatch,
  },
}));

vi.mock("@/providers/chat-ws", () => ({
  joinConversation: vi.fn(),
  leaveConversation: vi.fn(),
  sendAdminMessage: vi.fn(),
  subscribeToMessages: vi.fn(() => vi.fn()),
  subscribeToNewConversations: mockSubscribeToNewConversations,
  subscribeToBotTyping: vi.fn(() => vi.fn()),
}));

const conversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  id: 1,
  customerId: 10,
  customer: { id: 10, name: "Mina Customer", email: "mina@example.com" },
  type: "admin",
  orderId: null,
  assignedAdminId: null,
  assignedRiderId: null,
  status: "open",
  createdAt: "2026-04-29T04:00:00.000Z",
  updatedAt: "2026-04-29T04:00:00.000Z",
  closedAt: null,
  ...overrides,
});

describe("useChatInbox", () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it("loads the full admin inbox instead of only open conversations", async () => {
    const closed = conversation({ id: 2, status: "closed" });
    mockGet.mockResolvedValue({ data: [closed] });
    mockSubscribeToNewConversations.mockReturnValue(vi.fn());

    const { result } = renderHook(() => useChatInbox());

    await waitFor(() => expect(result.current.conversations).toEqual([closed]));
    expect(mockGet).toHaveBeenCalledWith("/chat/admin/conversations");
  });

  it("normalizes compact new-conversation events into selectable conversations", async () => {
    let listener: ((event: NewConversationEvent) => void) | undefined;
    mockGet.mockResolvedValue({ data: [] });
    mockSubscribeToNewConversations.mockImplementation((cb) => {
      listener = cb;
      return vi.fn();
    });
    const { result } = renderHook(() => useChatInbox());
    await waitFor(() => expect(result.current.conversations).toEqual([]));

    act(() => {
      listener?.({
        conversationId: 42,
        customerId: 9,
        customerName: "Ana Buyer",
        type: "admin",
        orderId: 77,
      });
    });

    expect(result.current.conversations[0]).toMatchObject({
      id: 42,
      customerId: 9,
      customer: { id: 9, name: "Ana Buyer" },
      type: "admin",
      orderId: 77,
      status: "open",
      assignedAdminId: null,
    });
  });

  it("replaces conversations with assign and close responses from the server", async () => {
    const open = conversation({ id: 3, status: "open" });
    const assigned = conversation({
      id: 3,
      status: "assigned",
      assignedAdminId: 99,
    });
    const closed = conversation({
      id: 3,
      status: "closed",
      assignedAdminId: 99,
      closedAt: "2026-04-29T04:05:00.000Z",
    });
    mockGet.mockResolvedValue({ data: [open] });
    mockPatch
      .mockResolvedValueOnce({ data: assigned })
      .mockResolvedValueOnce({ data: closed });
    mockSubscribeToNewConversations.mockReturnValue(vi.fn());

    const { result } = renderHook(() => useChatInbox());
    await waitFor(() => expect(result.current.conversations).toEqual([open]));

    await act(async () => {
      await expect(result.current.assignConversation(3)).resolves.toEqual(
        assigned,
      );
    });
    expect(result.current.conversations).toEqual([assigned]);

    await act(async () => {
      await expect(result.current.closeConversation(3)).resolves.toEqual(
        closed,
      );
    });
    expect(result.current.conversations).toEqual([closed]);
  });

  it("preserves loaded customer details when a mutation response is sparse", async () => {
    const open = conversation({ id: 4, status: "open" });
    const assigned = {
      ...open,
      customer: undefined,
      status: "assigned" as const,
      assignedAdminId: 99,
    } as unknown as Conversation;
    mockGet.mockResolvedValue({ data: [open] });
    mockPatch.mockResolvedValue({ data: assigned });
    mockSubscribeToNewConversations.mockReturnValue(vi.fn());

    const { result } = renderHook(() => useChatInbox());
    await waitFor(() => expect(result.current.conversations).toEqual([open]));

    await act(async () => {
      await result.current.assignConversation(4);
    });

    expect(result.current.conversations[0]).toMatchObject({
      id: 4,
      status: "assigned",
      assignedAdminId: 99,
      customer: open.customer,
    });
  });
});
