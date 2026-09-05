// Data model types and schema versioning.
// Per DATA_MODEL.md and LLD.md § 12.

export const CURRENT_SCHEMA_VERSION = 1;

export interface UserSettings {
  idleThresholdSeconds: number;
  sessionEndThresholdSeconds: number;
  goalMinutes: number;
  streakMinimumMinutes: number;
  comboLevels: ComboThresholds['levels'];
  historyRetentionDays: number;
  debugLogging: boolean;
  notifyOnSessionStart: boolean;
}

export interface ComboThresholds {
  levels: { minutes: number; multiplier: number }[];
}

export interface CodingSession {
  id: string;
  startedAt: number;
  endedAt: number | null;
  activeMillis: number;
}

export interface DailyStats {
  day: string;
  totalActiveMillis: number;
  sessions: CodingSession[];
  longestSessionMillis: number;
}

export interface ComboState {
  multiplier: number;
  continuousActiveMinutes: number;
  nextAtMinutes: number | null;
}

export interface StreakState {
  currentStreak: number;
  isTodayQualifying: boolean;
  lastQualifyingDay: string | null;
}

export interface GoalState {
  goalMinutes: number;
  todayMinutes: number;
  percent: number;
  completed: boolean;
}

export interface EngineSnapshot {
  schemaVersion: 1;
  generatedAt: number;
  timer: {
    state: 'IDLE' | 'ACTIVE' | 'PAUSED';
    activeMillis: number;
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
  goal: GoalState;
  settings: UserSettings;
}

export interface PersistedState {
  schemaVersion: number;
  settings: UserSettings;
  history: DailyStats[];
  currentSession: CodingSession | null;
  lastUpdatedAt: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  idleThresholdSeconds: 60,
  sessionEndThresholdSeconds: 900,
  goalMinutes: 240,
  streakMinimumMinutes: 30,
  comboLevels: [
    { minutes: 10, multiplier: 1 },
    { minutes: 20, multiplier: 2 },
    { minutes: 30, multiplier: 3 },
    { minutes: 40, multiplier: 4 },
    { minutes: 60, multiplier: 5 },
    { minutes: 90, multiplier: 6 },
  ],
  historyRetentionDays: 365,
  debugLogging: false,
  notifyOnSessionStart: false,
};

export function defaultSession(now: number): CodingSession {
  return {
    id: 'session-pending',
    startedAt: now,
    endedAt: null,
    activeMillis: 0,
  };
}

export function defaultDailyStats(day: string): DailyStats {
  return {
    day,
    totalActiveMillis: 0,
    sessions: [],
    longestSessionMillis: 0,
  };
}

export function defaultPersistedState(now: number): PersistedState {
  const day = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: undefined,
  }).format(new Date(now));
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    history: [defaultDailyStats(day)],
    currentSession: null,
    lastUpdatedAt: now,
  };
}
