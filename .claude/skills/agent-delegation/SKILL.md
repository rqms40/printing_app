---
name: agent-delegation
description: Use when orchestrating or delegating work in the printing_app repo across models — Codex GPT 5.6 (sol/terra), Grok 4.5, or Claude subagents — including deciding which model gets a task, escalating stuck work, or running a second-opinion review.
---

# Agent Delegation (GRIDGO printing_app)

## Overview

The session harness (Claude Code or Codex) is the main orchestrator: it owns
requirements, decisions, final review, and integration. Everything else can be
delegated. Route each delegated task to the cheapest model that will do it
well; escalate when evidence says it wasn't enough. AGENTS.md "Model Routing"
is the source of truth — this skill is the operating procedure.

## Routing decision

Ask three questions, in order:

1. **Is it UI/frontend design, visual polish, or UX writing?**
   → Claude, whenever Claude is available (Claude Code session itself, or a
   Claude subagent). Use the frontend-design skill for new UI.
2. **Is it backend and deep** (NestJS/TypeORM/migrations, dispatch planning,
   beta/credits/auth logic), **security-sensitive, or genuinely hard?**
   → Codex `gpt-5.6-sol` at reasoning `high`; use `xhigh` for the hardest
   work (migrations touching money/credits, dispatch solver, auth/beta
   gating). Prefer sol for backend even when the task looks small.
3. **Otherwise:** moderately hard / cross-surface → `gpt-5.6-sol` at
   `medium`; routine or mechanical (small fixes, test scaffolding, docs,
   repetitive edits) → `gpt-5.6-terra`.

Grok 4.5 is never a primary implementer by default — it is the second
opinion: adversarial review, plan critique, UX/copy alternatives, checklist
generation, comparing competing approaches.

## Quick reference

| Task | Model | Command |
| --- | --- | --- |
| Hardest backend/deep/security | `gpt-5.6-sol` xhigh | `codex exec -m gpt-5.6-sol -c model_reasoning_effort="xhigh" --cwd <repo> "<task>"` |
| Hard | `gpt-5.6-sol` high | same with `"high"` |
| Moderately hard / cross-surface | `gpt-5.6-sol` medium | same with `"medium"` |
| Routine / mechanical | `gpt-5.6-terra` | `codex exec -m gpt-5.6-terra --cwd <repo> "<task>"` |
| UI / frontend design | Claude | keep in-session, or Claude subagent + frontend-design skill |
| Read-heavy exploration / triage | Claude Explore or Codex subagents | parallel, read-only |
| Second opinion / adversarial review | Grok 4.5 | `grok --cwd <repo> --model grok-4.5 "Read-only review. Do not edit files. <ask>"` |
| Explicitly requested Grok implementation | Grok 4.5 | `grok --cwd <repo> --worktree=grok-<topic> --model grok-4.5 --max-turns 8 "<task>"` |

`<repo>` = the absolute path of this device's checkout — it differs per
machine (e.g. `/Users/admin/personal/mobile/printing_app` on macOS,
`/home/jd/projects/printing_app` on the Linux `jd` box). When already inside
the repo, use `--cwd "$(pwd)"`.

## Dispatch prompt shape

Every delegation prompt states, in order: the task with its smallest
reviewable scope; the files or surface it owns; whether it is read-only or
may edit (and where — worktree/branch); which checks to run (the owning
surface's commands from AGENTS.md); and the report format below. Example:

```bash
codex exec -m gpt-5.6-sol -c model_reasoning_effort="high" \
  --cwd "$(pwd)" \
  "Implement issue #84 in server/src/beta-mode only. Work on branch
  agent/beta-rank-fix; do not push. Run: cd server && npm run lint:check &&
  npm test. Report: files changed, findings, test output, confidence,
  recommended next action."
```

## Rules

- **Read-only by default.** Delegates get edit rights only for an assigned
  implementation task, isolated in a worktree or dedicated branch, and the
  orchestrator reviews the full diff before accepting anything.
- **Reports, not transcripts.** Delegates return: files inspected/changed,
  findings, checks run + output, confidence, recommended next action.
- **Verify before acting.** Confirm delegated findings against local code,
  tests, or issue evidence before changing code, closing issues, or
  reporting results. Conflicting outputs → trust verified local evidence.
- **One owner per file.** Never let two agents edit the same files
  concurrently without an explicit coordination point.
- **Parallelize reads, serialize decisions.** Fan out exploration/review
  subagents freely; integration and final review stay in the orchestrator
  thread.
- **Destructive beta e2e** (`GRIDGO_RUN_BETA_FLOW_DESTRUCTIVE=1`/`VISUAL=1`)
  is never delegated to a background agent against shared data — isolated
  loopback stacks only, per AGENTS.md.

## Escalation ladder

terra fails or churns → sol medium → sol high/xhigh → add a Grok 4.5
adversarial review of the approach. Two failed attempts at one tier means
escalate with a summary of what failed — never re-run the same prompt at the
same tier a third time.

## Common mistakes

| Mistake | Fix |
| --- | --- |
| "It's a small backend change, terra is fine" | Backend + deep (money, auth, migrations, dispatch) routes to sol even when small. |
| Treating Grok's critique as a verdict | Grok is input, never source of truth; verify against local evidence. |
| Delegating implementation into the main working tree | Worktree/branch isolation, then diff review. |
| Prompt without checks or report format | Rewrite the dispatch prompt: scope, ownership, checks, report. |
| Accepting "done" reports unverified | Re-run the named checks locally before integrating. |
