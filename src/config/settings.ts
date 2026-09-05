// Typed settings backed by vscode.workspace.getConfiguration('codepulse').
// Watches for live changes. Per LLD.md § 18.

import * as vscode from 'vscode';
import type { Logger } from '../util/logger';
import type { UserSettings } from '../storage/schema';
import { DEFAULT_SETTINGS } from '../storage/schema';

export interface Settings {
  get(): UserSettings;
  onChange(handler: (s: UserSettings) => void): () => void;
}

export function createSettings(logger: Logger): Settings {
  const section = () => vscode.workspace.getConfiguration('codepulse');

  function read(): UserSettings {
    const c = section();
    const getNum = (k: string, fb: number) => {
      const v = c.get<number>(k, fb);
      return typeof v === 'number' && Number.isFinite(v) ? v : fb;
    };
    const getBool = (k: string, fb: boolean) => {
      const v = c.get<boolean>(k, fb);
      return typeof v === 'boolean' ? v : fb;
    };

    const levels = c.get<{ minutes: number; multiplier: number }[]>('comboLevels', DEFAULT_SETTINGS.comboLevels);
    const safeLevels = Array.isArray(levels)
      ? levels
          .filter((l) => Number.isFinite(l?.minutes) && Number.isFinite(l?.multiplier))
          .map((l) => ({ minutes: Math.max(0, Math.round(l.minutes)), multiplier: Math.max(1, Math.round(l.multiplier)) }))
          .sort((a, b) => a.minutes - b.minutes)
      : DEFAULT_SETTINGS.comboLevels;

    return {
      idleThresholdSeconds: Math.max(10, Math.min(600, Math.round(getNum('idleThresholdSeconds', 60)))),
      sessionEndThresholdSeconds: Math.max(60, Math.min(86_400, Math.round(getNum('sessionEndThresholdSeconds', 900)))),
      goalMinutes: Math.max(1, Math.min(1440, Math.round(getNum('goalMinutes', 240)))),
      streakMinimumMinutes: Math.max(1, Math.min(1440, Math.round(getNum('streakMinimumMinutes', 30)))),
      comboLevels: safeLevels,
      historyRetentionDays: Math.max(30, Math.min(3650, Math.round(getNum('historyRetentionDays', 365)))),
      debugLogging: getBool('debugLogging', false),
      notifyOnSessionStart: getBool('notifyOnSessionStart', false),
    };
  }

  return {
    get: read,
    onChange(handler: (s: UserSettings) => void) {
      const disposable = vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('codepulse')) {
          logger?.info('settings changed');
          handler(read());
        }
      });
      return () => disposable.dispose();
    },
  };
}
