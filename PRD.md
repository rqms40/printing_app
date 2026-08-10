# GRIDGO — Product Requirements Document

**Version:** 4.0  
**Status:** Active — aligned to GRIDGO-TINKER pilot blueprint  
**Market:** Davao City managed-printing pilot (Philippines)  
**Currency:** PHP (all money stored as minor units / centavos)  
**Related docs:**
- `docs/PRD_SysArchi.md` — Phase 1 system architecture
- `docs/superpowers/specs/2026-08-04-marketplace-migration-decisions.md` — frozen implementation decisions
- `docs/superpowers/plans/2026-08-04-managed-marketplace-migration.md` — migration plan
- `C:\Mobile_App\GRIDGO-TINKER\` — product, ops, UX, and research source package

> This document is the implementation product source of truth for GRIDGO as a **managed printing marketplace**. It supersedes earlier PRD versions that described a single-shop customer / rider / admin print-and-deliver app with open top-up credits and live multi-payment checkout.

### Implementation stack note

The Davao pilot ships on the **existing** NestJS + TypeORM + PostgreSQL API, Flutter mobile app, and Refine/Ant Design admin—not a rewrite. Supabase, React Native, and related target diagrams in architecture docs remain a **future platform option**. Locked engineering choices (roles, statuses, COD/credits, admin split, beta coexistence) live in `docs/superpowers/specs/2026-08-04-marketplace-migration-decisions.md`.

---

## 1. Executive summary

**GRIDGO** is a Davao City-first **B2B managed printing marketplace**. It connects businesses, organizations, and teachers to **vetted print suppliers** and controlled last-mile delivery through one accountable workflow:

**structured request → mandatory artwork QA → verified supplier matching → payment authorization → production + self-QC → tracked rider delivery → 24-hour issue window → audited payout**

GRIDGO **matches** suppliers; clients do **not** browse bids or choose printers. Businesses, organizations, and teachers are **client-account metadata** (pricing, catalog, reporting, marketing)—not separate product workflows.

### Positioning

**GRIDGO makes business printing dependable:** one structured request, technical artwork QA, a verified print partner, tracked delivery, and one support owner.

Do **not** position GRIDGO as “the cheapest printer,” promise exact turnaround before product/artwork/capacity/route are confirmed, or claim free live digital payments during the free pilot.

### Pilot proposition

| Pillar | Rule |
|--------|------|
| Curated supply | Verified suppliers only; no open marketplace bidding |
| Mandatory Ops QA | Supplier Operations Admin approves artwork and feasibility **before** matching |
| Committed price/date | Supplier accepts final price and promised date before production authorization |
| Pilot payments | **Pilot Credits** (Ops-granted test instrument) + limited **COD ≤ ₱1,500** |
| Quality gates | Supplier self-QC evidence required before rider dispatch |
| Protected settlement | Delivery proof → 24h issue window; timely issue freezes payout; COD recon before payout |
| Privacy-safe tracking | Exact rider location only during active authorized trip after pickup |

### MVP goal

Ship a Davao pilot that can run real structured print jobs end-to-end with five roles, dual Light/Dark themes, Pilot Credits + constrained COD, Ops QA, supplier self-QC, rider proof, claims/payout holds, and immutable audit—without live digital collection and without open supplier bidding.

---

## 2. Vision, mission, principles

### Vision

To be the dependable digital printing partner for Philippine businesses—making the path from final artwork to delivered print predictable, accountable, and local-first.

### Mission

Replace fragmented Messenger, call, and walk-in print coordination with a managed marketplace: structured specs, artwork QA, verified suppliers, authorized production, tracked delivery, and one support path.

### Core principles

1. **Managed marketplace, not open directory** — GRIDGO owns intake, QA, matching, authorization, dispatch visibility, claims, and settlement controls.
2. **Shared order truth, role-appropriate detail** — one order state machine; each role sees only authorized data and actions.
3. **Server-side authorization** — RLS, signed storage, private realtime topics; UI hiding is never the only control.
4. **Payment before production** — production starts only after Pilot Credit authorization or eligible COD approval for collection.
5. **Evidence over assumption** — QA decisions, self-QC, pickup/delivery proof, COD collection, claims, and payout holds are evidence-backed and audited.
6. **One clear next action** — status-led UI; every blocked state explains reason and recovery.
7. **Theme parity** — Light and Dark are equivalent presentations; permissions and workflows are identical.
8. **Davao pilot discipline** — no zone, category, or payment expansion until reconciliation, privacy, claims, support, and SLAs are stable.

---

## 3. Target users and roles

### 3.1 Client (mobile)

- **Who:** Local SMEs and marketing teams; schools, organizations, and event coordinators; multi-branch local businesses that reorder.
- **Account types (metadata only):** business, organization, teacher.
- **Goals:** Structured print request, final artwork upload, QA/proof action, product preview mockup, pay with Pilot Credits or eligible COD, track active delivery, report material issues within 24 hours, reorder successful jobs.
- **Pain points today:** Shop visits / Messenger / calls; bad file feedback late; unclear price and status; no single support owner.
- **Cannot:** Choose suppliers; see other accounts or inactive rider locations; purchase, transfer, or withdraw Pilot Credits.

### 3.2 Supplier (responsive portal + lightweight mobile)

- **Who:** Verified Davao print partners (signage, digital/large-format, apparel, packaging, etc.).
- **Goals:** Accept/decline assigned jobs with SLA; commit final price and promised date; produce against approved artwork/spec; submit self-QC; hand off to rider; view payout status.
- **Portal vs mobile:** Portal = detailed jobs, capacity, financial history, settings. Mobile = time-sensitive alerts, accept/decline, production updates, self-QC evidence, pickup handoff, payout notices.
- **Cannot:** Access unapproved files, other suppliers, matching controls, or finance policy controls.

### 3.3 Rider (mobile)

- **Who:** Verified delivery riders for supplier pickup and client drop-off in Davao service zones.
- **Goals:** Accept dispatch; navigate; share active-trip location; submit pickup/delivery/COD/failure proof; document returns.
- **Cannot:** Access unrelated orders/history; override payouts or claims; complete unattended drop-off.

### 3.4 Supplier Operations Admin (web)

- **Who:** Marketplace operations staff—the mandatory gatekeeper before any client submission reaches a supplier.
- **Goals:** QA/preflight queue and workspace; correction/proof loops; supplier matching; quality recovery; live dispatch map; claims and payout holds; SLA management; order audit timeline.
- **Cannot:** Make unaudited policy or finance overrides; skip the normal QA gate.

### 3.5 Super Admin (web)

- **Who:** Platform governors (policy, verification, catalog, finance approvals, audit).
- **Goals:** Verify suppliers/riders; configure roles, catalog, zones, fees, commissions, pilot policy; grant Pilot Credits; COD reconciliation; payout/refund approval; reporting and audit access.
- **Does not** replace the Supplier Operations QA gate on individual jobs.

### Ideal customer profiles (launch)

| ICP | Needs |
|-----|--------|
| Local SMEs / marketing teams | Recurring flyers, cards, brochures, store signage, stickers, campaign materials |
| Schools / orgs / event coordinators | Deadline-bound tarps, shirts, certificates, bulk handouts |
| Multi-branch local businesses | Standardized reorders, delivery visibility, invoices, single support owner |

---

## 4. Pilot scope

### 4.1 In scope

**Catalog (Davao City service zones only)**
- Banners / tarpaulins
- Stickers
- Brochures / flyers
- Business cards
- Simple apparel
- School / event materials

**Platform capabilities**
- Five-role experiences (Client, Supplier, Rider, Ops Admin, Super Admin)
- Structured print request with final artwork upload
- Mandatory Ops artwork QA / preflight and proof approval path
- Product Preview (visual mockup only; never production source)
- Verified supplier matching and assignment SLA
- Pilot Credits ledger (grant / reserve / spend / release / expire / manual_adjustment)
- Limited COD with server-side eligibility and reconciliation
- Supplier production milestones and self-QC evidence
- Rider dispatch, navigation, active-trip tracking, pickup/delivery/COD/failure proof
- 24-hour material print/delivery issue window and payout freeze
- Immutable audit timeline for controlled events
- Light Mode and Dark Mode theme parity
- Auditable in-order support thread (client–supplier interaction stays on-platform)

### 4.2 Out of scope (pilot)

- Graphic design services or silent artwork content edits
- Open supplier directory, browsing, or bidding
- Nationwide or multi-city delivery
- Subscriptions and complex procurement workflows
- **Actual credit purchase, top-up, cash-out, transfer, or withdrawal**
- **Live digital payment collection** (PayMongo is sandbox-only until pilot approval)
- Unattended drop-off as successful completion
- Client-selectable free-text “express” override of matching policy without Ops rules
- Hardware / remote printer node control (future consideration only)

### 4.3 Research basis (directional)

Internal survey: 3 suppliers, 12 business clients.
- Suppliers: bad files, late payment, poor communication, unrealistic deadlines; require print-ready high-res/PDF, approvals, down payment; bulk ~1–2 working days.
- Clients: flyers and signage first; quality and price top factors; order quarterly/monthly; currently in-person / Messenger / phone.
- Full evidence and source register: GRIDGO-TINKER `Deliverables/GRIDGO_Research_and_Execution_Book.md`.

---

## 5. Order state machine and mandatory gates

### 5.1 Happy path

```text
draft
→ submitted
→ needs_qa
→ client_correction | proof_approval
→ approved_for_matching
→ supplier_assigned
→ supplier_accepted
→ awaiting_payment
→ payment_authorized
→ production
→ supplier_self_qc
→ ready_for_dispatch
→ rider_assigned
→ picked_up
→ out_for_delivery
→ delivered
→ issue_window_open
→ completed
→ payout_released
```

### 5.2 Payment vs collection states

| Concept | Meaning |
|---------|---------|
| `payment_authorized` | Pilot Credits reserved/spent **or** eligible COD approved for collection |
| `cash_collected` | Rider collected exact COD cash with proof |
| `cash_reconciled` | Ops/finance reconciled cash before supplier payout |

`payment_authorized` **does not** mean COD cash is in hand.

### 5.3 Mandatory gates

1. **Verify** suppliers and riders (identity/business, capability, capacity, zone, payout details, agreements) before assignment.
2. **QA every submission** before matching: product compatibility, dimensions, material, quantity, finish, bleed, resolution, color mode, safe area, deadline realism, address, Davao zone eligibility. Suppliers never see unapproved files.
3. **Match only** verified eligible suppliers; record ranking and acceptance SLA.
4. **Authorize payment** (Pilot Credits or eligible COD) before production; for COD, collect and reconcile cash before supplier payout.
5. **Require supplier self-QC evidence** before rider dispatch.
6. **Start 24-hour issue window** only after delivery/collection proof; freeze payout on timely issue.
7. **Start exact live tracking** only after confirmed pickup; stop at delivery, failure, or cancellation.

### 5.4 Exception paths

| Exception | Required behavior |
|-----------|-------------------|
| Artwork rejection / correction | Precise checklist; preserve versions; block matching until approved |
| Flagged proof | Client must approve proof; no advance without approval |
| Supplier decline / SLA timeout | Record reason; release capacity; re-rank; reassign; communicate revised date only when confirmed |
| Unpaid accepted assignment | At 24 hours release capacity and restart matching |
| Client cancellation before production | Ops confirms production not started; full refund/release per policy |
| Cancellation after production | Written exception policy |
| Pre-pickup defect | Supplier-funded reprint under recovery SLA; Ops may reassign if recovery fails |
| Failed pickup / delivery / collection | Time-stamped evidence; return to supplier/approved holding; notify Ops; block completion/payout as applicable; paid redelivery only after new fee + eligibility |
| Timely material issue (≤24h) | Freeze payout; capture evidence; refund/reprint/adjustment; audited release |
| Late issue | Escalation path for documented platform error only |
| Terminal outcomes | **Collected by customer** and **Delivered** are separate outcomes |

Unattended drop-off is **prohibited**.

---

## 6. Required role flows

### 6.1 Client

```text
Catalog / reorder
→ Structured request
→ Artwork upload
→ QA correction / proof
→ Compatible Product Preview (mockup only)
→ Supplier confirmation (price + promised date)
→ Pilot Credits or eligible COD (within 24h)
→ Production visibility
→ Tracking after pickup
→ Delivery proof
→ Issue window (24h)
```

### 6.2 Supplier

```text
Assignment alert
→ Inspect approved spec + artwork
→ Accept / decline (commit final price + promised date)
→ Wait for payment authorization
→ Production milestones
→ Self-QC evidence
→ Pickup handoff
→ Payout notice
```

### 6.3 Rider

```text
Delivery offer
→ Accept
→ Navigate to supplier
→ Pickup OTP + photo proof
→ Active location sharing ON
→ Navigate to client
→ COD collection when required
→ Delivery OTP / photo / signature / receipt
→ OR failed-delivery evidence + return
→ Stop sharing
```

### 6.4 Supplier Operations Admin

```text
Overview
→ QA queue / workspace
→ Correction or proof decision
→ Supplier matching
→ SLA / quality recovery
→ Live dispatch map
→ Claims / payout hold-release
→ Audit timeline
```

### 6.5 Super Admin

```text
Platform health
→ Verify suppliers / riders
→ Roles & policy
→ Catalog / zones / fees / commissions
→ Pilot Credit grants
→ COD reconciliation
→ Finance / payout / refunds
→ Audit access
```

---

## 7. Feature requirements by domain

### 7.1 Identity, verification, and RBAC

- Auth for all five roles with role-scoped sessions.
- Client account metadata: business / organization / teacher (does not fork workflows).
- Supplier and rider verification records before any assignment.
- Super Admin manages roles (including optional support/finance/auditor/view-only sub-roles as policy allows).
- Authorization enforced server-side (RLS + storage policies + private channels).

### 7.2 Catalog and structured request

- Configurable catalog for pilot product families.
- Structured fields: product type, dimensions, material, quantity, finish, color/sides, deadline, delivery address, artwork requirements.
- Reorder from successful historical jobs (snapshot-based).
- Service zone eligibility checked at request time.

### 7.3 Artwork, QA, and Product Preview

**ArtworkFile**
- Versioned uploads with filename, MIME, dimensions, resolution, color mode, bleed, preflight status, QA comments, proof status, approved timestamp.
- Signed/private access; malware scan path required.

**QualityReview (Ops)**
- Checklist results, decision, risk level, correction request, proof-required flag, evidence, timestamps.
- Decisions: needs correction, proof approval, approved for matching, blocked.

**ArtworkMockupRender (Product Preview)**
- Compatible templates: flyer, tarp/banner, signage, T-shirt (and other configured product templates).
- Fields: artworkFileId, productType, templateVersion, renderStatus, renderUrl, createdAt, expiresAt, failureReason.
- **Never** the production source of truth. UI must label: *“Visual mockup — not print-ready proof.”*
- Version/invalidate when artwork or product changes.

### 7.4 Matching and supplier assignment

- Rank eligible suppliers by verified capability, location, capacity, lead time, quality, acceptance rate, commercial terms.
- Record candidate ranking, assignee, acceptance deadline, decision/reason, final price, promised date.
- Client-facing copy: **“Matching you with a verified printer.”** (not “Looking for Service Provider”).
- Unconfirmed assignment expires after **24 hours** (capacity release + re-match).

### 7.5 Pilot Credits

Pilot Credits are a **free test instrument**—not stored value, not a wallet, not a payment product.

| Rule | Requirement |
|------|-------------|
| Grant | Ops / Super Admin only, to verified pilot clients |
| UI language | **Pilot Credits** or **Test Credits** only |
| Forbidden UI | “Top Up,” “Cash Out,” “Transfer,” purchase, withdraw |
| Properties | Non-cash, non-transferable, non-withdrawable, non-purchasable |
| Ledger events | `grant`, `reserve`, `spend`, `release`, `expire`, `manual_adjustment` |
| Units | PHP minor units |
| Audit | Actor, reason, balance before/after, expiry, order, idempotency key, audit link |
| Authorization | Confirmation reserves/spends idempotently |
| Visibility | Account owner + authorized Ops/finance |

### 7.6 Cash on Delivery (limited exception)

| Rule | Requirement |
|------|-------------|
| Who | Verified pilot clients only |
| Cap | Final total **including delivery fee and approved adjustments ≤ ₱1,500** |
| Concurrency | **One** active unpaid COD order per client (server-enforced) |
| Rejection | ₱1,501+ rejects COD even if UI is manipulated |
| Above cap | Sufficient Pilot Credits only; no live online payment in pilot |
| Rider proof | Exact cash + OTP + photo/receipt |
| Failure | Not completion: evidence, return, notify Ops, block payout |
| Redelivery | New approved delivery fee + eligibility review |
| Payout | Requires collection **and** Ops/finance reconciliation |
| Overrides | Reasoned, timestamped, actor-attributed audit events |

### 7.7 Future PayMongo adapter

- Pilot: **sandbox only** (sessions/callbacks/webhooks for integration testing—not actual collection).
- Marketing/product must not claim free live payments.
- Future live mode: hosted checkout, server-created intents, signed webhooks, idempotency, immutable payment events, reconciliation.
- Never store card details; never release production or payout from unverified browser redirect alone.
- Refund/disbursement separately configured and reviewed.

### 7.8 Production and supplier self-QC

- Production blocked until `payment_authorized`.
- Milestones visible to authorized roles (accepted → materials/setup → in production → complete → ready for pickup).
- Self-QC evidence required (photos/checklist per product policy) before dispatch readiness.
- Pre-pickup defect → supplier-funded reprint + recovery SLA escalation.

### 7.9 Dispatch, maps, and privacy

**Maps stack (adapter: `NavigationService`)**
- Google Maps display
- Routes API for ETA / dispatch comparison
- Navigation SDK for rider guidance
- Billing, quotas, and budget alerts are launch requirements

**Location sharing rules**
- Exact position only after confirmed pickup
- Visible only to: assigned rider, client on active order, assigned supplier while awaiting pickup (as policy), authorized Ops
- Stop immediately at delivery, failure, or cancellation
- Cadence: **10s** foreground / **30s** background + immediate lifecycle events
- Show active-sharing indicator; consent for foreground/background location; offline/poor-signal honesty
- Independently collected trip history: **90 days**, then delete/aggregate
- Google-derived Routes coordinates: separate retention/attribution rules (do not confuse with GRIDGO trip history)

### 7.10 Delivery proof, issues, and claims

- Delivery proof: OTP and/or photo/signature/receipt per policy.
- Opens **24-hour** material print/delivery issue window.
- Timely issue freezes supplier payout until documented resolution.
- Client-approved content errors and change-of-mind are **not** supplier-fault claims by default.
- Issue record: category, evidence, deadlines, decision, refund/reprint/adjustment, payout impact, actors, timestamps.

### 7.11 Payouts and finance controls

- Payout entity: supplier/order, gross/commission/net minor, hold reason/expiry, release authority, settlement state/reference.
- Holds: open issue window issue, missing COD recon, quality claim, manual Ops hold.
- Super Admin / authorized finance: payout approval, refunds, manual adjustments—all audited.
- All money PHP minor units; immutable snapshots of price, delivery fee, commission, specs, artwork version, promised date at authorization points.

### 7.12 Support and notifications

- Keep client–supplier communication in the **auditable order-support thread**.
- Notifications for QA correction, proof required, supplier accept, payment deadline, production milestones, dispatch, delivery, issue outcomes, payout events.
- No essential workflow that depends on color alone; status always icon + label.

### 7.13 Super Admin configuration

- Platform health overview
- User roles and verification queues
- Catalog, service zones (Davao map polygons), delivery fees, commission rules
- Pilot Credit grant tools
- COD reconciliation workspace
- Payout approval / refunds / audit log
- Policy settings (SLA timers, COD enablement, risk flags)

---

## 8. UX and design requirements

Full visual system: GRIDGO-TINKER `05_UX_Mockups/GRIDGO_Design_Requirements_Document.md`.

### 8.1 Platforms and viewports

| Experience | Platform | Notes |
|------------|----------|--------|
| Client | React Native / Expo dev builds | Phone 360–430 dp, portrait-first |
| Rider | React Native / Expo dev builds | Thumb-reachable active-trip controls; background location needs dev builds (not Expo Go) |
| Supplier mobile | React Native / Expo | Time-sensitive actions only |
| Supplier portal | Next.js responsive web | 360 / 768 / 1024 / 1440+ breakpoints |
| Ops / Super Admin | Next.js web | Dense multi-panel from 1024+; tablet supported |

### 8.2 Theme parity

- **Light Mode** and **Dark Mode** are equal products of the same IA.
- System preference + in-app override.
- Semantic design tokens only (no hard-coded theme colors in screens).
- Yellow action budget: **one primary CTA / current step / active nav / map route** per context—not yellow grids of row buttons in dense tables.

### 8.3 Key UX rules

- One clear next action for the current state
- Show reason and consequence for blocks (QA fail, COD ineligible, SLA countdown, payout hold)
- 44×44 px minimum touch targets on mobile
- WCAG 2.2 AA contrast for text and actionable controls
- Product Preview never presented as print-ready proof
- Pilot Credits / COD panels use pilot terminology only

### 8.4 Required screen groups (both themes)

| Role | Screen groups |
|------|----------------|
| Client | Catalog/reorder, structured request, artwork upload, QA correction/proof, Product Preview, payment selection, active tracking, issue/order history |
| Supplier | Portal job inbox/workspace, production/self-QC, handoff, capacity/payout; mobile alert, accept/decline, status/self-QC, handoff, payout notice |
| Rider | Offer, navigation/sharing, pickup proof, delivery/COD proof, failed-delivery return |
| Ops Admin | Overview, QA queue/workspace, correction/proof, matching, quality recovery, dispatch map, claims/payout holds, audit timeline |
| Super Admin | Overview, verification, roles, catalog/zones/fees, Pilot Credits, finance/reconciliation, policy/audit |

---

## 9. Technology direction (pilot)

| Layer | Planned technology |
|-------|--------------------|
| Client, Rider, Supplier mobile | React Native + Expo development builds |
| Supplier portal, Ops, Super Admin, public web | Next.js responsive web |
| Backend platform | Supabase: PostgreSQL, Auth, Storage, Realtime, Edge Functions, PostGIS |
| Shared contracts | TypeScript types, tokens, validation shared across clients—not every UI component |
| Maps / navigation | Google Maps Platform, Routes API, Navigation SDK behind `NavigationService` |
| Future payments | PayMongo sandbox in pilot; hosted checkout only after pilot approval |

### Edge Function ownership (controlled writes)

Edge Functions own: assignment, payment authorization/webhook, credit change, location ingest, claims, payout release, scheduled SLA work. Repeating controlled writes use **idempotency keys**.

### Security baseline

Role-scoped access, signed artwork access, malware scan, consent-based location, encrypted secrets, idempotent payment/location writes, provider webhooks, reconciliation controls, immutable audit events.

> Detailed architecture, entity fields, service boundaries, and acceptance mapping: `docs/PRD_SysArchi.md`.

---

## 10. Data requirements (summary)

Key entities: `User`, `Role`, `Organization`, `Address`, `SupplierVerification`, `SupplierCapability`, `ProductSpecification`, `ArtworkFile`, `ArtworkMockupRender`, `QualityReview`, `SupplierAssignment`, `Quote`, `Order`, `OrderItem`, `Payment`, `PilotCreditLedgerEntry`, `CODCollection`, `Payout`, `DeliveryJob`, `DeliveryLocationPing`, `DeliveryProof`, `Issue`, `Notification`, `StatusEvent`, `AuditEvent` / `AuditLog`.

| Entity | Critical rules |
|--------|----------------|
| `Order` | Client/org, state, promised date, final total minor, delivery fee minor, payment method/authorization, COD eligibility, immutable price/spec/artwork snapshots |
| `Payment` | Method `pilot_credit` \| `cod` \| future `paymongo`; authorization/collection/reconciliation status |
| `PilotCreditLedgerEntry` | Event, amount, balances, actor, reason, expiry, order, idempotency/audit |
| `CODCollection` | Eligibility, amount, rider, OTP/photo/receipt, collected/failed/reconciled times, discrepancy/return |
| `Payout` | Gross/commission/net, hold reason/expiry, release authority, settlement |
| `ArtworkMockupRender` | Never production source |
| `DeliveryLocationPing` | Job, rider, lat/lng, accuracy, heading, speed, recorded/received, source, GPS status |

Audit every QA, assignment, payment/credit/COD, production, location-access, claim, refund, payout, and override event.

---

## 11. Acceptance criteria

### Workflow gates
- [ ] Client cannot reach matching or production before Ops QA approval
- [ ] Flagged work cannot advance without proof approval
- [ ] Supplier sees only approved assigned work
- [ ] Supplier cannot produce before payment authorization
- [ ] Unconfirmed assignment expires after 24 hours and releases capacity
- [ ] Pre-pickup defect enforces supplier-funded reprint + recovery path

### Payments
- [ ] Pilot Credits cannot be purchased, transferred, withdrawn, or treated as cash
- [ ] All credit ledger changes balance and audit with idempotency
- [ ] COD restricted server-side: verified client, one active unpaid order, final total ≤ ₱1,500
- [ ] Failed COD collection creates proof/return and blocks payout
- [ ] Successful COD + reconciliation required before supplier payout
- [ ] PayMongo remains sandbox-only until explicit pilot approval for live collection

### Delivery and claims
- [ ] Live tracking is active-trip-only, role-limited, starts at pickup, stops at terminal state
- [ ] Stale / offline location is reported honestly
- [ ] Failed delivery records evidence and return; redelivery charges a new fee; unattended completion impossible
- [ ] Timely (≤24h) issue freezes payout; resolution path is audited
- [ ] “Collected by customer” and “Delivered” are distinct outcomes

### UX and access
- [ ] All roles have Light and Dark coverage with identical workflows/labels
- [ ] Yellow is one primary action/current state per context; dense portals are not yellow grids
- [ ] Product Preview is visibly non-production
- [ ] Authorization cannot be bypassed by UI manipulation
- [ ] Mobile controls meet 44 px; Supplier portal works at 360 / 768 / 1024 / 1440

### Reconciliation
- [ ] Client total, delivery fee, commission, supplier net, refunds, and manual adjustments reconcile

---

## 12. Launch measures and gates

### KPIs

- Request → authorized-order conversion
- QA correction rate and time-to-approval
- Supplier acceptance rate and response SLA
- Production on-time rate; first-pass self-QC yield
- Pickup/delivery on-time rate; stale/off-route incidents
- COD collection and reconciliation accuracy
- Issue / reprint / refund rate; payout-hold aging
- Repeat order rate; contribution margin per completed order

### Expansion gates

Do **not**:
- Expand zones until service levels, supplier coverage, claims trend, recon accuracy, and support response are stable
- Add categories without preflight rules, capacity data, pricing config, quality criteria, and recovery policy
- Run paid scale campaigns until end-to-end flow, recon, live-tracking privacy, and claims process are proven on pilot jobs

---

## 13. Out-of-scope marketing claims

Avoid: “cheapest,” “guaranteed fastest,” unconditional “same-day,” “error-free artwork,” exact ETA before dispatch, unlicensed wallet/payment claims. Do not show client artwork, addresses, rider location, supplier internals, or financial records without authorization.

---

## 14. Glossary

| Term | Definition |
|------|------------|
| **Managed marketplace** | GRIDGO matches and governs supply; clients do not bid on suppliers |
| **Client** | Business / organization / teacher account placing print requests |
| **Supplier** | Verified print partner that produces approved jobs |
| **Supplier Operations Admin (Ops)** | Mandatory QA, matching, dispatch, claims, payout-hold operator |
| **Super Admin** | Platform policy, verification, catalog/zones, finance approvals, audit |
| **Pilot Credits / Test Credits** | Ops-granted non-cash pilot instrument; not a wallet |
| **payment_authorized** | Credits reserved/spent or COD approved for collection—not cash in hand |
| **COD** | Cash on Delivery; pilot exception capped at ₱1,500 final total |
| **Product Preview** | Non-production visual mockup of artwork on a product template |
| **Self-QC** | Supplier evidence required before dispatch readiness |
| **Issue window** | 24 hours after delivery proof for material print/delivery claims |
| **Payout hold** | Settlement blocked pending issue, recon, quality, or manual Ops decision |
| **Active-trip tracking** | Exact location only after pickup until terminal state |
| **PHP minor units** | Centavos; canonical storage unit for all money |

---

## 15. Document control

| Item | Value |
|------|--------|
| Version | 4.0 |
| Supersedes | PRD v3 and earlier single-shop / greyscale-credit-top-up PRDs |
| Architecture companion | `docs/PRD_SysArchi.md` |
| External blueprint package | `C:\Mobile_App\GRIDGO-TINKER\` |
| Design system | TINKER `05_UX_Mockups/GRIDGO_Design_Requirements_Document.md` |
| Ops playbooks | TINKER `02_Business_Operations/Operations_Playbooks.md` |
| Research register | TINKER `Deliverables/GRIDGO_Research_and_Execution_Book.md` |

This document is product guidance for engineering and operations. It is **not** legal, tax, insurance, employment, or payment-licensing advice. Obtain local professional review for permits, privacy (Data Privacy Act), rider/supplier agreements, insurance, receipts, and payment responsibilities before public launch.

---

*GRIDGO PRD v4.0 — Davao City managed-printing marketplace pilot.*
