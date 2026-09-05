import { describe, it, expect } from 'vitest';
import { ulid } from '../../src/util/id';

describe('ulid', () => {
  it('returns 26 characters', () => {
    expect(ulid(1_700_000_000_000)).toHaveLength(26);
  });

  it('is sortable by time', () => {
    const a = ulid(1_700_000_000_000);
    const b = ulid(1_700_000_000_100);
    expect(a < b).toBe(true);
  });

  it('produces distinct values within same ms', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(ulid(1_700_000_000_000));
    expect(ids.size).toBe(100);
  });
});
