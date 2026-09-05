// GoalEngine. Pure projection over DailyStats + goalMinutes.
// Per LLD.md § 11.

import type { DailyStats, GoalState } from '../storage/schema';

export interface GoalEngine {
  snapshot(today: DailyStats, goalMinutes: number): GoalState;
}

export function createGoalEngine(): GoalEngine {
  return {
    snapshot(today: DailyStats, goalMinutes: number): GoalState {
      const todayMinutes = Math.floor(today.totalActiveMillis / 60_000);
      const percent = Math.max(0, Math.min(100, Math.round((todayMinutes / Math.max(1, goalMinutes)) * 100)));
      return {
        goalMinutes,
        todayMinutes,
        percent,
        completed: todayMinutes >= goalMinutes,
      };
    },
  };
}
