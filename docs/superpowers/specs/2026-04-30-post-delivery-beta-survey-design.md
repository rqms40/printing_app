# Post-Delivery Beta Survey Lockout Design

**Date:** 2026-04-30
**Status:** Approved concept - awaiting spec review
**Scope:** Trigger mandatory survey only when an admin changes an order to `delivered` or `completed_pickup`.

---

## Goal

When an admin marks a beta tester's order as delivered or completed pickup, the customer app must force that user into the survey. The user cannot leave the survey screen until it is submitted. After submission, the app thanks the user, logs them out, and the backend holds the account so the user cannot log in again until full release.

This is a beta-testing completion flow. It is not a general customer survey for every production user.

---

## Current Findings

- Admin order status changes call `OrdersService.updateStatus()` through `PATCH /admin/orders/:id/status`.
- Rider delivery currently updates order status through `RidersService.updateDeliveryStatus()` and bypasses `OrdersService.updateStatus()`. This design intentionally does not hook rider status changes yet.
- Existing survey data is stored in `tam_surveys`, tied only to `user_id`.
- Existing beta mode tracks `isBetaUser`, `betaEnrolledAt`, and `betaCreditsGranted`, but does not enforce access.
- `users.isActive` already exists and is displayed in admin, but login and JWT validation do not enforce it.

---

## Trigger Rules

Create a mandatory survey requirement only when all of these are true:

1. The status update was made through the admin order status flow.
2. The new order status is `delivered` or `completed_pickup`.
3. The order owner is a beta user.
4. No existing pending or submitted post-delivery survey requirement already exists for that order.

Do not trigger for:

- Rider checkpoint delivery for now.
- External courier `externalDeliveryStatus`.
- Cancelled or file-declined orders.
- Non-beta users.

---

## Data Model

### New Entity: `TamSurveyRequirement`

Table: `tam_survey_requirements`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `userId` | int FK | Owner who must answer |
| `orderId` | int FK | Order that completed |
| `reason` | varchar | `post_delivery` |
| `status` | enum/varchar | `pending`, `submitted` |
| `surveyId` | int nullable FK | Set after survey submit |
| `requiredAt` | timestamp | When requirement was created |
| `submittedAt` | timestamp nullable | When survey was accepted |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

Add a unique index on `(order_id, reason)` so repeated admin saves do not create duplicate requirements.

### Modified Entity: `TamSurvey`

Add optional links:

| Column | Type | Notes |
|---|---|---|
| `orderId` | int nullable FK | Filled for forced post-delivery survey |
| `requirementId` | int nullable FK | Filled for forced post-delivery survey |

Voluntary surveys can continue using `POST /tam-surveys` without these fields.

### Modified Entity: `User`

Use existing `isActive` as the actual login gate, and add explicit reason metadata so beta holds are distinguishable from other deactivations:

| Column | Type | Notes |
|---|---|---|
| `accountHoldReason` | varchar nullable | `beta_survey_complete` for this flow |
| `accountHeldAt` | timestamp nullable | Set when survey is submitted |
| `betaCompletedAt` | timestamp nullable | Set when survey is submitted |

After forced survey submission:

- `isActive = false`
- `accountHoldReason = beta_survey_complete`
- `accountHeldAt = now`
- `betaCompletedAt = now`

Full release can reactivate users by setting `isActive = true` and clearing `accountHoldReason` / `accountHeldAt` for rows with `accountHoldReason = beta_survey_complete`.

---

## Backend API

### Account State

Add:

`GET /users/me/account-state`

Response:

```json
{
  "accountStatus": "active",
  "holds": []
}
```

When a forced survey is pending:

```json
{
  "accountStatus": "survey_required",
  "holds": [
    {
      "type": "post_delivery_survey",
      "requirementId": 123,
      "orderId": 45,
      "orderRef": "ORD-10045",
      "requiredAt": "2026-04-30T12:00:00.000Z"
    }
  ]
}
```

This endpoint stays available while the survey is pending. Once the account is inactive after submission, normal login/profile endpoints reject access.

### Forced Survey Submission

Add:

`POST /tam-surveys/requirements/:requirementId/submit`

Body:

```json
{
  "surveyData": {
    "0": 4,
    "1": 3,
    "2": 4
  },
  "openForumFeedback": {
    "feature": "More pickup windows",
    "delivery": "Delivery was smooth"
  }
}
```

Rules:

- JWT user must own the requirement.
- Requirement must be `pending`.
- Requirement must contain exactly all 14 survey answers.
- Each answer must be an integer from `0` to `4`, matching current mobile/admin scale.
- Create a `TamSurvey` row linked to the requirement and order.
- Mark requirement `submitted`.
- Hold the user account as described above.
- Return:

```json
{
  "success": true,
  "surveyId": 999,
  "logoutRequired": true
}
```

### Existing Voluntary Survey

Keep `POST /tam-surveys` for optional profile surveys, but add server validation:

- `survey_data` must contain known survey answer keys.
- Values must be integers `0` to `4`.
- Do not hold the account for voluntary survey submission.

---

## Backend Flow

### Admin Status Update

In `OrdersService.updateStatus()`:

1. Persist the new status as today.
2. Run existing completion side effects for file expiry, notifications, and websocket updates.
3. If status is `delivered` or `completed_pickup`, call a new survey service method:

```typescript
tamSurveysService.createPostDeliveryRequirementIfNeeded(order);
```

The service loads the order owner, checks `isBetaUser`, and inserts the requirement idempotently.

### Auth Enforcement

Update `AuthService.login()`:

- If `user.isActive === false`, reject login with `UnauthorizedException`.
- If `accountHoldReason === beta_survey_complete`, return the message: `Beta testing completed. Your account will reopen at full release.`

Update JWT validation or the JWT guard so existing tokens stop working after hold:

- Load user by `payload.sub`.
- Reject if missing or inactive.
- Preserve `sub`, `email`, and `role` behavior for active users.

Important whitelist:

- The forced survey submission must complete before the user is held, so no special inactive-user whitelist is needed after hold.
- While survey is pending, the user is still active, but the mobile router keeps them on the survey screen.

---

## Mobile UX

### Detection

Add an account-state provider in Flutter:

- Fetches `GET /users/me/account-state` after login and auto-login.
- Refreshes when order websocket updates show an order moved to `delivered` or `completedPickup`.
- If `survey_required`, updates router state.

### Forced Route

Add a forced route:

`/customer/survey/required`

The router redirects authenticated customers to this route while account state says `survey_required`.

### Forced Survey Screen

Reuse most of the existing TAM survey UI, but add a required mode:

- Starts at question 1.
- Removes app bar back button.
- Removes close buttons from question and open-forum pages.
- Uses `PopScope(canPop: false)`.
- Requires all 14 answers before submission.
- Submits to `POST /tam-surveys/requirements/:requirementId/submit`.
- Shows thank-you state.
- Logs out through `authProvider.logout()`.
- Sends user to login.

The voluntary profile survey route remains available for active users and can keep the normal back behavior.

### Login Message

If login fails because the account is held after beta completion, show:

`Beta testing completed. Your account will reopen at full release.`

---

## Admin UX

No new admin screen is required for the first implementation.

Required admin behavior:

- Users list/detail already display active status, so held beta users will appear inactive.
- TAM survey list/detail must continue to show old voluntary survey responses and new forced survey responses.
- If a survey has `orderId`, the survey detail page shows the linked order reference.

Full-release reactivation can be a later admin action or a one-time script:

```sql
UPDATE users
SET is_active = true,
    account_hold_reason = NULL,
    account_held_at = NULL
WHERE account_hold_reason = 'beta_survey_complete';
```

---

## Error Handling

- Requirement already exists: return existing pending requirement; do not duplicate.
- User opens app after status changed while app was closed: account-state fetch redirects to forced survey.
- User loses network on submit: keep them on forced survey and show retry message.
- Survey submit succeeds but logout fails locally: token is cleared again on next app start because account is inactive and JWT validation rejects.
- Admin changes status away from delivered after requirement was created: requirement remains. The beta test has reached completion once admin marked fulfillment complete.

---

## Testing Strategy

### Backend

- `OrdersService.updateStatus()` creates one requirement when admin sets `delivered`.
- `OrdersService.updateStatus()` creates one requirement when admin sets `completed_pickup`.
- Non-beta users do not get a requirement.
- Repeated delivered/completed updates do not create duplicates.
- Forced submit rejects wrong user.
- Forced submit rejects partial answer sets.
- Forced submit creates `TamSurvey`, marks requirement submitted, and holds user.
- Login rejects inactive beta-completed users with the expected message.
- JWT validation rejects held users with existing tokens.

### Mobile

- Account-state provider parses active and survey-required responses.
- Router redirects authenticated customers to `/customer/survey/required`.
- Forced survey cannot be popped.
- Forced survey does not submit until all 14 answers exist.
- Successful forced submit shows thank-you and logs out.
- Login displays beta-complete hold message.

### Admin

- TAM survey list/detail still render old voluntary surveys.
- Survey with `orderId` displays order metadata.
- Users list/detail show held beta users as inactive.

---

## Out of Scope

- Rider checkpoint delivery trigger.
- External courier delivery trigger.
- SMS or email survey prompts.
- A full-release admin reactivation screen.
- General production survey enforcement for non-beta users.
- Changing the survey question set.
