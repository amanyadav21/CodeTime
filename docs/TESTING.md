# CodePulse — Testing Strategy

Version: 0.2
Scope: V1

Testing is required for all engines and for the storage layer. UI tests are minimal in V1 (the UI is a thin renderer over snapshots).

---

## 1. Test Runner

- **Vitest** for unit and integration tests in Node.
- **@vscode/test-electron** for extension-host integration tests.
- Pure-engine tests do not require the VS Code runtime; they are fast and run on every save.

## 2. Test Layout

```
tests/
├── unit/
│   ├── activityTracker.spec.ts
│   ├── timerEngine.spec.ts
│   ├── sessionManager.spec.ts
│   ├── comboEngine.spec.ts
│   ├── streakEngine.spec.ts
│   ├── goalEngine.spec.ts
│   ├── storageManager.spec.ts
│   ├── settings.spec.ts
│   ├── debounce.spec.ts
│   ├── time.spec.ts
│   ├── id.spec.ts
│   └── migrations.spec.ts
├── integration/
│   ├── extension-lifecycle.spec.ts
│   ├── session-lifecycle.spec.ts
│   └── webview-bridge.spec.ts
├── fixtures/
│   ├── sessions/
│   └── migrations/
└── e2e/                       # manual checklist; see § 7
```

## 3. Unit Tests

### 3.1 `timerEngine.spec.ts`

Pure tests over a `TimerEngine` with an injected `now()` function. Cases:

1. IDLE → ACTIVE on first signal.
2. ACTIVE → PAUSED after idle threshold (simulate by jumping `now`).
3. PAUSED → ACTIVE on next signal.
4. PAUSED → IDLE after session-end threshold.
5. `shutdown()` mid-session returns a snapshot with `endedAt = now`.
6. Multiple rapid signals inside 100 ms coalesce into a single transition.
7. Tick increments `activeMillis` using monotonic time only.
8. Clock jump backward during ACTIVE does not change `activeMillis`.
9. Clock jump forward larger than the 2 s tick cap → `activeMillis` only increases by the cap.

### 3.2 `sessionManager.spec.ts`

- Open on `IDLE → ACTIVE`.
- Close on `PAUSED → IDLE` after session-end.
- Midnight rollover: feed a sequence that crosses local midnight; assert two `DailyStats` are produced and the session is split.
- Persistence: closing a session triggers a `storage.save` call with the correct `totalActiveMillis`.

### 3.3 `comboEngine.spec.ts`

- Below first threshold → `×0`.
- At each ladder step → correct multiplier.
- Pause does not reset combo.
- New session resets combo.
- `nextAtMinutes` is the next ladder step or `null`.

### 3.4 `streakEngine.spec.ts`

- 0 days qualifying → streak 0.
- Today qualifying, yesterday qualifying → streak 2.
- Today not qualifying, yesterday qualifying → streak counts back from yesterday.
- Crossing 3, 7, 14, 30, 60, 100 emits exactly once per crossing.
- `isTodayQualifying` reflects today's status even before qualification.

### 3.5 `goalEngine.spec.ts`

- Empty today → 0 %.
- Halfway → 50 %.
- Above goal → 100 %, completed flag set once per day.

### 3.6 `storageManager.spec.ts`

- Round-trip a valid state.
- Corrupt JSON → defaults, warning logged.
- Wrong `schemaVersion` lower → migration runs.
- Wrong `schemaVersion` higher → defaults, sidecar `codepulse.state.unknownBackup` written.
- Quota error → prune + retry.
- Invalid field (e.g., negative `activeMillis`) → offending field replaced by default, warning logged.

### 3.7 `activityTracker.spec.ts`

- Debounce window: 5 events in 50 ms → 1 listener call.
- Each subscribed event leads to a listener call after debounce.
- `stop()` cancels pending debounce and disposes all subscriptions.

### 3.8 `settings.spec.ts`

- Invalid value falls back to default.
- Updating `codepulse.idleThresholdSeconds` notifies listeners.

### 3.9 `id.spec.ts`

- `ulid()` returns 26-char Crockford Base32.
- Two calls within the same ms still return distinct values (randomness).
- Output is sortable by time within the same process.

## 4. Integration Tests

### 4.1 `extension-lifecycle.spec.ts`

Launches a headless VS Code via `vscode-test`, activates CodePulse, asserts the sidebar view is registered and the status bar item exists. Deactivates; asserts storage key was written if there was any activity.

### 4.2 `session-lifecycle.spec.ts`

Simulates:
1. Activate.
2. Inject a synthetic activity event source.
3. Wait until ACTIVE.
4. Wait past idle threshold → PAUSED.
5. Inject activity → ACTIVE.
6. Deactivate.
7. Re-activate → verify persisted state is restored.

### 4.3 `webview-bridge.spec.ts`

Opens the sidebar webview in the test instance, sends `ready`, asserts a `snapshot` message arrives with the expected fields. Sends `setGoal { minutes: 300 }`, asserts a subsequent snapshot reflects the change.

## 5. Edge Cases (Explicit Test Set)

The following edge cases MUST have a test:

| # | Scenario |
| --- | --- |
| EC-1 | Open VS Code, do nothing → today = 0, no sessions. |
| EC-2 | Open VS Code, immediately start coding → first session begins within one tick. |
| EC-3 | Stop typing, walk away for 5 min → PAUSED then IDLE; new session on return. |
| EC-4 | Long think period inside an active session → combo frozen, session preserved. |
| EC-5 | Close VS Code mid-session → session persisted with `endedAt`. |
| EC-6 | Laptop sleeps → next activity reopens a session, not the old one. |
| EC-7 | Extension reload mid-session → no double-count on re-activate. |
| EC-8 | System clock jumps backward → `activeMillis` unaffected. |
| EC-9 | System clock jumps forward → `activeMillis` capped per-tick delta. |
| EC-10 | Midnight during a session → day split, both days have stats. |
| EC-11 | Multiple files open simultaneously → activity aggregated. |
| EC-12 | Multiple workspaces → activity aggregated. |
| EC-13 | Storage corruption → defaults restored, no crash. |
| EC-14 | Invalid stored values (negative durations, bad day string) → discarded. |
| EC-15 | Very long session (>24 h) → split on midnight. |
| EC-16 | Hundreds of selection events / second → debounced; CPU bounded. |
| EC-17 | Notification storm prevention → at most one of each kind per scope. |
| EC-18 | Unknown future `schemaVersion` → preserved to sidecar, defaults returned. |
| EC-19 | Webview dispose mid-session → engine keeps running, status bar updates continue. |
| EC-20 | `prefers-reduced-motion` in webview → animations disabled; layout stable. |

## 6. Performance Smoke Tests

A separate, non-gating perf check:

- Spawn 1000 selection events per second for 10 seconds.
- Assert that listener call count ≤ 100 (≈100 ms debounce × 10 s).
- Assert that `globalState` write count ≤ 20 (storage is debounced 500 ms).

## 7. Manual E2E Checklist

A documented human-driven checklist under `tests/e2e/manual.md` covers:

- Status bar visibility across light/dark themes.
- Sidebar rendering with `prefers-reduced-motion`.
- Notification behaviour in Zen mode.
- Cursor-specific UI parity.

## 8. CI

- `npm run lint`, `npm run typecheck`, `npm run test:unit` run on every push.
- Integration tests are optional in CI for V1 (extension-host tests are slow); they run on a nightly schedule.

## 9. Coverage Targets

- Engines: ≥ 90 % line coverage.
- Storage: ≥ 90 % branch coverage.
- UI: snapshot tests for one render of each component.
