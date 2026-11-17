// ============================================================
// NABER — shared world constants + small helpers
// ============================================================
export const TAU = Math.PI * 2;
export const ARENA_R = 500;
export const ANCHOR_ORBIT = 322;
export const PLAYER_R = 15;
export const CORE_R = 52;
export const ROPE_MAX = 440;
export const ROPE_MIN = 118;
export const REEL_SPEED = 168;
export const GRAVITY = 238;
export const MAX_SPEED = 1120;
export const PICKUP_R = 30;
export const COMBO_TIME = 3.2;
export const FIXED = 1 / 120;

export const WAVES = [
  { name: 'DRIFT',    goal: 7,  shrink: 2.9, leeches: 0, sub: 'NAB THE FALLING LIGHT' },
  { name: 'CREEP',    goal: 9,  shrink: 3.2, leeches: 1, sub: 'SOMETHING STIRS BELOW' },
  { name: 'HUNT',     goal: 11, shrink: 3.5, leeches: 2, sub: 'THE VOID IS HUNGRY' },
  { name: 'SURGE',    goal: 13, shrink: 3.8, leeches: 2, sub: 'GOLD LIGHT MAKES YOU DANGEROUS' },
  { name: 'COLLAPSE', goal: 15, shrink: 4.1, leeches: 3, sub: 'THE SAFE ORBIT IS SHRINKING' },
  { name: 'MAW',      goal: 17, shrink: 4.4, leeches: 3, sub: 'HOLD THE LINE' },
  { name: 'ECLIPSE',  goal: 19, shrink: 4.7, leeches: 4, sub: 'NO SAFE ORBIT' },
  { name: 'ZENITH',   goal: 21, shrink: 5.0, leeches: 4, sub: 'NAB THE LAST LIGHT' },
];

export const COLORS = {
  lime: '#caff4a',
  limeSoft: '#eaffb0',
  cyan: '#55f2ff',
  magenta: '#ff4f9e',
  gold: '#ffd35c',
  white: '#ffffff',
  violet: '#8f6bff',
  ink: '#eafff4',
};

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
};

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// safe localStorage (some embedded browsers throw)
export function loadNum(key, fallback = 0) {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) ? v : fallback;
  } catch { return fallback; }
}
export function loadStr(key, fallback = '') {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
export function save(key, value) {
  try { localStorage.setItem(key, String(value)); } catch { /* no-op */ }
}

export function fmt(n) {
  return Math.round(n).toLocaleString('en-US');
}
