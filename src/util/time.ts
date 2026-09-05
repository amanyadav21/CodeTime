// Time helpers. Per LLD.md § 2.

export type MonotonicMs = number;
export type WallMs = number;

export function nowMono(): MonotonicMs {
  return performance.now();
}

export function nowWall(): WallMs {
  return Date.now();
}

const dayFmt = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: undefined,
});

export function localDayKey(wall: WallMs): string {
  return dayFmt.format(new Date(wall));
}

export function startOfLocalDay(wall: WallMs): WallMs {
  const key = localDayKey(wall);
  const [y, m, d] = key.split('-').map((s) => Number(s)) as [number, number, number];
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

export function isLocalMidnightCross(prev: WallMs, now: WallMs): boolean {
  return localDayKey(prev) !== localDayKey(now);
}
