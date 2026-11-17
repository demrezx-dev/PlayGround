/* ============================================================
   PULSAR — Neon Arena
   A canvas arena-survival shooter. Waves, upgrades, a boss.
   ============================================================ */

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });
const $ = (id) => document.getElementById(id);

const ui = {
  hud: $("hud"),
  hpFill: $("hpFill"),
  hpGhost: $("hpGhost"),
  hpText: $("hpText"),
  hpMax: $("hpMax"),
  shieldFill: $("shieldFill"),
  shieldText: $("shieldText"),
  chips: $("chips"),
  score: $("scoreVal"),
  combo: $("comboVal"),
  comboFill: $("comboFill"),
  levelVal: $("levelVal"),
  xpFill: $("xpFill"),
  wave: $("waveVal"),
  best: $("bestVal"),
  bossHud: $("bossHud"),
  bossFill: $("bossFill"),
  dashFill: $("dashFill"),
  banner: $("waveBanner"),
  bannerText: $("waveBannerText"),
  bannerSub: $("waveBannerSub"),
  startScreen: $("startScreen"),
  levelScreen: $("levelScreen"),
  pauseScreen: $("pauseScreen"),
  deadScreen: $("deadScreen"),
  cards: $("cards"),
  levelEyebrow: $("levelEyebrow"),
  startBest: $("startBest"),
  deadScore: $("deadScore"),
  deadWave: $("deadWave"),
  deadKills: $("deadKills"),
  deadBest: $("deadBest"),
  deadNew: $("deadNew"),
  soundBtn: $("soundBtn"),
  pauseBtn: $("pauseBtn"),
  dashBtn: $("dashBtn"),
  toast: $("toast"),
  startBtn: $("startBtn"),
  retryBtn: $("retryBtn"),
  resumeBtn: $("resumeBtn"),
  quitBtn: $("quitBtn"),
  homeBtn: $("homeBtn"),
};

/* ---------------------------------------------------------- helpers */

const TAU = Math.PI * 2;
const rnd = (a = 1, b = 0) => b + Math.random() * (a - b);
const rndInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const ease = (rate, dt) => 1 - Math.exp(-rate * dt);
const fmt = (n) => Math.round(n).toLocaleString("tr-TR");

function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + d * t;
}

function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy;
  let t = len2 > 0 ? ((px - ax) * vx + (py - ay) * vy) / len2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}

const MONO = 'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, monospace';
const SANS = '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

const C = {
  cyan: "94,242,255",
  magenta: "255,84,190",
  amber: "255,183,94",
  violet: "170,140,255",
  green: "109,255,176",
  red: "255,95,109",
  white: "255,255,255",
  orange: "255,138,92",
};

/* ------------------------------------------------------------ glow */

const glowCache = new Map();
function glowSprite(rgb) {
  let sprite = glowCache.get(rgb);
  if (sprite) return sprite;
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,0.95)");
  grd.addColorStop(0.16, `rgba(${rgb},0.9)`);
  grd.addColorStop(0.46, `rgba(${rgb},0.3)`);
  grd.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  glowCache.set(rgb, c);
  return c;
}

function glow(x, y, r, rgb, alpha = 1) {
  const sprite = glowSprite(rgb);
  if (r > 180) {
    alpha *= 180 / r;
    r = 180;
  }
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

/* ----------------------------------------------------------- audio */

const audio = {
  ctx: null,
  master: null,
  muted: false,
  noiseBuf: null,
  lastEnemyAt: 0,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.34;
    this.master.connect(this.ctx.destination);
  },
  unlock() {
    this.init();
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  },
  tone(freq, end, dur, type = "sine", vol = 0.1, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, freq), t);
    if (end && end !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.04);
  },
  noise(dur, vol, cut = 1200, delay = 0) {
    if (!this.ctx || this.muted) return;
    if (!this.noiseBuf) {
      const len = Math.floor(this.ctx.sampleRate * 0.7);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    }
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cut;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  },
  shoot() {
    this.tone(rnd(980, 840), rnd(300, 220), 0.06, "triangle", 0.045);
  },
  hit() {
    this.tone(rnd(340, 280), 150, 0.05, "triangle", 0.04);
  },
  kill(big) {
    this.noise(big ? 0.55 : 0.16, big ? 0.32 : 0.14, big ? 700 : 1400);
    this.tone(big ? 120 : rnd(190, 150), 45, big ? 0.6 : 0.16, "sine", big ? 0.24 : 0.09);
  },
  hurt() {
    this.tone(120, 40, 0.32, "sawtooth", 0.16);
    this.noise(0.2, 0.14, 900);
  },
  shieldHit() {
    this.tone(620, 220, 0.16, "sine", 0.1);
    this.noise(0.12, 0.08, 2600);
  },
  pickup() {
    this.tone(820, 1240, 0.09, "sine", 0.06);
  },
  heal() {
    this.tone(420, 840, 0.22, "sine", 0.09);
    this.tone(630, 1160, 0.26, "triangle", 0.05, 0.05);
  },
  level() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, f * 1.01, 0.3, "triangle", 0.09, i * 0.075));
    this.noise(0.4, 0.05, 2800);
  },
  dash() {
    this.noise(0.22, 0.16, 2200);
    this.tone(220, 900, 0.2, "sine", 0.07);
  },
  enemyShot() {
    const now = performance.now();
    if (now - this.lastEnemyAt < 70) return;
    this.lastEnemyAt = now;
    this.tone(rnd(300, 240), 110, 0.14, "square", 0.025);
  },
  wave() {
    this.tone(110, 240, 0.5, "sine", 0.1);
    this.noise(0.5, 0.06, 700);
  },
  boss() {
    this.tone(70, 38, 1.1, "sawtooth", 0.14);
    this.noise(1.2, 0.12, 400);
  },
  clear() {
    [392, 523, 659].forEach((f, i) => this.tone(f, f, 0.35, "sine", 0.08, i * 0.09));
  },
  dead() {
    [300, 220, 160, 90].forEach((f, i) => this.tone(f, f * 0.6, 0.5, "triangle", 0.12, i * 0.12));
    this.noise(0.9, 0.18, 500);
  },
  ui() {
    this.tone(620, 760, 0.05, "square", 0.03);
  },
};

/* ----------------------------------------------------------- input */

const keys = new Set();
const pointer = { x: 0, y: 0, active: false, lastMove: -1e9 };
const joy = { id: null, active: false, ox: 0, oy: 0, dx: 0, dy: 0, mag: 0 };

/* -------------------------------------------------- canvas + world */

const ARENA = { w: 2600, h: 1700 };
const cam = { x: ARENA.w / 2, y: ARENA.h / 2, sx: 0, sy: 0 };
let W = window.innerWidth;
let H = window.innerHeight;
let DPR = 1;
let bgGrad = null;
let bgLayer = null;
let visualTime = 0;
let game = null;
let lastAt = 0;
const stars = [];

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  const target = 960;
  const scale = Math.min(1, target / Math.max(W * dpr, H * dpr));
  DPR = dpr * scale;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const g = ctx.createRadialGradient(W * 0.5, H * 0.26, 0, W * 0.5, H * 0.52, Math.max(W, H) * 0.92);
  g.addColorStop(0, "#0c1529");
  g.addColorStop(0.45, "#070b18");
  g.addColorStop(1, "#03040a");
  bgGrad = g;
  buildStars();
  buildBackgroundLayer();
}

function buildBackgroundLayer() {
  const c = document.createElement("canvas");
  c.width = canvas.width;
  c.height = canvas.height;
  const g = c.getContext("2d");
  g.setTransform(DPR, 0, 0, DPR, 0, 0);

  g.fillStyle = bgGrad;
  g.fillRect(0, 0, W, H);

  const nebula = (x, y, r, rgb, a) => {
    g.globalAlpha = a;
    g.drawImage(glowSprite(rgb), x - r, y - r, r * 2, r * 2);
    g.globalAlpha = 1;
  };
  g.globalCompositeOperation = "lighter";
  nebula(W * 0.18, H * 0.08, Math.min(460, W * 0.45), C.magenta, 0.085);
  nebula(W * 0.88, H * 0.9, Math.min(500, W * 0.5), C.cyan, 0.065);
  g.globalCompositeOperation = "source-over";

  for (const s of stars) {
    const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(s.ph));
    g.fillStyle = `rgba(${s.z > 0.75 ? "200,240,255" : "140,180,235"},${(0.18 + s.z * 0.5) * tw})`;
    g.fillRect(s.nx * W, s.ny * H, s.s, s.s);
  }

  const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.78);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(0.72, "rgba(2,4,10,0.28)");
  v.addColorStop(1, "rgba(2,3,8,0.78)");
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);

  g.fillStyle = "rgba(255,255,255,0.02)";
  for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);

  bgLayer = c;
}

function buildStars() {
  stars.length = 0;
  const count = clamp(Math.round((W * H) / 11000), 70, 220);
  for (let i = 0; i < count; i += 1) {
    stars.push({
      nx: Math.random(),
      ny: Math.random(),
      z: rnd(0.35, 1),
      s: rnd(0.7, 2.2),
      ph: rnd(0, TAU),
      sp: rnd(0.4, 1.5),
    });
  }
}

function screenToWorld(sx, sy) {
  return { x: cam.x + (sx - W / 2), y: cam.y + (sy - H / 2) };
}

/* --------------------------------------------------------- upgrades */

const UPGRADES = [
  { id: "rate", name: "HIZLI ATEŞ", short: "ATEŞ", tag: "SİLAH", icon: "↯", color: C.cyan, max: 6, desc: "Ateş hızı %16 artar.", apply(s) { s.fireInterval *= 0.84; } },
  { id: "dmg", name: "YOĞUN PLAZMA", short: "PLAZMA", tag: "SİLAH", icon: "✦", color: C.magenta, max: 8, desc: "Mermi hasarı %22 artar.", apply(s) { s.damage *= 1.22; } },
  { id: "gun", name: "ÇATALLI NAMLU", short: "SAÇMA", tag: "SİLAH", icon: "⇶", color: C.violet, max: 4, desc: "+1 mermi, hafif yayılım.", apply(s) { s.bullets += 1; s.spread *= 0.94; } },
  { id: "pierce", name: "DELİCİ IŞIN", short: "DELİCİ", tag: "SİLAH", icon: "➤", color: C.amber, max: 3, desc: "Mermiler +1 hedef deler.", apply(s) { s.pierce += 1; } },
  { id: "crit", name: "KRİTİK FREKANS", short: "KRİTİK", tag: "SİLAH", icon: "✹", color: C.red, max: 5, desc: "Kritik vuruş şansı +%11.", apply(s) { s.crit = Math.min(0.8, s.crit + 0.11); } },
  { id: "size", name: "AĞIR ÇEKİRDEK", short: "ÇEKİRDEK", tag: "SİLAH", icon: "⬢", color: C.amber, max: 2, desc: "Mermiler %20 büyür, hasar +%8.", apply(s) { s.bulletSize *= 1.2; s.damage *= 1.08; } },
  { id: "speed", name: "İTKİ YÜKSELTME", short: "İTKİ", tag: "GÖVDE", icon: "⌁", color: C.cyan, max: 5, desc: "Hareket hızı %11 artar.", apply(s) { s.speed *= 1.11; } },
  { id: "shield", name: "REZONANS KALKANI", short: "KALKAN", tag: "GÖVDE", icon: "◈", color: C.cyan, max: 4, desc: "Kalkan kapasitesi +25 ve kalkan dolar.", apply(s, p) { s.shieldMax += 25; p.maxShield = s.shieldMax; p.shield = p.maxShield; } },
  { id: "regen", name: "HIZLI ONARIM", short: "ONARIM", tag: "GÖVDE", icon: "↺", color: C.green, max: 4, desc: "Kalkan yenilenmesi %45 hızlanır.", apply(s) { s.shieldRegen *= 1.45; } },
  { id: "hp", name: "GÜÇLENDİRİLMİŞ GÖVDE", short: "GÖVDE", tag: "GÖVDE", icon: "✚", color: C.green, max: 4, desc: "Maksimum can +25, canını iyileştirir.", apply(s, p) { s.maxHp += 25; p.maxHp = s.maxHp; p.hp = Math.min(p.maxHp, p.hp + 25); } },
  { id: "vamp", name: "VAMPİR ÇEKİRDEĞİ", short: "VAMPİR", tag: "GÖVDE", icon: "♥", color: C.red, max: 2, desc: "Her 14 imhada +6 can kazan.", apply(s) { s.vampEvery += 14; } },
  { id: "magnet", name: "ÇEKİM ALANI", short: "ÇEKİM", tag: "SİSTEM", icon: "◎", color: C.violet, max: 3, desc: "Enerji toplama menzili +70.", apply(s) { s.magnet += 70; } },
  { id: "dash", name: "FAZ ATLAMASI", short: "FAZ", tag: "SİSTEM", icon: "⤳", color: C.cyan, max: 3, desc: "Atılma beklemesi %22 azalır.", apply(s) { s.dashCd *= 0.78; } },
  { id: "boom", name: "ŞOK DALGASI", short: "ŞOK", tag: "SİSTEM", icon: "☄", color: C.amber, max: 1, desc: "Atılırken çevrene hasar veren dalga yay.", apply(s) { s.dashBoom = 1; } },
];

const UPGRADE_MAP = new Map(UPGRADES.map((u) => [u.id, u]));

function baseStats() {
  return {
    speed: 330,
    fireInterval: 0.165,
    damage: 12,
    bulletSpeed: 1040,
    bulletSize: 1,
    bullets: 1,
    spread: 0.075,
    pierce: 0,
    crit: 0.06,
    critMult: 2,
    magnet: 120,
    dashCd: 2.4,
    dashBoom: 0,
    shieldRegen: 9,
    shieldMax: 50,
    maxHp: 100,
    vampEvery: 0,
  };
}

function makePlayer() {
  const stats = baseStats();
  return {
    x: ARENA.w / 2,
    y: ARENA.h / 2,
    vx: 0,
    vy: 0,
    r: 14,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    shield: stats.shieldMax,
    maxShield: stats.shieldMax,
    shieldDelay: 0,
    aim: -Math.PI / 2,
    fireCd: 0,
    dashCd: 0,
    dashTime: 0,
    dashDir: { x: 1, y: 0 },
    dashHits: new Set(),
    invuln: 0,
    hurt: 0,
    recoil: 0,
    trail: [],
    killsSinceHeal: 0,
    alive: true,
  };
}

function createGame(mode = "menu") {
  return {
    mode,
    time: 0,
    score: 0,
    displayScore: 0,
    best: readBest(),
    kills: 0,
    wave: 1,
    waveState: "idle",
    spawnQueue: [],
    spawnTimer: 0,
    clearTimer: 0,
    combo: 0,
    comboTimer: 0,
    comboMax: 3.1,
    level: 1,
    xp: 0,
    xpNeed: 7,
    pendingLevels: 0,
    stats: baseStats(),
    upgrades: {},
    upgradeVersion: 0,
    choices: [],
    player: null,
    enemies: [],
    bullets: [],
    ebullets: [],
    orbs: [],
    particles: [],
    rings: [],
    texts: [],
    portals: [],
    pickups: [],
    shake: 0,
    flash: 0,
    hitstop: 0,
    deadTimer: 0,
    deadShown: false,
    newBest: false,
    touch: matchMedia("(pointer: coarse)").matches,
    hintShown: false,
  };
}

function readBest() {
  try {
    return Number(localStorage.getItem("pulsar.best.v1")) || 0;
  } catch {
    return 0;
  }
}

function writeBest(v) {
  try {
    localStorage.setItem("pulsar.best.v1", String(Math.round(v)));
  } catch {
    /* storage unavailable — ignore */
  }
}

/* ------------------------------------------------------ UI helpers */

function showOverlay(el) {
  el.classList.add("show");
}
function hideOverlay(el) {
  el.classList.remove("show");
}
function hideAllOverlays() {
  [ui.startScreen, ui.levelScreen, ui.pauseScreen, ui.deadScreen].forEach(hideOverlay);
}

let bannerTimer = null;
function banner(main, sub = "") {
  ui.bannerText.textContent = main;
  ui.bannerSub.textContent = sub;
  ui.banner.classList.remove("show");
  void ui.banner.offsetWidth;
  ui.banner.classList.add("show");
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => ui.banner.classList.remove("show"), 2700);
}

let toastTimer = null;
function toast(msg) {
  ui.toast.textContent = msg;
  ui.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 2100);
}

/* --------------------------------------------------- game lifecycle */

function startGame() {
  audio.unlock();
  hideAllOverlays();
  game = createGame("playing");
  game.player = makePlayer();
  cam.x = game.player.x;
  cam.y = game.player.y;
  document.body.classList.remove("dead");
  document.body.classList.add("playing");
  ui.startBest.textContent = fmt(game.best);
  ui.best.textContent = fmt(game.best);
  ui.deadNew.classList.remove("on");
  ui.bossHud.classList.remove("show");
  renderChips();
  game.displayScore = 0;
  game.wave = 0;
  startWave(1);
  updateHUD(true);
  toast(game.touch ? "Sürükle: hareket · ATIL: atılma" : "SPACE: atılma · Enerji kristallerini topla");
}

function goMenu() {
  hideAllOverlays();
  document.body.classList.remove("playing", "dead", "touch-paused");
  game = createGame("menu");
  game.player = null;
  ui.startBest.textContent = fmt(game.best);
  ui.best.textContent = fmt(game.best);
  ui.bossHud.classList.remove("show");
  showOverlay(ui.startScreen);
}

function togglePause() {
  if (!game) return;
  if (game.mode === "playing") {
    game.mode = "paused";
    showOverlay(ui.pauseScreen);
    audio.ui();
  } else if (game.mode === "paused") {
    game.mode = "playing";
    hideOverlay(ui.pauseScreen);
    audio.ui();
  }
}

function reserveDeath() {
  const p = game.player;
  p.alive = false;
  game.mode = "dead";
  game.deadTimer = 0;
  game.deadShown = false;
  game.shake = 26;
  game.flash = 0.85;
  p.hp = 0;
  explode(p.x, p.y, C.cyan, 46, 520);
  game.rings.push({ x: p.x, y: p.y, r: 10, maxR: 240, life: 0.9, max: 0.9, color: C.cyan, w: 3 });
  audio.dead();
  const best = Math.max(game.best, game.score);
  game.newBest = game.score > game.best && game.score > 0;
  game.best = best;
  writeBest(best);
  document.body.classList.remove("playing");
  document.body.classList.add("dead");
}

function revealDeath() {
  const g = game;
  ui.deadScore.textContent = fmt(g.score);
  ui.deadWave.textContent = g.wave;
  ui.deadKills.textContent = fmt(g.kills);
  ui.deadBest.textContent = fmt(g.best);
  ui.deadNew.classList.toggle("on", g.newBest);
  ui.startBest.textContent = fmt(g.best);
  ui.best.textContent = fmt(g.best);
  showOverlay(ui.deadScreen);
}

function gameOverNow() {
  if (game && game.mode === "dead" && !game.deadShown) revealDeath();
}

/* --------------------------------------------------------- level up */

function openLevelUp() {
  const g = game;
  g.mode = "levelup";
  g.pendingLevels -= 1;
  const available = UPGRADES.filter((u) => (g.upgrades[u.id] || 0) < u.max);
  const pool = available.slice();
  const choices = [];
  while (choices.length < 3 && pool.length) {
    const idx = Math.floor(Math.random() * pool.length);
    choices.push(pool.splice(idx, 1)[0]);
  }
  g.choices = choices;
  ui.levelEyebrow.textContent = `SEVİYE ${g.level}`;
  ui.cards.innerHTML = choices
    .map(
      (u, i) => `
      <button class="card" type="button" data-index="${i}" style="--accent:${u.color}">
        <span class="card-key">${i + 1}</span>
        <span class="card-icon">${u.icon}</span>
        <span class="card-body">
          <span class="card-tag">${u.tag}</span>
          <span class="card-name">${u.name}</span>
          <span class="card-desc">${u.desc}</span>
          <span class="card-stack">SEVİYE ${(g.upgrades[u.id] || 0)} / ${u.max}</span>
        </span>
      </button>`
    )
    .join("");
  ui.cards.querySelectorAll(".card").forEach((btn) => {
    btn.addEventListener("click", () => chooseCard(Number(btn.dataset.index)));
  });
  showOverlay(ui.levelScreen);
  audio.level();
}

function chooseCard(index) {
  if (!game || game.mode !== "levelup") return;
  const up = game.choices[index];
  if (!up) return;
  game.upgrades[up.id] = (game.upgrades[up.id] || 0) + 1;
  up.apply(game.stats, game.player);
  game.player.hp = Math.min(game.player.maxHp, game.player.hp);
  game.upgradeVersion += 1;
  renderChips();
  hideOverlay(ui.levelScreen);
  game.mode = "playing";
  audio.ui();
  const p = game.player;
  game.rings.push({ x: p.x, y: p.y, r: 12, maxR: 150, life: 0.6, max: 0.6, color: C.cyan, w: 2 });
  toast(`${up.name} · SV. ${game.upgrades[up.id]}`);
  if (game.pendingLevels > 0) {
    setTimeout(() => {
      if (game && game.mode === "playing" && game.pendingLevels > 0) openLevelUp();
    }, 220);
  }
}

/* ------------------------------------------------------------- HUD */

function renderChips() {
  if (!game) return;
  const parts = [];
  for (const [id, count] of Object.entries(game.upgrades)) {
    if (!count) continue;
    const up = UPGRADE_MAP.get(id);
    if (!up) continue;
    parts.push(
      `<span class="chip" style="border-color:rgba(${up.color},0.3)"><span class="chip-glyph">${up.icon}</span>${up.short}<b>${count}</b></span>`
    );
  }
  ui.chips.innerHTML = parts.join("");
}

let lastHud = {};
function updateHUD(force = false) {
  if (!game || !game.player) return;
  const g = game;
  const p = g.player;
  const hpPct = clamp(p.hp / p.maxHp, 0, 1);
  const hpWidth = `${(hpPct * 100).toFixed(1)}%`;
  if (force || lastHud.hp !== hpWidth) {
    ui.hpFill.style.width = hpWidth;
    lastHud.hp = hpWidth;
  }
  ui.hpGhost.style.width = hpWidth;
  const hpText = String(Math.ceil(p.hp));
  if (force || lastHud.hpText !== hpText) {
    ui.hpText.textContent = hpText;
    ui.hpMax.textContent = `/ ${p.maxHp}`;
    lastHud.hpText = hpText;
  }
  const shieldPct = `${(clamp(p.shield / p.maxShield, 0, 1) * 100).toFixed(0)}%`;
  ui.shieldFill.style.width = shieldPct;
  ui.shieldText.textContent = String(Math.ceil(p.shield));

  g.displayScore = force ? g.score : lerp(g.displayScore, g.score, 0.14);
  const scoreText = fmt(g.displayScore);
  if (force || scoreText !== lastHud.score) {
    ui.score.textContent = scoreText;
    lastHud.score = scoreText;
  }
  const mult = 1 + Math.min(g.combo, 60) * 0.05;
  ui.combo.textContent = `x${mult.toFixed(1)}`;
  ui.combo.style.opacity = g.combo > 0 ? "1" : "0.35";
  ui.comboFill.style.transform = `scaleX(${clamp(g.comboTimer / g.comboMax, 0, 1).toFixed(3)})`;
  ui.levelVal.textContent = `SV.${g.level}`;
  ui.xpFill.style.width = `${(clamp(g.xp / g.xpNeed, 0, 1) * 100).toFixed(1)}%`;
  if (force || String(g.wave) !== lastHud.wave) {
    ui.wave.textContent = g.wave;
    lastHud.wave = String(g.wave);
  }
  const bestText = fmt(Math.max(g.best, g.score));
  if (force || bestText !== lastHud.best) {
    ui.best.textContent = bestText;
    lastHud.best = bestText;
  }
  const dashRatio = g.stats.dashCd > 0 ? clamp(p.dashCd / g.stats.dashCd, 0, 1) : 0;
  ui.dashFill.style.transform = `scaleY(${(1 - dashRatio).toFixed(3)})`;

  const boss = g.enemies.find((e) => e.type === "boss" && e.alive);
  if (boss) {
    ui.bossHud.classList.add("show");
    ui.bossFill.style.width = `${(clamp(boss.hp / boss.maxHp, 0, 1) * 100).toFixed(1)}%`;
  } else {
    ui.bossHud.classList.remove("show");
  }
}

/* ---------------------------------------------------- sound button */

function toggleSound() {
  audio.unlock();
  audio.muted = !audio.muted;
  ui.soundBtn.classList.toggle("muted", audio.muted);
  try {
    localStorage.setItem("pulsar.muted.v1", audio.muted ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (!audio.muted) audio.ui();
}

