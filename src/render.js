// ============================================================
// NABER — canvas rendering
// ============================================================
import {
  TAU, ARENA_R, ANCHOR_ORBIT, CORE_R, ROPE_MAX, PICKUP_R, COLORS, clamp, rgba,
} from './core.js';

export function initGlows(game) {
  const glows = {};
  for (const [key, color] of Object.entries(COLORS)) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const grd = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, rgba(color, 0.95));
    grd.addColorStop(0.25, rgba(color, 0.5));
    grd.addColorStop(0.6, rgba(color, 0.12));
    grd.addColorStop(1, rgba(color, 0));
    x.fillStyle = grd;
    x.fillRect(0, 0, 128, 128);
    glows[key] = c;
  }
  game.glows = glows;
}

function glow(g, ctx, key, x, y, rad, alpha = 1) {
  const spr = g.glows?.[key];
  if (!spr) return;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.drawImage(spr, x - rad, y - rad, rad * 2, rad * 2);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function poly(ctx, cx, cy, r, n, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// ---------------- background ----------------
export function buildBackdrop(g) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(g.w));
  c.height = Math.max(1, Math.ceil(g.h));
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, Math.max(g.w, g.h) * 0.72);
  grd.addColorStop(0, '#08111a');
  grd.addColorStop(0.45, '#05080f');
  grd.addColorStop(1, '#020308');
  x.fillStyle = grd;
  x.fillRect(0, 0, g.w, g.h);

  x.save();
  x.globalCompositeOperation = 'lighter';
  const blobs = [
    [0.22, 0.3, '#164a52', 0.2, 0.42],
    [0.8, 0.7, '#2c1442', 0.19, 0.5],
    [0.56, 0.16, '#1f4428', 0.12, 0.38],
    [0.12, 0.8, '#10283a', 0.13, 0.34],
  ];
  for (let i = 0; i < blobs.length; i++) {
    const [px, py, color, alpha, size] = blobs[i];
    const bx = g.cx + (px - 0.5) * g.w;
    const by = g.cy + (py - 0.5) * g.h;
    const r = Math.max(g.w, g.h) * size;
    const bg = x.createRadialGradient(bx, by, 0, bx, by, r);
    bg.addColorStop(0, rgba(color, alpha));
    bg.addColorStop(1, rgba(color, 0));
    x.fillStyle = bg;
    x.fillRect(bx - r, by - r, r * 2, r * 2);
  }
  x.restore();
  g.backdrop = c;
}

function drawBackground(g, ctx) {
  const { w, h } = g;
  if (g.backdrop) {
    ctx.drawImage(g.backdrop, 0, 0, w, h);
  } else {
    ctx.fillStyle = '#05080f';
    ctx.fillRect(0, 0, w, h);
  }

  // stars
  for (const s of g.stars) {
    const tw = 0.45 + 0.55 * Math.abs(Math.sin(g.t * s.tw + s.phase));
    ctx.globalAlpha = s.a * tw;
    ctx.fillStyle = s.c;
    const drift = (g.t * s.drift) % (w + 40);
    const x = (s.x + drift) % (w + 40) - 20;
    ctx.fillRect(x, s.y, s.size, s.size);
  }
  ctx.globalAlpha = 1;
}

// ---------------- arena structure ----------------
function drawArena(g, ctx) {
  // radial spokes
  ctx.save();
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + g.t * 0.008;
    ctx.strokeStyle = rgba(COLORS.cyan, 0.045);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * CORE_R, Math.sin(a) * CORE_R);
    ctx.lineTo(Math.cos(a) * ARENA_R, Math.sin(a) * ARENA_R);
    ctx.stroke();
  }
  // concentric orbits
  [150, 240, ANCHOR_ORBIT, 430].forEach((r, i) => {
    ctx.strokeStyle = rgba(COLORS.lime, i === 2 ? 0.1 : 0.045);
    ctx.lineWidth = i === 2 ? 1.5 : 1;
    if (i === 2) ctx.setLineDash([3, 13]); else ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // outer boundary ticks
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU - g.t * 0.02;
    const big = i % 6 === 0;
    ctx.strokeStyle = rgba(COLORS.lime, big ? 0.34 : 0.1);
    ctx.lineWidth = big ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (ARENA_R - (big ? 13 : 6)), Math.sin(a) * (ARENA_R - (big ? 13 : 6)));
    ctx.lineTo(Math.cos(a) * ARENA_R, Math.sin(a) * ARENA_R);
    ctx.stroke();
  }
  ctx.strokeStyle = rgba(COLORS.cyan, 0.16);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, ARENA_R, 0, TAU);
  ctx.stroke();
  ctx.restore();

  // tiny drifting dust
  ctx.save();
  for (let i = 0; i < 26; i++) {
    const a = i * 2.399 + g.t * 0.03 * (1 + (i % 3) * 0.2);
    const r = 100 + ((i * 61) % 340);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    ctx.fillStyle = rgba(COLORS.cyan, 0.12 + 0.1 * Math.sin(g.t + i));
    ctx.fillRect(x, y, 1.6, 1.6);
  }
  ctx.restore();
}

// ---------------- the void ----------------
function voidPoints(g) {
  const N = 150;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    const wob = Math.sin(a * 7 + g.t * 0.9) * 3.4 + Math.sin(a * 13 - g.t * 1.4) * 2.1 + Math.sin(a * 3 + g.t * 0.4) * 3.8;
    const r = g.voidR + wob;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

function drawVoid(g, ctx) {
  const pts = voidPoints(g);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-1600, -1600, 3200, 3200);
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  const vg = ctx.createRadialGradient(0, 0, g.voidR * 0.92, 0, 0, g.voidR + 160);
  vg.addColorStop(0, 'rgba(18,4,30,0.9)');
  vg.addColorStop(0.35, 'rgba(7,2,14,0.97)');
  vg.addColorStop(1, 'rgba(1,1,4,0.99)');
  ctx.fillStyle = vg;
  ctx.fill('evenodd');

  // rim glows
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 38;
  ctx.strokeStyle = rgba(COLORS.violet, 0.06);
  ctx.stroke();
  ctx.lineWidth = 16;
  ctx.strokeStyle = rgba(COLORS.magenta, 0.1);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.strokeStyle = rgba(COLORS.magenta, 0.55);
  ctx.stroke();
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = rgba('#ffe0f0', 0.9);
  ctx.stroke();

  // violet arcs crawling along the rim
  for (let i = 0; i < 4; i++) {
    const a0 = g.t * 0.5 + i * 1.7;
    const span = 0.5 + 0.35 * Math.sin(g.t * 1.3 + i);
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = rgba(COLORS.violet, 0.34 + 0.15 * Math.sin(g.t * 2 + i));
    ctx.beginPath();
    ctx.arc(0, 0, g.voidR + 4, a0, a0 + span);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';

  // inward teeth / tendrils
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * TAU + Math.sin(g.t * 0.35 + i) * 0.03;
    const reach = 10 + 22 * (0.5 + 0.5 * Math.sin(g.t * 0.7 + i * 2.1));
    const r = g.voidR;
    const spread = 0.028;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a - spread) * (r + 8), Math.sin(a - spread) * (r + 8));
    ctx.lineTo(Math.cos(a) * (r - reach), Math.sin(a) * (r - reach));
    ctx.lineTo(Math.cos(a + spread) * (r + 8), Math.sin(a + spread) * (r + 8));
    ctx.closePath();
    ctx.fillStyle = 'rgba(4,1,9,0.92)';
    ctx.fill();
    ctx.strokeStyle = rgba(COLORS.magenta, 0.26);
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // drifting void specks outside the rim
  for (let i = 0; i < 34; i++) {
    const a = i * 2.399 + g.t * 0.045 * (i % 2 ? 1 : -1);
    const r = g.voidR + 30 + ((i * 47) % 190);
    const alpha = 0.1 + 0.16 * (0.5 + 0.5 * Math.sin(g.t * 1.3 + i));
    ctx.fillStyle = rgba(COLORS.magenta, alpha);
    ctx.fillRect(Math.cos(a) * r, Math.sin(a) * r, 2, 2);
  }
  ctx.restore();
}

// ---------------- core ----------------
function drawCore(g, ctx) {
  const prog = g.progress();
  const pulse = 0.5 + 0.5 * Math.sin(g.t * 1.7);

  glow(g, ctx, 'lime', 0, 0, 120 + pulse * 20, 0.16 + prog * 0.1);

  ctx.save();
  ctx.rotate(g.t * 0.18);
  ctx.strokeStyle = rgba(COLORS.lime, 0.3);
  ctx.lineWidth = 1.4;
  ctx.setLineDash([10, 16]);
  ctx.beginPath();
  ctx.arc(0, 0, 78, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // progress arc
  ctx.save();
  ctx.rotate(-Math.PI / 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(202,255,74,0.1)';
  ctx.beginPath();
  ctx.arc(0, 0, 70, 0, TAU);
  ctx.stroke();
  if (prog > 0.001) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(COLORS.lime, 0.9);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, 70, 0, TAU * clamp(prog, 0, 1));
    ctx.stroke();
    ctx.lineWidth = 9;
    ctx.strokeStyle = rgba(COLORS.lime, 0.12);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();

  ctx.save();
  ctx.rotate(-g.t * 0.5);
  ctx.strokeStyle = rgba(COLORS.cyan, 0.4);
  ctx.lineWidth = 1.2;
  poly(ctx, 0, 0, 58, 6, 0);
  ctx.stroke();
  ctx.rotate(g.t * 1.1);
  ctx.strokeStyle = rgba(COLORS.lime, 0.55);
  poly(ctx, 0, 0, 46, 3, 0);
  ctx.stroke();
  ctx.restore();

  const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, CORE_R);
  grd.addColorStop(0, 'rgba(234,255,176,0.95)');
  grd.addColorStop(0.28, 'rgba(202,255,74,0.33)');
  grd.addColorStop(0.8, 'rgba(85,242,255,0.06)');
  grd.addColorStop(1, 'rgba(3,8,5,0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(0, 0, CORE_R, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = rgba(COLORS.limeSoft, 0.8);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, 35 + pulse * 1.5, 0, TAU);
  ctx.stroke();

  ctx.fillStyle = rgba(COLORS.lime, 0.9);
  ctx.beginPath();
  ctx.arc(0, 0, 6 + pulse * 1.4, 0, TAU);
  ctx.fill();
}

// ---------------- entities ----------------
function drawAnchor(g, ctx, a) {
  const p = g.player;
  const inRange = p && Math.hypot(a.x - p.x, a.y - p.y) < ROPE_MAX;
  const target = g.hover === a;
  const attached = g.attached === a;
  const es = g.entityScale;
  const size = (18 + Math.sin(g.t * 2 + a.phase) * 1.5) * es;

  if (inRange || g.state === 'menu') glow(g, ctx, 'violet', a.x, a.y, size * 3.6, 0.22);
  if (target || attached) glow(g, ctx, 'lime', a.x, a.y, size * 5, 0.32);

  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.strokeStyle = rgba(COLORS.violet, inRange ? 0.32 : 0.14);
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 7]);
  ctx.beginPath();
  ctx.arc(0, 0, size * 2.1, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.rotate(g.t * 0.35 + a.phase);
  ctx.strokeStyle = rgba(COLORS.violet, inRange ? 0.9 : 0.3);
  ctx.lineWidth = 1.8;
  poly(ctx, 0, 0, size, 6, 0);
  ctx.stroke();

  ctx.rotate(-g.t * 0.8);
  ctx.strokeStyle = rgba(COLORS.cyan, inRange ? 0.85 : 0.25);
  ctx.lineWidth = 1.8;
  poly(ctx, 0, 0, size * 0.62, 3, 0);
  ctx.stroke();

  ctx.fillStyle = target || attached ? COLORS.limeSoft : rgba(COLORS.lime, inRange ? 0.9 : 0.35);
  ctx.beginPath();
  ctx.arc(0, 0, 3.4 * es, 0, TAU);
  ctx.fill();
  ctx.restore();

  // targeting brackets
  if (target || attached) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(-g.t * 0.7);
    ctx.strokeStyle = attached ? rgba(COLORS.lime, 0.95) : rgba(COLORS.lime, 0.55);
    ctx.lineWidth = 1.4;
    const r = size * 1.85;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, r, i * (TAU / 4) + 0.2, i * (TAU / 4) + 0.85);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (a.consumed) {
    ctx.strokeStyle = rgba(COLORS.magenta, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x - 6, a.y - 6); ctx.lineTo(a.x + 6, a.y + 6);
    ctx.moveTo(a.x + 6, a.y - 6); ctx.lineTo(a.x - 6, a.y + 6);
    ctx.stroke();
  }
}

function drawShard(g, ctx, s) {
  const es = g.entityScale;
  const pulse = 0.5 + 0.5 * Math.sin(g.t * 3 + s.phase);
  const isSurge = s.type === 'surge';
  const key = isSurge ? 'gold' : 'cyan';
  const size = (isSurge ? 14 : 10.4) * (0.9 + pulse * 0.14) * es;
  glow(g, ctx, key, s.x, s.y, size * 4.4, isSurge ? 0.4 : 0.26);

  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.rot);
  ctx.fillStyle = isSurge ? rgba(COLORS.gold, 0.85) : rgba(COLORS.cyan, 0.8);
  ctx.strokeStyle = isSurge ? '#fff4c9' : '#d9ffff';
  ctx.lineWidth = 1.2;
  if (isSurge) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      const r = i % 2 ? size * 0.4 : size * 1.5;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fffbe8';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.28, 0, TAU);
    ctx.fill();
  } else {
    poly(ctx, 0, 0, size, 4, 0);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    poly(ctx, 0, 0, size * 0.4, 4, 0);
    ctx.fill();
  }
  ctx.restore();

  // magnet thread
  if (g.player) {
    const d = Math.hypot(g.player.x - s.x, g.player.y - s.y);
    if (d < 120 && d > PICKUP_R) {
      ctx.strokeStyle = rgba(isSurge ? COLORS.gold : COLORS.cyan, 0.12 * (1 - d / 120));
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(g.player.x, g.player.y);
      ctx.stroke();
    }
  }
}

function drawLeech(g, ctx, l) {
  const es = g.entityScale;
  const wob = g.t * 4 + l.phase;
  const size = 15 * es;
  glow(g, ctx, 'magenta', l.x, l.y, size * 4.2, 0.26);

  ctx.save();
  ctx.translate(l.x, l.y);
  ctx.rotate(l.rot);
  ctx.beginPath();
  const n = 11;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const r = size * (0.8 + 0.22 * Math.sin(a * 3 + wob));
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(17,4,20,0.96)';
  ctx.fill();
  ctx.strokeStyle = rgba(COLORS.magenta, 0.72);
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.fillStyle = rgba(COLORS.magenta, 0.95);
  ctx.beginPath();
  ctx.ellipse(size * 0.3, 0, size * 0.24, size * 0.16, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawTether(g, ctx, a, p) {
  const dx = p.x - a.x, dy = p.y - a.y;
  const d = Math.hypot(dx, dy) || 1;
  const nx = -dy / d, ny = dx / d;
  const jitter = Math.sin(g.t * 38) * 1.4 + Math.sin(g.t * 17 + 1) * 1.1;
  const mx = (a.x + p.x) / 2 + nx * jitter;
  const my = (a.y + p.y) / 2 + ny * jitter;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(COLORS.cyan, 0.13);
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(mx, my, p.x, p.y);
  ctx.stroke();

  ctx.strokeStyle = rgba(COLORS.cyan, 0.75);
  ctx.lineWidth = 1.9;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(mx, my, p.x, p.y);
  ctx.stroke();

  // energy beads travelling toward player
  const tt = (g.t * 1.7) % 1;
  for (let i = 0; i < 4; i++) {
    const t = (tt + i * 0.25) % 1;
    const it = 1 - t;
    const x = it * it * a.x + 2 * it * t * mx + t * t * p.x;
    const y = it * it * a.y + 2 * it * t * my + t * t * p.y;
    ctx.fillStyle = rgba(COLORS.limeSoft, 0.65);
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlayer(g, ctx, p) {
  const es = g.entityScale;
  const flicker = p.invuln > 0 && Math.floor(g.t * 18) % 2 === 0;
  const alpha = (flicker ? 0.35 : 1) * (p.fade ?? 1);
  ctx.globalAlpha = alpha;

  // trail
  if (p.trail && p.trail.length > 1) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i < p.trail.length; i++) {
      const t = i / p.trail.length;
      const a = p.trail[i - 1], b = p.trail[i];
      ctx.strokeStyle = rgba(COLORS.cyan, 0.03 + t * 0.18);
      ctx.lineWidth = 0.5 + t * 5.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  const rad = 24 * es;
  glow(g, ctx, p.surge > 0 ? 'gold' : 'lime', p.x, p.y, rad * 3.2, 0.32);
  if (p.surge > 0) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(g.t * 1.4);
    ctx.strokeStyle = rgba(COLORS.gold, 0.7);
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 9]);
    ctx.beginPath();
    ctx.arc(0, 0, rad * 1.75, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle || 0);

  // rear fins / ribbon
  ctx.strokeStyle = rgba(COLORS.cyan, 0.45);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-rad * 0.6, -rad * 0.35);
  ctx.quadraticCurveTo(-rad * 1.5, -rad * 0.7 + Math.sin(g.t * 7) * 2, -rad * 2.1, -rad * 0.2);
  ctx.moveTo(-rad * 0.6, rad * 0.35);
  ctx.quadraticCurveTo(-rad * 1.5, rad * 0.7 + Math.cos(g.t * 7) * 2, -rad * 2.1, rad * 0.2);
  ctx.stroke();

  // body
  const bodyGrad = ctx.createRadialGradient(rad * 0.28, -rad * 0.3, 1, 0, 0, rad * 1.1);
  bodyGrad.addColorStop(0, '#294433');
  bodyGrad.addColorStop(0.55, '#0b1710');
  bodyGrad.addColorStop(1, '#050b08');
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = rgba(COLORS.lime, 0.92);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, rad * 0.94, rad * 0.74, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();

  // ear fins
  ctx.fillStyle = '#0a140d';
  ctx.strokeStyle = rgba(COLORS.lime, 0.8);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-rad * 0.5, -rad * 0.5);
  ctx.lineTo(-rad * 1.15, -rad * 0.95);
  ctx.lineTo(-rad * 0.8, -rad * 0.14);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-rad * 0.5, rad * 0.5);
  ctx.lineTo(-rad * 1.15, rad * 0.95);
  ctx.lineTo(-rad * 0.8, rad * 0.14);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // eye
  ctx.fillStyle = '#f7ffe4';
  ctx.beginPath();
  ctx.ellipse(rad * 0.28, 0, rad * 0.4, rad * 0.46, 0, 0, TAU);
  ctx.fill();
  const look = p.look || { x: 1, y: 0 };
  ctx.fillStyle = '#0a160c';
  ctx.beginPath();
  ctx.arc(rad * 0.28 + look.x * rad * 0.15, look.y * rad * 0.16, rad * 0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(202,255,74,0.95)';
  ctx.beginPath();
  ctx.arc(rad * 0.31 + look.x * rad * 0.16, -rad * 0.04 + look.y * rad * 0.16, rad * 0.065, 0, TAU);
  ctx.fill();

  // tiny nose lamp
  ctx.fillStyle = rgba(COLORS.cyan, 0.9);
  ctx.beginPath();
  ctx.arc(rad * 0.82, 0, rad * 0.07, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ---------------- fx ----------------
function drawParticles(g, ctx) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of g.particles) {
    const a = clamp(p.life / p.max, 0, 1);
    if (p.kind === 'spark') {
      ctx.strokeStyle = rgba(p.color, a * 0.85);
      ctx.lineWidth = p.size * a + 0.4;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.016, p.y - p.vy * 0.016);
      ctx.stroke();
    } else if (p.kind === 'ring') {
      ctx.strokeStyle = rgba(p.color, a * 0.7);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r || p.size, 0, TAU);
      ctx.stroke();
    } else {
      glow(g, ctx, p.color, p.x, p.y, p.size * (0.5 + a * 1.6), a * 0.65);
    }
  }
  ctx.restore();
}

function drawTexts(g, ctx) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const tx of g.texts) {
    const a = clamp(tx.life / tx.max, 0, 1);
    ctx.globalAlpha = Math.min(1, a * 1.7);
    ctx.font = `700 ${tx.size}px "DejaVu Sans Mono", ui-monospace, monospace`;
    ctx.fillStyle = rgba(tx.color, 0.95);
    ctx.shadowColor = rgba(tx.color, 0.7);
    ctx.shadowBlur = 8;
    ctx.fillText(tx.text, tx.x, tx.y);
  }
  ctx.restore();
}

// ---------------- master ----------------
export function renderGame(g) {
  const ctx = g.ctx;
  const { w, h } = g;
  ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  drawBackground(g, ctx);

  let sx = 0, sy = 0;
  if (g.shake > 0.2) {
    const s = g.shake;
    sx = (Math.random() - 0.5) * s;
    sy = (Math.random() - 0.5) * s;
  }

  ctx.save();
  ctx.translate(g.cx + sx, g.cy + sy);
  ctx.scale(g.scale, g.scale);

  drawArena(g, ctx);
  drawVoid(g, ctx);
  drawCore(g, ctx);

  for (const s of g.shards) drawShard(g, ctx, s);
  for (const a of g.anchors) drawAnchor(g, ctx, a);
  for (const l of g.leeches) drawLeech(g, ctx, l);

  if (g.player) {
    if (g.attached) drawTether(g, ctx, g.attached, g.player);
    else if (g.hover && g.state === 'playing' && !g.attached) {
      const p = g.player;
      ctx.save();
      ctx.setLineDash([3, 9]);
      ctx.strokeStyle = rgba(COLORS.cyan, 0.13);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(g.hover.x, g.hover.y);
      ctx.stroke();
      ctx.restore();
    }
    drawPlayer(g, ctx, g.player);
  }

  drawParticles(g, ctx);

  drawParticles(g, ctx);
  drawTexts(g, ctx);
  ctx.restore();

  // proximity warning ring
  if (g.state === 'playing' && g.player) {
    const d = Math.hypot(g.player.x, g.player.y);
    if (d > g.voidR - 120) {
      const a = clamp((d - (g.voidR - 120)) / 120, 0, 1);
      ctx.save();
      ctx.strokeStyle = rgba(COLORS.magenta, 0.12 + a * 0.25);
      ctx.lineWidth = 2 + a * 6;
      ctx.beginPath();
      ctx.arc(g.cx, g.cy, (g.voidR - 4) * g.scale, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  if (g.flash > 0.001) {
    ctx.fillStyle = rgba(g.flashColor || COLORS.magenta, g.flash * 0.42);
    ctx.fillRect(0, 0, w, h);
  }
  if (g.surgeWash > 0.001) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(COLORS.gold, g.surgeWash * 0.05);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

export function renderMenuBackdrop(g) {
  // intentionally empty — menu uses the same world render with dim overlay
}
