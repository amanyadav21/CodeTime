import { describe, it, expect } from 'vitest';
import { createComboEngine } from '../../src/engines/comboEngine';

describe('comboEngine', () => {
  const engine = createComboEngine();
  const levels = [
    { minutes: 10, multiplier: 1 },
    { minutes: 20, multiplier: 2 },
    { minutes: 30, multiplier: 3 },
    { minutes: 40, multiplier: 4 },
    { minutes: 60, multiplier: 5 },
    { minutes: 90, multiplier: 6 },
  ];

  it('returns ×0 below first threshold', () => {
    expect(engine.snapshot(0, levels)).toEqual({ multiplier: 0, continuousActiveMinutes: 0, nextAtMinutes: 10 });
  });

  it('returns ×1 at 10 minutes', () => {
    expect(engine.snapshot(10 * 60_000, levels)).toEqual({ multiplier: 1, continuousActiveMinutes: 10, nextAtMinutes: 20 });
  });

  it('returns ×3 at 30 minutes', () => {
    expect(engine.snapshot(30 * 60_000, levels)).toEqual({ multiplier: 3, continuousActiveMinutes: 30, nextAtMinutes: 40 });
  });

  it('returns ×6 at 90 minutes', () => {
    expect(engine.snapshot(90 * 60_000, levels)).toEqual({ multiplier: 6, continuousActiveMinutes: 90, nextAtMinutes: null });
  });

  it('returns ×6 beyond 90 minutes', () => {
    expect(engine.snapshot(120 * 60_000, levels)).toEqual({ multiplier: 6, continuousActiveMinutes: 120, nextAtMinutes: null });
  });
});
