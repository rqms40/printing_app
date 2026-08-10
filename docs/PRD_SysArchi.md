# GRIDGO — Product Requirements Document  
## Phase 1 System Architecture

**Version:** 2.0  
**Status:** Active — aligned to GRIDGO-TINKER pilot blueprint  
**Product companion:** `PRD.md` (v4.0)  
**Target market:** Davao City B2B managed-printing pilot  
**Scope:** System architecture for roles, services, data, security, maps, payments, and acceptance

> This document defines **how** GRIDGO is structured for the pilot. Product behavior and acceptance rules live in root `PRD.md`. Both supersede earlier Phase 1 notes that described a single-shop operational engine with CSV-only finance and tentative top-up credits.

---

## 1. Product architecture overview

GRIDGO is a **managed printing marketplace**, not an open supplier directory and not a single print-shop queue app.

### Implementation stack note

**Pilot delivery** uses the current monorepo stack: NestJS + TypeORM + PostgreSQL API, Flutter (Client / Rider / Supplier lite), Refine admin (Ops + Super Admin + supplier portal routes), MinIO, WebSockets, and OSRM—evolved in place per the managed marketplace migration plan. The diagram below describes the **product architecture model** (and a possible future Supabase / React Native platform); it is **not** a mandate to rewrite before pilot. Frozen implementation decisions: `docs/superpowers/specs/2026-08-04-marketplace-migration-decisions.md`.

```text
┌──────────────────────────────────────────────────────────────────────┐
│                         GRIDGO PILOT PLATFORM                        │
├──────────────────┬───────────────────┬───────────────────────────────┤
│  Mobile (RN)     │  Responsive Web   │  Supabase Platform            │
│  • Client        │  • Supplier portal│  • Auth + RBAC + RLS           │
│  • Rider         │  • Ops Admin      │  • PostgreSQL + PostGIS        │
│  • Supplier lite │  • Super Admin    │  • Storage (signed artwork)    │
│                  │  • Public web     │  • Realtime (private topics)   │
│                  │                   │  • Edge Functions (writes)     │
├──────────────────┴───────────────────┴───────────────────────────────┤
│  NavigationService  │  Pilot Credits ledger  │  COD recon  │  Audit  │
│  Google Maps / Routes / Navigation SDK                              │
│  Future: PayMongo hosted checkout (sandbox in pilot)                │
└──────────────────────────────────────────────────────────────────────┘
```

### Vision (architecture implication)

Dependable local print fulfillment requires **server-authoritative gates**: QA before matching, payment authorization before production, self-QC before dispatch, proof before issue window, reconciliation before COD payout.

### Mission (architecture implication)

One shared order truth across five roles; each surface renders only authorized slices. Edge Functions own high-risk mutations; clients never self-elevate state.

---

## 2. Strategic roadmap (Phase 1)

| Step | Stage | Architecture outcome |
|------|-------|----------------------|
| 1 | Concept | Market problem, managed-marketplace model, pilot constraints |
| 2 | **System architecture** | Roles, state machine, services, data model, security, maps (this doc + `PRD.md`) |
| 3 | UX & dual-theme package | Light/Dark mockups, design tokens, screen groups (TINKER `05_UX_Mockups`) |
| 4 | Core platform build | Supabase schema/RLS, Edge Functions, RN apps, Next.js portals |
| 5 | Pilot operations | Verified suppliers/riders, Pilot Credits grants, COD recon, audit |
| 6 | Stabilize & gate expansion | KPI review before zones, categories, or live PayMongo |

Phase 1 does **not** expand beyond Davao City configured service zones.

---

## 3. Experiences and client surfaces

### 3.1 Native mobile (React Native + Expo development builds)

| App surface | Primary use | Notes |
|-------------|-------------|--------|
| Client | Catalog, request, artwork, QA/proof, Product Preview, payment, tracking, issues | Portrait phone-first |
| Rider | Offer, navigation, proofs, COD, failure/return | Background location requires **dev builds**, not Expo Go |
| Supplier mobile | Alerts, accept/decline, milestones, self-QC, handoff, payout notice | Time-sensitive only |

### 3.2 Responsive web (Next.js)

| Surface | Primary use | Breakpoints |
|---------|-------------|-------------|
| Supplier portal | Full job workspace, capacity, payouts, settings | 360 / 768 / 1024 / 1440+ |
| Supplier Operations Admin | QA, matching, recovery, dispatch, claims, holds | Dense from 1024+ |
| Super Admin | Verification, catalog/zones/fees, credits, finance, audit | Dense from 1024+ |
| Public web | Marketing, zone/service education, request CTA | Responsive |

### 3.3 Theme architecture

- Light Mode and Dark Mode share **identical** IA, permissions, routes, and states.
- Semantic tokens via shared package (e.g. `packages/design-tokens`) with RN + CSS adapters.
- `action-yellow` (`#FFDE58`) is a finite attention budget: one primary CTA / current step / active nav / map route per context.

---

## 4. Role architecture and authorization

### 4.1 Primary roles

| Role | Responsibility | Hard limits |
|------|----------------|-------------|
| **Client** | Request, artwork, QA/proof action, permitted payment, track active delivery, 24h issue | No supplier choice; no inactive location; no credit purchase/transfer/withdraw |
| **Supplier** | Accept assigned work, commit price/date, produce, self-QC, handoff | No unapproved files; no other suppliers; no matching/finance policy |
| **Rider** | Accept job, navigate, proofs, COD collect, return on failure | No unrelated orders; no payout/claim override |
| **Supplier Operations Admin** | Mandatory QA, proof, matching, recovery, dispatch, claims, payout holds | No unaudited finance/policy overrides |
| **Super Admin** | Verification, catalog/zone/policy, Pilot Credit grants, COD recon, finance/audit | Does **not** remove the normal Ops QA gate |

Optional Super Admin–managed sub-roles (support, finance, auditor, view-only) may exist for access partitioning; they do not change the five primary product roles.

### 4.2 Authorization model

| Layer | Mechanism |
|-------|-----------|
| Identity | Supabase Auth |
| Data access | PostgreSQL **Row Level Security** |
| Artwork files | Signed Storage URLs; private buckets |
| Live channels | Private Realtime topics scoped to active job + authorized principals |
| High-risk writes | Edge Functions only (assignment, credits, payment auth, location ingest, claims, payout release, SLA jobs) |
| UI | Hides unauthorized actions for UX; **never** sole control |

Client account types **business / organization / teacher** are metadata columns/flags—not separate authorization graphs.

---

## 5. Domain services

| Service | Owns |
|---------|------|
| **Identity / RBAC** | Users, roles, sessions, verification status, consent records |
| **Catalog / specification** | Product families, configurable fields, zone eligibility rules |
| **Artwork storage / preflight** | Versioned files, MIME/size limits, malware scan hooks, technical preflight signals |
| **Artwork mockup rendering** | Product Preview templates; invalidation on artwork/product change |
| **Order orchestration** | State machine transitions, snapshots, exception paths |
| **Matching** | Candidate ranking, assignment SLA, accept/decline, re-rank |
| **Payments / ledger** | Pilot Credits ledger, COD eligibility, payment authorization, future PayMongo adapter |
| **Dispatch / location** | Delivery jobs, rider assignment, pings, ETA, tracking start/stop |
| **Notifications** | Push/email/in-app events for role-relevant state changes |
| **Disputes / claims** | Issue window, evidence, freeze/release, refund/reprint decisions |
| **Reporting** | Ops KPIs, Super Admin platform health (non-wallet analytics) |
| **Immutable audit** | Controlled-event timeline (QA, assignment, payment, production, location access, claim, refund, payout, override) |
| **NavigationService** | Adapter over Google Maps display, Routes API, Navigation SDK |

### Edge Function write owners

Must run server-side with idempotency keys where repeats are possible:

1. Supplier assignment / reassignment  
2. Payment authorization / webhook handling  
3. Pilot Credit grant / reserve / spend / release / expire / manual adjustment  
4. Location ping ingest and tracking lifecycle  
5. Claims open / resolve and payout hold/release  
6. Scheduled SLA expiry jobs (assignment timeout, payment timeout, issue window close)  
7. COD reconciliation state transitions  

---

## 6. Order state machine (system view)

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
→ delivered                 # or collected_by_customer (separate terminal path)
→ issue_window_open
→ completed
→ payout_released
```

### 6.1 Gate enforcement points

| From → To | Gate owner | Rule |
|-----------|------------|------|
| `submitted` → `needs_qa` | Orchestration | Structured spec + artwork present |
| `needs_qa` → matching path | Ops QA | Pass / proof approve only; corrections block |
| `approved_for_matching` → `supplier_assigned` | Matching | Verified eligible suppliers only |
| `supplier_assigned` → `supplier_accepted` | Supplier | Accept with final price + promised date inside SLA |
| `supplier_accepted` → `payment_authorized` | Payments | Pilot Credits reserve/spend **or** eligible COD approved |
| any → `production` | Orchestration | Requires `payment_authorized` |
| `production` → `ready_for_dispatch` | Supplier + policy | Self-QC evidence accepted |
| `picked_up` | Rider + dispatch | Pickup proof; **start** exact tracking |
| `delivered` / failure / cancel | Rider + dispatch | Terminal proof; **stop** tracking |
| `delivered` → `issue_window_open` | Claims | Open 24h material issue window |
| timely issue | Claims + payout | **Freeze** payout |
| COD payout | Finance | `cash_collected` + `cash_reconciled` required |

### 6.2 Payment state vs collection state

| State | Meaning |
|-------|---------|
| `payment_authorized` | Credits reserved/spent **or** COD approved for collection |
| `cash_collected` | Rider collected exact cash with proof |
| `cash_reconciled` | Ops/finance reconciled cash |

Do not collapse these into one boolean.

### 6.3 SLA timers (scheduled)

| Timer | Default pilot rule | On expiry |
|-------|--------------------|-----------|
| Supplier acceptance | Assignment SLA (configured) | Release capacity; re-match; audit reason |
| Client payment after accept | **24 hours** | Release capacity; restart matching |
| Issue window | **24 hours** after delivery proof | Close window unless open issue; allow late-issue escalation only for documented platform error |

---

## 7. Payments architecture

### 7.1 Pilot Credits ledger

Not a wallet product. Operations/Super Admin grants only.

```text
grant → available
available → reserve (on authorized confirm)
reserve → spend (final)
reserve → release (cancel / expiry path)
available → expire
* → manual_adjustment (audited finance/Ops only)
```

**Ledger entry fields (required):** client, event type, amount minor, balance before/after, actor, reason, expiry, order id (nullable), idempotency key, audit link.

**UI contract:** labels **Pilot Credits** / **Test Credits** only. No Top Up / Cash Out / Transfer controls.

### 7.2 COD subsystem

```text
eligibility check (verified client + total ≤ 150000 centavos + zone + risk flag + one unpaid COD max)
→ authorization for collection (payment_authorized)
→ rider collection attempt
    → cash_collected + proof
    → OR collection_failed + return evidence + payout blocked
→ Ops/finance cash_reconciled
→ eligible for supplier payout release (subject to issue holds)
```

Server must reject COD when final total **> ₱1,500** (including delivery fee and approved adjustments) even if the client forges requests.

### 7.3 Future PayMongo adapter

| Pilot | Future live |
|-------|-------------|
| Sandbox sessions/webhooks only | Hosted checkout / payment methods |
| No actual collection claims | Server-created intents, signed webhooks |
| No production/payout release from sandbox success alone | Idempotent payment events + reconciliation |

Never store card PAN/CVV; never trust browser redirect alone for production or payout release.

### 7.4 Money rules

- Store **all** money in PHP **minor units** (centavos).
- Snapshot price, delivery fee, commission, specification, artwork version, promised date at authorization-critical points.
- Payout = gross − commission (± adjustments); holds apply until release authority clears.

---

## 8. Logistics, maps, and privacy

### 8.1 Delivery lifecycle

```text
ready_for_dispatch
→ rider_assigned / offer
→ accept
→ navigate supplier
→ pickup proof (OTP + photo)
→ tracking ON (picked_up → out_for_delivery)
→ navigate client
→ optional COD collection
→ delivery proof (OTP/photo/signature/receipt)
→ tracking OFF
→ issue window
```

Failed path: evidence → return to supplier/approved holding → notify Ops → paid redelivery only after new fee + eligibility. **No unattended completion.**

### 8.2 Location privacy design

| Rule | Value |
|------|--------|
| Tracking start | Confirmed pickup only |
| Tracking stop | Delivered, failed, or cancelled |
| Audience | Assigned rider; client on active order; supplier awaiting pickup (policy); authorized Ops |
| Foreground ping | Every **10 seconds** while active app |
| Background ping | Every **30 seconds** |
| Immediate events | Pickup, delivery, exception transitions |
| Trip history retention | Independently collected pings **90 days**, then delete/aggregate |
| Google Routes data | Separate retention/attribution; do not merge policies casually |
| UX honesty | Stale / offline / poor signal must be explicit |

### 8.3 NavigationService adapter

Abstract provider so display map, ETA matrix/comparison, and turn-by-turn guidance can be tested and budgeted:

- Google Maps display  
- Routes API for ETA / dispatch comparison  
- Navigation SDK for rider guidance  
- Launch requirements: billing enabled, quotas, budget alerts  

---

## 9. Data architecture

### 9.1 Core entities

| Entity | Purpose |
|--------|---------|
| `User` / `Role` | Identity and RBAC |
| `Organization` | Client org metadata (optional linkage) |
| `Address` | Delivery/pickup addresses; zone eligibility |
| `SupplierVerification` | KYC/business/payout/capability gate |
| `SupplierCapability` | Product families, materials, capacity signals |
| `ProductSpecification` | Catalog templates and order field schemas |
| `ArtworkFile` | Versioned production-source artwork |
| `ArtworkMockupRender` | Non-production Product Preview |
| `QualityReview` | Ops QA decision record |
| `SupplierAssignment` | Ranking, assignee, SLA, accept/decline, committed price/date |
| `Quote` | Optional intermediate commercial snapshot if used by matching |
| `Order` / `OrderItem` | Lifecycle owner + line items |
| `Payment` | Authorization record (`pilot_credit` / `cod` / future `paymongo`) |
| `PilotCreditLedgerEntry` | Immutable credit events |
| `CODCollection` | Collection eligibility, proofs, recon |
| `Payout` | Supplier settlement + holds |
| `DeliveryJob` | Dispatch unit + tracking lifecycle |
| `DeliveryLocationPing` | Raw location samples |
| `DeliveryProof` | Pickup/delivery/COD/failure evidence |
| `Issue` | Material claim within/outside window |
| `Notification` | Role-targeted alerts |
| `StatusEvent` | Order timeline events |
| `AuditLog` / `AuditEvent` | Immutable controlled-event metadata |

### 9.2 Critical field contracts

**Order**
- client/org, state, promised date  
- final total minor, delivery fee minor  
- payment method + authorization status  
- COD eligibility flags  
- immutable snapshots: price, fees, commission, specs, artwork version, promised date  

**ArtworkFile**
- version, filename, MIME, dimensions, resolution, color mode, bleed  
- preflight status, QA comments, proof status, approved timestamp  

**ArtworkMockupRender**
- artworkFileId, productType, templateVersion, renderStatus, renderUrl  
- createdAt, expiresAt, failureReason  
- **never** production source  

**QualityReview**
- order, reviewer, checklist results, decision, risk level  
- correction request, proof-required flag, evidence, timestamps  

**SupplierAssignment**
- ranking inputs, assigned supplier, acceptance deadline  
- decision/reason, final price, promised date  

**DeliveryJob**
- pickup/drop-off coordinates  
- tracking state, planned/current ETA  
- route deviation flag, last location timestamp  
- tracking start/end  

**DeliveryLocationPing**
- deliveryJobId, riderId  
- lat/lng, accuracyMeters, heading, speed  
- recordedAt, receivedAt, source, GPS status  

**CODCollection**
- eligibility/reason, amount minor, rider  
- OTP/photo/receipt references  
- collected/failed/reconciled timestamps  
- discrepancy/return reason  

**Payout**
- supplier/order, gross/commission/net minor  
- hold reason/expiry, release authority  
- settlement state/reference  

### 9.3 Snapshot and immutability rules

- Spec and artwork version frozen for production after approval + authorization.  
- Price/fee/commission snapshots frozen at payment authorization.  
- Ledger and audit rows are append-only.  
- Product Preview renders are versioned and may expire; regenerating does not alter production artwork.

---

## 10. Security, privacy, and compliance architecture

### 10.1 Security controls

- Role-scoped API and RLS policies for every table with personal or commercial data  
- Signed, time-limited artwork URLs; private buckets  
- Malware scan path for uploads before broad access  
- Secrets only in environment / secret manager  
- Idempotency keys on payment, credit, location batch, and webhook handlers  
- Provider webhook signature verification (PayMongo future)  
- Immutable audit for overrides, refunds, reprints, payout releases  

### 10.2 Privacy controls

- Clear privacy notice purposes for client, supplier, rider, and live-location data (Data Privacy Act)  
- Consent for foreground/background location on rider devices  
- Active-trip-only exact location sharing  
- Retention: trip history 90 days independent of Google Routes cache limits  
- Support communications retained in order thread for dispute integrity  

### 10.3 Operational finance separation (pilot)

Unlike earlier “non-financial ops engine + CSV only” design:

- The platform **does** store operational money amounts (totals, fees, commissions, ledger, COD, payouts) in minor units for marketplace control.  
- It does **not** implement full accounting/P&L software.  
- Super Admin / finance tools cover pilot grants, COD recon, payout approval, refunds, and audit—not general ledger accounting.

---

## 11. Feature requirements mapped to architecture

### 11.1 Order & production pipeline

| Capability | System mapping |
|------------|----------------|
| Structured request | Catalog + Order orchestration |
| Artwork QA | QualityReview + ArtworkFile |
| Matching | Matching service + SupplierAssignment |
| Production milestones | Order state + supplier workspace events |
| Self-QC | Evidence attachments + gate to `ready_for_dispatch` |

### 11.2 Logistics & fleet

| Capability | System mapping |
|------------|----------------|
| Dispatch | DeliveryJob + Ops dispatch map |
| Live rider view (authorized) | DeliveryLocationPing + Realtime topics |
| Navigation | NavigationService |
| PoD / pickup proof | DeliveryProof |
| COD collection | CODCollection + Payment |

### 11.3 Admin split (new vs old)

| Old single “Admin” idea | New architecture |
|-------------------------|------------------|
| One shop admin queue | **Ops Admin** = QA/matching/dispatch/claims |
| Owner export | **Super Admin** = policy, verification, finance approvals, audit |
| Developers debug | Platform ops / engineering access outside product roles |
| CSV-only finance | Controlled in-platform ledger + recon + export as needed |

### 11.4 Non-financial + commercial KPIs

Track both operational and pilot commercial health:

- TAT (request → delivered)  
- QA correction rate / time  
- Supplier acceptance SLA  
- Self-QC first-pass yield  
- On-time pickup/delivery  
- Stale route incidents  
- COD recon accuracy  
- Issue/reprint/refund rate  
- Payout-hold aging  
- Repeat orders / margin per completed order  

---

## 12. UX system architecture (implementation handoff)

| Concern | Rule |
|---------|------|
| Tokens | Shared semantic palette (canvas, surface, text, outline, action-yellow, success/error/warning/info) |
| Components | Shell/nav, yellow primary / neutral secondary, status chips (icon+label), steppers, evidence viewers, map cards, financial panels |
| Maps | Yellow route; pins differentiated by shape/label as well as color; last-updated / stale states |
| Forms | Helper + error text; units on dimensions/money; sticky primary action on mobile progress |
| Accessibility | WCAG 2.2 AA, focus rings, keyboard web nav, reduced motion, 44px touch targets |
| Assets | Role mockups in TINKER Light Mode / Dark Mode packages |

Screen group checklist lives in `PRD.md` §8.4 and TINKER Design Requirements Document.

---

## 13. Acceptance matrix (architecture-level)

| ID | Requirement | System proof |
|----|-------------|--------------|
| A1 | No matching before QA | State machine rejects transition without QualityReview pass/proof |
| A2 | No production before payment authorization | Production transitions require Payment authorized |
| A3 | Assignment expires | SLA job releases SupplierAssignment and re-queues matching |
| A4 | Credits non-cash | No purchase/transfer/withdraw endpoints; ledger-only grants |
| A5 | COD ≤ ₱1,500 + one unpaid | Server eligibility function; RLS/API both enforce |
| A6 | Failed COD blocks payout | CODCollection failed state + Payout hold |
| A7 | Tracking window | Tracking flags tied to pickup/terminal events only |
| A8 | 24h issue freezes payout | Issue open within window sets Payout hold |
| A9 | Self-QC before dispatch | `ready_for_dispatch` requires self-QC evidence |
| A10 | Theme parity | Shared routes/components; token themes only |
| A11 | Product Preview non-production | Mockup entity separated from ArtworkFile production pointer |
| A12 | Audit completeness | Controlled events write AuditEvent rows |

Detailed product acceptance list: `PRD.md` §11 and TINKER `07_Testing_and_Acceptance/Acceptance_Test_Matrix.md`.

---

## 14. Out of scope (Phase 1 architecture)

- Live PayMongo collection and disbursement automation  
- Credit top-up / wallet product  
- Open supplier bidding marketplace  
- Multi-city logistics beyond configured Davao zones  
- Graphic design editor / silent content edits  
- Full accounting ERP / P&L suite  
- Hardware node health / remote printer control  
- Nationwide third-party courier marketplace as primary path  

---

## 15. Open questions / launch readiness

- [ ] Final supplier acceptance SLA defaults per product family  
- [ ] Exact self-QC checklist templates per product category  
- [ ] COD risk flags and manual disable criteria  
- [ ] Professional review: permits, privacy notice, rider/supplier contracts, insurance, receipts  
- [ ] Google Maps billing/quota/budget alert setup  
- [ ] Font licensing for Satoshi / Poppins / Instrument Serif before shipping binaries  
- [ ] Criteria and date for PayMongo live switch post-pilot  

---

## 16. Glossary

| Term | Definition |
|------|------------|
| **Managed marketplace** | Platform matches verified suppliers; clients do not bid |
| **Ops / Supplier Operations Admin** | Mandatory QA and fulfillment control role |
| **Super Admin** | Platform governance and finance approval role |
| **Pilot Credits** | Non-cash test instrument granted by Ops/Super Admin |
| **payment_authorized** | Credits reserved/spent or COD approved for collection |
| **Self-QC** | Supplier evidence gate before dispatch |
| **Issue window** | 24 hours after delivery proof for material claims |
| **NavigationService** | Maps/routing/navigation provider adapter |
| **RLS** | PostgreSQL Row Level Security |
| **PHP minor units** | Centavos; canonical monetary storage |
| **Active-trip tracking** | Exact location only between pickup and terminal state |

---

## 17. Document control

| Item | Value |
|------|--------|
| Version | 2.0 |
| Supersedes | PRD_SysArchi v1.0 (single-shop ops engine, CSV-only finance, tentative top-up credits) |
| Product PRD | `PRD.md` v4.0 |
| Blueprint package | `C:\Mobile_App\GRIDGO-TINKER\` |
| Ops playbooks | TINKER `02_Business_Operations/Operations_Playbooks.md` |
| Data dictionary | TINKER `06_Data_Model/Data_Dictionary.md` |
| Design requirements | TINKER `05_UX_Mockups/GRIDGO_Design_Requirements_Document.md` |

This is engineering and product architecture guidance, not legal or licensing advice.

---

*GRIDGO Phase 1 System Architecture v2.0 — Davao City managed-printing marketplace pilot.*
