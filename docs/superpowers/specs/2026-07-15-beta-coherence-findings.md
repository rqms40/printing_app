# Beta Coherence Findings — 2026-07-15

Evidence register for the Phase A audit (see
`docs/superpowers/plans/2026-07-15-beta-coherence-audit.md`). Severity:
`high` (user-facing broken/misleading), `medium` (rule invisible or datum
missing), `low` (cosmetic/dead payload), `ux` (heuristic finding from the
manual pass).

Dispositions: `fix:F1..F5`, `fix:new` (small fix this phase), `issue:#N`
(merged into existing issue), `issue:new` (new issue in Phase D), `oos`
(out of scope, noted).

| ID | Step # | Surface(s) | Severity | Evidence | Finding | Disposition |
|----|--------|-----------|----------|----------|---------|-------------|
| C1 | 13 | mobile | high | `orders_provider.dart:972-973,1038-1039`; `checkout_screen.dart:406-409`; `BetaOrderLimitSheet` has no production caller | Order-limit 403 renders raw `BetaOrderLimitException` string in a SnackBar; purpose-built sheet is dead code | fix:F1 |
| C2 | 11 | mobile | medium | `orders.service.ts:1151`; no `credits_only` reference in `apps/mobile/lib` | `beta_credits_only` 403 has no code-aware client handler; protection is prevention-only | fix:F2 |
| C3 | 2/5 | server+admin | medium | `beta-mode.service.ts:229-237` (no rank in `searchBetaMembers`); `admin/src/pages/beta-mode/index.tsx` table has no Rank column | Admin beta members table cannot show enrollment rank the system derives | fix:F3 |
| C4 | 23 | mobile | medium | `map_tracking_tile.dart:796-799` (`queueSize` unused); `:1268-1274` (client-side ETA only); server enrichment `orders.service.ts:359-372` | Queued customers never see queue size; live ETA ignores server-authoritative leg duration | fix:F4 |
| C5 | 2 | admin | low | `admin/src/pages/beta-mode/index.tsx:51,535` vs mobile `payment_method_sheet.dart:84,333` | "GRID Credits" vs "GRIDGO Credits" naming drift | fix:F5 |
| C6 | 22-25 | mobile | low | `orders.service.ts:361`, `order.dart:210`, no widget consumer | `deliveryPlanState` computed/parsed but never rendered — dead payload | issue:#87 |
| C7 | 5 | mobile | medium | Registration flow has zero beta touchpoints (auth surface report 2026-07-15); server grants 100 credits + rank silently | No enrollment/credits/beta-number moment at signup | issue:#85 (Phase C) |

<!-- Rows below this line are appended during the live audit (Tasks 2-7). -->
| C8 | — | e2e harness | medium | Visual runs 1-3 on 2026-07-15: run 1 failed at address label fill (`saveAddressThroughUi`, label saved as "Address"), run 2 timed out waiting for a dispatch response, run 3 failed with an empty focused password field (`fillNamed`) — three different failure points, all Flutter-web text-entry/network races; runs overlapped concurrent local `flutter test` load | `beta-workflow-visual.spec.ts` is load-sensitive on this machine: Flutter-web semantics fills race under CPU contention; destructive API run passed green, so product logic is unaffected | fixed: harness commits edbc96b + follow-ups (runs 6-12), final run green |
| C9 | 10 | mobile | low | Visual run 1: address created with `label: "Address"` while the label input read "Mark beta route stop" per harness fill; `address_picker_screen.dart:111-113` silently substitutes "Address" for an empty label | When the label text is lost (or user leaves it empty), the save silently falls back to the generic "Address" label with no user feedback — recents become indistinguishable | issue:#87 |
| C10 | 5-6 | e2e harness | medium | Visual run 7 (05:07 local): `beginFirstOrderTutorial` asserted /Let's print something/ while the time-of-day "Catch the next batch · missed earlier batches" dialog (`next_batch_dialog.dart:267,603`) covered home; the harness's own `closeNextBatchDialogIfShown` was not invoked on that path | The visual release gate is clock-dependent — it can only pass during hours when the next-batch dialog variant doesn't appear; fixed by closing the dialog inside `beginFirstOrderTutorial` | fix:new (harness) |
| C11 | 5-6 | mobile | ux | `next_batch_session_trigger.dart:46-66` — session dialog fires whenever the first slot fetch resolves, on any tab, at any moment (observed popping between harness actions in visual run 8) | The "Catch the next batch" modal can interrupt a customer mid-task (e.g. during checkout) because its timing is network-dependent, not context-aware; same family as closed #77 (education overlays blocking flows) | issue:#87 |
| C12 | 22-24 | mobile | ux | Screenshots 23/24 (2026-07-15 visual bundle d6d21d1b): "Rider is on the way — Tracking real-time loca…" and "Live tracking unlocks w…" truncate mid-sentence on the 393px viewport | Delivery-status copy is cut off at default mobile width — key reassurance text unreadable | issue:#87 |
| C13 | 5/21 | server seed + beta | medium | Run 9: maria@gridgo.ph auto-enrolled mid-journey (ledger BETA-ENROLLMENT:1 09:20:23), shifting Ven's rank to 3; screenshot 22 shows maria's seeded order ORD-10004/assignment #1 in Juan's live dispatch panel; idle-stack experiment proves no spontaneous enrollment; trigger observed once, not reproduced in runs 10-12 | The seeded demo customer participates in real beta flows: her seeded assignment appears in production dispatch UIs and any login as her consumes a beta rank — the documented maria-beta-exception plan (docs/superpowers/plans/2026-07-15-maria-beta-exception.md) is the fix | issue:#86 |
| V1 | 22-26 | all | pass | Screenshots 21-26: queue privacy enforced (Ven live map, Mark position-only), promotion without reload works, OSRM plan v1 persisted with per-stop ETAs in admin, saved-address label survives checkout pin flow | Core beta dispatch/privacy contract verified visually end-to-end | — |
| V2 | 27-29 | mobile | pass | Screenshots 28/29: 14-question survey (distinctive yellow smiley Likert — strong peak-end asset), success wall preserves full name (#78 fix live), share links + FOUNDING TESTER framing | Survey → testimonial → held flow coherent | — |
| A1 | 2-3 | e2e run log | info | Contract 14 passed / live preflight 2 passed / destructive 1 passed (2026-07-15, fresh loopback stack, GRIDGO_BIND_ADDR=127.0.0.1); DB evidence: 8 orders, 3 assignments, 2 survey requirements, 4 credit transactions | Non-visual modes fully green on fresh stack | — |
