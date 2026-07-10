# Beta Workflow Release 1.6 Design

## Goal

Make the complete admin, Mark, Ven, and Juan beta workflow reliable, road-aware, privacy-preserving, and visibly verifiable on a fresh isolated stack. Release GRIDGO `1.6.0+17` as tag `v1.6.0` only after the exact release commit passes every local, rendered, integration, and GitHub CI gate in this document.

## Approved Direction

Use a release-grade hybrid routing design:

- The server obtains a road-duration matrix from a configurable OSRM-compatible provider.
- The server computes the best route for GRIDGO's small active stop count and persists the resulting dispatch plan.
- Map clients render the persisted stop order and provider geometry; they do not independently reorder deliveries.
- Production routing uses an owned or supported endpoint. The public OSRM demo endpoint is development-only and is never treated as a production dependency.
- The design leaves a clean adapter boundary for VROOM or a managed optimizer if fleet size, capacities, time windows, or multiple vehicles later require a full vehicle-routing solver.

References:

- [OSRM API: route, table, and trip services](https://project-osrm.org/docs/v5.24.0/api/)
- [VROOM vehicle-routing engine and supported routing backends](https://github.com/VROOM-Project/vroom)
- [Google Route Optimization API](https://developers.google.com/maps/documentation/route-optimization)
- [OR-Tools vehicle-routing model](https://developers.google.com/optimization/routing/vrp)

## Scope Decomposition

This release program is split into five independently reviewable workstreams that meet at one release gate:

1. Fresh schema, seed, and beta-account lifecycle.
2. Order, assignment, status, proof, survey, and credit integrity.
3. Persisted road-aware dispatch planning, live location, and queue privacy.
4. Four-actor Playwright workflow with numbered screenshot evidence.
5. Repository-wide CI and release automation.

Each workstream must produce a working, testable result. No workstream may claim the complete workflow passes until the integrated four-actor run succeeds.

## Existing Baseline

The current repository already provides meaningful coverage:

- Beta registration can auto-enroll a customer and grant 100 GRIDGO Credits.
- Beta checkout enforces credits at the order boundary.
- Real upload metadata, saved addresses, customer order visibility, rider assignment, proof-required delivery, surveys, testimonials, and held login states exist.
- Customer queue responses withhold the assignment identifier and map eligibility from later stops.
- The location socket authenticates customers and rechecks current-stop ownership.
- Unit and widget tests cover many isolated customer and rider states.
- An opt-in destructive Playwright test exercises much of the backend flow through APIs.

The existing evidence is insufficient for release 1.6 because:

- The destructive workflow does not drive the real interfaces or capture passing-flow screenshots.
- The current Server CI run fails because an end-to-end location client omits the JWT required by the location gateway.
- Routing is recalculated with straight-line nearest-neighbor distance instead of using a persisted road-time plan.
- The rider map draws only the current leg while describing the experience as an optimized multi-stop route.
- The fallback movement path does not follow the actual Ven and Mark destinations.
- Assignment, order-status, proof-file, survey-creation, and production-migration integrity have release-blocking gaps.
- Current CI and tag workflows do not gate the entire repository or the fresh-stack rendered workflow.

## Fresh Database, Migrations, and Seed

### Migration contract

- Production and CI start from an empty PostgreSQL database using a complete, ordered TypeORM migration chain.
- `server/package.json` exposes explicit migration generate, run, and revert commands using the repository data-source configuration.
- Production keeps schema synchronization disabled.
- The development stack runs migrations before seeding. Development synchronization may remain available only as an explicit local escape hatch and is not part of release verification.
- CI proves that migrations can build the schema from an empty database and can start the server without synchronization.

### Fresh-stack contract

- The verification run deletes only the isolated `docker-compose.dev.yml` PostgreSQL and MinIO volumes after confirming they are disposable local data.
- Compose binds public services to loopback and builds mobile/admin/landing URLs against `127.0.0.1`.
- Seed runs only after migrations and leaves beta mode disabled.
- Seeded admin and Juan rider identities are verified through login without printing credentials.
- Seeded file, address, catalog, delivery-slot, beta-setting, and rider-profile records are checked before the destructive workflow begins.
- The run identifier makes Mark and Ven data unique if the stack is intentionally retained for inspection.
- The final test disables beta and verifies that both held users regain login access.

## Beta Enrollment and Credit Integrity

- Enrollment and the 100-credit grant occur atomically and remain idempotent.
- Each grant writes a credit-ledger transaction with a beta-enrollment reason.
- Beta rank ordering uses enrollment timestamp plus a stable identifier as a deterministic tie-breaker.
- Mark registers before Ven in the rendered flow, so Mark's rank precedes Ven's rank.
- The UI visibly displays the assigned beta number and a 100-credit starting balance before either order.
- Checkout debit and cancellation refund use the same complete charge breakdown, including subtotal, delivery fee, priority fee, and extra-destination fees.

## Order and Admin Production Integrity

- Admin order status transitions follow the declared production state machine. Arbitrary backward or skipped transitions are rejected unless a separately authorized recovery path is defined.
- Every accepted transition writes `order_status_history` with actor, previous status, new status, timestamp, and optional reason.
- The UI drives Mark and Ven through the real production pipeline rather than directly patching each order to `ready_for_dispatch`.
- Customer order updates reach the correct customer socket and refresh visible state without requiring logout.
- Assignment is allowed only for an eligible order and an available rider.
- One order can have only one active assignment. The database constraint and service transaction protect against concurrent duplicate assignment.
- Assignment creation, order rider/status update, and notification emission are transactionally consistent.

## Persisted Dispatch Plan

### Plan creation

- A dispatch plan is created or revised explicitly when the admin dispatches a set of ready assignments.
- The plan records rider, ordered assignment identifiers, origin, provider, provider profile, matrix/plan timestamp, version, total road distance, estimated duration, and per-leg geometry or geometry references.
- The initial origin is the configured GRIDGO store location, not a rider's stale last-known position.
- The route sequence remains stable after dispatch. Rider movement updates progress and ETA; it does not silently reorder the remaining customers.
- A controlled re-optimize action creates a new plan version and emits customer/rider updates.

### Optimization

- The provider table service supplies road durations and distances for the store and all stops.
- For the small GRIDGO stop limit, the server computes the minimum-duration open route starting at the store. Deterministic tie-breaking uses assignment identifier.
- The implementation records unreachable coordinates and rejects dispatch with a clear admin error rather than omitting a customer.
- The server can later replace the small-route solver with VROOM or another optimizer behind the same plan interface.

### Provider fallback

- A timeout, invalid provider response, or unreachable stop cannot be labeled optimized.
- If no plan exists, dispatch remains blocked and the admin sees the routing failure with a retry path.
- If an active plan exists, clients retain that last valid plan and mark geometry/ETA stale while location updates continue.
- A straight interpolated line may be used only as clearly labeled degraded visual geometry; it cannot change sequence or ETA claims.

## Rider Movement and Map Experience

- Juan sees all stops in the persisted order and one continuous route made from the planned legs.
- Stop numbers, list order, timeline order, and route geometry use the same dispatch-plan sequence.
- The active leg is visually stronger than later legs; completed legs remain visible but subdued.
- Rider GPS posts through the authenticated REST location endpoint. The client no longer emits an unsupported location WebSocket publishing event.
- The server broadcasts accepted rider positions only to the current delivery room and includes assignment identifier, timestamp, and plan version.
- Maps show live, stale, offline, and degraded-routing states explicitly.
- Map tiles and routing-provider attribution remain visible.

## Customer Queue Privacy and Promotion

- Ven receives queue position 1, map eligibility, and only Ven's current assignment identifier.
- Mark receives queue position 2 and queue size 2, but no assignment identifier, location-room membership, live rider coordinates, route geometry, or live-map affordance.
- Guessing Mark's or Ven's assignment identifier cannot bypass server authorization.
- Completing Ven emits a plan-progress/promotion event to Mark. Mark becomes position 1, receives map eligibility and the current assignment identifier, and opens live tracking without a manual app restart.
- Ven loses current tracking access after delivery completion.
- Held or inactive customers with old JWTs cannot keep subscribing to protected location/order rooms.

## Proof of Delivery and Survey Reliability

- Juan must reach `arrived` for the current plan stop before proof can complete the delivery.
- Signature proof has a bounded payload and a valid non-empty path.
- Photo proof references a real uploaded file owned by Juan with the proof-of-delivery purpose and accepted image MIME type.
- Fake, foreign, deleted, or wrong-purpose files are rejected.
- Assignment proof state, order delivery state, status history, required-survey creation, and notifications cannot leave a partially completed delivery. Transactional work and post-commit event dispatch keep database state consistent.
- Survey creation failure prevents a false final success response and is observable in logs/health evidence.
- Both Mark and Ven receive a pending 14-question requirement and are routed automatically to the non-dismissible survey.
- Completing the survey moves each user to the success/photo flow and beta-held state.
- `sharedOnSocial` is recorded only after an actual share callback succeeds. Uploading the mandatory testimonial photo remains a distinct required action.
- While beta remains enabled, login returns the held identity and completion state. Disabling beta restores login for Mark and Ven.

## Four-Actor Playwright Workflow

### Browser contexts

- `admin`: desktop Chromium at the admin website.
- `mark`: mobile portrait Chromium at the Flutter web app.
- `ven`: a separate mobile portrait Chromium context at the Flutter web app.
- `juan`: mobile portrait Chromium with geolocation permission at the Flutter web app.

Each context has independent cookies and storage. Flutter semantics are enabled before role/name locators are used.

### Movement simulation

Playwright changes Juan's geolocation through five deterministic checkpoints:

1. GRIDGO store origin.
2. A road position between the store and Ven.
3. Ven's pinned destination.
4. A road position between Ven and Mark.
5. Mark's pinned destination.

The test waits for the authenticated location REST request, server acknowledgement, current-customer WebSocket update, and visible marker/state change at every checkpoint. Mock customer orders, mock addresses, mock assignments, and the hard-coded fallback path are forbidden in this real-flow project.

### Screenshot evidence

The run captures accepted screenshots in flow order using numbered names. Each accepted screenshot is inspected for the correct window, role, state, load completion, and crop before it is included as evidence.

| Step | Required rendered evidence |
| --- | --- |
| 1 | Admin login form and authenticated operations dashboard |
| 2 | Beta page before and after enabling beta |
| 3 | Mark account registration entry and completion |
| 4 | Mark's completed profile details |
| 5 | Mark beta number and 100-credit balance |
| 6 | Mark order tutorial completion |
| 7 | Paper-print category selected |
| 8 | Real file selected, uploaded, and previewable |
| 9 | Mark's completed paper specifications/order progression |
| 10 | Pinned address and saved-address/recent list evidence |
| 11 | GRIDGO Credits selected with all other methods unavailable |
| 12 | Selected print and delivery mode summary |
| 13 | Successful order placement and order reference |
| 14 | Mark order in customer order list/details |
| 15 | Admin production status progression for Mark |
| 16 | Admin rider-assignment confirmation for Mark |
| 17 | Juan's assignment list showing Mark |
| 18 | Ven beta number, credits, checkout, and placed order |
| 19 | Admin production status progression for Ven |
| 20 | Admin rider-assignment confirmation for Ven |
| 21 | Juan's two-stop dispatch route and ordered stop list |
| 22 | Route plan evidence showing nearer Ven before farther Mark |
| 23 | Ven first/current state with live map |
| 24 | Mark second-in-queue state with no live map |
| 25 | Juan arrived at Ven and Ven signature proof accepted |
| 26 | Mark promoted to current with live map after Ven completion |
| 27 | Juan arrived at Mark and Mark signature proof accepted |
| 28 | Automatic required-survey screens for Ven and Mark |
| 29 | Success/share/photo state, held login, beta disabled, and restored login |

Steps with multiple role-visible states receive additional suffix screenshots, such as `24-mark-private.png` and `26-mark-promoted.png`, without changing the canonical step number.

### Assertion and evidence rules

- A screenshot never substitutes for a state assertion.
- Every step asserts page identity, meaningful content, no framework overlay, and no relevant console error.
- Each mutation asserts the corresponding API response and durable state.
- Queue/map steps assert WebSocket authorization and location-room privacy.
- The run records failed network requests, console warnings/errors, trace, and video.
- Evidence is saved outside committed source by default and rendered in the final audit report.
- Screenshot baselines are introduced only for stable, high-value map/queue states; the full journey does not use brittle pixel-perfect baselines.

## Error Handling and Recovery

- Upload cancellation or rejection leaves the screen actionable and prevents checkout submission.
- Address-save failure preserves a clearly identified one-time address only when the user explicitly accepts it; it does not claim the address was saved.
- Pricing, payment, assignment, routing, proof, survey, and held-login failures preserve the last durable state and show a retryable message.
- WebSocket disconnects show stale state, retain last-known data, retry with bounded backoff, and reauthorize after reconnection.
- A later-stop customer never receives cached current-stop coordinates during reconnect or role/account changes.
- Test failures retain screenshots, trace, video, relevant container logs, and the run identifier for diagnosis.

## Layered Verification

### Backend

- Unit tests for beta rank/ledger, full refunds, status transitions/history, route matrices/solver/ties, plan versioning, assignment uniqueness, proof ownership, survey reliability, and socket account checks.
- E2E tests for empty-database migrations, authenticated location delivery, duplicate-assignment concurrency, transactional rollback, real proof upload, queue promotion, and beta-off login restoration.

### Mobile

- Provider/widget tests for real-data-only E2E mode, first/current queue copy, multi-leg route rendering, stale/offline/degraded maps, promotion events, proof errors, actual share callbacks, held login, and beta-off reopening.
- Full analyze, Flutter tests, and web release build.

### Admin

- Tests for beta consequences copy, valid production transitions, available-rider filtering, route-plan/dispatch state, and clear routing errors.
- Full TypeScript check, unit tests, and production build.

### Landing and integration

- Landing lint, content checks, and production build.
- Non-mutating beta contract.
- Fresh-stack live preflight.
- Destructive API workflow.
- Four-context rendered workflow.

## CI and Release

- Mobile-web E2E triggers for relevant mobile, admin, server, compose, E2E, and workflow changes.
- CI adds an empty-database migration job and a loopback fresh-compose integration job.
- The screenshot-heavy destructive browser workflow may use a protected/manual release-candidate environment, but its successful run identifier and artifacts are required by the release gate.
- Landing receives its own CI workflow.
- Release automation verifies the exact tagged commit is on `main` and that required Server, Admin, Mobile, Landing, Mobile Web E2E, migration, and fresh-stack checks succeeded.
- The release job runs Flutter analyze, tests, and the signed APK build.
- Version is updated from `1.5.2+16` to `1.6.0+17` only after integrated verification passes.
- Tag `v1.6.0` is annotated and pushed only after the version commit is on `main` and CI is green.
- The tag workflow publishes versioned and latest APK assets with generated release notes.

## GitHub Tracker Contract

- Existing beta issues are rechecked against fresh evidence; previously closed issues are reopened only if the release work proves a regression or the closure evidence was materially false.
- New independent integrity gaps receive focused issues when they cannot fit safely in the release branch scope.
- Comments list exact commands, test counts, screenshot artifact location, commit SHA, and remaining risks without exposing credentials.
- Trello markers remain unchanged.

## Release Acceptance

Release 1.6 is allowed only when all statements below are true:

- The repository is clean except for intentional committed release changes.
- An empty database migrates and seeds successfully with beta disabled.
- Mark and Ven complete the real customer UI flow using real uploads and saved coordinates.
- Juan receives and dispatches both assignments in the persisted road-time order.
- Ven is first, Mark is private while second, and Mark is promoted automatically.
- Both deliveries require and retain valid proof.
- Both surveys open automatically and both held/login-restoration paths pass.
- All 29 numbered steps have accepted screenshots or an explicitly failed release gate; no step is silently represented by indirect evidence.
- All local checks pass on the final commit.
- All required GitHub checks are green for the same final commit.
- Version `1.6.0+17`, tag `v1.6.0`, signed APK, and release notes refer to that exact commit.

If any statement is false, the result is an audit report with a blocker, not a release.
