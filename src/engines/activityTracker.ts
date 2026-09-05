// ActivityTracker: subscribes to VS Code editor events, emits debounced pulses.
// Per LLD.md § 6. This is the ONLY engine-layer file that imports vscode.

import * as vscode from 'vscode';
import type { Logger } from '../util/logger';
import { debounce } from '../util/debounce';
import { nowWall } from '../util/time';

export type ActivityListener = (wall: number) => void;

export interface ActivityTracker {
  start(): void;
  stop(): void;
  onActivity(listener: ActivityListener): () => void;
}

export function createActivityTracker(logger: Logger): ActivityTracker {
  const listeners = new Set<ActivityListener>();
  let disposables: vscode.Disposable[] = [];

  const pulse = debounce(() => {
    const w = nowWall();
    for (const l of listeners) l(w);
  }, 100);

  const subscribe = (...d: vscode.Disposable[]): void => {
    disposables.push(...d);
  };

  return {
    start(): void {
      if (disposables.length > 0) return;
      subscribe(
        vscode.window.onDidChangeActiveTextEditor(() => pulse()),
        vscode.window.onDidChangeTextEditorSelection(() => pulse()),
        vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
          // Only treat as activity if the visible range actually changed.
          if (e.visibleRanges.length > 0) pulse();
        }),
        vscode.workspace.onDidChangeTextDocument(() => pulse()),
        vscode.workspace.onDidSaveTextDocument(() => pulse()),
        vscode.workspace.onDidOpenTextDocument(() => pulse()),
        vscode.workspace.onDidCloseTextDocument(() => pulse()),
        vscode.workspace.onDidChangeWorkspaceFolders(() => pulse()),
      );
      logger.info('activity tracker started');
    },

    stop(): void {
      pulse.cancel();
      for (const d of disposables) d.dispose();
      disposables = [];
      logger.info('activity tracker stopped');
    },

    onActivity(listener: ActivityListener): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
