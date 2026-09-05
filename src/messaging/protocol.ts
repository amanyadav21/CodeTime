// Protocol types shared between extension and webview. Per LLD.md § 13.

export type TimerState = 'IDLE' | 'ACTIVE' | 'PAUSED';

export interface TimerSnapshot {
  state: TimerState;
  activeMillis: number;
  sessionStartedAt: number | null;
  lastActivityAt: number | null;
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

export interface SessionsSnapshot {
  current: CodingSession | null;
  today: DailyStats;
  history: DailyStats[];
  bestTodayMillis: number;
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

export interface UserSettings {
  idleThresholdSeconds: number;
  sessionEndThresholdSeconds: number;
  goalMinutes: number;
  streakMinimumMinutes: number;
  comboLevels: { minutes: number; multiplier: number }[];
  historyRetentionDays: number;
  debugLogging: boolean;
  notifyOnSessionStart: boolean;
}

export interface EngineSnapshot {
  schemaVersion: 1;
  generatedAt: number;
  timer: TimerSnapshot;
  sessions: SessionsSnapshot;
  combo: ComboState;
  streak: StreakState;
  goal: GoalState;
  settings: UserSettings;
}

export type CpServerMessage =
  | { type: 'snapshot'; payload: EngineSnapshot }
  | {
      type: 'notification';
      payload: { kind: 'goalReached' | 'comboMilestone' | 'streakMilestone' | 'sessionStarted'; data?: unknown };
    };

export type CpClientMessage =
  | { type: 'ready' }
  | { type: 'setGoal'; minutes: number }
  | { type: 'setStreakMinimum'; minutes: number }
  | { type: 'requestSnapshot' };
