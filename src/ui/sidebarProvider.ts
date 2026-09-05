import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
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
    const baseUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview'));
    const cspSource = webview.cspSource;

    const indexPath = path.join(this.extensionUri.fsPath, 'dist', 'webview', 'index.html');
    let html = '<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>CodePulse</title></head><body><div id="root">Loading CodePulse…</div></body></html>';
    try {
      if (fs.existsSync(indexPath)) {
        html = fs.readFileSync(indexPath, 'utf-8');
      }
    } catch (err) {
      this.logger.warn('sidebar: failed to read webview index.html', err);
    }

    const csp = `default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} data:; font-src ${cspSource} data:; connect-src 'self';`;
    html = html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${csp}"/>`);
    html = html.replace('<head>', `<head><base href="${baseUri.toString()}/">`);
    const bootstrap = `<script type="module">window.__CP_BASE='${baseUri.toString()}/';</script>`;
    html = html.replace('<head>', `<head>${bootstrap}`);

    return html;
  }
}
