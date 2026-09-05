import { describe, it, expect } from 'vitest';
import { createStreakEngine } from '../../src/engines/streakEngine';

describe('streakEngine', () => {
  const engine = createStreakEngine();

  const day = (d: string, active: number) => ({
    day: d,
    totalActiveMillis: active * 60_000,
    sessions: [],
    longestSessionMillis: 0,
  });

  const settings = (min = 30, retention = 365) => ({
    streakMinimumMinutes: min,
    historyRetentionDays: retention,
  });

  it('returns 0 with no qualifying days', () => {
    const history = [day('2024-01-01', 0), day('2024-01-02', 0)];
    const snap = engine.snapshot(history, settings(), day('2024-01-03', 0), () => new Date('2024-01-03').getTime());
    expect(snap.currentStreak).toBe(0);
    expect(snap.isTodayQualifying).toBe(false);
  });

  it('returns streak of 2 for yesterday and today qualifying', () => {
    const history = [day('2024-01-01', 30)];
    const snap = engine.snapshot(history, settings(), day('2024-01-02', 30), () => new Date('2024-01-02').getTime());
    expect(snap.currentStreak).toBe(2);
    expect(snap.isTodayQualifying).toBe(true);
  });

  it('returns 1 when only today qualifies', () => {
    const history = [day('2024-01-01', 0)];
    const snap = engine.snapshot(history, settings(), day('2024-01-02', 30), () => new Date('2024-01-02').getTime());
    expect(snap.currentStreak).toBe(1);
    expect(snap.isTodayQualifying).toBe(true);
  });

  it('counts back from yesterday when today does not qualify', () => {
    const history = [day('2024-01-01', 30), day('2024-01-02', 30)];
    const snap = engine.snapshot(history, settings(), day('2024-01-03', 0), () => new Date('2024-01-03').getTime());
    expect(snap.currentStreak).toBe(2);
    expect(snap.isTodayQualifying).toBe(false);
  });
});
