// StreakEngine. Derived from history. Per LLD.md § 10.

import type { DailyStats, StreakState, UserSettings } from '../storage/schema';

export interface StreakEngine {
  snapshot(history: DailyStats[], settings: UserSettings, today: DailyStats, now?: () => number): StreakState;
}

export function createStreakEngine(): StreakEngine {
  return {
    snapshot(history: DailyStats[], settings: UserSettings, today: DailyStats, now?: () => number): StreakState {
      const timeSource = now ?? (() => Date.now());
      const streakMinMs = settings.streakMinimumMinutes * 60_000;
      const todayQualifies = today.totalActiveMillis >= streakMinMs;
      const byDay = new Map<string, DailyStats>();
      for (const d of history) byDay.set(d.day, d);
      byDay.set(today.day, today);

      const dayMs = 24 * 60 * 60 * 1000;
      let streak = 0;
      let cursor = new Date(timeSource());
      if (!todayQualifies) {
        cursor = new Date(cursor.getTime() - dayMs);
      }
      for (let i = 0; i < (settings.historyRetentionDays + 1); i++) {
        const key = new Intl.DateTimeFormat('en-CA', {
          year: 'numeric', month: '2-digit', day: '2-digit', timeZone: undefined,
        }).format(cursor);
        const stats = byDay.get(key);
        if (stats && stats.totalActiveMillis >= streakMinMs) {
          streak++;
          cursor = new Date(cursor.getTime() - dayMs);
        } else {
          break;
        }
      }

      const lastQualifyingDay = (() => {
        if (streak === 0) return null;
        if (todayQualifies) return today.day;
        const yesterday = new Date(timeSource() - dayMs);
        const key = new Intl.DateTimeFormat('en-CA', {
          year: 'numeric', month: '2-digit', day: '2-digit', timeZone: undefined,
        }).format(yesterday);
        const stats = byDay.get(key);
        return stats && stats.totalActiveMillis >= streakMinMs ? key : null;
      })();

      return {
        currentStreak: streak,
        isTodayQualifying: todayQualifies,
        lastQualifyingDay,
      };
    },
  };
}
