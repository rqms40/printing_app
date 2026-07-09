# Beta Workflow Remediation Design

## Goal

Make the beta workflow reliable and privacy-preserving from registration through order, delivery, feedback, and account hold, then align GitHub issue state with verified behavior.

## Scope

- Canonical beta regression issues #72-#79.
- Beta umbrella and feedback issues #26, #30, #49-#51, and #64.
- Live-audit blockers that directly affect beta safety: location WebSocket authorization, deployed development login shortcuts, admin login credentials/responsiveness/title, and unauthenticated beta-status noise.
- A real isolated live workflow test that uses admin, Mark, Ven, and Juan as distinct actors. Destructive execution remains opt-in and must not target shared data without explicit credentials and permission.

## Decisions

- While global beta mode is enabled, beta customers can pay only with GRIDGO Credits. The API enforces the rule, credit orders are recorded paid after successful deduction, and the mobile UI hides or disables every other method.
- A pinned checkout address is persisted and returned as a saved address when the address limit and API permit it. If persistence fails, checkout keeps the valid one-time address and explains that it was not saved.
- Only the current optimized delivery stop can subscribe to rider location. Later customers receive queue position without assignment-room access. Riders cannot advance a later stop before the current stop is delivered or declined.
- File selection never creates a fake checkout item. A real positive metadata identifier is required before Continue.
- Human-readable order references come from the greatest stored numeric suffix inside the creation transaction and retry on a unique conflict. Row counts are not identifiers.
- New customer registrations auto-enroll and receive the one-time 100-credit grant when beta mode is enabled.
- Structured HTTP errors preserve explicitly authored response fields so `beta_held` identity and completion state reach the mobile client. Blank names render `Beta Tester`.
- Home education waits for order loading and is suppressed while an active delivery needs attention.
- Required survey free-text fields round-trip to the server and admin. The beta success photo receives a branded share treatment and an explicit save/download action; photo submission is not presented as optional during the mandatory beta completion path.
- Production/deployed builds do not expose dev-login buttons or preset credentials.

## Architecture

Backend owns policy and authorization. Pure route-ordering and reference-generation helpers are independently tested, then services consume them. Customer order responses expose queue metadata while withholding tracking identifiers for later stops. WebSocket connections authenticate JWTs and authorize subscriptions against assignment ownership/current-stop state; clients cannot publish location events.

Mobile consumes server policy and queue metadata, keeps unavailable actions out of the interaction path, and adds regression widget/provider tests. Admin login becomes responsive and empty by default, while survey detail displays every captured answer. The Playwright contract keeps its non-mutating checklist test and gains credential-driven opt-in workflow scenarios.

## Error Handling

- Upload cancellation and picker failure leave the screen actionable with a clear message and no fake file.
- Address persistence failure falls back to the current one-time selection without losing checkout state.
- Payment policy is fail-closed for authenticated beta customers if settings cannot be loaded.
- WebSocket authentication or authorization failure disconnects or returns a forbidden socket error without joining a room.
- Reference conflicts retry a bounded number of times, then return a controlled server error.

## Verification

- Focused Jest and Flutter tests are written failing first for every behavior change.
- Server lint/build/test and mobile analyze/test/web build run after focused suites.
- Admin typecheck/test/build run for admin changes.
- Playwright validates mobile and admin at the exact requested hosts on desktop and mobile viewports, with console and screenshot evidence.
- The destructive Mark/Ven/Juan/admin workflow runs only against an isolated local stack or an explicitly authorized test dataset.

## Tracker Rules

- Preserve Trello markers.
- Close #51 with existing implementation evidence.
- Close focused issues only after their regression tests and relevant rendered/live checks pass.
- Keep #64 open until the full isolated 29-step flow passes; update it with a remaining checklist otherwise.
