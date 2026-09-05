# CodePulse — Activity Detection

Version: 0.2
Scope: V1

Activity detection is the most important part of CodePulse. It is also the most misunderstood. This document is explicit about what is and what is not counted, and honest about limitations.

---

## 1. Definition

**Active coding** = time during which the user produced a *positive activity signal* inside the editor, and the timer remained in `ACTIVE` state.

**Activity signal** = any of the events listed in §3, after debouncing (~100 ms).

**Inactive** = no activity signal within the configured idle threshold.

---

## 2. What Counts as Activity

| Signal | Source | Notes |
| --- | --- | --- |
| Typing / text changes | `workspace.onDidChangeTextDocument` | Debounced 100 ms. |
| Cursor movement | `window.onDidChangeTextEditorSelection` | Debounced. |
| Selection change | same as above | Even a click into a different place counts. |
| Scroll | `window.onDidChangeTextEditorVisibleRanges` (range changed) | Cached to avoid duplicate fires. |
| Active editor switch | `window.onDidChangeActiveTextEditor` | Includes switching to settings / markdown preview. |
| File open | `workspace.onDidOpenTextDocument` | |
| File close | `workspace.onDidCloseTextDocument` | |
| File save | `workspace.onDidSaveTextDocument` | |
| Workspace switch | `workspace.onDidChangeWorkspaceFolders` | Multi-root workspace support. |

## 3. What Does NOT Count as Activity

| Behaviour | Reason |
| --- | --- |
| Window gaining focus alone | The user may simply alt-tab in. |
| Window becoming visible alone | Visibility does not imply coding. |
| Editor focus alone | Opening a file and staring at it is not coding. |
| Terminal-only activity | V1 excludes terminal events to avoid overcounting shell commands. |
| Debug-only activity | V1 excludes debug events. |
| Idle presence | Sitting with VS Code open while reading elsewhere. |

V1 deliberately prefers to **undercount** rather than overcount. We can always relax thresholds later; overcounting breaks user trust.

---

## 4. Idle Threshold

- Default: **60 seconds**.
- Configurable: 10–600 s.
- On crossing the threshold with no activity signal, timer transitions `ACTIVE → PAUSED`. `activeMillis` stops accumulating.

## 5. Pause Behaviour

- The current session **stays open** during `PAUSED`.
- Combo is **frozen** (not reset).
- After `sessionEndThreshold` (default 15 min) of continuous `PAUSED`, the session is **closed** and the timer returns to `IDLE`.

## 6. Resume Behaviour

- Any activity signal during `PAUSED` transitions to `ACTIVE` and resumes accumulation.
- Combo continues from its frozen value.

## 7. Multiple Windows

- VS Code and Cursor both allow multiple windows. Activity events from all windows are aggregated because the extension host is per-process and each process sees its own events. The Activity Tracker treats all of them as a single source.
- For a single window holding multiple editors, `onDidChangeActiveTextEditor` and selection events are aggregated across editors.

## 8. Multiple Workspaces

- All workspaces in the same window are treated as a single activity source.
- Switching workspaces is itself an activity event.

## 9. Terminal and Debug Activity

- **Out of scope for V1.** Including these would require deciding what "active coding" means in a shell session or a long-running debug pause, and both are easy to overcount.
- Documented as a V2 candidate in `FUTURE_ROADMAP.md`.

## 10. Long Reading / Thinking Periods

- A user reading code for 5 minutes between edits will see the timer transition to `PAUSED` at 60 s and the session end at 15 min.
- This is the intended behaviour. The user can tune `idleThresholdSeconds` upward if they read more than they type.
- CodePulse will never claim to measure mental focus. It measures *editor activity*.

## 11. Laptop Sleep / Wake

- VS Code emits no events while suspended.
- After wake:
  - If the elapsed wall time since `lastActivityAt` is less than `sessionEndThreshold`, the session is marked `PAUSED` but not yet ended. The next editor event resumes it.
  - If the elapsed wall time exceeds `sessionEndThreshold`, the session is closed and the timer returns to `IDLE`.

## 12. VS Code Restart

- On `deactivate()`:
  - If a session is open, it is closed cleanly (`endedAt = now`, `activeMillis` final).
  - State is persisted.
- On next `activate()`:
  - Storage is loaded.
  - No session is auto-resumed; the user must produce a fresh activity signal.

## 13. System Clock Changes

- The timer uses `performance.now()` for durations, so clock skew during ACTIVE does not affect `activeMillis`.
- Wall-clock-derived timestamps (`startedAt`, `endedAt`) may be slightly off after a clock change. This is acceptable because no aggregate is computed from those during ACTIVE.
- `lastActivityAt` is wall-based and is only used to compare to *current* wall time; small skew is self-correcting on the next tick.
- A forward jump in wall time is also bounded by the per-tick delta cap of 2 s (see `LLD.md` § 7.4).

## 14. Extension Reload

- Handled identically to VS Code restart. See § 12.

## 15. Editor Differences (VS Code vs Cursor)

- Both implement the standard `vscode` API.
- Cursor may diverge in:
  - Default keybindings for AI commands (irrelevant to activity).
  - Some proposed APIs (CodePulse avoids them).
  - Telemetry defaults (irrelevant: CodePulse ships no telemetry).
- No known divergence that affects activity detection as of V1.

## 16. Limitations (Honest List)

CodePulse activity detection is **not** and **cannot be**:

- A measure of mental effort.
- A measure of code quality.
- A measure of "focus" in a psychological sense.
- A guarantee that the user was actually coding.

It is a reasonable **activity-based estimate** of coding time using editor events. We will never market it as anything stronger.
