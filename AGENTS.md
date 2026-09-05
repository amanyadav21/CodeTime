# AGENTS.md

Authoritative engineering docs live in `/docs`. **Read these before making non-trivial changes.**

- `docs/REQUIREMENTS.md` — what the system must do (functional + non-functional + constraints).
- `docs/HLD.md` — high-level design, decisions, state machine, data flow.
- `docs/ARCHITECTURE.md` — modules, layering, failure modes, extension points.
- `docs/LLD.md` — implementation-oriented: per-module APIs, transitions, edge cases.
- `docs/DATA_MODEL.md` — persisted schema, validation, versioning, migration.
- `docs/ACTIVITY_DETECTION.md` — what counts as activity, what does not, edge cases.
- `docs/UI_SPECIFICATION.md` — every UI surface, states, accessibility, anti-patterns.
- `docs/TESTING.md` — test strategy and explicit edge-case set.
- `docs/SECURITY.md` — privacy posture; no source-code collection; no telemetry in V1.
- `docs/FUTURE_ROADMAP.md` — V2 / V3 ideas (out of scope for V1).

## Project layout (matches `ARCHITECTURE.md` § 2)

```
src/         extension host (engines, storage, messaging, ui stubs, util)
webview/     Next.js app (UI layer) — static export
tests/       unit + integration
docs/        this folder
```

## Common commands

- `npm run typecheck` — strict tsc for both `src/` and `webview/`.
- `npm run lint` — ESLint.
- `npm run test:unit` — Vitest.
- `npm run build` — webview + extension bundle into `dist/`.
- `npm run dev` — build then launch Extension Development Host.
- `npm run package` — produce a `.vsix` for VS Code / Cursor.

## Rules of thumb (from the master prompt)

- VS Code being open does NOT mean the user is coding.
- Engines are pure; UI is a thin renderer.
- No source-code collection, no telemetry in V1.
- Debounce/throttle high-frequency activity events.
- Validate persisted data; preserve unknown future `schemaVersion` to the sidecar key.
