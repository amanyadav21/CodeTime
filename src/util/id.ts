// ULID: 26-char Crockford Base32. Monotonic-ish via last-time cache.
// No external dependency. Per LLD.md § 4.

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ENCODING_LEN = ENCODING.length;
const TIME_LEN = 10;
const RANDOM_LEN = 16;

let lastTime = 0;
let lastRandom = '';

function randomChars(n: number): string {
  let out = '';
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < n; i++) {
    const b = bytes[i] ?? 0;
    out += ENCODING.charAt(b % ENCODING_LEN);
  }
  return out;
}

export function ulid(now: number = Date.now()): string {
  const time = now;
  if (time === lastTime && lastRandom.length === RANDOM_LEN) {
    const bumped = bumpLastChar(lastRandom);
    lastRandom = bumped;
    return encodeTime(time) + bumped;
  }
  lastTime = time;
  lastRandom = randomChars(RANDOM_LEN);
  return encodeTime(time) + lastRandom;
}

function bumpLastChar(s: string): string {
  const chars = s.split('');
  for (let i = chars.length - 1; i >= 0; i--) {
    const c = chars[i] ?? '0';
    const idx = ENCODING.indexOf(c);
    if (idx < 0) {
      chars[i] = '0';
      continue;
    }
    if (idx === ENCODING_LEN - 1) {
      chars[i] = '0';
      if (i === 0) {
        chars[0] = '0';
      }
      continue;
    }
    chars[i] = ENCODING.charAt(idx + 1);
    break;
  }
  return chars.join('');
}

function encodeTime(time: number): string {
  let out = '';
  let t = time;
  for (let i = 0; i < TIME_LEN; i++) {
    const mod = t % ENCODING_LEN;
    out = ENCODING.charAt(mod) + out;
    t = Math.floor(t / ENCODING_LEN);
  }
  return out;
}
