import { describe, it, expect, vi } from 'vitest';
import { createTimerEngine } from '../../src/engines/timerEngine';

describe('timerEngine', () => {
  const logger = { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() };

  const make = () =>
    createTimerEngine(
      { idleThresholdMs: 60_000, sessionEndThresholdMs: 900_000 },
      logger,
    );

  it('starts IDLE and transitions to ACTIVE on signal', () => {
    const engine = make();
    expect(engine.snapshot().state).toBe('IDLE');
    engine.signalActivity(1000);
    expect(engine.snapshot().state).toBe('ACTIVE');
    expect(engine.snapshot().sessionStartedAt).toBe(1000);
  });

  it('resets activeMillis on new session', () => {
    const engine = make();
    engine.signalActivity(1000);
    expect(engine.snapshot().activeMillis).toBe(0);
  });

  it('shutdown returns IDLE snapshot', () => {
    const engine = make();
    engine.signalActivity(1000);
    const snap = engine.shutdown(2000);
    expect(snap.state).toBe('IDLE');
    expect(snap.sessionStartedAt).toBeNull();
  });

  it('notifies listeners on transition', () => {
    const engine = make();
    const listener = vi.fn();
    engine.onChange(listener);
    engine.signalActivity(1000);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]![0]!.state).toBe('ACTIVE');
  });

  it('unsubscribes listener', () => {
    const engine = make();
    const listener = vi.fn();
    const unsub = engine.onChange(listener);
    unsub();
    engine.signalActivity(1000);
    expect(listener).not.toHaveBeenCalled();
  });
});
