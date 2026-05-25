# Decisions

Grep-able one-line index of durable decisions. Reasoning lives in the
linked session file or commit; this file is the index, not the
explanation.

Append-only. Newest at the bottom. To supersede an earlier decision,
add a new line that references the old one — never delete or rewrite a
prior entry.

Format:

```
YYYY-MM-DD · <one-line decision> · <sessions/file.md or commit SHA>
```

Examples:

```
2026-05-24 · Adopt cross-tool agent memory protocol v2.1 · docs/agent/sessions/2026-05-24-093000-claude-memory-bootstrap.md
2026-05-25 · Drop DECISIONS.md exclusion from CI paths-ignore (false positive earlier) · 7e4bf4b
2026-06-02 · Reverse 2026-05-24 — use protocol v2 (drop DECISIONS.md) · docs/agent/sessions/2026-06-02-110000-claude-prune.md
```

Read on demand (look up "when did we decide X?"), not loaded on every
`start session`.

---

<!-- Append real entries below this line. -->

2026-05-25 · Build v1 as a TypeScript Discord app using DeepL primary, optional Google fallback, SQLite quota/settings, and Docker Compose · docs/agent/sessions/2026-05-25-214703-codex-translation-plan.md
