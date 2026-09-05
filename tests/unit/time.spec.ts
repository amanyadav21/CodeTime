import { describe, it, expect } from 'vitest';
import { localDayKey, startOfLocalDay, isLocalMidnightCross } from '../../src/util/time';

describe('time', () => {
  it('localDayKey returns YYYY-MM-DD', () => {
    const ms = new Date('2024-06-15T12:00:00Z').getTime();
    expect(localDayKey(ms)).toBe('2024-06-15');
  });

  it('startOfLocalDay returns midnight of the local day', () => {
    const ms = new Date('2024-06-15T14:30:00Z').getTime();
    const start = startOfLocalDay(ms);
    expect(new Date(start).getHours()).toBe(0);
    expect(new Date(start).getMinutes()).toBe(0);
  });

  it('isLocalMidnightCross detects day change', () => {
    const a = new Date('2024-06-15T23:59:59Z').getTime();
    const b = new Date('2024-06-16T00:00:01Z').getTime();
    expect(isLocalMidnightCross(a, b)).toBe(true);
  });
});
