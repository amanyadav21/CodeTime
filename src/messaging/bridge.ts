// MessageBridge: throttled server → client + validated client → server.
// Per LLD.md § 14.

import * as vscode from 'vscode';
import type { Logger } from '../util/logger';
import type { CpClientMessage, CpServerMessage, EngineSnapshot } from './protocol';

export interface MessageBridge {
  attach(webview: vscode.Webview): void;
  publish(snapshot: EngineSnapshot): void;
  onClientMessage(handler: (msg: CpClientMessage) => void): () => void;
  dispose(): void;
}

export function createMessageBridge(logger: Logger): MessageBridge {
  let webview: vscode.Webview | undefined;
  let publishTimer: NodeJS.Timeout | undefined;
  let pending: EngineSnapshot | undefined;
  let clientHandler: ((m: CpClientMessage) => void) | undefined;
  let onDidReceiveMessageDisposable: vscode.Disposable | undefined;

  const throttlePublish = (): void => {
    if (publishTimer) return;
    publishTimer = setTimeout(() => {
      publishTimer = undefined;
      if (webview && pending) {
        const msg: CpServerMessage = { type: 'snapshot', payload: pending };
        try {
          webview.postMessage(msg);
        } catch (err) {
          logger.warn('bridge postMessage failed', err);
        }
        pending = undefined;
      }
    }, 1000);
  };

  return {
    attach(w: vscode.Webview): void {
      webview = w;
      onDidReceiveMessageDisposable = w.onDidReceiveMessage((msg: unknown) => {
        const m = msg as CpClientMessage;
        if (!m || typeof m !== 'object' || !('type' in m)) return;
        if (clientHandler) {
          try {
            clientHandler(m as CpClientMessage);
          } catch (err) {
            logger.warn('bridge client handler threw', err);
          }
        }
      });
    },

    publish(snapshot: EngineSnapshot): void {
      pending = snapshot;
      throttlePublish();
    },

    onClientMessage(handler: (msg: CpClientMessage) => void) {
      clientHandler = handler;
      return () => { clientHandler = undefined; };
    },

    dispose(): void {
      if (publishTimer) clearTimeout(publishTimer);
      onDidReceiveMessageDisposable?.dispose();
      webview = undefined;
      clientHandler = undefined;
    },
  };
}
