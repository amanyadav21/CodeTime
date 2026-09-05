# CodePulse — Low-Level Design (LLD)

Version: 0.2
Scope: V1
Audience: Engineers implementing the extension.

This document is implementation-oriented. It complements `HLD.md` and `ARCHITECTURE.md`. It does not duplicate `DATA_MODEL.md` — fields are referenced, not redefined.

---

## 1. Conventions

- TypeScript strict mode. No implicit `any`. Prefer `unknown` at boundaries.
- All time durations inside engines are `number` (ms) of monotonic time (`performance.now()`).
- All wall-clock timestamps are `number` (ms since epoch, `Date.now()`).
- All IDs are `string` ULIDs generated via `util/id.ts` (no external dep).
- No engine depends on `vscode`. Engines receive injected sources and emit plain events.
- No `any` in public APIs. The only place `any` may appear is the boundary of a `JSON.parse` / `JSON.stringify` round-trip; it is re-validated immediately.

## 2. Module: `util/time.ts`

```ts
export type MonotonicMs = number;
export type WallMs = number;

export function nowMono(): MonotonicMs;
export function nowWall(): WallMs;
export function startOfLocalDay(wall: WallMs): WallMs; // ms at local midnight
export function localDayKey(wall: WallMs): string;     // 'YYYY-MM-DD'
export function isLocalMidnightCross(prev: WallMs, now: WallMs): boolean;
```

Local-day logic uses `Intl.DateTimeFormat` with `timeZone: undefined` (system local).

## 3. Module: `util/debounce.ts`

```ts
export function debounce<F extends (...a: any[]) => void>(
  fn: F, waitMs: number
): F & { cancel(): void };
```

The internal timer is a `setTimeout` whose handle is stored so `.cancel()` is reliable. The first call wins; subsequent calls within the window are coalesced.

## 4. Module: `util/id.ts`

```ts
export function ulid(): string;
```

A 26-char Crockford Base32 ULID. Monotonic, sortable, no external dependency. The first 10 chars encode time; the remaining 16 chars encode randomness.

## 5. Module: `util/logger.ts`

```ts
export interface Logger {
  debug(msg: string, data?: unknown): void;
  info(msg: string, data?: unknown): void;
  warn(msg: string, data?: unknown): void;
  error(msg: string, data?: unknown): void;
}
export function createLogger(channelName: string, debugFlag: () => boolean): Logger;
```

The logger is backed by a `vscode.OutputChannel` when available, and by `console` otherwise (for unit tests). `debug` calls are dropped when the flag is false.

## 6. Module: `engines/activityTracker.ts`

### 6.1 Responsibilities

- Subscribe to editor events from `vscode`.
- Normalise events to a single "activity happened at `now`" signal.
- Apply debounce so that sustained typing emits ~10 Hz pulses, not raw keystrokes.

### 6.2 Inputs

- `vscode.window.onDidChangeActiveTextEditor`
- `vscode.window.onDidChangeTextEditorSelection`
- `vscode.window.onDidChangeTextEditorVisibleRanges` (scroll proxy)
- `vscode.workspace.onDidChangeTextDocument` (debounced)
- `vscode.workspace.onDidSaveTextDocument`
- `vscode.workspace.onDidOpenTextDocument`
- `vscode.workspace.onDidCloseTextDocument`
- `vscode.workspace.onDidChangeWorkspaceFolders`

### 6.3 Output

```ts
export type ActivityListener = (wall: WallMs) => void;

export interface ActivityTracker {
  start(): void;
  stop(): void;
  onActivity(listener: ActivityListener): () => void; // returns unsubscribe
}
```

### 6.4 Logic

- All subscriptions are stored in a `vscode.Disposable[]`.
- Each raw event calls an internal `onRawEvent()` which is debounced 100 ms.
- After debounce, the tracker fires all listeners with `nowWall()`.
- `stop()` disposes all subscriptions and cancels the debounce timer.

### 6.5 Edge cases

- Multiple events within 100 ms collapse to a single pulse.
- `onDidChangeTextEditorVisibleRanges` may fire during normal selection changes. The tracker treats it as activity only when the visible range *changed* (cached last range).
- Terminal / debug events are NOT subscribed in V1.

## 7. Module: `engines/timerEngine.ts`

### 7.1 State

```ts
export type TimerState = 'IDLE' | 'ACTIVE' | 'PAUSED';

export interface TimerSnapshot {
  state: TimerState;
  activeMillis: number;        // current session active duration
  sessionStartedAt: WallMs | null;
  lastActivityAt: WallMs | null;
}
```

### 7.2 Public API

```ts
export interface TimerEngine {
  signalActivity(wall: WallMs): void;
  snapshot(): TimerSnapshot;
  onChange(listener: (s: TimerSnapshot) => void): () => void;
  shutdown(wall: WallMs): TimerSnapshot; // closes current session
}
```

### 7.3 Transitions

| From | To | Trigger |
| --- | --- | --- |
| IDLE | ACTIVE | `signalActivity` |
| ACTIVE | PAUSED | `nowWall - lastActivityAt > idleThreshold` (checked on tick) |
| PAUSED | ACTIVE | `signalActivity` |
| PAUSED | IDLE | `nowWall - lastActivityAt > sessionEndThreshold` |
| ACTIVE | IDLE | forced close (`shutdown`) |
| ACTIVE | IDLE | midnight split |

### 7.4 Tick loop

The engine owns a 1 Hz internal tick via a self-rescheduling `setTimeout`:

```ts
function tick() {
  const mono = nowMono();
  const wall = nowWall();
  const elapsed = mono - lastTickMono;
  if (state === 'ACTIVE') activeMillis += Math.min(elapsed, 2000);
  lastTickMono = mono;
  // threshold checks
  scheduleNext();
}
```

The 2 s cap on per-tick delta prevents a giant jump on resume from sleep. The chain self-corrects.

### 7.5 Configuration consumed

```ts
interface TimerConfig {
  idleThresholdMs: number;       // default 60_000
  sessionEndThresholdMs: number; // default 15 * 60_000
}
```

### 7.6 Edge cases

- A `signalActivity` arriving while the engine is in IDLE due to session-end will start a new session (delegated to Session Manager).
- Shutdown mid-session ends the session cleanly.
- Re-entrant transitions: each transition emits exactly one `onChange` notification.

## 8. Module: `engines/sessionManager.ts`

### 8.1 State

```ts
export interface CodingSession {
  id: string;
  startedAt: WallMs;
  endedAt: WallMs | null;
  activeMillis: number;
}

export interface DailyStats {
  day: string;            // 'YYYY-MM-DD' in local tz
  totalActiveMillis: number;
  sessions: CodingSession[];
  longestSessionMillis: number;
}

export interface SessionsSnapshot {
  current: CodingSession | null;
  today: DailyStats;
  history: DailyStats[]; // last `historyRetentionDays` days, ascending
}
```

### 8.2 Public API

```ts
export interface SessionManagerDeps {
  timer: TimerEngine;
  storage: StorageManager;
  now: () => WallMs;
  config: SessionManagerConfig;
}

export interface SessionManagerConfig {
  goalMinutes: number;
  streakMinimumMinutes: number;
  combo: ComboThresholds;
  historyRetentionDays: number; // default 365
}

export interface SessionManager {
  start(): void;
  stop(): void;
  snapshot(): SessionsSnapshot;
  onChange(l: (s: SessionsSnapshot) => void): () => void;
  setGoal(minutes: number): void;
  setStreakMinimum(minutes: number): void;
}
```

### 8.3 Logic

- Subscribes to `timer.onChange`.
- On `IDLE → ACTIVE`: open a new `CodingSession`, push to `today.sessions`. Emit `sessionStarted` notification (deduped per session).
- On `ACTIVE → PAUSED`: nothing structural, but `current.activeMillis` is frozen.
- On `PAUSED → ACTIVE`: continue, no new session.
- On `PAUSED → IDLE` or `ACTIVE → IDLE` (shutdown / midnight): close current session (`endedAt = now`), increment `today.totalActiveMillis`, recompute `longestSessionMillis`. Fire goal/streak checks.
- On midnight rollover during an open session: close it on the *previous* day, push a new `DailyStats` for the new day, do not open a new session unless activity continues.

### 8.4 Notifications / side effects

- Session started: `Notifier.notify('sessionStarted')` (deduped per session; opt-in by default).
- Goal reached: `Notifier.notify('goalReached')` once per day.
- Streak milestone: delegated to Streak Engine.

## 9. Module: `engines/comboEngine.ts`

```ts
export interface ComboThresholds {
  // sorted ascending by minutes
  levels: { minutes: number; multiplier: number }[];
}

export interface ComboSnapshot {
  multiplier: number;       // 0 if below first threshold
  nextAtMinutes: number | null;
  continuousActiveMinutes: number;
}

export interface ComboEngine {
  snapshot(): ComboSnapshot;
  onChange(l: (s: ComboSnapshot) => void): () => void;
}
```

- Pure function over `currentSession.activeMillis`.
- `continuousActiveMinutes` is the current session's active duration divided by 60_000 (floored).
- `multiplier` is the largest level whose `minutes ≤ continuousActiveMinutes`.
- On session close: `multiplier = 0`.
- On session resume after pause: combo continues from where it was (frozen during pause).
- On every crossing of a level boundary, `onChange` fires. The UI animates only on transitions (React effect, see `UI_SPECIFICATION.md` § 2.3).

## 10. Module: `engines/streakEngine.ts`

```ts
export interface StreakSnapshot {
  currentStreak: number;
  isTodayQualifying: boolean;
  lastQualifyingDay: string | null;
}

export interface StreakEngine {
  snapshot(): StreakSnapshot;
  onChange(l: (s: StreakSnapshot) => void): () => void;
}
```

- Reads `history` sorted by day descending.
- Counts back from the **most recent qualifying day** (today if `isTodayQualifying`, otherwise yesterday if that is qualifying, otherwise nothing). Walk back while `totalActiveMillis ≥ streakMinimumMs`.
- Streak milestones: 3, 7, 14, 30, 60, 100. Emits at most once per crossing.
- The "today is not yet qualifying" state is preserved in the snapshot so the UI can show the "keep going today" hint.

## 11. Module: `engines/goalEngine.ts`

```ts
export interface GoalSnapshot {
  goalMinutes: number;
  todayMinutes: number;
  percent: number;          // 0..100, clamped
  completed: boolean;
}
```

- Pure projection over `DailyStats` and `goalMinutes`.
- `completed` flips once per day and triggers `goalReached` notification.

## 12. Module: `storage/storageManager.ts`

### 12.1 Interface

```ts
export interface StorageManager {
  load(): Promise<PersistedState>;
  save(state: PersistedState): Promise<void>;
  onQuotaError(handler: (err: unknown) => void): () => void;
}

export interface PersistedState {
  schemaVersion: number;            // current = 1
  snapshot: SessionsSnapshot;
  settings: UserSettings;
}
```

### 12.2 Validation

On `load()`:
1. Read raw JSON from `globalState.get('codepulse.state')`.
2. If absent → return defaults.
3. If JSON malformed → log warning, return defaults.
4. Validate against `schema.ts` (hand-rolled type guards in V1 to avoid dependencies).
5. If `schemaVersion < CURRENT` → run migrations.
6. If `schemaVersion > CURRENT` → preserve to `codepulse.state.unknownBackup`, return defaults, schedule a one-time notification.
7. Return validated state.

### 12.3 Write policy

- Debounced 500 ms to coalesce bursts.
- Single key: `codepulse.state`.
- On `QuotaExceeded` or any error: prune `history` to `historyRetentionDays/2`, retry once, log.

## 13. Module: `messaging/protocol.ts`

```ts
export type CpServerMessage =
  | { type: 'snapshot'; payload: EngineSnapshot }
  | { type: 'notification'; payload: { kind: 'goalReached' | 'comboMilestone' | 'streakMilestone' | 'sessionStarted'; data?: unknown } };

export type CpClientMessage =
  | { type: 'ready' }
  | { type: 'setGoal'; minutes: number }
  | { type: 'setStreakMinimum'; minutes: number }
  | { type: 'requestSnapshot' };

export interface EngineSnapshot {
  schemaVersion: 1;
  generatedAt: WallMs;
  timer: TimerSnapshot;
  sessions: SessionsSnapshot;
  combo: ComboSnapshot;
  streak: StreakSnapshot;
  goal: GoalSnapshot;
  settings: UserSettings;
}
```

The webview sends `ready` once after mount; the extension host replies with a `snapshot`. All subsequent updates flow server → client as `snapshot` messages, throttled to 1 Hz.

The `notification` kind is reserved for UI-only cues (e.g., transient toasts inside the webview). OS notifications are handled by the `Notifier`, not via the bridge.

## 14. Module: `messaging/bridge.ts`

```ts
export interface MessageBridge {
  attach(webview: vscode.Webview): void;
  publish(snapshot: EngineSnapshot): void;
  onClientMessage(handler: (msg: CpClientMessage) => void): () => void;
  dispose(): void;
}
```

- Validates every message before invoking the handler.
- Coalesces `publish` calls within a 1 s window to enforce the 1 Hz cap.
- On webview disposal, all `Disposable` references are cleared.

## 15. Module: `ui/sidebarProvider.ts`

- Registers a `WebviewViewProvider` for `codepulse.dashboard`.
- Resolves a webview with:
  - `localResourceRoots: [vscode.Uri.joinPath(extUri, 'webview')]`
  - `enableScripts: true`
  - `retainContextWhenHidden: true`
- HTML template loads the static `out/index.html` produced by the Next.js export, with a base URL rewritten to the extension's webview URI.
- Listens to `onDidReceiveMessage` and forwards to `MessageBridge.onClientMessage`.

## 16. Module: `ui/statusBar.ts`

```ts
export interface StatusBar {
  update(snapshot: EngineSnapshot): void;
  dispose(): void;
}
```

- Creates a `StatusBarItem` with `Priority.Low` aligned right.
- Text format: `${icon} ${formatHms(todayMinutes)}` where `icon` ∈ `⚡ ⏸ ○`.
- Tooltip: full snapshot summary (today, current session, combo, streak, hint).

## 17. Module: `notifications/notifier.ts`

```ts
export interface Notifier {
  notify(kind: NotifKind, data?: unknown): void;
}
```

- `withProgress` is NOT used (avoids stealing focus).
- Uses `vscode.window.showInformationMessage` with low frequency.
- Internal flag map prevents duplicate notifications per session / per day.

## 18. Module: `config/settings.ts`

```ts
export interface UserSettings {
  idleThresholdSeconds: number;          // default 60
  sessionEndThresholdSeconds: number;    // default 900
  goalMinutes: number;                   // default 240
  streakMinimumMinutes: number;          // default 30
  comboLevels: { minutes: number; multiplier: number }[];
  historyRetentionDays: number;          // default 365
  debugLogging: boolean;                 // default false
  notifyOnSessionStart: boolean;         // default false
}
```

- Backed by `vscode.workspace.getConfiguration('codepulse')`.
- `codepulse.*` settings are listed in `package.json#contributes.configuration`.
- All values are validated; invalid values fall back to defaults with a warning.

## 19. Event Flow Examples

### 19.1 User types continuously

```
[editor onDidChangeTextDocument]
  → activityTracker (debounced 100 ms)
  → timerEngine.signalActivity(now)
  → state IDLE → ACTIVE; sessionManager opens session
  → 1 Hz tick increments activeMillis (monotonic)
  → bridge.publish(snapshot) throttled to 1 Hz
```

### 19.2 User walks away 5 minutes

```
no events → tick at 60 s → ACTIVE → PAUSED
no events → tick at 900 s → PAUSED → IDLE; session closed
no events → timer stays IDLE
```

### 19.3 Editor restart mid-session

```
deactivate(): timerEngine.shutdown(now)
  → close session, persist (debounced flush)
activate(): storageManager.load()
  → rehydrate; current session = null on V1
  → resume activity detection
```

## 20. Error Handling

| Class | Example | Handling |
| --- | --- | --- |
| Recoverable | Storage quota exceeded | Prune + retry, log, continue. |
| Recoverable | Invalid setting | Fall back to default, log. |
| Non-recoverable | `vscode` API throws unexpectedly | Catch in module, log, swallow (never throw across async boundary). |
| UI | Webview crashes | Engine keeps running; status bar continues. |

No engine method throws under normal operation. Boundaries (Activity Tracker → engines) translate exceptions into logged warnings.

## 21. Edge Cases

The following are covered by unit tests in `tests/unit/`:

1. Open VS Code, no activity → today = 0, no sessions.
2. Activity burst then idle → session persists, idle pause respected.
3. Idle beyond session-end → session closed; new activity starts a new session.
4. Midnight during a session → session closed on day N, new session opens on day N+1 (only if activity continues).
5. Two activity events 50 ms apart → single pulse.
6. Hundreds of selection events per second → CPU bounded by debounce.
7. Clock jumps backward → monotonic deltas unaffected.
8. Clock jumps forward during ACTIVE → tick processes `min(elapsed, 2000)` to avoid a giant jump.
9. Corrupted storage → defaults restored, extension continues.
10. Extension reload mid-session → session closed, no double-count on next activate.
11. Multiple workspaces open → activity aggregated across all editors.
12. Multiple windows (Cursor multi-window) → activity aggregated by summing pulses; deduplicated within debounce window.
13. Very long session (>24 h) → session closed on midnight; new session opens if activity continues.
14. Notification storm prevention → notifier deduplicates per kind per scope.
15. Unknown future `schemaVersion` → preserved to sidecar, defaults returned.
16. Combo crossing back to 0 after session end → UI animates only on transitions, no flicker.
17. Streak "today not yet qualifying" → snapshot reports `isTodayQualifying: false`; UI shows the at-risk hint.

## 22. Open LLD Questions (V1 resolutions)

- **Q-1** `setInterval` vs self-rescheduling `setTimeout` for the tick? → V1 uses self-rescheduling `setTimeout` driven by `performance.now()`. Documented in `timerEngine.ts` header.
- **Q-2** Emit on every combo threshold crossing or only on display changes? → V1: emit on every crossing; the webview animates only on transitions (React effect).
