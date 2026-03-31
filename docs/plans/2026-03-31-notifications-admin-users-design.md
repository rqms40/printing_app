# Notifications And Admin Users Data Integrity Design

**Date:** 2026-03-31

**Scope:** Fix the mobile notifications read flow and ensure the admin users page only renders NestJS/database data.

## Context

Two related data-integrity problems were identified:

1. The mobile notifications provider expects string `id` and `userId` fields, but the NestJS notifications API returns numeric values. That parse failure causes the provider to fall back to mock notifications.
2. The fallback notifications use mock IDs such as `notif_014`, and the app still tries to send `PATCH /notifications/:id/read` for those IDs. The NestJS endpoint expects real persisted notification IDs.
3. The notifications screen uses `Dismissible` without removing the dismissed item from the widget tree, which causes the Flutter exception.
4. The admin users page requests `GET /admin/users`, but it initializes with hardcoded mock users and silently keeps those rows if the backend request fails.

## Goals

- Make backend data the source of truth for notification mutations.
- Keep the customer notifications screen usable when backend data is unavailable.
- Remove dismissed notifications from the screen so the widget tree stays consistent.
- Make the admin users page backend-only, with no silent mock fallback.
- Add regression coverage for the parsing, mutation, and admin data-loading paths.

## Decisions

### Mobile Notifications

- Normalize backend notification payloads defensively by converting `id`, `userId`, and related fields to strings rather than casting them as strings.
- Track whether the current notification list came from the API or from local mock fallback.
- Only send notification mutation requests when the current list is API-backed.
- Treat the notifications screen as an unread inbox:
  - swipe-to-read removes the notification from the list
  - tap-to-read also removes the notification from the list
  - mark-all-as-read clears the list locally
- If notification data is already in fallback mode, read actions stay local and do not surface blocking errors.
- If an API-backed read mutation fails, prefer optimistic local removal plus logging rather than a hard user-facing failure.

### Admin Users

- Remove hardcoded `mockUsers` bootstrapping from the admin users page.
- Load users only from `GET /admin/users`.
- If the request fails, show an explicit error state with retry and render no fake rows.
- Continue using the existing admin normalizer so the page remains resilient to backend field-shape differences.

## Data Flow

### Notifications

1. `GET /notifications` returns persisted notifications from NestJS.
2. The provider normalizes server payloads into the mobile model.
3. If the fetch succeeds, the provider marks the list as API-backed.
4. If the fetch fails, the provider loads mock notifications and marks the list as fallback-backed.
5. Read mutations:
   - API-backed list: call the backend, then remove the item locally.
   - fallback-backed list: skip the backend call and remove the item locally.

### Admin Users

1. The admin page loads and requests `GET /admin/users`.
2. Success path: normalize the payload and render the table.
3. Failure path: render an explicit error state and provide retry.
4. No mock users are rendered at any point.

## Error Handling

- Notifications fallback mode is non-critical and local-first.
- Admin users is an operational/admin surface, so failures must be explicit.
- The admin page should not silently mask auth, backend, or database issues with seeded UI data.

## Verification Strategy

- Extend notifications provider tests to cover numeric API payload normalization and local-only fallback mutation behavior.
- Extend notifications screen tests to verify dismissed items are removed from the tree.
- Add admin users tests around backend-only loading behavior and explicit error state handling.
