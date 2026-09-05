import { describe, it, expect, vi } from 'vitest';
import { createStorageManager } from '../../src/storage/storageManager';
import type { Logger } from '../../src/util/logger';

const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function makeContext(initial: unknown = undefined) {
  const store = new Map<string, unknown>();
  return {
    globalState: {
      get: vi.fn((key: string) => store.get(key) ?? initial),
      update: vi.fn((key: string, value: unknown) => {
        store.set(key, value);
        return Promise.resolve();
      }),
    },
  };
}

describe('storageManager', () => {
  it('returns defaults when nothing stored', async () => {
    const ctx = makeContext(undefined);
    const sm = createStorageManager(ctx, mockLogger);
    const state = await sm.load();
    expect(state.settings.goalMinutes).toBe(240);
    expect(state.history).toHaveLength(1);
  });

  it('round-trips valid state', async () => {
    const ctx = makeContext(undefined);
    const sm = createStorageManager(ctx, mockLogger);
    const initial = await sm.load();
    await sm.save(initial);
    const sm2 = createStorageManager(ctx, mockLogger);
    const loaded = await sm2.load();
    expect(loaded.settings.goalMinutes).toBe(240);
  });

  it('falls back to defaults on corrupt JSON', async () => {
    const ctx = makeContext('not-json');
    const sm = createStorageManager(ctx, mockLogger);
    const state = await sm.load();
    expect(state.settings.goalMinutes).toBe(240);
  });
});
