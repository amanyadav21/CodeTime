# CodePulse — Data Model

Version: 0.2
Scope: V1

This document is the canonical reference for everything CodePulse persists and exposes in-memory. Field-level types are normative; type names referenced from `LLD.md` are defined here.

---

## 1. Top-Level Container

All persisted data lives under a single `globalState` key, `codepulse.state`, as a JSON-serialised blob:

```ts
interface PersistedState {
  schemaVersion: number;          // current = 1
  settings: UserSettings;
  history: DailyStats[];          // sorted ascending by `day`
  currentSession: CodingSession | null;
  lastUpdatedAt: number;          // wall ms
}
```

The in-memory `EngineSnapshot` (sent to UI) is composed from this blob plus live engine state (see `LLD.md` § 13).

## 2. `UserSettings`

| Field | Type | Default | Validation |
| --- | --- | --- | --- |
| `idleThresholdSeconds` | number | 60 | 10..600, integer |
| `sessionEndThresholdSeconds` | number | 900 | 60..86_400, integer |
| `goalMinutes` | number | 240 | 1..1440, integer |
| `streakMinimumMinutes` | number | 30 | 1..1440, integer |
| `comboLevels` | `{ minutes: number; multiplier: number }[]` | default ladder | sorted ascending by `minutes`, `multiplier ≥ 1` |
| `historyRetentionDays` | number | 365 | 30..3650, integer |
| `debugLogging` | boolean | false | — |
| `notifyOnSessionStart` | boolean | false | — |

Default combo ladder:

```ts
[
  { minutes: 10, multiplier: 1 },
  { minutes: 20, multiplier: 2 },
  { minutes: 30, multiplier: 3 },
  { minutes: 40, multiplier: 4 },
  { minutes: 60, multiplier: 5 },
  { minutes: 90, multiplier: 6 }
]
```

## 3. `CodingSession`

```ts
interface CodingSession {
  id: string;                  // ULID
  startedAt: number;           // wall ms
  endedAt: number | null;      // null = open
  activeMillis: number;        // monotonic active duration in this session
}
```

- `id` is generated on session open (see `util/id.ts`).
- `activeMillis` increments only while `TimerState == ACTIVE`.
- A session with `endedAt != null` is immutable except for internal corrections on midnight rollover.

## 4. `DailyStats`

```ts
interface DailyStats {
  day: string;                            // 'YYYY-MM-DD' in local tz
  totalActiveMillis: number;              // sum of closed + live session activeMillis
  sessions: CodingSession[];              // all sessions that day, including live if any
  longestSessionMillis: number;           // max over sessions (live: candidate)
}
```

- Invariant: `totalActiveMillis === sum(sessions.activeMillis)` at all times.
- A day may have zero sessions (e.g., the day before the user installed CodePulse).

## 5. `ComboState`

Lives in-memory only. Re-derived from `currentSession.activeMillis`.

```ts
interface ComboState {
  multiplier: number;
  continuousActiveMinutes: number;
  nextAtMinutes: number | null; // null if at top
}
```

## 6. `StreakState`

Lives in-memory only. Re-derived from `history`.

```ts
interface StreakState {
  currentStreak: number;
  isTodayQualifying: boolean;
  lastQualifyingDay: string | null;
}
```

## 7. Engine Snapshot (in-memory)

```ts
interface EngineSnapshot {
  schemaVersion: 1;
  generatedAt: number;             // wall ms
  timer: {
    state: 'IDLE' | 'ACTIVE' | 'PAUSED';
    activeMillis: number;          // current session active duration
    sessionStartedAt: number | null;
    lastActivityAt: number | null;
  };
  sessions: {
    current: CodingSession | null;
    today: DailyStats;
    bestTodayMillis: number;
  };
  combo: ComboState;
  streak: StreakState;
  goal: {
    goalMinutes: number;
    todayMinutes: number;
    percent: number;               // 0..100
    completed: boolean;
  };
  settings: UserSettings;
}
```

## 8. Validation Rules

On `load()`:

- If `schemaVersion` is missing or not a number → defaults.
- For each `DailyStats`:
  - `day` must match `/^\d{4}-\d{2}-\d{2}$/`.
  - `totalActiveMillis ≥ 0`.
  - `sessions` must be an array; each element validated as `CodingSession`.
- For each `CodingSession`:
  - `id` non-empty string.
  - `startedAt`, `endedAt` numbers (`endedAt` may be null).
  - `activeMillis ≥ 0`.
- If any validation fails, the offending field is replaced by its default; a `warn` is logged with the field path.

## 9. Versioning & Migration

- `schemaVersion` is an integer.
- Migration is a sequence of pure functions: `migrate(v0 → v1)`, `migrate(v1 → v2)`, ...
- Each migration returns a new blob with the next `schemaVersion`.
- Migrations are unit-tested with fixture blobs (committed under `tests/fixtures/migrations/`).
- On unknown future version (`schemaVersion > CURRENT`), the blob is preserved as-is in a sidecar key (`codepulse.state.unknownBackup`) and defaults are returned; user is informed via a one-time notification ("Stored data is newer than this version of CodePulse").

## 10. Quota & Pruning

- `globalState` quota is typically a few MB per extension. V1 data is small.
- On `QuotaExceeded`:
  1. Compute new retention = `floor(historyRetentionDays / 2)`.
  2. Prune `history` to the last `retention` days.
  3. Retry `update`.
  4. If still failing, log error and continue without persisting (transient loss only).

## 11. Privacy Boundary

What is stored:

- Aggregate durations and counts.
- Local-day strings (not timestamps of individual keystrokes).
- User settings.

What is **NOT** stored:

- File contents.
- File paths (in V1; may add project labels in V2 only if user opts in).
- Editor selections or text.
- Identifiers of the user or machine.
