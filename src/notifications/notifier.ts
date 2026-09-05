// Notifier: deduplicated, low-priority VS Code notifications.
// Per LLD.md § 16 and UI_SPECIFICATION.md § 4.

import * as vscode from 'vscode';
import type { Logger } from '../util/logger';

export interface Notifier {
  notify(kind: 'sessionStarted' | 'comboMilestone' | 'goalReached' | 'streakMilestone', data?: unknown): void;
  dispose(): void;
}

export function createNotifier(logger: Logger, settings: () => { notifyOnSessionStart: boolean }): Notifier {
  const sent = new Set<string>();

  const dedupKey = (kind: string, data?: unknown): string => {
    if (kind === 'sessionStarted') return 'session:day:' + new Date().toDateString();
    if (kind === 'goalReached') return 'goal:day:' + new Date().toDateString();
    if (kind === 'streakMilestone') return 'streak:' + String(data);
    if (kind === 'comboMilestone') return 'combo:' + String(data);
    return kind;
  };

  return {
    notify(kind, data): void {
      const s = settings();
      if (kind === 'sessionStarted' && !s.notifyOnSessionStart) return;
      const key = dedupKey(kind, data);
      if (sent.has(key)) return;
      sent.add(key);

      const text =
        kind === 'sessionStarted'
          ? 'CodePulse — Coding session started'
          : kind === 'goalReached'
            ? 'CodePulse — Daily goal reached'
            : kind === 'streakMilestone'
              ? `CodePulse — ${String(data)} day streak`
              : `CodePulse — Combo ×${String(data)}`;

      vscode.window.showInformationMessage(text, { modal: false }).then(() => {}, () => {});
      logger.debug('notification', { kind, data });
    },
    dispose(): void {
      // no-op; set is in-memory and lives with the extension host.
    },
  };
}
