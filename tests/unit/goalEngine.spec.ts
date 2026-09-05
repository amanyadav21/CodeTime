import { describe, it, expect } from 'vitest';
import { createGoalEngine } from '../../src/engines/goalEngine';

describe('goalEngine', () => {
  const engine = createGoalEngine();

  const today = (totalActiveMillis: number) => ({
    day: '2024-01-01',
    totalActiveMillis,
    sessions: [],
    longestSessionMillis: 0,
  });

  it('returns 0% with no activity', () => {
    expect(engine.snapshot(today(0), 240)).toEqual({
      goalMinutes: 240,
      todayMinutes: 0,
      percent: 0,
      completed: false,
    });
  });

  it('returns 50% at halfway', () => {
    expect(engine.snapshot(today(120 * 60_000), 240)).toEqual({
      goalMinutes: 240,
      todayMinutes: 120,
      percent: 50,
      completed: false,
    });
  });

  it('returns 100% at goal', () => {
    expect(engine.snapshot(today(240 * 60_000), 240)).toEqual({
      goalMinutes: 240,
      todayMinutes: 240,
      percent: 100,
      completed: true,
    });
  });

  it('clamps above goal to 100%', () => {
    expect(engine.snapshot(today(300 * 60_000), 240)).toEqual({
      goalMinutes: 240,
      todayMinutes: 300,
      percent: 100,
      completed: true,
    });
  });
});
