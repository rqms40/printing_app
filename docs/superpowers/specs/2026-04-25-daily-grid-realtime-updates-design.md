# Daily Grid Real-Time Updates Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Admin mutations to Daily Grid cards (create, update, delete, reorder, activate/deactivate) are reflected on all connected customer mobile carousels in real-time via WebSocket push.

**Architecture:** New `DailyGridGateway` (NestJS, Socket.IO, namespace `/ws/daily-grid`, no auth) broadcasts a `dailyGridUpdated` event after any admin mutation. Mobile `DailyGridSection` connects to the namespace on mount, calls `ref.invalidate(dailyGridProvider)` on the event, and the existing `FutureProvider.autoDispose` re-fetches and re-renders the carousel.

**Tech Stack:** NestJS + Socket.IO (server) · Flutter + Riverpod + socket_io_client (mobile)

---

## Subsystems

Two independent subsystems delivered in order:

1. **Server** — new gateway + service integration
2. **Mobile** — WebSocket connection in service + widget

---

## Section 1: Server

### New file: `server/src/daily-grid/daily-grid.gateway.ts`

```typescript
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ namespace: '/ws/daily-grid', cors: { origin: '*' } })
export class DailyGridGateway {
  @WebSocketServer()
  server: Server;

  notifyUpdated(): void {
    this.server.emit('dailyGridUpdated', {});
  }
}
```

No auth required — daily-grid data is public. No `handleConnection` needed.

### Modified: `server/src/daily-grid/daily-grid.service.ts`

Inject `DailyGridGateway` and call `this.gateway.notifyUpdated()` at the end of:
- `create()`
- `update()`
- `remove()`
- `reorder()`

### Modified: `server/src/daily-grid/daily-grid.module.ts`

Add `DailyGridGateway` to `providers`.

---

## Section 2: Mobile

### Modified: `apps/mobile/lib/shared/services/websocket_service.dart`

Add a `_dailyGridSocket` field alongside the existing three sockets.

New method `connectDailyGrid({ required VoidCallback onUpdated })`:
- If `_dailyGridSocket?.connected == true` → no-op (idempotent)
- If `_dailyGridSocket != null` but disconnected → reconnect
- Otherwise → create socket at `$_baseUrl/ws/daily-grid`, no auth token, `disableAutoConnect`, register `dailyGridUpdated` listener that calls `onUpdated()`, then connect

New method `disconnectDailyGrid()`:
- Disconnects and nulls `_dailyGridSocket`

Include `_dailyGridSocket?.disconnect(); _dailyGridSocket = null;` in the existing `disconnect()` method (called on logout), consistent with how `_ordersSocket` and `_notificationsSocket` are nulled there.

### Modified: `apps/mobile/lib/features/customer/home/widgets/daily_grid_section.dart`

`_DailyGridSectionState` gains:

```dart
void _onDailyGridUpdated() {
  if (mounted) ref.invalidate(dailyGridProvider);
}
```

`initState` calls:
```dart
WebSocketService.instance.connectDailyGrid(onUpdated: _onDailyGridUpdated);
```

`dispose` calls:
```dart
WebSocketService.instance.disconnectDailyGrid();
```

`dailyGridProvider` itself is unchanged — `autoDispose` + `ref.invalidate` already handles the re-fetch correctly.

---

## Data Flow

```
Admin saves card change (PATCH /daily-grid/admin/:id)
  ↓
DailyGridService.update() persists to DB
  ↓
DailyGridGateway.notifyUpdated() → server.emit('dailyGridUpdated', {})
  ↓
All connected /ws/daily-grid clients receive event
  ↓
_DailyGridSectionState._onDailyGridUpdated()
  ↓
ref.invalidate(dailyGridProvider)
  ↓
FutureProvider rebuilds → GET /daily-grid
  ↓
Carousel re-renders with updated cards
```

Same flow for create, delete, and reorder.

---

## Connection Lifecycle

- **Connect:** `DailyGridSection.initState` — fires when the home screen mounts
- **Disconnect:** `DailyGridSection.dispose` — fires when the home screen leaves the widget tree
- **Idempotent:** Multiple `connectDailyGrid` calls while connected are no-ops
- **Logout:** Global `WebSocketService.disconnect()` closes all sockets including daily-grid

---

## Error Handling

- Connection failure: `connect_error` is logged via `debugPrint`; the carousel continues showing the last-fetched data and will retry on the next `connectDailyGrid` call (when the user re-enters the home screen)
- No reconnection logic needed beyond what socket.io_client provides by default
- If the server is unreachable when `dailyGridUpdated` fires, `ref.invalidate` triggers a fetch that fails gracefully via the provider's `error` state (existing fallback carousel shown)

---

## Testing

**Server:**
- Unit: `DailyGridGateway.notifyUpdated()` calls `server.emit('dailyGridUpdated', {})`
- Unit: `DailyGridService.create/update/remove/reorder` each call `gateway.notifyUpdated()`

**Mobile:**
- Unit: `WebSocketService.connectDailyGrid` — second call while connected is a no-op (callback not re-registered)
- Widget: tapping a card after `_onDailyGridUpdated` fires causes `dailyGridProvider` to rebuild
