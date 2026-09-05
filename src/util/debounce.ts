// Debounce. Per LLD.md § 3.

export interface Debounced<F extends (...a: never[]) => void> {
  (...args: Parameters<F>): void;
  cancel(): void;
  flush(): void;
}

export function debounce<F extends (...a: never[]) => void>(
  fn: F,
  waitMs: number,
): Debounced<F> {
  let timer: NodeJS.Timeout | undefined;
  let pendingArgs: Parameters<F> | undefined;

  const run = (): void => {
    timer = undefined;
    if (pendingArgs) {
      const args = pendingArgs;
      pendingArgs = undefined;
      fn(...args);
    }
  };

  const debounced = ((...args: Parameters<F>): void => {
    pendingArgs = args;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(run, waitMs);
  }) as Debounced<F>;

  debounced.cancel = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    pendingArgs = undefined;
  };

  debounced.flush = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    run();
  };

  return debounced;
}
