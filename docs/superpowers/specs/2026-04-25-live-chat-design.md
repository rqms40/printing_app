# Live Chat Feature — Design Spec
**Date:** 2026-04-25  
**Branch:** feat/2026-04-21-file-preview (extends current branch)  
**Scope:** Real-time chat for mobile customers, React admin dashboard, NestJS server  
**Status:** Approved, ready for implementation planning

---

## 1. Overview

Add a live chat system to GRIDGO that lets customers talk to GridBot (AI assistant), admin support, or their assigned rider — all in real time, with full message history persisted to the database.

### Entry points
- **Floating chat button** on the customer home screen (bottom-right corner)
- **"Chat about this order"** contextual button on order detail screens
- **Support Chat** page in the React admin dashboard sidebar

### Participants
| Role | Can chat with |
|------|--------------|
| Customer | GridBot, Admin, Rider (if order has assigned rider + active delivery) |
| Admin | Customer (via inbox) |
| Rider | Customer (via order-specific conversation) |
| GridBot | Customer (AI only, no human involvement) |

---

## 2. Architecture

### New NestJS module: `chat`

```
server/src/chat/
├── chat.module.ts
├── chat.gateway.ts           ← Socket.IO /ws/chat namespace
├── chat.controller.ts        ← REST: history, admin inbox
├── chat.service.ts           ← business logic + OpenRouter calls
├── openrouter.service.ts     ← HTTP client for AI completions
├── entities/
│   ├── conversation.entity.ts
│   └── chat-message.entity.ts
└── dto/
    ├── create-conversation.dto.ts
    └── send-message.dto.ts
```

### WebSocket namespace
`/ws/chat` — separate from existing `/ws/orders`, `/ws/daily-grid`, `/ws/notifications`, `/ws/location`.

### Socket rooms
- `conversation:{id}` — all participants of a conversation (customer, admin, rider)
- `admin_inbox` — all connected admins join on login; receives `new-conversation` broadcasts

---

## 3. Data Model

### `Conversation` entity
| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| customerId | UUID FK → User | |
| type | ENUM `ai\|admin\|rider` | |
| orderId | UUID FK → Order | nullable — null for general chats |
| assignedAdminId | UUID FK → User | nullable — null until admin claims |
| assignedRiderId | UUID FK → User | nullable — only for type=rider |
| status | ENUM `open\|assigned\|closed` | |
| createdAt | TIMESTAMP | |
| updatedAt | TIMESTAMP | |
| closedAt | TIMESTAMP | nullable |

### `ChatMessage` entity
| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| conversationId | UUID FK → Conversation | |
| senderId | UUID FK → User | nullable — null for bot messages |
| senderRole | ENUM `customer\|admin\|rider\|bot` | |
| content | TEXT | |
| isRead | BOOLEAN | default false |
| readAt | TIMESTAMP | nullable |
| createdAt | TIMESTAMP | |

### Indexes
- `(conversationId, createdAt)` — fast message paging
- `(customerId, status)` — customer's conversation list
- `(status, type)` — admin inbox filtering

### Conversation lifecycle
```
Customer opens chat
  → POST /chat/conversations { type, orderId? }
  → status: 'open'

type='ai'    → GridBot responds automatically
type='admin' → sits in admin_inbox until claimed
type='rider' → assignedRiderId = order.assignedRiderId (auto-set)

Admin replies to unassigned conversation
  → auto-assigns: assignedAdminId = that admin, status='assigned'

Admin clicks "Close"
  → status='closed', closedAt=now
```

---

## 4. Environment Variables

Added to `server/.env` and `server/.env.example`:

```
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=nvidia/nemotron-3-nano-30b-a3b:free
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_FALLBACK_MODEL=openai/gpt-3.5-turbo
```

> **Security note:** The API key above goes in `server/.env` only. It must never be committed to git. `server/.env` is already in `.gitignore`. `server/.env.example` stores the key name with a placeholder value.

---

## 5. WebSocket Protocol

### Client → Server events
| Event | Payload | Effect |
|-------|---------|--------|
| `join-conversation` | `{ conversationId }` | Client joins room `conversation:{id}` |
| `send-message` | `{ conversationId, content }` | Save msg → broadcast → trigger GridBot if type=ai |
| `typing` | `{ conversationId }` | Broadcast `user-typing` to room (debounced 2s) |
| `read-messages` | `{ conversationId }` | Mark all unread as read → emit `messages-read` |
| `leave-conversation` | `{ conversationId }` | Client leaves room |

### Server → Client events
| Event | Payload | Recipient |
|-------|---------|-----------|
| `message-received` | `{ id, conversationId, senderId, senderRole, content, createdAt }` | Room members |
| `bot-typing` | `{ conversationId }` | Room — emitted while OpenRouter processes |
| `bot-response` | `{ id, conversationId, senderRole:'bot', content, createdAt }` | Room |
| `user-typing` | `{ conversationId, senderRole }` | Room |
| `messages-read` | `{ conversationId, readAt }` | Room |
| `conversation-assigned` | `{ conversationId, adminId, adminName }` | Customer — when admin claims |
| `new-conversation` | `{ conversationId, customerId, customerName, type, orderId? }` | `admin_inbox` room |

---

## 6. REST API

### Customer endpoints (JWT required)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/chat/conversations` | Start a conversation `{ type, orderId? }` |
| `GET` | `/chat/conversations` | List my conversations (paginated) |
| `GET` | `/chat/conversations/:id/messages` | Message history `?page=1&limit=50` |

### Admin endpoints (JWT + role=admin required)
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/chat/admin/conversations` | Inbox `?status=open&type=admin` |
| `PATCH` | `/chat/conversations/:id/assign` | Claim conversation (sets self as assignedAdmin) |
| `PATCH` | `/chat/conversations/:id/close` | Close conversation |

---

## 7. GridBot (AI) Integration

### OpenRouter call
```
POST https://openrouter.ai/api/v1/chat/completions
Authorization: Bearer {OPENROUTER_API_KEY}
Content-Type: application/json

{
  "model": "{OPENROUTER_MODEL}",
  "messages": [
    { "role": "system", "content": "{systemPrompt}" },
    ...last 10 messages from conversation history,
    { "role": "user", "content": "{customerMessage}" }
  ]
}
```

### System prompt
```
You are GridBot, a helpful assistant for GRIDGO printing services.
Help customers with questions about paper printing, 3D printing,
pricing, and delivery. For order-specific issues or account 
matters, politely direct them to our admin support team.
```

### Flow inside `send-message` handler (type=ai only)
1. Save customer message to DB
2. Broadcast `message-received` to room
3. Emit `bot-typing` to room
4. Fetch last 10 messages for context window
5. POST to OpenRouter (10s timeout)
6. Save bot response as ChatMessage (`senderId=null`, `senderRole='bot'`)
7. Emit `bot-response` to room

### Fallback on error
If OpenRouter returns an error or times out:
- Save and emit: `"I'm having trouble right now. Please try again or chat with our admin support team."`
- Log the error server-side
- If `OPENROUTER_FALLBACK_MODEL` is set, retry once with fallback model before using canned response

---

## 8. Mobile UI (Flutter)

> **Implementation note:** Use `frontend-design:frontend-design` skill for all UI screens and widgets.

### New files
```
apps/mobile/lib/features/customer/chat/
├── screens/
│   ├── chat_list_screen.dart        ← conversation history list
│   ├── chat_select_screen.dart      ← choose AI / Admin / Rider
│   └── conversation_screen.dart    ← bubble chat UI
├── providers/
│   ├── chat_provider.dart           ← conversations list (StateNotifier)
│   └── conversation_provider.dart  ← messages per conversation (StateNotifier)
├── models/
│   ├── conversation.dart
│   └── chat_message.dart
└── widgets/
    ├── floating_chat_button.dart    ← FAB with unread badge
    ├── message_bubble.dart          ← left/right, role-aware styling
    └── typing_indicator.dart        ← animated three-dot indicator

apps/mobile/test/features/customer/chat/
├── chat_provider_test.dart
└── conversation_provider_test.dart
```

### Router additions (app_router.dart)
- `/customer/chat` → `ChatListScreen`
- `/customer/chat/select` → `ChatSelectScreen` (optional orderId query param)
- `/customer/chat/:id` → `ConversationScreen`

### FloatingChatButton
- Positioned in `HomeScreen` via `Stack`
- Shows red unread badge when total unread > 0
- Taps: if no conversations → `ChatSelectScreen`; if has conversations → `ChatListScreen`

### ChatSelectScreen logic
- If `orderId` provided: show GridBot, Admin, Rider (rider only if `order.assignedRiderId != null` and order status is one of: `riderAssigned`, `pickedUp`, `onTheWay`, `arrivedAtDestination`)
- If no `orderId`: show GridBot and Admin only

### ConversationScreen
- Customer bubbles: right-aligned, brand color
- Admin/Rider bubbles: left-aligned, grey
- Bot bubbles: left-aligned, distinct bot color with 🤖 avatar
- Typing indicator: animated three dots, shown on `bot-typing` or `user-typing` events
- Input: text field + send button, disabled while bot is typing

---

## 9. Admin UI (React)

> **Implementation note:** Use `frontend-design:frontend-design` skill for all UI screens and components.

### New files
```
admin/src/
├── pages/chat/
│   ├── index.tsx              ← ChatInboxPage (table + split thread panel)
│   └── ChatThread.tsx         ← right-side thread panel
├── hooks/
│   └── useChat.ts             ← Socket.IO connection, message state, unread count
├── components/chat/
│   ├── MessageBubble.tsx      ← admin/customer bubble styling
│   ├── ConversationList.tsx   ← left panel inbox list
│   └── TypingIndicator.tsx    ← animated dots
└── providers/
    └── ChatSocketProvider.tsx ← Socket.IO context, unread count for sidebar badge
```

### Sidebar
- "Support Chat" nav item with live unread badge (count from `new-conversation` events)
- Badge resets when admin opens the inbox

### Inbox page
- Ant Design Table with columns: Status, Customer, Type, Order, Assigned To, Age
- Filter tabs: All / Open / Mine / Closed
- Click row → opens `ChatThread` panel (split layout, right side)

### ChatThread panel
- Loads message history via `GET /chat/conversations/:id/messages`
- Joins room via `join-conversation` WebSocket event
- Renders `MessageBubble` for each message
- "Assign to me" button → `PATCH /chat/conversations/:id/assign`
- "Close conversation" button → `PATCH /chat/conversations/:id/close`
- Reply input → `send-message` WebSocket event (also auto-assigns if unassigned)

### useChat hook responsibilities
- Maintain Socket.IO connection on admin login
- Join `admin_inbox` room on connect
- Listen for `new-conversation` → add to inbox list, increment badge
- Listen for `message-received` → update active thread if open
- Export: `{ conversations, activeConversation, messages, unreadCount, sendMessage, assignConversation, closeConversation }`

---

## 10. Error Handling

| Scenario | Handling |
|----------|----------|
| OpenRouter timeout (>10s) | Emit canned fallback response, log error |
| OpenRouter 429 rate limit | Emit canned fallback, log warning |
| OpenRouter model unavailable | Retry with `OPENROUTER_FALLBACK_MODEL`, then canned fallback |
| WebSocket disconnect (mobile) | `socket_io_client` auto-reconnects; re-emit `join-conversation` on reconnect |
| Messages sent while offline | Queue in `ConversationProvider`, flush on reconnect |
| JWT invalid on /ws/chat handshake | Disconnect client |
| Rider disconnects mid-delivery | Emit system message: "Rider is currently unavailable" |
| Admin closes conversation | Customer receives `conversation-updated` event with status=closed |

---

## 11. Testing

### Server (Jest)
- `ChatService` — createConversation, sendMessage (customer + bot), assignAdmin, closeConversation
- `OpenRouterService` — mock HTTP client: happy path, timeout fallback, model env switching
- `ChatGateway` — mock socket: join room, bot-typing emitted before bot-response, admin_inbox broadcast

### Mobile (Flutter test)
- `ChatProvider` — conversation list loads, unread count increments on new message
- `ConversationProvider` — message append, optimistic send, offline queue + flush

### Manual integration checklist
- [ ] GridBot responds end-to-end to a question
- [ ] Changing `OPENROUTER_MODEL` env var → correct model responds
- [ ] OpenRouter fallback triggers on invalid model name
- [ ] Admin sees `new-conversation` badge increment in real time
- [ ] Admin claims conversation → customer receives `conversation-assigned`
- [ ] Customer receives admin reply in real time
- [ ] Rider option hidden when order has no assigned rider
- [ ] Rider option visible when order status is out for delivery
- [ ] Full message history loads on reopening a conversation
- [ ] Unread badge on floating button increments on new message

---

## 12. Out of Scope (future)

- File/image attachments in chat
- Admin-to-admin internal notes on a conversation
- AI suggested replies for admins (Option C from brainstorm)
- Canned response templates for admins
- Customer satisfaction rating after conversation closes
- Push notifications for new chat messages (can reuse existing `notifications` module later)
