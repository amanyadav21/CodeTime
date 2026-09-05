# CodePulse — Requirements Specification

Version: 0.2 (V1 scope)
Status: Living document
Owner: Engineering

---

## 1. Purpose

CodePulse is a developer productivity extension for VS Code and Cursor that measures **genuine active coding time**, not mere IDE uptime. It provides coding sessions, combos, daily goals and streaks with full local-first storage and a premium minimal UI.

This document defines the **what** of V1. The **how** lives in `HLD.md`, `LLD.md`, `ARCHITECTURE.md`, and the rest of `/docs`.

---

## 2. Product Principle

> VS Code being open does **not** mean the user is coding.

The single most important quality bar:

> Does the displayed coding time feel believable to the developer?

If a developer opens VS Code and watches YouTube for two hours, CodePulse must not report two hours of coding. If the developer codes for one hour with natural pauses, CodePulse should report a defensible active-time estimate.

---

## 3. Scope

### 3.1 In Scope (V1)

- Active coding timer (IDLE / ACTIVE / PAUSED)
- Coding sessions (start, end, duration)
- Time-based combo system (configurable thresholds)
- Daily goal (configurable target)
- Streak tracking (configurable minimum per day)
- Sidebar dashboard UI (Next.js webview)
- Status bar item
- Subtle notifications for milestones
- Local-first persistence (VS Code `ExtensionContext.globalState`)
- VS Code + Cursor compatibility

### 3.2 Out of Scope (V1)

- Cloud sync, accounts, authentication
- Web dashboard
- Team challenges, leaderboards
- AI insights
- Language / project analytics beyond what's needed for V1
- Source code collection of any kind
- Terminal / debug activity counting (documented as V2)

These are documented in `FUTURE_ROADMAP.md`.

---

## 4. Stakeholders

| Stakeholder | Interest |
| --- | --- |
| Developer (end user) | Believable coding time, clean UI, privacy |
| Editor (VS Code / Cursor) | Stable extension, low resource usage |
| Maintainers | Clear architecture, testable code, good docs |

---

## 5. Functional Requirements

### FR-1 — Active Coding Timer

- **FR-1.1** The system shall expose three timer states: `IDLE`, `ACTIVE`, `PAUSED`.
- **FR-1.2** Opening the editor without IDE activity shall keep the timer in `IDLE` (displayed total = 0).
- **FR-1.3** Detected IDE activity shall transition the timer from `IDLE → ACTIVE`.
- **FR-1.4** Absence of activity for a configurable **idle threshold** shall transition `ACTIVE → PAUSED`.
- **FR-1.5** Resumed activity during `PAUSED` shall transition back to `ACTIVE`.
- **FR-1.6** A long pause beyond a configurable **session-end threshold** shall end the current session and return the timer to `IDLE` until new activity is detected.
- **FR-1.7** The displayed timer shall tick at most once per second.
- **FR-1.8** The timer shall not consume CPU when there is no open editor and no listeners (test: deactivate all activity sources → engine tick halts).

### FR-2 — Activity Detection

- **FR-2.1** The system shall treat the following as activity (positive signals):
  - Text changes in any editor
  - Cursor position changes in any editor
  - Selection changes
  - Scroll events (visible range change)
  - Active editor switching
  - File open / close / save
  - Workspace folder change
- **FR-2.2** The system shall NOT treat the following as activity:
  - Window focus alone
  - Window visibility alone
  - Editor focus alone without subsequent activity
  - Idle presence in any editor
  - Terminal-only activity (V1)
  - Debug-only activity (V1)
- **FR-2.3** All editor events shall be debounced (~100 ms) so that the extension host is never required to do work per-keystroke at high frequency.
- **FR-2.4** The idle threshold default shall be **60 seconds** (configurable, range 10–600 s).
- **FR-2.5** The session-end threshold default shall be **15 minutes** (configurable, range 60–86 400 s).

### FR-3 — Coding Sessions

- **FR-3.1** Each `IDLE → ACTIVE` transition that produces meaningful active duration shall start a new `CodingSession`.
- **FR-3.2** A session ends on:
  - Session-end threshold reached while `PAUSED`
  - Editor shutdown (session is persisted and closed cleanly)
  - Midnight rollover to a new local day (split, not end-of-life)
- **FR-3.3** A session shall record at minimum: `id`, `startedAt`, `endedAt`, `activeMillis`.
- **FR-3.4** The system shall compute, for the current local day:
  - Total active coding time
  - Number of sessions
  - Longest session (so far, including the live one)
  - Current session (live, if any)
  - Best session of the day (== longest, today)

### FR-4 — Combo Engine

- **FR-4.1** A combo multiplier shall be derived from **continuous active coding time within the current session**.
- **FR-4.2** Combo thresholds shall be configurable. V1 default:

  | Continuous active minutes | multiplier |
  | --- | --- |
  | 10 | ×1 |
  | 20 | ×2 |
  | 30 | ×3 |
  | 40 | ×4 |
  | 60 | ×5 |
  | 90 | ×6 |

  Thresholds shall be stored in configuration and editable.
- **FR-4.3** A break in activity (pause beyond idle threshold but before session-end) shall **freeze** the combo for the current session.
- **FR-4.4** A session end shall **reset** the combo to ×0.
- **FR-4.5** The combo shall be displayed as `COMBO × N` and shown even at ×0 (as `COMBO —`).

### FR-5 — Daily Goal

- **FR-5.1** The user shall configure a daily coding goal in minutes (default: 240 minutes / 4h).
- **FR-5.2** The system shall show progress: `todayActive / goal` and a percentage.
- **FR-5.3** When `todayActive ≥ goal`, the system shall emit a single "Goal completed" notification for that day.

### FR-6 — Streak

- **FR-6.1** A "streak day" is a local day where `todayActive ≥ streakMinimum` (default 30 minutes, configurable).
- **FR-6.2** A streak is the number of consecutive local days ending today (or yesterday if today is not yet a streak day) that satisfy the streak rule.
- **FR-6.3** Opening VS Code without coding does not count as a streak day.
- **FR-6.4** Streak milestones (3, 7, 14, 30, 60, 100 days) shall emit a single notification per milestone.

### FR-7 — UI Surfaces

- **FR-7.1 Sidebar Dashboard** (Webview view): title, total active time, combo, daily goal, current session, best session, sessions count, streak.
- **FR-7.2 Status Bar**: compact timer with state icon (`⚡` active, `⏸` paused, `○` idle) and total active time.
- **FR-7.3 Notifications**: session started, combo milestone, goal completed, streak milestone. Throttled and never spammed.

### FR-8 — Persistence

- **FR-8.1** V1 shall use **only** local storage. No network calls for V1 features.
- **FR-8.2** Persisted data shall include: `UserSettings`, `DailyStats[]`, `CodingSession[]`, `ComboState`, `StreakState`, `GoalState`.
- **FR-8.3** Persisted data shall be validated on load. Invalid data shall be discarded with a logged warning and defaults restored.
- **FR-8.4** All persisted data shall carry a `schemaVersion` and migration shall be explicit and tested.
- **FR-8.5** Writes shall be debounced to avoid hot-path I/O.

### FR-9 — Configuration

- **FR-9.1** All thresholds, defaults and feature toggles shall be exposed via VS Code settings under the `codepulse.*` namespace.
- **FR-9.2** Changes to configuration shall take effect without requiring an extension reload, where the setting allows.

### FR-10 — Compatibility

- **FR-10.1** CodePulse shall target the standard VS Code Extension API.
- **FR-10.2** CodePulse shall not use APIs that are explicitly VS Code-only when a portable equivalent exists.
- **FR-10.3** Differences in Cursor-specific behaviour shall be documented in `ACTIVITY_DETECTION.md` and `TESTING.md`.

---

## 6. Non-Functional Requirements

### NFR-1 — Performance

- Extension host shall use **< 1% CPU** during steady-state ACTIVE coding.
- Extension host shall use **< 50 MB RAM**.
- No synchronous I/O on activity events.

### NFR-2 — Reliability

- The extension shall never block the extension host.
- All event listeners and timers shall be cleaned up on deactivate, on view disposal, and on configuration changes.
- Recovery from corrupted storage shall not crash the extension; instead, defaults are restored and a warning is logged.

### NFR-3 — Privacy

- CodePulse shall not transmit source code, file contents, file paths beyond what's needed for V1, or keystrokes anywhere.
- No telemetry in V1. If telemetry is added later, it shall be **opt-in** and documented in `SECURITY.md`.

### NFR-4 — Local-First

- All V1 features shall work offline.
- No backend service shall be required.

### NFR-5 — Responsiveness

- UI shall remain responsive even under heavy activity event load.
- Activity event processing shall be debounced/throttled.

### NFR-6 — Maintainability

- Business logic must be independent of UI.
- Strong TypeScript typing. No implicit `any`.
- Tests for all engines: activity, session, combo, streak, goal, storage.

### NFR-7 — Accessibility

- Sidebar UI shall meet WCAG AA colour contrast against VS Code's default light and dark themes.
- Status bar item shall have a meaningful tooltip.
- Animations shall respect `prefers-reduced-motion`.

### NFR-8 — Observability

- All engine state transitions shall be logged at `debug` level behind a `codepulse.debug` setting (off by default).
- The output channel shall be `CodePulse`.

---

## 7. Constraints

### C-1 — VS Code Webview Constraints

- Webviews cannot directly access Node APIs.
- All data crossing the boundary must go via the VS Code message protocol (`postMessage` / `onDidReceiveMessage`).
- Webview content must be self-contained (bundled assets).
- CSP is controlled by VS Code; the webview must not depend on inline scripts.

### C-2 — Extension API Constraints

- No editor APIs that depend on undocumented internals.
- No API marked as proposed/ unstable unless explicitly opted in via `enabledApiProposals` in `package.json`.

### C-3 — Build Constraints

- The UI must be a buildable Next.js app whose static export is bundled into the extension at packaging time.
- No Next.js server runtime is shipped.

### C-4 — Editor Constraints

- VS Code and Cursor share the bulk of the API but may diverge on telemetry and certain workspace features. Differences shall be documented.

---

## 8. Glossary

| Term | Definition |
| --- | --- |
| Active coding | Time during which the user produced meaningful editor activity and the timer was in `ACTIVE` state. |
| Idle threshold | Continuous inactivity duration after which the timer transitions `ACTIVE → PAUSED`. |
| Session-end threshold | Continuous inactivity duration after which an ongoing session is closed. |
| Session | A bounded period of active coding separated by pauses or breaks. |
| Combo | Multiplier derived from continuous active minutes within the current session. |
| Streak | Consecutive local days meeting the streak minimum. |
| Flow time | Synonym used in UI copy for active coding time when a session is long and uninterrupted. |
| Activity pulse | A single normalised "activity happened now" event after debouncing. |

---

## 9. Acceptance Criteria (V1)

V1 is shippable when:

1. Opening VS Code without activity shows total = 0 and no fake session growth.
2. Real activity produces believable active coding time.
3. Idle threshold pauses the timer; resumed activity resumes it.
4. Session-end threshold closes the session; new activity opens a new one.
5. Combo, goal, streak behave as specified.
6. All persisted state survives editor restart.
7. No source code leaves the machine.
8. CPU < 1%, memory < 50 MB during normal use.
9. Tests for all engines pass.
10. Documentation in `/docs` is consistent with the implementation.
