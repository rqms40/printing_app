# GRIDGO — Product Requirements Document
## Phase 1 System Architecture
**Version:** 1.0  
**Status:** Active Development  
**Target Market:** Philippine Digital Printing Industry  
**Timeline:** 3–5 Years to Market Leadership

---

## 1. Product Overview

**GRIDGO** is a digital printing platform designed to make the transition from digital design to physical reality effortless and stress-free. It combines precision technology, high-quality print output, and seamless logistics delivery — targeting professionals and students across the Philippines.

### Vision
To be the essential digital printing partner in the global market, making the transition from digital design to physical reality effortless and stress-free for every user.

### Mission
To revolutionize the printing experience by combining precision technology, high-quality output, and seamless logistics, empowering professionals and students to focus on their craft.

### Goal
To become and lead the digital printing industry within the Philippine market within three to five years.

---

## 2. Strategic Roadmap (Phase 1)

Phase 1 is broken into 6 sequential milestones:

| Step | Stage | Description |
|------|-------|-------------|
| 1 | **Concept** | Ideation, market cost projection, and full planning |
| 2 | **System Architecture** | App design, UI/UX, feature definition, admin dashboard |
| 3 | **Prototyping & Marketing Strategy** | Beta testing at selected events; marketing conceptualization |
| 4 | **App Development** | Feedback implementation, app testing, soft launch marketing |
| 5 | **Operations** | Daily operations, weekly dev meetings |
| 6 | **Phase 2 Preparations** | 6–8 months of operations, app improvement, Phase 2 planning |

---

## 3. Admin Architecture — The Operational Engine

### 3.1 Core Philosophy

The GRIDGO admin dashboard functions as a **pure Operational Engine** — output-based and non-financial by design. Accounting is intentionally decoupled into a separate department.

- The app outputs **raw operational data** (units, distances, counts, statuses)
- The admin exports this data as **CSV** for use in Excel or third-party accounting software
- This separation prevents codebase complexity and keeps developer focus on the core product

### 3.2 Role Separation

| Role | Access Level | Responsibilities |
|------|-------------|-----------------|
| Developers | `Debug` | Technical access, bug resolution |
| Managers | `Operational` | Day-to-day order and fleet management |
| Owner | `Export` | Full data access, Master CSV export |
| Accounting Dept | External | Receives CSV exports, handles financials independently |

---

## 4. Feature Requirements

### 4.1 Order & Production Management

**Job Pipeline**
- Status tracking with the following states: `Queued → Printing → Ready → Out for Delivery`
- Admin must be able to view and manage all jobs in the pipeline at any time

**File Inspector**
- Preview uploaded PDFs and CAD exports
- Validate page count before job proceeds to printing

**Priority Toggle**
- Ability to flag and elevate "Express" jobs to the top of the queue
- Manual override capability for admins

---

### 4.2 Logistics & Fleet *(Phase 1 Primary Focus)*

**Rider Live-View**
- Real-time GPS tracking of all active delivery riders within Davao
- Map interface showing both customer locations and rider positions simultaneously

**Live Map**
- Dual-layer tracking: customers on one side, rotating riders on the other
- Must support real-time updates without significant lag

**Dispatch Logic**
- Auto-assignment of delivery jobs to the nearest available rider
- System should account for current rider load and proximity

**Proof of Delivery (PoD)**
- Mandatory completion step before a delivery is marked done
- Accepted proof: photo upload OR digital signature from recipient

---

### 4.3 Hardware & Network *(Phase 2 & 3 Readiness)*

> These features are planned but not required for Phase 1 launch. Include as forward-compatible architecture considerations.

**Node Health Dashboard**
- Remote monitoring of paper levels, toner status, and network connectivity
- Applicable to remote or satellite printing units

**Remote Command Console**
- Ability to restart printer software remotely
- Ability to clear print queues without physical access

---

### 4.4 System Efficiency (Non-Financial KPIs)

The following KPIs are tracked operationally — no monetary values are stored in the app.

| KPI | Definition |
|-----|-----------|
| **Turnaround Time (TAT)** | Duration from "Order Placed" timestamp to "Order Delivered" timestamp |
| **Error Rate** | Count of failed prints or rejected/returned deliveries per period |
| **User Retention Heatmap** | Frequency of return visits per unique User ID |

---

### 4.5 Security & Data Protection

**Role-Based Access Control (RBAC)**
- Three distinct permission tiers: `Debug`, `Operational`, `Export`
- Access gates must be enforced at both UI and API levels

**Master CSV Export**
- Single-button export of all raw operational data
- Accessible by Owner role only
- Output is intended for ingestion into Excel or accounting software (e.g., QuickBooks, Xero)
- No financial calculations are performed within the app itself

---

## 5. GRIDGO Credit System *(Tentative — Pending Review)*

> ⚠️ The credit system design is still tentative. Major changes are to be discussed in the next team meeting before development begins.

### Current Proposed Workflow

```
User → TOP-UP → App → ADD CREDIT → Devs
                                      ↓
                                 NOTIFY USER
                                      ↓
User ← RECEIVE ← Operation ← PRINT (SUBTRACT) ← App
```

### Flow Summary
1. User initiates a **top-up** via the app
2. Developers/system **adds credit** to the user's account
3. User is **notified** of successful credit addition
4. When a print job is executed, credits are **subtracted** automatically
5. The operation system triggers delivery; user **receives** output

### Design Note
- A tentative coin/token visual design exists (GRIDGO-branded coin icon)
- The credit currency name, denomination, and conversion rates are TBD
- All credit system decisions deferred to the next stakeholder meeting

---

## 6. Out of Scope (Phase 1)

The following are explicitly excluded from the app's codebase in Phase 1:

- Financial calculations or invoicing
- Payment gateway integration (deferred to credit system discussion)
- Accounting dashboards or P&L views
- Hardware remote control (Phase 2/3)
- Multi-city logistics beyond Davao

---

## 7. Open Questions / Items for Next Meeting

- [ ] Final credit system design: denomination, name, conversion logic
- [ ] Payment gateway selection for top-up flow
- [ ] How and when hardware node monitoring gets scoped into development
- [ ] Phase 2 geographic expansion targets
- [ ] Marketing strategy finalization post-beta

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| **TAT** | Turnaround Time — order-to-delivery duration |
| **PoD** | Proof of Delivery — photo or signature confirming receipt |
| **RBAC** | Role-Based Access Control |
| **Node** | A remote printing unit connected to the GRIDGO network |
| **Master CSV** | Full operational data export for accounting use |
| **Express Job** | A priority print order elevated above the standard queue |
| **Operational Engine** | The GRIDGO dashboard's core function — tracking ops data, not finances |

---

*This PRD is based on the GRIDGO Phase 1 System Architecture document (v2). For questions or updates, refer to the development team's weekly meeting notes.*