# Beta Coherence Review & UX Uplift Program — Design

Date: 2026-07-15
Status: Approved by user (session design review)
Scope owner: Claude Code session (orchestrator), delegated per AGENTS.md Model Routing

## Goal

Verify end-to-end that the 29-step beta workflow is coherent across server, mobile,
and admin — every rule the API enforces is rendered intelligibly by the UI, and
every affordance the UI shows is backed by the API — then fix the incoherences,
triage the issue tracker to match reality, and ship two UX uplifts: a
near-navigation rider map experience and a redesigned registration flow.

Execution order: **A (audit + coherence fixes) → D (issue triage) → B (rider) →
C (registration)**, strictly sequential, evidence-first. Each phase gates on the
owning surface's checks from AGENTS.md plus e2e regression where relevant.

## Inputs (exploration evidence, 2026-07-15)

Three read-only exploration reports produced during design:

1. **Rider surface report** — 17 catalogued UX gaps with file:line evidence.
   Key facts: flutter_map + OSRM leg geometry already renders multi-stop routes
   with numbered badges; vehicle marker is static (two inconsistent styles:
   taxi icon on home maps, navigation arrow in `rider_map_view.dart`); GPS
   `heading`/`speed` captured in `rider_location_tracker_provider.dart` but
   never consumed; no ETA rendered anywhere despite server-computed
   `legDurationSeconds`; `routingDataStale` reaches state but no widget reads
   it; maps hardcode `MapHelpers.shopPoint` instead of plan `origin`;
   `StatusActionBar`/`CheckpointAction` are parallel dead checkpoint UIs.
2. **Registration surface report** — 7-step wizard (privacy → nickname →
   category → field → gender → age → account); templated look (stock undraw
   SVGs); email validation is `contains('@')`; password rules inconsistent
   (6 in `auth_form.dart`, 8 in wizard); consent implicit (no checkbox);
   gender/age hard-required; batch validation on submit only; **zero beta
   touchpoints at signup** — the server's auto-enrollment, 100-credit grant,
   and beta number are never surfaced during registration.
3. **Cross-surface coherence map** — per-step status of all 29 steps plus six
   concrete incoherences (see Phase A fix list) and confirmation that all five
   CLAUDE.md known gaps are still open.

Issue tracker snapshot: 37 open issues — 21 `status:already-fixed` +
`evidence-review`, 12 `partially-fixed`, 3 unclear (#60, #24, #33), 2
still-needed (#25, #21). Beta issues #72–#79 already closed. #13 (registration
onboarding) closed — the registration redesign gets a new issue.

## Phase A — Live beta-workflow audit + coherence fixes

### Stack

- `docker compose -f docker-compose.dev.yml down -v` (wipes local dev volumes —
  user approved), then up loopback-bound with `GRIDGO_PUBLIC_HOST=127.0.0.1`
  and `GRIDGO_TRUST_PROXY_HOPS=1`.
- Precondition check: `server/.env` contains `JWT_SECRET`, `MINIO_*`,
  `GRIDGO_SEED_{CUSTOMER,RIDER,ADMIN}_PASSWORD` (presence verified, values
  never printed or logged).

### E2E runs (in order, per AGENTS.md "Beta Workflow Regression")

1. Contract: `MOBILE_WEB_E2E_NO_SERVER=1 npm test -- tests/beta-workflow.spec.ts`
2. Live preflight: `GRIDGO_RUN_BETA_FLOW_E2E=1` against the running stack.
3. Destructive: `GRIDGO_RUN_BETA_FLOW_DESTRUCTIVE=1` (isolated stack only).
4. Recreate the stack, then visual: `GRIDGO_RUN_BETA_FLOW_VISUAL=1
   npm run test:beta:visual` — numbered screenshots, four contexts (admin,
   Mark, Ven, Juan).

The orchestrator reviews every screenshot against the 29 steps, then performs a
supplementary manual Playwright pass on admin (:8189) and mobile web (:8088)
applying a Laws-of-UX heuristic checklist per screen (clarity of state,
feedback, affordances, error copy).

### Output

Findings register: `docs/superpowers/specs/2026-07-15-beta-coherence-findings.md`
merging e2e evidence with the three exploration reports. Every finding carries:
surface(s), step number, evidence (file:line or screenshot id), severity, and
disposition (fix now / merge into issue #N / new issue / out of scope).

### Fixes shipped in Phase A

Each fix is its own smallest-reviewable branch; owning-surface checks + targeted
e2e re-run before merge.

| ID | Fix | Surface | Route |
|----|-----|---------|-------|
| F1 | Wire the existing-but-dead `BetaOrderLimitSheet` into the checkout error path so `BETA_ORDER_LIMIT_REACHED` (403) stops rendering a raw `BetaOrderLimitException` string in a SnackBar (`checkout_screen.dart:398-409`, `orders_provider.dart:972-973`) | mobile | Claude |
| F2 | Code-aware fallback handler for `beta_credits_only` (403) at checkout — translate to human copy even if client-side prevention is bypassed | mobile | Claude |
| F3 | Return `rank` from `searchBetaMembers` (`beta-mode.service.ts`) and render a Rank column in the admin beta members table (`admin/src/pages/beta-mode/index.tsx`) — closes a documented known gap | server + admin | codex sol, medium |
| F4 | Customer queued tile shows "Nth of N" using `deliveryQueueSize`; live tile shows server-authoritative `deliveryLegDurationSeconds`/`deliveryLegDistanceMeters` instead of client-side geometry estimate (`map_tracking_tile.dart`) | mobile | Claude |
| F5 | Unify "GRID Credits" → "GRIDGO Credits" in admin beta copy (`beta-mode/index.tsx:50,57,293-298`) | admin | codex terra |

Plus any new defects the live runs surface, dispositioned through the findings
register (fix-now only if small and beta-critical; otherwise issue-tracked).

### Explicitly out of scope for Phase A

- Maria beta exception (own plan: `2026-07-15-maria-beta-exception.md`).
- Admin-configurable credit grant amount (product decision; issue only).
- Registration beta-welcome moment (belongs to Phase C).

## Phase D — Issue triage & closure

- **21 already-fixed issues:** read-only verification agents (codex terra for
  single-surface, sol medium for cross-surface), batched ~5 issues per agent,
  each returning: files inspected, evidence, confidence, recommended verdict.
  The orchestrator verifies each verdict locally before closing with an
  evidence comment (file refs, behavior, tests). Not-actually-fixed issues get
  relabeled (`status:partial` / `status:still-needed`) instead of closed.
- **12 partially-fixed issues:** updated with concrete remaining-work
  checklists; program findings merged into the appropriate homes — rider
  findings → #62 (Rider.UI.FT01) with links to B1/B2; delivery-status findings
  → #45/#47; notification findings → #61/#48.
- **Unclear (#60, #24, #33):** rewritten into actionable bodies, preserving
  `Trello-Card-ID`/`Trello-ShortLink` markers.
- **Still-needed (#25, #21):** label/sequencing only; implementation out of
  scope for this program.
- **New issues:** rider map uplift (B1), rider live navigation (B2) — both
  linked from #62; registration redesign (successor to closed #13); one issue
  per unfixed e2e-discovered defect.

Label taxonomy per AGENTS.md ("Issue Labeling And Routing"). Closures require
current-code evidence; `docs/trello/` mirror remains untouched.

## Phase B — Rider map & navigation

### B1 — `feat/rider-map-uplift` (UI-heavy; Claude + frontend-design skill)

- **Unified vehicle marker component** replacing the taxi/arrow split: heading
  rotation from GPS heading, smooth position interpolation between fixes
  (tween, no teleporting), accuracy circle from Geolocator accuracy (start
  capturing it), consistent across `rider_map_view`, `rider_route_map_tile`,
  `rider_route_map_panel`.
- **ETAs:** per-stop ETA chips from `legDurationSeconds` (stop rail, today's
  route cards, active stop card); total route time/distance summary on the
  home cockpit map, replacing the decorative clock overlay. If the plan
  payload lacks `totalDurationSeconds`/`totalDistanceMeters`, add them to the
  mobile model from the existing server response; only touch
  `dispatch-plan.service.ts` if the API genuinely doesn't expose them (then:
  codex sol, high).
- **Stale-route banner** driven by the already-parsed `routingDataStale`.
- **Plan origin:** use `plan.origin` for the shop marker; keep
  `MapHelpers.shopPoint` only as a fallback when no plan exists.
- **UX gap fixes** from the rider report: readable stop labels (kill the 4.5pt
  "STOP" text), decline confirmation dialog with reason picker, proof photo
  preview + retry on failed upload, honest labeling of the arrived-state
  action (swipe opens the proof sheet — label it so), single consistent
  surface name ("Deliveries"), remove dead `StatusActionBar` +
  `CheckpointAction`, stop rail "done" state driven by per-stop `status` not
  count, visible tap affordance on the home cockpit map, snackbar feedback
  when call/navigate URL launches fail, and hide the route-position badge
  entirely when position is unknown instead of rendering the literal "STOP -".

### B2 — `feat/rider-live-navigation` (backend-heavy; codex sol xhigh in an observable cmux terminal; Claude for Flutter UI)

- **Camera-follow driving mode:** opt-in toggle on the active delivery map;
  camera tracks the animated vehicle marker, north-up ↔ heading-up.
- **Off-route detection:** client-side distance-from-active-leg-polyline
  threshold → "off route" banner + explicit "request replan" action that goes
  through the existing versioned dispatch-plan service. Routing failure
  remains a hard `routing_unavailable` 503 — no haversine fallback, ever.
- **Live rider position for the eligible customer:** rider GPS updates
  (already posted to `/riders/location`) relayed over the existing websocket
  channel **only** to the customer whose stop satisfies the existing
  `canTrackDelivery` rules (queue position 1 AND stop `on_the_way`/`arrived`).
  Later-queue customers receive nothing beyond position/size — no assignment
  id, geometry, or coordinates. Server-side gating gets dedicated unit tests.
  Customer map animates the rider marker with the same unified component.
- **Adversarial review:** Grok 4.5 reviews B2 specifically for queue-privacy
  leakage before merge; findings verified locally before acting.

### Verification (both branches)

`fvm flutter analyze lib/` + `fvm flutter test` + web build; server: lint,
build, unit + e2e where touched; destructive + visual e2e re-run; Android
emulator screenshots (`make mobile-android`) reviewed by the orchestrator.

## Phase C — Registration redesign

### Structure (7 steps → 5)

1. **Welcome/privacy** — real consent checkbox (explicit affirmative record),
   Terms link; no more implicit "Agree & Continue".
2. **Account** — full name, email, phone, password + confirm. Moves up from
   step 7: credentials early, profiling after (goal-gradient: the account
   exists sooner; profiling becomes enrichment, not a wall). Live per-field
   on-blur validation, proper email regex, unified 8-char password rule
   (also fix `auth_form.dart`'s 6), password strength meter.
3. **Nickname** — kept as the personality moment.
4. **Category + field** — combined single step; keeps the existing
   preference auto-seeding (Tesler: defaults absorb complexity).
5. **Gender + age** — combined, **skippable** ("Prefer not to say" for both);
   rationale copy explaining why it's asked.

### Visual identity

Drop the stock undraw SVGs. Distinctive print-craft direction honoring the
app's stated philosophy (monochrome dominant, yellow as disciplined accent):
grid/halftone/paper-registration motifs, Poppins display + Satoshi body kept.
Designed with the frontend-design skill; Grok UX critique of the direction
before implementation; lawsofux.com fetched and applied explicitly
(goal-gradient, Hick, Fitts ≥48dp targets, Jakob, peak-end,
aesthetic-usability).

### Beta welcome moment

After successful registration while beta mode is enabled: a reveal screen
showing the tester's beta number (from `/beta-mode/me`) and the 100 GRIDGO
credits granted — the peak-end moment the flow currently lacks. Renders only
when the API confirms enrollment; no client-side assumptions.

### Consistency

`ProfileSetupScreen` reuses the restyled field/selector components (no parallel
rewrite). Server contract unchanged — this phase is mobile-only.

### Verification

flutter analyze/test/build; emulator + mobile web screenshots reviewed;
registration exercised end-to-end against the dev stack (real `POST
/auth/register`, beta enrollment visible).

## Orchestration

- Orchestrator (this session) owns requirements, decisions, issue updates,
  final review, integration. Delegation per AGENTS.md Model Routing and the
  agent-delegation skill.
- Long-running codex implementers run in **cmux terminal panes**
  (`codex exec … |& tee <log>`) so the user can observe live; the orchestrator
  polls the log/worktree. Quick read-only verifications run headless. Grok is
  review-only, never source of truth.
- One owner per file; implementation isolated in worktrees/branches; the
  orchestrator reviews full diffs before merge.
- Destructive/visual e2e never delegated to background agents — orchestrator
  runs them against the isolated loopback stack only.

## Error handling & risks

- **Stack/e2e flakiness:** OSRM fixture and seeds are deterministic; if a live
  run fails, diagnose with systematic-debugging before touching product code —
  a red e2e is itself a Phase A finding.
- **Model availability:** routing falls back per AGENTS.md (availability wins
  over preference).
- **B2 privacy regression risk:** mitigated by server-side gating tests +
  Grok adversarial review + destructive e2e queue-privacy steps (22/23/25).
- **Scope creep:** anything discovered but not listed here goes to the
  findings register / issue tracker, not into the current branch.

## Deliverables

1. Findings register doc (committed).
2. E2E screenshot audit bundle (outside committed source).
3. F1–F5 coherence fixes merged.
4. Issue tracker reconciled (~30 issues closed or updated with evidence; new
   B1/B2/registration issues opened).
5. `feat/rider-map-uplift` and `feat/rider-live-navigation` merged.
6. Registration redesign branch merged.
7. Implementation plan doc (next step: writing-plans skill).
