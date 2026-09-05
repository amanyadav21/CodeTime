import * as vscode from 'vscode';
import type { Logger } from '../util/logger';

export class SidebarProvider implements vscode.WebviewViewProvider {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly extensionUri: vscode.Uri,
    private readonly logger: Logger,
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    const webview = webviewView.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview')],
    };
    webview.html = this.renderHtml(webview);

    this.logger.info('sidebar resolved');

    // Phase 3 will hook this up to the MessageBridge.
    webview.onDidReceiveMessage((msg) => {
      this.logger.debug('webview message', msg);
    });
  }

  private renderHtml(webview: vscode.Webview): string {
    // Load the static index.html produced by `next build` (output: 'export').
    const indexUri = vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'index.html');
    const cspSource = webview.cspSource;
    // We inline a minimal placeholder; the real bootstrap happens in Phase 3 once
    // esbuild copies `webview/out` into `dist/webview`.
    return `<!doctype html><html><head><meta charset="utf-8"/>
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} data:;" />
      <title>CodePulse</title></head>
      <body style="font-family: var(--vscode-font-family, system-ui); color: var(--vscode-foreground);">
        <p>CodePulse — Phase 2 stub. UI bundles at build time.</p>
        <p>Asset base: <code>${indexUri.toString()}</code></p>
      </body></html>`;
  }
}
