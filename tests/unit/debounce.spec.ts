import { describe, it, expect, vi } from 'vitest';
import { debounce } from '../../src/util/debounce';

describe('debounce', () => {
  it('coalesces multiple calls within window', async () => {
    const fn = vi.fn();
    const d = debounce(fn, 50);
    d(1);
    d(2);
    d(3);
    expect(fn).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 100));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
  });

  it('flushes immediately', async () => {
    const fn = vi.fn();
    const d = debounce(fn, 1000);
    d(1);
    d.flush();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
  });

  it('cancels pending calls', async () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d(1);
    d.cancel();
    await new Promise((r) => setTimeout(r, 200));
    expect(fn).not.toHaveBeenCalled();
  });
});
