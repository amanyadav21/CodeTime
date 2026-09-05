import * as vscode from 'vscode';

export interface Logger {
  debug(msg: string, data?: unknown): void;
  info(msg: string, data?: unknown): void;
  warn(msg: string, data?: unknown): void;
  error(msg: string, data?: unknown): void;
}

export function createLogger(channelName: string, debugFlag: () => boolean): Logger {
  const channel = vscode.window.createOutputChannel(channelName);

  const write = (
    level: 'debug' | 'info' | 'warn' | 'error',
    msg: string,
    data?: unknown,
  ): void => {
    if (level === 'debug' && !debugFlag()) return;
    const line = data === undefined ? msg : `${msg} ${JSON.stringify(data)}`;
    channel.appendLine(`[${level}] ${line}`);
  };

  return {
    debug: (m, d) => write('debug', m, d),
    info: (m, d) => write('info', m, d),
    warn: (m, d) => write('warn', m, d),
    error: (m, d) => write('error', m, d),
  };
}
