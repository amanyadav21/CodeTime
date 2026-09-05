import * as vscode from 'vscode';
import { SidebarProvider } from './ui/sidebarProvider';
import { StatusBar } from './ui/statusBar';
import { Logger, createLogger } from './util/logger';

let statusBar: StatusBar | undefined;
let sidebar: SidebarProvider | undefined;
let logger: Logger | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('codepulse');
  logger = createLogger('CodePulse', () => cfg.get<boolean>('debugLogging', false) === true);

  logger.info('activating');

  // Webview assets are bundled at the path declared in package.json#browser.
  // The provider resolves them with the correct extension URI.
  sidebar = new SidebarProvider(context, context.extensionUri, logger);
  statusBar = new StatusBar(logger);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('codepulse.dashboard', sidebar, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    statusBar,
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('codepulse.')) {
        logger?.info('configuration changed');
      }
    }),
  );

  // Phase 3 will wire ActivityTracker, TimerEngine, SessionManager, etc.
  // For Phase 2 we just bring up the surfaces.
  logger.info('activated (Phase 2 stub)');
}

export function deactivate(): void {
  logger?.info('deactivating');
  statusBar?.dispose();
  statusBar = undefined;
  sidebar = undefined;
  logger = undefined;
}
