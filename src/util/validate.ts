// Defensive JSON parse + type-guard helpers. No dependencies.
// Used by StorageManager. Per DATA_MODEL.md § 8.

export type Result<T> = { ok: true; value: T } | { ok: false; reason: string };

export function safeJsonParse(text: string): Result<unknown> {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (err) {
    return { ok: false, reason: `JSON parse failed: ${(err as Error).message}` };
  }
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function expectString(v: unknown, path: string): Result<string> {
  if (typeof v === 'string' && v.length > 0) return { ok: true, value: v };
  return { ok: false, reason: `${path}: expected non-empty string, got ${typeof v}` };
}

export function expectNumber(v: unknown, path: string, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY): Result<number> {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    return { ok: false, reason: `${path}: expected finite number, got ${typeof v}` };
  }
  if (v < min || v > max) {
    return { ok: false, reason: `${path}: ${v} out of range [${min}, ${max}]` };
  }
  return { ok: true, value: v };
}

export function expectBoolean(v: unknown, path: string): Result<boolean> {
  if (typeof v === 'boolean') return { ok: true, value: v };
  return { ok: false, reason: `${path}: expected boolean, got ${typeof v}` };
}

export function expectArray(v: unknown, path: string): Result<unknown[]> {
  if (Array.isArray(v)) return { ok: true, value: v };
  return { ok: false, reason: `${path}: expected array, got ${typeof v}` };
}

export function expectObject(v: unknown, path: string): Result<Record<string, unknown>> {
  if (isPlainObject(v)) return { ok: true, value: v };
  return { ok: false, reason: `${path}: expected object` };
}

export function expectNullOrNumber(v: unknown, path: string): Result<number | null> {
  if (v === null) return { ok: true, value: null };
  if (typeof v === 'number' && Number.isFinite(v)) return { ok: true, value: v };
  return { ok: false, reason: `${path}: expected number|null, got ${typeof v}` };
}
