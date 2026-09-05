// StorageManager: reads/writes/validates the persisted blob in globalState.
// Per LLD.md § 12.

import * as vscode from 'vscode';
import type { Logger } from '../util/logger';
import type { PersistedState, UserSettings, CodingSession, DailyStats } from './schema';
import { CURRENT_SCHEMA_VERSION, DEFAULT_SETTINGS, defaultDailyStats } from './schema';
import { debounce } from '../util/debounce';
import { safeJsonParse, expectNumber, expectBoolean, expectString, expectArray, expectObject, isPlainObject, expectNullOrNumber } from '../util/validate';
import { nowWall } from '../util/time';

const STORAGE_KEY = 'codepulse.state';
const UNKNOWN_BACKUP_KEY = 'codepulse.state.unknownBackup';

export interface StorageManager {
  load(): Promise<PersistedState>;
  save(state: PersistedState): Promise<void>;
  onQuotaError(handler: (err: unknown) => void): () => void;
}

export function createStorageManager(
  context: vscode.ExtensionContext,
  logger: Logger,
): StorageManager {
  const debouncedSave = debounce((raw: PersistedState) => {
    context.globalState.update(STORAGE_KEY, raw).then(undefined, (err) => {
      logger.warn('globalState.update failed, pruning and retrying', err);
      const pruned = pruneHistory(raw);
      context.globalState.update(STORAGE_KEY, pruned).then(undefined, (retryErr) => {
        logger.error('globalState.update failed after prune', retryErr);
      });
    });
  }, 500);

  return {
    async load(): Promise<PersistedState> {
      const raw = context.globalState.get<unknown>(STORAGE_KEY, undefined);
      if (raw === undefined) return defaultState();

      const parsed = typeof raw === 'string' ? safeJsonParse(raw) : { ok: true, value: raw };
      if (!parsed.ok) {
        const reason = (parsed as { ok: false; reason: string }).reason;
        logger.warn(`storage load: invalid JSON (${reason}), returning defaults`);
        return defaultState();
      }

      return validatePersistedState(parsed.value, logger, context) ?? defaultState();
    },

    async save(state: PersistedState): Promise<void> {
      const toWrite = { ...state, lastUpdatedAt: nowWall() };
      debouncedSave(toWrite);
      return Promise.resolve();
    },

    onQuotaError(_handler: (err: unknown) => void): () => void {
      return () => {};
    },
  };
}

function defaultState(): PersistedState {
  const day = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: undefined,
  }).format(new Date(nowWall()));
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    history: [defaultDailyStats(day)],
    currentSession: null,
    lastUpdatedAt: nowWall(),
  };
}

function pruneHistory(state: PersistedState): PersistedState {
  const retention = Math.max(1, Math.floor((state.settings.historyRetentionDays ?? 365) / 2));
  const cutoff = nowWall() - retention * 24 * 60 * 60 * 1000;
  const history = state.history.filter((d) => Date.parse(d.day) >= cutoff);
  return { ...state, history };
}

function validatePersistedState(raw: unknown, logger: Logger, ctx: vscode.ExtensionContext): PersistedState | null {
  const obj = expectObject(raw, 'root');
  if (!obj.ok) {
    logger.warn(`storage: root is not object (${obj.reason})`);
    return null;
  }

  const v = obj.value;
  const versionResult = expectNumber(v.schemaVersion, 'schemaVersion', 0, 999);
  const version = versionResult.ok ? versionResult.value : CURRENT_SCHEMA_VERSION;

  if (version > CURRENT_SCHEMA_VERSION) {
    void ctx.globalState.update(UNKNOWN_BACKUP_KEY, v).then(undefined, () => {});
    logger.warn(`storage: schemaVersion ${version} > CURRENT ${CURRENT_SCHEMA_VERSION}, sidecar saved`);
    return null;
  }

  const settings = validateSettings(v.settings, logger) ?? { ...DEFAULT_SETTINGS };
  const history = validateHistory(v.history, logger) ?? [];
  const currentSession = validateSession(v.currentSession, 'currentSession', logger);
  const lastUpdatedAtResult = expectNumber(v.lastUpdatedAt, 'lastUpdatedAt', 0, Date.now());
  const lastUpdatedAt = lastUpdatedAtResult.ok ? lastUpdatedAtResult.value : nowWall();

  return {
    schemaVersion: version,
    settings,
    history,
    currentSession,
    lastUpdatedAt,
  };
}

function validateSettings(raw: unknown, logger: Logger): UserSettings | null {
  if (!isPlainObject(raw)) {
    logger.warn('storage: settings is not object');
    return null;
  }
  const out: Partial<UserSettings> = { ...DEFAULT_SETTINGS };

  const r = (k: string, fb: number) => {
    const result = expectNumber((raw as Record<string, unknown>)[k], k, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    return result.ok ? result.value : fb;
  };

  out.idleThresholdSeconds = Math.max(10, Math.min(600, Math.round(r('idleThresholdSeconds', 60))));
  out.sessionEndThresholdSeconds = Math.max(60, Math.min(86_400, Math.round(r('sessionEndThresholdSeconds', 900))));
  out.goalMinutes = Math.max(1, Math.min(1440, Math.round(r('goalMinutes', 240))));
  out.streakMinimumMinutes = Math.max(1, Math.min(1440, Math.round(r('streakMinimumMinutes', 30))));
  out.historyRetentionDays = Math.max(30, Math.min(3650, Math.round(r('historyRetentionDays', 365))));

  const levelsResult = expectArray((raw as Record<string, unknown>).comboLevels, 'comboLevels');
  if (levelsResult.ok) {
    const levels = levelsResult.value as { minutes: number; multiplier: number }[];
    if (Array.isArray(levels) && levels.length > 0) {
      const mapped = levels.map((l) => {
        const minutesResult = expectNumber(l, 'comboLevels[].minutes');
        const multiplierResult = expectNumber(l, 'comboLevels[].multiplier');
        if (!minutesResult.ok || !multiplierResult.ok) return null;
        return { minutes: Math.max(0, Math.round(minutesResult.value)), multiplier: Math.max(1, Math.round(multiplierResult.value)) };
      }).filter((l): l is { minutes: number; multiplier: number } => l !== null);
      if (mapped.length > 0) out.comboLevels = mapped as UserSettings['comboLevels'];
    }
  }

  const dl = expectBoolean((raw as Record<string, unknown>).debugLogging, 'debugLogging');
  if (dl.ok) out.debugLogging = dl.value;

  const ns = expectBoolean((raw as Record<string, unknown>).notifyOnSessionStart, 'notifyOnSessionStart');
  if (ns.ok) out.notifyOnSessionStart = ns.value;

  return out as UserSettings;
}

function validateHistory(raw: unknown, logger: Logger): DailyStats[] | null {
  const arrResult = expectArray(raw, 'history');
  if (!arrResult.ok) {
    logger.warn(`storage: ${arrResult.reason}`);
    return null;
  }
  const out: DailyStats[] = [];
  for (let i = 0; i < arrResult.value.length; i++) {
    const item = arrResult.value[i];
    const stats = validateDailyStats(item, `history[${i}]`, logger);
    if (stats) out.push(stats);
  }
  return out.length > 0 ? out : null;
}

function validateDailyStats(raw: unknown, path: string, logger: Logger): DailyStats | null {
  const objResult = expectObject(raw, path);
  if (!objResult.ok) {
    logger.warn(`storage: ${path} is not object (${objResult.reason})`);
    return null;
  }
  const v = objResult.value;
  const dayResult = expectString(v.day, `${path}.day`);
  const day = dayResult.ok ? dayResult.value : '1970-01-01';
  const totalResult = expectNumber(v.totalActiveMillis, `${path}.totalActiveMillis`, 0, Number.MAX_SAFE_INTEGER);
  const total = totalResult.ok ? totalResult.value : 0;
  const sessions = validateSessions(v.sessions, `${path}.sessions`, logger) ?? [];
  const longestResult = expectNumber(v.longestSessionMillis, `${path}.longestSessionMillis`, 0, Number.MAX_SAFE_INTEGER);
  const longest = longestResult.ok ? longestResult.value : 0;
  return { day, totalActiveMillis: total, sessions, longestSessionMillis: Math.max(0, longest) };
}

function validateSessions(raw: unknown, path: string, logger: Logger): CodingSession[] | null {
  const arrResult = expectArray(raw, path);
  if (!arrResult.ok) {
    logger.warn(`storage: ${path} is not array (${arrResult.reason})`);
    return null;
  }
  const out: CodingSession[] = [];
  for (let i = 0; i < arrResult.value.length; i++) {
    const item = arrResult.value[i];
    const objResult = expectObject(item, `${path}[${i}]`);
    if (!objResult.ok) {
      logger.warn(`storage: ${path}[${i}] is not object`);
      continue;
    }
    const v = objResult.value;
    const idResult = expectString(v.id, `${path}[${i}].id`);
    const startedAtResult = expectNumber(v.startedAt, `${path}[${i}].startedAt`, 0, Date.now());
    const endedAtResult = expectNullOrNumber(v.endedAt, `${path}[${i}].endedAt`);
    const activeMillisResult = expectNumber(v.activeMillis, `${path}[${i}].activeMillis`, 0, Number.MAX_SAFE_INTEGER);
    if (!idResult.ok || !startedAtResult.ok) continue;
    out.push({
      id: idResult.value,
      startedAt: startedAtResult.value,
      endedAt: endedAtResult.ok ? endedAtResult.value : null,
      activeMillis: activeMillisResult.ok ? Math.max(0, activeMillisResult.value) : 0,
    });
  }
  return out.length > 0 ? out : null;
}

function validateSession(raw: unknown, path: string, logger: Logger): { id: string; startedAt: number; endedAt: number | null; activeMillis: number } | null {
  if (raw === null || raw === undefined) return null;
  const objResult = expectObject(raw, path);
  if (!objResult.ok) {
    logger.warn(`storage: ${path} is not object (${objResult.reason})`);
    return null;
  }
  const v = objResult.value;
  const idResult = expectString(v.id, `${path}.id`);
  const startedAtResult = expectNumber(v.startedAt, `${path}.startedAt`, 0, Date.now());
  const endedAtResult = expectNullOrNumber(v.endedAt, `${path}.endedAt`);
  const activeMillisResult = expectNumber(v.activeMillis, `${path}.activeMillis`, 0, Number.MAX_SAFE_INTEGER);
  if (!idResult.ok || !startedAtResult.ok) return null;
  return {
    id: idResult.value,
    startedAt: startedAtResult.value,
    endedAt: endedAtResult.ok ? endedAtResult.value : null,
    activeMillis: activeMillisResult.ok ? Math.max(0, activeMillisResult.value) : 0,
  };
}
