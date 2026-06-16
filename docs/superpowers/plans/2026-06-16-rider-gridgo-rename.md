# Rider + GRIDGO Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the delivery-person role to rider everywhere it is represented in source/docs/contracts, and rename the uppercase product brand token to GRIDGO.

**Architecture:** Use a repository-wide terminology regression check as the TDD guard, then apply scoped mechanical renames across server, mobile, admin, and documentation. Preserve API behavior where possible by choosing explicit compatibility only when tests or existing contracts require it.

**Tech Stack:** Node terminology check, NestJS/TypeScript server, React/TypeScript admin, Flutter/Dart mobile, GitHub Actions verification.

---

### Task 1: Terminology Regression Check

**Files:**
- Create: `scripts/terminology-check.mjs`

- [ ] **Step 1: Write the failing terminology check**

Create `scripts/terminology-check.mjs` that scans tracked text files and file paths, excluding dependency locks and generated artifacts, and reports any remaining legacy delivery-role tokens or standalone uppercase old-brand tokens.

- [ ] **Step 2: Run the check to verify it fails**

Run: `node scripts/terminology-check.mjs`

Expected: FAIL with multiple matches from existing source/docs.

- [ ] **Step 3: Keep this check as the final regression guard**

Run it after each rename batch and before release.

### Task 2: Delivery Role Rename

**Files:**
- Modify server files under `server/src`, `server/migrations`, and server tests.
- Modify admin files under `admin/src`.
- Modify mobile files under `apps/mobile/lib` and `apps/mobile/test`.
- Modify docs and non-generated project text.

- [ ] **Step 1: Apply mechanical path and content renames**

Rename source paths, identifiers, labels, routes, endpoints, events, types, tests, docs, and comments from the legacy delivery-role word to rider/riders with matching case.

- [ ] **Step 2: Preserve compile-time consistency**

Update imports, class names, filenames, route registration, controller/provider names, models, test names, and generated references that are stored in source control.

- [ ] **Step 3: Run focused checks**

Run: `node scripts/terminology-check.mjs`

Expected: no legacy delivery-role matches.

### Task 3: GRIDGO Brand Rename

**Files:**
- Modify brand-visible files across root docs, admin, mobile, server, landing page, config, tests, and package metadata.

- [ ] **Step 1: Use a subagent for the brand rename**

Dispatch a worker subagent to rename standalone uppercase old-brand tokens to GRIDGO and update obvious product-brand display text consistently.

- [ ] **Step 2: Review and integrate the subagent output**

Confirm no dependency names or generic layout terms were accidentally changed.

- [ ] **Step 3: Run focused checks**

Run: `node scripts/terminology-check.mjs`

Expected: no standalone uppercase old-brand matches.

### Task 4: Full Verification, Publish, Release

**Files:**
- Modify only if verification exposes issues.

- [ ] **Step 1: Run local verification**

Run server, admin, and mobile test/build commands required by the repository.

- [ ] **Step 2: Commit and push**

Create a branch commit with the completed rename and push it.

- [ ] **Step 3: Check GitHub status**

Use GitHub tooling or `gh` to confirm CI is green.

- [ ] **Step 4: Build and release**

Build release artifacts according to the repo release workflow and publish the release if verification is green.

### Self-Review

- Spec coverage: delivery role wording, uppercase brand token, verification, GitHub status, and release are all represented.
- Placeholder scan: no placeholder implementation steps remain; each task has explicit files and commands.
- Type consistency: naming target is rider/riders and GRIDGO throughout the plan.
