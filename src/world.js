// ============================================================
// NABER — world simulation helpers (shards, leeches, physics, fx)
// ============================================================
import {
  TAU, ARENA_R, ANCHOR_ORBIT, PLAYER_R, CORE_R, ROPE_MIN, ROPE_MAX,
  REEL_SPEED, GRAVITY, MAX_SPEED, COMBO_TIME, COLORS,
  clamp, rand, randInt, dist, rgba,
} from './core.js';

const TAU_R = TAU;

function angleLerp(a, b, t) {
  let d = (b - a + Math.PI) % TAU - Math.PI;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}

// ---------------- particles ----------------
export function burst(g, x, y, color, count = 12, speed = 190, opts = {}) {
  const n = Math.round(count * (g.reduceMotion ? 0.55 : 1));
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU);
    const sp = rand(speed * 0.25, speed);
    g.particles.push({
      kind: opts.sparks ? 'spark' : 'dot',
      x, y,
      vx: Math.cos(a) * sp + (opts.vx || 0) * 0.3,
      vy: Math.sin(a) * sp + (opts.vy || 0) * 0.3,
      life: rand(0.24, opts.life || 0.72),
      max: 0.75,
      size: rand(1.4, opts.size || 3.6),
      color: color,
      drag: rand(1.2, 3.4),
    });
  }
  if (g.particles.length > 460) g.particles.splice(0, g.particles.length - 460);
}

export function shock(g, x, y, color, size = 90, life = 0.5) {
  g.particles.push({ kind: 'ring', x, y, r: 5, size, life, max: life, color, vx: 0, vy: 0, drag: 0 });
}

export function floatText(g, x, y, text, color = COLORS.lime, size = 13) {
  g.texts.push({ x, y, vy: -30, text, color, size, life: 0.9, max: 0.9 });
  if (g.texts.length > 24) g.texts.shift();
}

export function updateParticles(g, dt) {
  for (let i = g.particles.length - 1; i >= 0; i--) {
    const p = g.particles[i];
    p.life -= dt;
    if (p.life <= 0) { g.particles.splice(i, 1); continue; }
    if (p.kind === 'ring') {
      const t = 1 - p.life / p.max;
      p.r = 5 + (p.size - 5) * (1 - (1 - t) * (1 - t));
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy *= d;
    }
  }
}

export function updateTexts(g, dt) {
  for (let i = g.texts.length - 1; i >= 0; i--) {
    const t = g.texts[i];
    t.life -= dt;
    t.y += t.vy * dt;
    t.vy *= Math.exp(-2 * dt);
    if (t.life <= 0) g.texts.splice(i, 1);
  }
}

// ---------------- anchors ----------------
export function createAnchors() {
  const off = rand(0, TAU);
  return Array.from({ length: 6 }, (_, i) => ({
    id: i,
    angle: off + (i / 6) * TAU,
    phase: rand(0, TAU),
    drift: 0.052 + (i % 2 ? 0.014 : -0.008),
    radius: ANCHOR_ORBIT + rand(-8, 8),
    x: 0, y: 0, consumed: false,
  }));
}

export function updateAnchors(g, dt) {
  for (const a of g.anchors) {
    a.angle += a.drift * dt;
    const r = a.radius + Math.sin(g.t * 0.4 + a.phase) * 13;
    a.x = Math.cos(a.angle) * r;
    a.y = Math.sin(a.angle) * r;
    const was = a.consumed;
    a.consumed = Math.hypot(a.x, a.y) > g.voidR - 6;
    if (a.consumed && !was) burst(g, a.x, a.y, COLORS.magenta, 8, 110);
  }
}

// ---------------- shards ----------------
export function spawnShard(g, forceType) {
  const p = g.player;
  let x = 0, y = 0, ok = false;
  for (let tries = 0; tries < 8 && !ok; tries++) {
    const maxR = Math.max(150, Math.min(g.voidR - 42, 445));
    const minR = Math.max(120, Math.min(maxR - 40, g.voidR * 0.36));
    const r = Math.sqrt(rand(minR * minR, maxR * maxR));
    const a = rand(0, TAU);
    x = Math.cos(a) * r;
    y = Math.sin(a) * r;
    ok = !p || Math.hypot(p.x - x, p.y - y) > 120;
  }
  // clusters make chaining feel great and keep the field lively
  if (g.shards.length && Math.random() < 0.38) {
    const anchorShard = g.shards[randInt(0, g.shards.length - 1)];
    const a = rand(0, TAU);
    const rr = rand(45, 110);
    const cx = anchorShard.x + Math.cos(a) * rr;
    const cy = anchorShard.y + Math.sin(a) * rr;
    if (Math.hypot(cx, cy) < g.voidR - 40) { x = cx; y = cy; }
  }
  const surge = forceType === 'surge' || (forceType !== 'cyan' && Math.random() < 0.09 && g.player.surge <= 0);
  const ang = rand(0, TAU);
  const drift = rand(8, 26);
  g.shards.push({
    x, y,
    vx: Math.cos(ang + Math.PI / 2) * drift,
    vy: Math.sin(ang + Math.PI / 2) * drift,
    rot: rand(0, TAU),
    spin: rand(-1.4, 1.4),
    phase: rand(0, TAU),
    type: surge ? 'surge' : 'cyan',
    born: g.t,
  });
}

export function updateShards(g, dt) {
  const p = g.player;
  for (let i = g.shards.length - 1; i >= 0; i--) {
    const s = g.shards[i];
    s.rot += s.spin * dt;
    s.phase += dt * 2.4;
    if (p) {
      const dx = p.x - s.x, dy = p.y - s.y;
      const d = Math.hypot(dx, dy);
      if (d < 165 && d > 0.1) {
        const pull = (1 - d / 165) * 580;
        s.vx += (dx / d) * pull * dt;
        s.vy += (dy / d) * pull * dt;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= Math.exp(-0.85 * dt);
      s.vy *= Math.exp(-0.85 * dt);

      if (d < 42) {
        collectShard(g, s, i);
        continue;
      }
    }
    if (Math.hypot(s.x, s.y) > g.voidR - 12) {
      burst(g, s.x, s.y, COLORS.magenta, 5, 80);
      g.shards.splice(i, 1);
    }
  }
}

export function collectShard(g, s, idx) {
  g.shards.splice(idx, 1);
  const sling = g.t - g.lastReleaseAt < 0.72;
  g.combo += 1;
  g.comboTimer = COMBO_TIME;
  const mult = g.comboMult();
  const isSurge = s.type === 'surge';
  const base = isSurge ? 180 : 100;
  const gain = Math.round(base * mult * (sling ? 1.5 : 1));
  g.score += gain;
  g.waveShards += 1;
  g.totalShards += 1;
  g.bestChain = Math.max(g.bestChain, mult);
  g.audio.pickup(Math.min(g.combo - 1, 12));
  burst(g, s.x, s.y, isSurge ? COLORS.gold : COLORS.cyan, isSurge ? 22 : 10, isSurge ? 300 : 180, { sparks: true });
  shock(g, s.x, s.y, isSurge ? COLORS.gold : COLORS.cyan, isSurge ? 70 : 40, 0.36);
  floatText(g, s.x, s.y - 18, `${sling ? 'SLING +' : '+'}${gain}`, sling || isSurge ? COLORS.gold : COLORS.lime, sling ? 16 : 13);
  if (sling) {
    g.shake = Math.max(g.shake, 3.5);
    g.lastReleaseAt = -99;
  }
  if (isSurge) activateSurge(g);
  g.syncHud();
  if (!g.intermission && g.waveShards >= g.waveGoal) g.clearWave();
}

// ---------------- surge ----------------
export function activateSurge(g) {
  g.player.surge = 6.5;
  g.player.invuln = Math.max(g.player.invuln, 6.5);
  g.surgeWash = 1;
  g.flash = Math.max(g.flash, 0.55);
  g.flashColor = COLORS.gold;
  g.shake = Math.max(g.shake, 9);
  g.audio.surgePickup();
  floatText(g, g.player.x, g.player.y - 34, 'SURGE!', COLORS.gold, 18);
  shock(g, g.player.x, g.player.y, COLORS.gold, 200, 0.7);
  for (const l of g.leeches) {
    if (Math.hypot(l.x - g.player.x, l.y - g.player.y) < 460) {
      popLeech(g, l);
      l.dead = true;
    }
  }
  g.leeches = g.leeches.filter((l) => !l.dead);
}

// ---------------- leeches ----------------
export function spawnLeech(g) {
  const a = rand(0, TAU);
  const r = g.voidR - 10;
  const sp = rand(55, 90);
  g.leeches.push({
    x: Math.cos(a) * r,
    y: Math.sin(a) * r,
    vx: -Math.cos(a) * sp,
    vy: -Math.sin(a) * sp,
    rot: rand(0, TAU),
    phase: rand(0, TAU),
    puff: rand(0, 0.2),
    born: g.t,
    dead: false,
  });
  shock(g, Math.cos(a) * (r - 8), Math.sin(a) * (r - 8), COLORS.magenta, 55, 0.5);
}

export function updateLeeches(g, dt) {
  const p = g.player;
  if (!p) return;
  for (let i = g.leeches.length - 1; i >= 0; i--) {
    const l = g.leeches[i];
    const dx = p.x - l.x, dy = p.y - l.y;
    const d = Math.hypot(dx, dy) || 1;
    const accel = 112;
    l.vx += (dx / d) * accel * dt;
    l.vy += (dy / d) * accel * dt;
    const maxSp = 78 + g.wave * 4;
    const sp = Math.hypot(l.vx, l.vy);
    if (sp > maxSp) { l.vx *= maxSp / sp; l.vy *= maxSp / sp; }
    l.x += l.vx * dt;
    l.y += l.vy * dt;
    l.rot += dt * 1.9;
    l.puff -= dt;
    if (l.puff <= 0) {
      l.puff = 0.19;
      g.particles.push({
        kind: 'dot', x: l.x + rand(-6, 6), y: l.y + rand(-6, 6),
        vx: rand(-14, 14), vy: rand(-14, 14), life: 0.55, max: 0.55,
        size: rand(1.5, 3.4), color: COLORS.magenta, drag: 1.2,
      });
    }

    if (d < 36 + (g.entityScale - 1) * 8) {
      const speed = Math.hypot(p.vx, p.vy);
      if (p.surge > 0 || p.invuln > 0 || speed > 560) {
        popLeech(g, l);
        l.dead = true;
      } else {
        g.hurt('leech', l.x, l.y);
        l.dead = true;
      }
    }
    if (l.dead) {
      g.leeches.splice(i, 1);
    }
  }
}

export function popLeech(g, l) {
  g.score += 200;
  g.audio.pop();
  burst(g, l.x, l.y, COLORS.magenta, 16, 250, { sparks: true });
  burst(g, l.x, l.y, COLORS.violet, 8, 140);
  shock(g, l.x, l.y, COLORS.magenta, 70, 0.45);
  floatText(g, l.x, l.y - 12, '+200', COLORS.magenta, 12);
  g.shake = Math.max(g.shake, 4);
  g.syncHud();
}

// ---------------- player physics ----------------
export function stepPlayer(g, dt, demo = false) {
  const p = g.player;
  if (!p) return;
  const d0 = Math.hypot(p.x, p.y) || 1;
  const gf = GRAVITY * (demo ? 0.72 : 1) * (0.82 + 0.34 * Math.min(1, d0 / ARENA_R));
  p.vx -= (p.x / d0) * gf * dt;
  p.vy -= (p.y / d0) * gf * dt;

  const a = g.attached;
  if (a) {
    let dx = a.x - p.x, dy = a.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const tx = -dy / d, ty = dx / d;
    const vt = p.vx * tx + p.vy * ty;
    const dir = Math.abs(vt) < 8 ? 1 : Math.sign(vt);
    const pump = (demo ? 240 : 305) * dt * clamp(1 - Math.abs(vt) / 545, 0, 1);
    p.vx += tx * dir * pump;
    p.vy += ty * dir * pump;
  }

  p.x += p.vx * dt;
  p.y += p.vy * dt;

  if (a) {
    g.ropeLen = Math.max(ROPE_MIN, g.ropeLen - REEL_SPEED * dt * (demo ? 0.82 : 1));
    const dx = p.x - a.x, dy = p.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > g.ropeLen + 0.2 || d < g.ropeLen - 0.2) {
      const nx = dx / d, ny = dy / d;
      p.x = a.x + nx * g.ropeLen;
      p.y = a.y + ny * g.ropeLen;
      const vr = p.vx * nx + p.vy * ny;
      p.vx -= nx * vr;
      p.vy -= ny * vr;
    }
  }

  const cap = demo ? 720 : MAX_SPEED;
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > cap) { p.vx *= cap / sp; p.vy *= cap / sp; }

  if (!demo) {
    // core shelter bounce
    const cd = Math.hypot(p.x, p.y) || 1;
    const coreLim = CORE_R + PLAYER_R - 4;
    if (cd < coreLim) {
      const nx = p.x / cd, ny = p.y / cd;
      p.x = nx * coreLim;
      p.y = ny * coreLim;
      const vr = p.vx * nx + p.vy * ny;
      if (vr < 0) {
        p.vx -= nx * vr * 1.45;
        p.vy -= ny * vr * 1.45;
      }
      if (g.t - (p.lastBounce || -9) > 0.28) {
        p.lastBounce = g.t;
        burst(g, p.x, p.y, COLORS.lime, 6, 130);
        g.audio.tone?.({ freq: 180, dur: 0.16, type: 'sine', gain: 0.03, slide: 70 });
      }
    }

    // void boundary
    const lim = g.voidR - PLAYER_R;
    const vd = Math.hypot(p.x, p.y);
    if (vd > lim) {
      const nx = p.x / vd, ny = p.y / vd;
      p.x = nx * (lim - 14);
      p.y = ny * (lim - 14);
      const vr = p.vx * nx + p.vy * ny;
      if (vr > 0) {
        p.vx -= nx * vr * 1.08;
        p.vy -= ny * vr * 1.08;
      }
      if (!demo && p.surge <= 0) g.hurt('void');
      if (p.surge > 0) burst(g, p.x, p.y, COLORS.gold, 3, 100);
    }
  }

  const sp2 = Math.hypot(p.vx, p.vy);
  if (sp2 > 24) {
    const targetA = Math.atan2(p.vy, p.vx);
    p.angle = angleLerp(p.angle ?? targetA, targetA, 1 - Math.exp(-dt * 10));
  }
  const last = p.trail[p.trail.length - 1];
  if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 3) {
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 20) p.trail.shift();
  }
}
