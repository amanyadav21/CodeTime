// ComboEngine. Pure function over current session activeMillis.
// Per LLD.md § 9.

import type { ComboState, ComboThresholds } from '../storage/schema';

export interface ComboEngine {
  snapshot(activeMillis: number, levels: ComboThresholds['levels']): ComboState;
}

export function createComboEngine(): ComboEngine {
  return {
    snapshot(activeMillis: number, levels: ComboThresholds['levels']): ComboState {
      const continuousActiveMinutes = Math.floor(activeMillis / 60_000);
      let multiplier = 0;
      let nextAtMinutes: number | null = null;
      for (let i = 0; i < levels.length; i++) {
        const level = levels[i]!;
        if (continuousActiveMinutes >= level.minutes) {
          multiplier = level.multiplier;
        } else {
          nextAtMinutes = level.minutes;
          break;
        }
      }
      if (multiplier === 0 && levels.length > 0) {
        nextAtMinutes = levels[0]!.minutes;
      }
      if (multiplier > 0 && nextAtMinutes === null) {
        nextAtMinutes = null; // at cap
      }
      return { multiplier, continuousActiveMinutes, nextAtMinutes };
    },
  };
}
