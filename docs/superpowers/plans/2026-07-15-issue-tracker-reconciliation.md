# Issue Tracker Reconciliation (Phase D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Verification agents are read-only; ONLY the orchestrator closes issues or edits labels.

**Goal:** Make the GitHub tracker match code reality: verify and close the 21 `status:already-fixed` issues with evidence, refresh the 12 `partially-fixed` issues with remaining-work checklists (merging Phase A/B/C findings), rewrite the unclear ones, and open the program's new issues.

**Architecture:** Read-only verification agents (codex terra for single-surface, sol medium for cross-surface) check ~5 issues each against the current code and return evidence reports. The orchestrator spot-verifies every verdict locally before acting on GitHub. All label changes follow the AGENTS.md taxonomy; Trello markers are preserved; `docs/trello/` is never touched.

**Tech Stack:** `gh` CLI, codex CLI (in cmux panes for observability), local greps/tests for verification.

## Global Constraints

- Close an issue ONLY when current code clearly satisfies it; closure comment must cite files/behavior/tests (AGENTS.md).
- Preserve `Trello-Card-ID` / `Trello-ShortLink` markers in every edited body.
- Verification agents: read-only, report format = files inspected, evidence, confidence, recommended verdict.
- A verdict is actionable only after the orchestrator confirms at least the key evidence locally.
- Never re-run a failed agent prompt a third time at the same tier (escalation ladder).

---

### Task 1: Snapshot and batch

- [ ] **Step 1:** `gh issue list --state open --limit 200 --json number,title,labels,body > /private/tmp/claude-501/-Users-admin-personal-mobile-printing-app/d73590e3-b56e-4aba-9627-51c729368199/scratchpad/issues-snapshot.json`
- [ ] **Step 2:** Partition into batches of ≤5 by status label and surface:
  - Already-fixed, single-surface → terra batches: {#35,#38,#41,#42,#44}, {#53,#56,#57,#59,#68}, {#31,#39,#40,#43,#65}
  - Already-fixed, cross-surface → sol-medium batches: {#36,#37,#46,#52,#66}, {#34}
  - Partially-fixed → sol-medium batches: {#22,#23,#29,#45,#47}, {#32,#33,#48,#58,#61}, {#62,#63}
  - Unclear → orchestrator handles directly: {#60,#24}; still-needed label/sequence only: {#25,#21}

### Task 2: Dispatch verification agents (observable in cmux)

- [ ] **Step 1:** For each batch, open a cmux pane running codex with tee'd logs, e.g.:

```bash
cmux open "$(pwd)" # once, to ensure a workspace
# per batch (adjust model/effort per Task 1 routing):
codex exec -m gpt-5.6-terra --cwd "$(pwd)" \
  "Read-only issue verification. Do NOT edit files or issues. For each of issues #35 #38 #41 #42 #44 (bodies in scratchpad issues-snapshot.json): compare the request against current code. Report per issue: files inspected (paths), evidence the request is satisfied or not (file:line), confidence high/medium/low, recommended verdict (close / relabel status:partial / relabel status:still-needed) and one-line evidence summary suitable for a closure comment." \
  |& tee <scratchpad>/triage-batch-1.log
```

- [ ] **Step 2:** Collect all batch reports; any agent that churns or contradicts itself → escalate that batch one tier with a summary of what failed.

### Task 3: Orchestrator verification and closure (already-fixed set)

- [ ] **Step 1:** For each `close` verdict, locally confirm the cited evidence (open the file at the cited lines; run the named test if one exists and is cheap).
- [ ] **Step 2:** Close with evidence, adjust labels:

```bash
gh issue close <n> --comment "Verified in current code: <one-paragraph evidence with file refs / test names>. Closing as implemented."
gh issue edit <n> --remove-label status:evidence-review
```

- [ ] **Step 3:** For verdicts that do NOT hold up: relabel (`status:partial` or `status:still-needed`), comment with what's missing, leave open.

### Task 4: Partially-fixed refresh + findings merge

- [ ] **Step 1:** For each of the 12, post a comment with a concrete remaining-work checklist from the verification report.
- [ ] **Step 2:** Merge program findings into their homes:
  - #62 (Rider.UI.FT01): the 17 rider UX gaps summary + links to the B1/B2 issues (Task 5).
  - #45/#47 (delivery status/progress): customer tracking-tile findings (queue "of N", server ETA — note F4 fixed them; check off).
  - #61/#48 (notifications): any notification findings from the Phase A audit.
  - #22/#23 (admin ops): admin findings incl. rank column (F3 — check off when merged).
- [ ] **Step 3:** Rewrite #60, #24, #33 bodies into actionable steps (keep Trello markers verbatim); replace `status:needs-clarification` with the accurate status label.

### Task 5: Open the program's new issues

- [ ] **Step 1:** `gh issue create` for:
  1. **Rider map uplift (B1)** — body: scope from the program spec §Phase B/B1, labels `surface:mobile,role:rider,module:riders,type:ux,priority:p1-high`, link to #62.
  2. **Rider live navigation (B2)** — spec §Phase B/B2, labels `surface:mobile,surface:backend,role:rider,module:riders,module:delivery-logistics,type:feature,priority:p2-medium`, link to #62 and B1.
  3. **Registration redesign** — spec §Phase C, labels `surface:mobile,role:customer,type:ux,priority:p2-medium`, note it succeeds closed #13.
  4. One issue per unfixed Phase A finding that has no existing home (from the findings register dispositions).
- [ ] **Step 2:** Cross-link: comment on #62 pointing to B1/B2; findings register updated with issue numbers in disposition column.

### Task 6: Reconciliation check

- [ ] **Step 1:** `gh issue list --state open --limit 200 --json number,labels` — confirm no remaining `status:evidence-review` labels, and every open issue's status label matches a verified state.
- [ ] **Step 2:** Commit the updated findings register (disposition column now has issue numbers) on `agent/beta-coherence-program`.
