# Metric Ruler, Chat Alerts, Delivery UX, and Release Design

**Date:** 2026-07-27
**Target deadline:** 2026-07-27
**Repository:** `rqms40/printing_app`

## Scope

This release addresses five independently trackable outcomes:

1. Replace the mobile preview ruler's imperial architect scales with adjustable metric scales.
2. Notify a customer when their assigned rider sends an order-related chat message.
3. Show useful delivery information immediately after checkout.
4. Prevent the first-order tutorial from appearing for customers who already have order history.
5. Remove the legacy host nginx mobile site on port 8089 and retain Compose port 8088 as the only mobile deployment.

The existing backend root endpoint work in the shared working tree is also part of the release and must retain its regression test.

## 1. Adjustable Metric Ruler

### User experience

The file-preview ruler will use metric ratios instead of imperial architect scales. The picker will provide these presets:

- `1:20`
- `1:25`
- `1:50`
- `1:75`
- `1:100`
- `1:125`
- `1:200`

The picker will also provide a **Custom** option. Custom input uses the familiar `1:N` format: the user enters the positive denominator `N`, for example `150` for `1:150`.

Validation rules:

- The denominator must be a whole number.
- The denominator must be greater than or equal to 1.
- Empty, decimal, negative, zero, and nonnumeric values are rejected with an inline error.
- Applying a valid custom value updates the ruler immediately.

The app remembers the last selected preset or custom denominator for the current user. Persistence must be account-scoped so one person's ruler preference does not leak into another account on a shared device. If no saved choice exists, the default is `1:100`.

### Calculation

Uploaded dimensions remain in millimetres; no API or database contract changes are required. For a scale of `1:N`, one real-world metre occupies `1000 / N` drawing millimetres. The preview converts that drawing distance to pixels using the fitted drawing rectangle.

Major tick labels use metres (`m`). Subdivisions adapt to available screen space so labels do not overlap. Imperial inch and foot labels, constants, and special cases are removed from the visible ruler behavior.

### Tests

Tests cover preset labels, `1:100` and `1:50` calibration, custom validation, custom rendering, account-scoped persistence, default selection, portrait and landscape fitting, and the absence of imperial labels.

## 2. Rider Chat Notifications

### Backend behavior

After an authorized rider message is successfully persisted:

1. The message is emitted to the active conversation room as it is today.
2. A persistent customer notification is created with:
   - type `rider_message`
   - public order reference
   - conversation ID
   - safe text preview or attachment fallback
3. The customer's notification WebSocket room receives the new notification.
4. Firebase Cloud Messaging sends a device push using the same routing metadata.

Only rider-to-customer messages in an assigned order conversation trigger this notification. Customer messages do not notify the customer who sent them.

Notification and push delivery are best-effort after chat persistence. A notification outage must not turn a successfully saved chat message into a failed send or invite duplicate retries.

No database migration is required because the existing notification entity supports type, order reference, and JSON metadata.

### Mobile behavior

Foreground customers receive the in-app notification, unread badge update, and existing notification sound. Background or suspended customers receive the device push.

Tapping either alert opens the related rider conversation. Missing or malformed routing metadata must not crash the app; the notification is still readable in the notification center.

### Tests

Backend tests cover rider-only notification creation, order/conversation metadata, attachment-only previews, authorization failures, and best-effort error handling. Mobile tests cover parsing, real-time insertion, unread state, deep linking, malformed metadata, and foreground/background message handling.

## 3. Immediate Post-Order Delivery UI

Checkout already receives the newly created orders and inserts them into the orders provider. The success route will carry an immutable snapshot of those created orders and stable string identifiers instead of discarding the data or coercing identifiers to integers.

The success screen immediately shows:

- order or batch reference
- current order status
- delivery or pickup method
- booked delivery slot when available
- a direct action to view the order, orders list, or delivery tracking as applicable

The screen may observe the orders provider for live updates while mounted. It does not perform a redundant fetch. Multi-order batches show an aggregate summary and a **View orders** action. Existing beta-success routing remains intact. If route data is absent, the current generic success state remains a safe fallback.

Tests cover delivery and pickup orders, slot display, string identifiers, multi-order batches, provider updates, missing snapshots, cart reset, and beta routing.

## 4. Repeat-Customer Tutorial Guard

The first-order pipeline tutorial is eligible only when all of these are true:

- initial order-history loading has completed
- the order list is empty
- the pipeline tutorial key is not already marked as seen
- no active-delivery deferral rule blocks it

Order history is the fail-safe evidence. A stale or missing tutorial key must never cause a customer with existing orders to see the first-order tutorial.

Tutorial persistence remains scoped to the authenticated user. Completion updates should not be lost during logout or route transitions; asynchronous server persistence must be awaited or safely queued at those transition points.

Tests cover new customers, repeat customers with missing tutorial metadata, second orders, active delivery deferral, logout/login synchronization, and two accounts sharing one device.

## 5. Port 8089 Retirement

Compose port `8088` is the canonical mobile deployment. The host nginx site on `8089` is outside the repository deployment and serves a stale artifact.

The safe host operation is:

1. Remove only `/etc/nginx/sites-enabled/flutter`.
2. Validate nginx configuration.
3. Reload nginx.
4. Confirm port 8089 no longer listens.
5. Confirm `http://192.168.40.201:8088/` remains healthy.
6. Optionally remove `/etc/nginx/sites-available/flutter` after verification.

This operation requires administrative privilege because the nginx files and master process are root-owned. Deleting the ignored `build/web` directory alone is not an acceptable substitute.

## GitHub Tracking

Create five GitHub issues, one for each numbered outcome. Every issue includes:

- deadline `2026-07-27`
- owning surface and role labels
- current behavior and evidence
- desired behavior
- implementation boundaries
- acceptance criteria
- verification commands
- dependencies or external blockers

Use a GitHub milestone due `2026-07-27` when repository permissions support it; otherwise place the deadline prominently in each issue body. Link the implementation commit and verification evidence before closing an issue.

## Release and Verification

The implementation follows test-driven changes in independent scopes, followed by:

- backend lint, build, unit tests, and relevant e2e tests
- Flutter analyze, unit/widget tests, and release web build
- admin and landing checks to detect cross-surface regressions
- beta workflow contract tests
- fresh Compose migration and seed
- live API, login, mobile, admin, landing, chat, notification, and delivery probes
- final `git diff --check` and working-tree review

The completed release is committed and pushed to `main` only after local verification passes.

Two external conditions cannot be resolved in repository code:

1. GitHub-hosted checks currently do not start because the GitHub account reports a failed payment or spending-limit restriction. They cannot become green until the account owner resolves billing and reruns them.
2. Retiring host port 8089 requires sudo/root access unavailable to the current process.

These conditions must be reported accurately rather than represented as successful. All other locally executable work proceeds independently.
