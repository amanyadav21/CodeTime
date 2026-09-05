import * as vscode from 'vscode';
import type { Logger } from '../util/logger';
import type { MessageBridge } from '../messaging/bridge';

export class SidebarProvider implements vscode.WebviewViewProvider {
  private bridgeAttached = false;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly extensionUri: vscode.Uri,
    private readonly logger: Logger,
    private readonly bridge?: MessageBridge,
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

    if (!this.bridgeAttached && this.bridge) {
      this.bridge.attach(webview);
      this.bridgeAttached = true;
      this.bridge.onClientMessage((msg) => {
        this.logger.debug('webview message', msg);
      });
    }
  }

  private renderHtml(webview: vscode.Webview): string {
    // The static export lives at dist/webview/index.html.
    const baseUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview'));
    const cspSource = webview.cspSource;

    const bootstrap = `
      <script type="module">
        window.__CP_BASE = '${baseUri.toString()}/';
        window.__CP_READY = false;
      </script>
    `;

    // Fallback stub when the static export is not yet built.
    const stub = `
      <script type="module" src="${baseUri.toString()}/_next/static/chunks/main.js"></script>
    `;

    return `<!doctype html>
      <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} data:; font-src ${cspSource} data:; connect-src 'self';"/>
        <title>CodePulse</title>
        ${bootstrap}
        <base href="${baseUri.toString()}/">
      </head>
      <body style="margin:0;background:transparent;">
        <div id="root">Loading CodePulse…</div>
        ${stub}
      </body>
      </html>`;
  }
}
