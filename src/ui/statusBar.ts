import * as vscode from 'vscode';
import type { Logger } from '../util/logger';
import type { EngineSnapshot } from '../messaging/protocol';

export class StatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private disposables: vscode.Disposable[] = [];

  constructor(private readonly logger: Logger) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -100);
    this.item.text = '○ 00:00:00';
    this.item.tooltip = 'CodePulse';
    this.item.show();
    this.logger.info('status bar shown');
  }

  update(snapshot: EngineSnapshot): void {
    const icon = snapshot.timer.state === 'ACTIVE' ? '⚡' : snapshot.timer.state === 'PAUSED' ? '⏸' : '○';
    const totalSeconds = Math.floor(snapshot.sessions.today.totalActiveMillis / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const text = `${icon} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    this.item.text = text;
    const combo = snapshot.combo.multiplier > 0 ? ` COMBO ×${snapshot.combo.multiplier}` : '';
    const streak = snapshot.streak.currentStreak > 0 ? ` 🔥 ${snapshot.streak.currentStreak}d` : '';
    this.item.tooltip = `CodePulse: ${text} | ${snapshot.goal.todayMinutes}m / ${snapshot.goal.goalMinutes}m${combo}${streak} | Click to open dashboard`;
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.item.dispose();
  }
}
