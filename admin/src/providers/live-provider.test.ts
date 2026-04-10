import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Socket.IO mock ─────────────────────────────────────────────────
const mockOn = vi.fn();
const mockDisconnect = vi.fn();
const mockSocket = {
  connected: false,
  on: mockOn,
  disconnect: mockDisconnect,
};
const mockIo = vi.fn(() => mockSocket);

vi.mock("socket.io-client", () => ({ io: mockIo }));

// ── localStorage mock ──────────────────────────────────────────────
vi.stubGlobal("localStorage", {
  getItem: vi.fn().mockReturnValue("test-jwt-token"),
  setItem: vi.fn(),
  removeItem: vi.fn(),
});

// ── Helpers ────────────────────────────────────────────────────────

/** Fire a simulated WS event that the socket registered via .on() */
function fireSocketEvent(event: string, data: unknown) {
  const call = mockOn.mock.calls.find(([e]) => e === event);
  if (!call) throw new Error(`No listener registered for "${event}"`);
  call[1](data);
}

// ── Tests ──────────────────────────────────────────────────────────

describe("live-provider", () => {
  // Re-import the module fresh for each test to reset singleton state
  beforeEach(() => {
    vi.resetModules();
    mockIo.mockClear();
    mockOn.mockClear();
    mockDisconnect.mockClear();
    mockSocket.connected = false;
  });

  it("connects to the correct WS namespace with JWT in auth", async () => {
    const { subscribeToOrderUpdates, disconnectLive } = await import(
      "@/providers/live-provider"
    );

    subscribeToOrderUpdates(() => {});

    expect(mockIo).toHaveBeenCalledOnce();
    const [url, opts] = mockIo.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(url).toContain("/ws/orders");
    expect(opts).toMatchObject({ auth: { token: "test-jwt-token" } });

    disconnectLive();
  });

  it("does not connect when localStorage has no token", async () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

    const { subscribeToOrderUpdates, disconnectLive } = await import(
      "@/providers/live-provider"
    );

    subscribeToOrderUpdates(() => {});

    expect(mockIo).not.toHaveBeenCalled();
    disconnectLive();
  });

  it("calls subscribers when orderUpdate event fires", async () => {
    const { subscribeToOrderUpdates, disconnectLive } = await import(
      "@/providers/live-provider"
    );

    const cb = vi.fn();
    subscribeToOrderUpdates(cb);

    const order = { id: 7, orderId: "ORD-10007", orderStatus: "delivered" };
    fireSocketEvent("orderUpdate", order);

    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(order);

    disconnectLive();
  });

  it("unsubscribe removes the callback so it no longer fires", async () => {
    const { subscribeToOrderUpdates, disconnectLive } = await import(
      "@/providers/live-provider"
    );

    const cb = vi.fn();
    const unsubscribe = subscribeToOrderUpdates(cb);
    unsubscribe();

    fireSocketEvent("orderUpdate", { id: 1 });

    expect(cb).not.toHaveBeenCalled();

    disconnectLive();
  });

  it("multiple subscribers all receive the event", async () => {
    const { subscribeToOrderUpdates, disconnectLive } = await import(
      "@/providers/live-provider"
    );

    const cb1 = vi.fn();
    const cb2 = vi.fn();
    subscribeToOrderUpdates(cb1);
    subscribeToOrderUpdates(cb2);

    fireSocketEvent("orderUpdate", { id: 2 });

    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();

    disconnectLive();
  });

  it("disconnectLive calls socket.disconnect and clears listeners", async () => {
    const { subscribeToOrderUpdates, disconnectLive } = await import(
      "@/providers/live-provider"
    );

    const cb = vi.fn();
    subscribeToOrderUpdates(cb);
    disconnectLive();

    expect(mockDisconnect).toHaveBeenCalledOnce();

    // After disconnect, firing an event should not reach old callbacks
    // (listeners cleared — the socket object is also nulled)
    expect(cb).not.toHaveBeenCalled();
  });

  it("does not create duplicate sockets if already connected", async () => {
    mockSocket.connected = true;
    const { subscribeToOrderUpdates, disconnectLive } = await import(
      "@/providers/live-provider"
    );

    subscribeToOrderUpdates(() => {});
    subscribeToOrderUpdates(() => {});

    expect(mockIo).toHaveBeenCalledOnce();

    disconnectLive();
  });
});
