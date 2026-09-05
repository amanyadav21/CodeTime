// Mirrors docs/LLD.md § 13. The webview communicates exclusively via this module.

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

declare global {
  interface Window {
    acquireVsCodeApi?: () => {
      postMessage(msg: CpClientMessage): void;
      setState?(state: unknown): void;
      getState?(): unknown;
    };
  }
}

// The bridge is intentionally tiny: one inbound queue, one outbound postMessage.
// The webview holds no authoritative state; it only renders the latest snapshot.

export function send(msg: CpClientMessage): void {
  const api = typeof window !== 'undefined' ? window.acquireVsCodeApi?.() : undefined;
  if (!api) {
    // Running outside the host (e.g., `next dev` in a browser) — no-op.
    return;
  }
  api.postMessage(msg);
}

export function onServerMessage(handler: (msg: CpServerMessage) => void): () => void {
  const listener = (event: MessageEvent<CpServerMessage>) => handler(event.data);
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}
