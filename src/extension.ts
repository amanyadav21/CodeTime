// Extension entry. Wires ActivityTracker → TimerEngine → SessionManager → Storage → Bridge → UI.
// Per LLD.md § 19.

import * as vscode from 'vscode';
import { SidebarProvider } from './ui/sidebarProvider';
import { StatusBar } from './ui/statusBar';
import { Logger, createLogger } from './util/logger';
import { createActivityTracker } from './engines/activityTracker';
import { createTimerEngine } from './engines/timerEngine';
import { createSessionManager } from './engines/sessionManager';
import { createStorageManager } from './storage/storageManager';
import { createSettings } from './config/settings';
import { createMessageBridge } from './messaging/bridge';
import { createNotifier } from './notifications/notifier';
import type { EngineSnapshot } from './messaging/protocol';

let statusBar: StatusBar | undefined;
let sidebar: SidebarProvider | undefined;
let tracker: ReturnType<typeof createActivityTracker> | undefined;
let timer: ReturnType<typeof createTimerEngine> | undefined;
let sessions: ReturnType<typeof createSessionManager> | undefined;
let storage: ReturnType<typeof createStorageManager> | undefined;
let settings: ReturnType<typeof createSettings> | undefined;
let bridge: ReturnType<typeof createMessageBridge> | undefined;
let notifier: ReturnType<typeof createNotifier> | undefined;
let logger: Logger | undefined;
const subscriptions: vscode.Disposable[] = [];

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('codepulse');
  logger = createLogger('CodePulse', () => cfg.get<boolean>('debugLogging', false) === true);

  logger.info('activating');

  storage = createStorageManager(context, logger);
  settings = createSettings(logger);
  const settingsGetter = () => settings!.get();
  notifier = createNotifier(logger, settingsGetter);
  tracker = createActivityTracker(logger);
  timer = createTimerEngine(
    {
      idleThresholdMs: settingsGetter().idleThresholdSeconds * 1000,
      sessionEndThresholdMs: settingsGetter().sessionEndThresholdSeconds * 1000,
    },
    logger,
  );
  sessions = createSessionManager({
    timer: timer!,
    storage: storage!,
    settings: settingsGetter,
    now: () => Date.now(),
    logger: logger!,
    notifier: notifier!,
  });
  bridge = createMessageBridge(logger);
  statusBar = new StatusBar(logger);
  sidebar = new SidebarProvider(context, context.extensionUri, logger, bridge);

  // Activity tracker feeds timer.
  subscriptions.push(
    { dispose: tracker!.onActivity((wall) => timer!.signalActivity(wall)) },
  );

  // Session manager + settings change -> publish to bridge.
  const sessionUnsub = sessions!.onChange((snap) => {
    const eng: EngineSnapshot = {
      schemaVersion: 1,
      generatedAt: Date.now(),
      timer: timer!.snapshot(),
    sessions: { current: snap.current, today: snap.today, history: snap.history, bestTodayMillis: snap.today.longestSessionMillis },
      combo: snap.combo,
      streak: snap.streak,
      goal: snap.goal,
      settings: snap.settings,
    };
    bridge!.publish(eng);
    statusBar!.update(eng);
  });
  subscriptions.push({ dispose: sessionUnsub });

  subscriptions.push({
    dispose: settings!.onChange(() => {
      const s = settingsGetter();
      const newTimer = createTimerEngine(
        {
          idleThresholdMs: s.idleThresholdSeconds * 1000,
          sessionEndThresholdMs: s.sessionEndThresholdSeconds * 1000,
        },
        logger!,
      );
      timer = newTimer;
      subscriptions.push({ dispose: tracker!.onActivity((wall) => timer!.signalActivity(wall)) });
    }),
  });

  // Bridge listens for webview intents.
  subscriptions.push({
    dispose: bridge!.onClientMessage((msg) => {
      if (msg.type === 'setGoal') sessions!.setGoal(msg.minutes);
      if (msg.type === 'setStreakMinimum') sessions!.setStreakMinimum(msg.minutes);
      if (msg.type === 'requestSnapshot') {
        const snap = sessions!.snapshot();
        const eng: EngineSnapshot = {
          schemaVersion: 1,
          generatedAt: Date.now(),
          timer: timer!.snapshot(),
      sessions: { current: snap.current, today: snap.today, history: snap.history, bestTodayMillis: snap.today.longestSessionMillis },
          combo: snap.combo,
          streak: snap.streak,
          goal: snap.goal,
          settings: snap.settings,
        };
        bridge!.publish(eng);
      }
    }),
  });

  // Sidebar provider attaches bridge when the webview resolves.
  subscriptions.push(
    vscode.window.registerWebviewViewProvider('codepulse.dashboard', sidebar!, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    statusBar!,
  );

  tracker!.start();
  await sessions!.start();

  // Initial snapshot.
  const snap = sessions!.snapshot();
  const eng: EngineSnapshot = {
    schemaVersion: 1,
    generatedAt: Date.now(),
    timer: timer!.snapshot(),
    sessions: { current: snap.current, today: snap.today, history: snap.history, bestTodayMillis: snap.today.longestSessionMillis },
    combo: snap.combo,
    streak: snap.streak,
    goal: snap.goal,
    settings: snap.settings,
  };
  bridge!.publish(eng);

  context.subscriptions.push(
    ...subscriptions,
    bridge,
    { dispose: () => { notifier = undefined; } },
    { dispose: () => { subscriptions.forEach((d) => d.dispose()); } },
  );

  logger.info('activated');
}

export function deactivate(): void {
  tracker?.stop();
  sessions?.stop();
  bridge?.dispose();
  statusBar?.dispose();
  subscriptions.forEach((d) => d.dispose());
  logger?.info('deactivated');
}
