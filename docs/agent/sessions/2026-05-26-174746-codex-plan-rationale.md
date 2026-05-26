# Session 2026-05-26 17:47:46 — Codex CLI — plan-rationale

**Tool:** Codex CLI
**Started from session:** docs/agent/sessions/2026-05-25-222358-claude-bootstrap-and-plan-refinement.md
**Branch:** master
**Code worktree:** dirty
**Tracked dirty code paths:** none
**Relevant untracked code paths:** docs/plans/deep-research-report.md — research/advisory report used to refine the canonical plan; still untracked
**Active task:** discord-translation-bot

## Done

- Ran `start session` per protocol. `STATE.md` pointed at an older session, so
  I recovered by reading the actual latest handoff:
  `docs/agent/sessions/2026-05-25-222358-claude-bootstrap-and-plan-refinement.md`.
- Reread `docs/plans/discord-translation-bot.md` and compared it with
  untracked advisory input in `docs/plans/deep-research-report.md`.
- Folded useful deep-research items into the canonical plan:
  - Discord `USER_INSTALL` + `PRIVATE_CHANNEL` verification.
  - Use `interaction.context` and `authorizing_integration_owners` for
    context/access interpretation.
  - Immediate defer + edit-original ephemeral response as the normal loop.
  - Formatting protection for code spans, URLs, mentions, emoji tokens, and
    attachment URLs.
  - In-memory component session store for Source/Target/Swap/Save state.
  - Discord long-message rendering limits: content 2000, embed description
    4096, total embed payload 6000; no file attachments for output in v1.
  - V1.x/V2 evolution section, with V2 explicitly optional and demand-driven.
- Added "Decision comment" rationale blocks explaining why the plan chooses
  the current approach over common alternatives.
- Applied additional review fixes:
  - Replaced "decrement quota reservation on provider failure" with refund
    rules: refund only when definitely unbilled.
  - Added precise DeepL mapping notes: internal `en/fr/uk/auto`; omit
    `source_lang` for auto; manual source `EN/FR/UK`; target English defaults
    to `EN-US`, configurable to `EN-GB`.
  - Added same-language billing warning and prompt-before-billing behavior.
  - Added placeholder integrity verification: every protected placeholder must
    survive exactly once before rehydration.
  - Removed default per-user daily cap from v1 after user feedback that
    translation use is bursty. Provider monthly quota is the hard stop; optional
    per-user throttle is deferred until real abuse/noise appears.
- Updated active task and DECISIONS index to match the revised plan.

## Changed files / intent

- `docs/plans/discord-translation-bot.md` — canonical product/architecture
  plan refined with rationale, DeepL mapping, placeholder safety, quota refund
  semantics, daily-cap reversal, and V1/V2 evolution boundaries. Committed
  separately as `b8c5527 docs(plan): refine translation bot plan`.
- `docs/agent/tasks/discord-translation-bot.md` — active task edge and
  milestone bullets updated to match the canonical plan.
- `docs/agent/DECISIONS.md` — appended a reversal entry for the default
  per-user daily cap decision.
- `docs/agent/STATE.md` — updated current state for this handoff.
- `docs/agent/JOURNAL.md` — appended this session entry.
- `docs/agent/sessions/2026-05-26-174746-codex-plan-rationale.md` — this
  handoff.
- `docs/plans/deep-research-report.md` — untracked advisory report. It was used
  as input but is not committed by this save.

## Decisions

- **No default per-user daily cap in v1.** User pointed out usage is bursty:
  one day may involve heavy conversation and another only "hello". A fixed
  daily cap can block legitimate use while adding little protection. Provider
  monthly quota remains the hard stop; per-user throttles are deferred until
  real abuse/noise appears.
- **DeepL English target defaults to `EN-US`.** Internal `en` stays provider
  neutral, but the DeepL adapter owns exact provider codes. `EN-GB` is
  configurable via `DEFAULT_ENGLISH_VARIANT`.
- **Placeholder corruption is a hard rendering failure.** If provider output
  drops/duplicates placeholders, do not output corrupted mentions, URLs, or code
  blocks.

## Failed approaches / do not retry

- Do not re-add daily caps by default unless real abuse/noise is observed.
- Do not blindly refund quota reservations on timeout/5xx/provider ambiguity;
  fail closed and accept small local upward drift.
- Do not treat the untracked deep research report as canonical state. The
  canonical plan is `docs/plans/discord-translation-bot.md`.

## Next

1. Start Step 1 (M0): scaffold the TypeScript package (`package.json`,
   `tsconfig.json`, npm scripts, `Dockerfile`, `docker-compose.yml`,
   `.env.example`, `.dockerignore`, minimal `src/` skeleton).
2. Default to npm + ESLint/Prettier unless a stronger repo-local reason appears.
3. Before provider work, run M1 manual verification on a throwaway Discord app:
   user install, DM/group-DM `Apps -> Translate`, ephemeral defer/edit, and
   context metadata.
4. Decide whether `docs/plans/deep-research-report.md` should be committed as a
   reference or left/deleted as scratch.

## Resume prompt

Read `docs/agent/STATE.md`, then `docs/agent/tasks/discord-translation-bot.md`,
then `docs/plans/discord-translation-bot.md`. The implementation plan is now
the source of truth and includes rationale comments plus V1/V2 boundaries. Next
work item is **Step 1 (M0): scaffold the TypeScript package and Docker/Compose
skeleton**. Keep `docs/plans/deep-research-report.md` in mind only as
untracked advisory input; do not commit or delete it unless the user decides.
