import * as vscode from 'vscode';
import type { Logger } from '../util/logger';

export class StatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor(private readonly logger: Logger) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -100);
    this.item.text = '○ 00:00:00';
    this.item.tooltip = 'CodePulse';
    this.item.show();
    this.logger.info('status bar shown');
  }

  // Phase 3 will call this with an EngineSnapshot.
  update(_snapshot: unknown): void {
    // placeholder; will render the timer per UI_SPECIFICATION § 3 in Phase 3.
  }

  dispose(): void {
    this.item.dispose();
  }
}
