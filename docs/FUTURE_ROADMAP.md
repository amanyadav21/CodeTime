# CodePulse — Future Roadmap

Version: 0.2
Scope: V2 and beyond

This document captures ideas that are intentionally **not** in V1. Items here are not commitments; they exist so we do not lose track of them and so we can defend V1's scope against scope creep.

---

## V2 — Insights & Customisation

- **Terminal & debug activity** as configurable activity sources.
- **Weekly / yearly dashboards** in the sidebar.
- **Language statistics** (per-file-type active minutes), opt-in, derived locally.
- **Project statistics** (per-workspace-folder active minutes), opt-in.
- **Custom combo ladders** UI (already configurable; V2 adds a friendly editor).
- **Themes** for the sidebar UI (light/dark handled by VS Code already).
- **Idle threshold profiles** (Coding, Reading, Pairing) one-click presets.
- **More achievements**: e.g., "5 sessions today", "3 days ≥ 2 h".
- **Export**: JSON / CSV export of personal data.

## V3 — Optional Cloud & Social

- **Optional account** (GitHub OAuth) for cross-device sync.
- **Web dashboard** mirroring the sidebar UI.
- **Cross-device sync** via the cloud account.
- **AI-generated weekly insights** (opt-in).
- **Team challenges** (opt-in; admins only see aggregates, never raw keystrokes).
- **Leaderboards** (opt-in; explicit per-leaderboard enrolment).

## Explicit Non-Goals

The following will **never** be in CodePulse:

- Source code collection.
- Keystroke recording.
- Screen capture.
- Behavioural analytics for employer monitoring.
- "Focus score" claims that overreach what activity data can support.

## Architectural Pre-Wiring

V1 is built to accept these later without rewrites:

- `StorageManager` interface allows a cloud backend implementation.
- Engines are pure and can run in a desktop / CLI shell.
- The webview message protocol is versioned (`schemaVersion` in `EngineSnapshot`).
- The Next.js app is already a buildable artefact that can be hosted as a standalone web dashboard if/when V3 adds sync.

## Decision Criteria for Adding Features

A feature gets added only if:

1. It does not compromise the V1 quality bar (believability, performance, privacy).
2. It is opt-in by default.
3. It can be implemented without breaking the `EngineSnapshot` shape, or with an additive change that older clients can ignore.
4. It survives review by the maintainers with explicit acknowledgement of the privacy posture.
