// TimerEngine. Pure state machine: IDLE / ACTIVE / PAUSED.
// Per LLD.md § 7.

import type { Logger } from '../util/logger';
import { nowMono, nowWall } from '../util/time';

export type TimerState = 'IDLE' | 'ACTIVE' | 'PAUSED';

export interface TimerSnapshot {
  state: TimerState;
  activeMillis: number;
  sessionStartedAt: number | null;
  lastActivityAt: number | null;
}

export interface TimerEngineConfig {
  idleThresholdMs: number;
  sessionEndThresholdMs: number;
}

export interface TimerEngine {
  signalActivity(wall: number): void;
  snapshot(): TimerSnapshot;
  onChange(listener: (s: TimerSnapshot) => void): () => void;
  shutdown(wall: number): TimerSnapshot;
}

export function createTimerEngine(
  config: TimerEngineConfig,
  _logger: Logger,
): TimerEngine {
  let state: TimerState = 'IDLE';
  let activeMillis = 0;
  let sessionStartedAt: number | null = null;
  let lastActivityAt: number | null = null;

  const listeners = new Set<(s: TimerSnapshot) => void>();
  let timerHandle: NodeJS.Timeout | undefined;
  let lastTickMono = nowMono();

  const emit = (): void => {
    const snap: TimerSnapshot = {
      state,
      activeMillis,
      sessionStartedAt,
      lastActivityAt,
    };
    for (const l of listeners) l(snap);
  };

  const scheduleTick = (): void => {
    if (timerHandle) clearTimeout(timerHandle);
    // Align tick to ~1 Hz. Self-rescheduling setTimeout.
    timerHandle = setTimeout(tick, 1000);
  };

  const tick = (): void => {
    const mono = nowMono();
    const wall = nowWall();
    const elapsed = Math.min(mono - lastTickMono, 2000); // cap 2s
    lastTickMono = mono;

    if (state === 'ACTIVE') {
      activeMillis += elapsed;
    }

    // Threshold checks.
    if ((state === 'ACTIVE' || state === 'PAUSED') && lastActivityAt !== null) {
      const since = wall - lastActivityAt;
      if (since >= config.sessionEndThresholdMs) {
        // Close session.
        state = 'IDLE';
        activeMillis = 0;
        sessionStartedAt = null;
        lastActivityAt = null;
        emit();
      } else if (state === 'ACTIVE' && since >= config.idleThresholdMs) {
        state = 'PAUSED';
        emit();
      }
    }

    scheduleTick();
  };

  const engine: TimerEngine = {
    signalActivity(wall: number): void {
      lastActivityAt = wall;
      if (state === 'IDLE') {
        state = 'ACTIVE';
        sessionStartedAt = wall;
        activeMillis = 0;
        lastTickMono = nowMono();
        scheduleTick();
      } else if (state === 'PAUSED') {
        state = 'ACTIVE';
        lastTickMono = nowMono();
        if (!timerHandle) scheduleTick();
      }
      emit();
    },

    snapshot(): TimerSnapshot {
      return { state, activeMillis, sessionStartedAt, lastActivityAt };
    },

    onChange(listener: (s: TimerSnapshot) => void): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },

    shutdown(_wall: number): TimerSnapshot {
      if (timerHandle) {
        clearTimeout(timerHandle);
        timerHandle = undefined;
      }
      if (state === 'ACTIVE') {
        const mono = nowMono();
        activeMillis += Math.min(mono - lastTickMono, 2000);
      }
      const prev = state;
      const snap: TimerSnapshot = {
        state: 'IDLE',
        activeMillis,
        sessionStartedAt: null,
        lastActivityAt: null,
      };
      state = 'IDLE';
      sessionStartedAt = null;
      lastActivityAt = null;
      if (prev !== 'IDLE') emit();
      return snap;
    },
  };

  return engine;
}
