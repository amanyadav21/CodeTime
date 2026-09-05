// SessionManager: orchestrates sessions, daily stats, and feeds derived engines.
// Per LLD.md § 8.

import type { Logger } from '../util/logger';
import { ulid } from '../util/id';
import { localDayKey } from '../util/time';
import { debounce } from '../util/debounce';
import type { TimerEngine, TimerSnapshot } from './timerEngine';
import { createComboEngine } from './comboEngine';
import { createGoalEngine } from './goalEngine';
import { createStreakEngine } from './streakEngine';
import type { StorageManager } from '../storage/storageManager';
import type { PersistedState, UserSettings, CodingSession, DailyStats, ComboState, StreakState, GoalState } from '../storage/schema';
import { defaultSession, defaultDailyStats } from '../storage/schema';
import type { Notifier } from '../notifications/notifier';

export interface SessionManager {
  start(): Promise<void>;
  stop(): void;
  snapshot(): {
    current: CodingSession | null;
    today: DailyStats;
    history: DailyStats[];
    combo: ComboState;
    streak: StreakState;
    goal: GoalState;
    settings: UserSettings;
  };
  onChange(listener: (s: SessionSnapshot) => void): () => void;
  setGoal(minutes: number): void;
  setStreakMinimum(minutes: number): void;
}

export interface SessionSnapshot {
  current: CodingSession | null;
  today: DailyStats;
  history: DailyStats[];
  combo: ComboState;
  streak: StreakState;
  goal: GoalState;
  settings: UserSettings;
}

export function createSessionManager(
  deps: {
    timer: TimerEngine;
    storage: StorageManager;
    settings: () => UserSettings;
    now: () => number;
    logger: Logger;
    notifier: Notifier;
  },
): SessionManager {
  const { timer, storage, settings, now, logger, notifier } = deps;
  let state: PersistedState;
  const comboEngine = createComboEngine();
  const goalEngine = createGoalEngine();
  const streakEngine = createStreakEngine();

  const listeners = new Set<(s: SessionSnapshot) => void>();
  let current: CodingSession | null = null;
  let notifiedGoalToday = false;

  const save = (): void => {
    state.currentSession = current;
    state.lastUpdatedAt = now();
    void storage.save(structuredClone(state));
  };

  const debouncedSave = debounce(() => save(), 500);

  const getOrCreateToday = (wall: number): DailyStats => {
    const day = localDayKey(wall);
    let today = state.history.find((d) => d.day === day);
    if (!today) {
      today = defaultDailyStats(day);
      state.history.push(today);
      pruneHistory();
    }
    return today;
  };

  const pruneHistory = (): void => {
    const retention = state.settings.historyRetentionDays ?? 365;
    const cutoff = now() - retention * 24 * 60 * 60 * 1000;
    const minDay = new Date(cutoff).toISOString().slice(0, 10);
    state.history = state.history.filter((d) => d.day >= minDay);
  };

  const ensureToday = (): DailyStats => getOrCreateToday(now());

  const closeCurrent = (wall: number): void => {
    if (!current) return;
    current.endedAt = wall;
    const today = ensureToday();
    today.totalActiveMillis += current.activeMillis;
    today.sessions.push(current);
    if (current.activeMillis > today.longestSessionMillis) {
      today.longestSessionMillis = current.activeMillis;
    }
    current = null;
    const goal = goalEngine.snapshot(today, state.settings.goalMinutes);
    if (goal.completed && !notifiedGoalToday) {
      notifier.notify('goalReached');
      notifiedGoalToday = true;
    }
    debouncedSave();
  };

  const onTimerChange = (snap: TimerSnapshot): void => {
    const s = settings();
    ensureToday();

    if (snap.state === 'ACTIVE' && snap.sessionStartedAt !== null && current === null) {
      current = defaultSession(snap.sessionStartedAt);
      current.id = ulid(snap.sessionStartedAt);
      if (s.notifyOnSessionStart) {
        notifier.notify('sessionStarted');
      }
    }

    if (snap.state === 'ACTIVE' && current !== null && current.endedAt === null) {
      current.activeMillis = snap.activeMillis;
    }

    if (snap.state === 'PAUSED' || snap.state === 'IDLE') {
      if (current !== null && current.endedAt === null) {
        current.activeMillis = snap.activeMillis;
      }
    }

    if (snap.state === 'IDLE' && current !== null) {
      closeCurrent(now());
    }

    debouncedSave();
    emitSnapshot();
  };

  const buildSnapshot = (): SessionSnapshot => {
    const s = settings();
    const today = ensureToday();
    const combo = comboEngine.snapshot(current?.activeMillis ?? 0, s.comboLevels);
    const streak = streakEngine.snapshot(state.history, s, today);
    const goal = goalEngine.snapshot(today, s.goalMinutes);
    return {
      current: current ? { ...current } : null,
      today: structuredClone(today),
      history: structuredClone(state.history),
      combo,
      streak,
      goal,
      settings: { ...s },
    };
  };

  const emitSnapshot = (): void => {
    const snap = buildSnapshot();
    for (const l of listeners) l(snap);
  };

  return {
    async start(): Promise<void> {
      state = await storage.load();
      pruneHistory();
      const today = ensureToday();
      const s = settings();
      const goal = goalEngine.snapshot(today, s.goalMinutes);
      if (!goal.completed) notifiedGoalToday = false;
      if (state.currentSession && state.currentSession.endedAt === null) {
        const wall = now();
        const lastActivity = state.currentSession.startedAt;
        if (wall - lastActivity < s.sessionEndThresholdSeconds * 1000) {
          current = { ...state.currentSession };
        } else {
          state.currentSession = null;
        }
      }
      timer.onChange(onTimerChange);
      emitSnapshot();
      logger.info('session manager started');
    },

    stop(): void {
      if (current) closeCurrent(now());
      save();
      logger.info('session manager stopped');
    },

    snapshot() {
      return buildSnapshot();
    },

    onChange(listener: (s: SessionSnapshot) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },

    setGoal(minutes: number): void {
      state.settings.goalMinutes = Math.max(1, Math.min(1440, minutes));
      notifiedGoalToday = false;
      debouncedSave();
      emitSnapshot();
    },

    setStreakMinimum(minutes: number): void {
      state.settings.streakMinimumMinutes = Math.max(1, Math.min(1440, minutes));
      debouncedSave();
      emitSnapshot();
    },
  };
}
