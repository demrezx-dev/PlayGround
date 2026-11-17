/* PULSAR — combat, waves, pickups, effects */

/* ------------------------------------------------------- enemy data */

const TYPES = {
  drifter: { hp: 24, speed: 98, r: 15, dmg: 11, score: 12, xp: 1, color: C.magenta, sides: 4, inner: 0.48, spin: 0.8 },
  hunter: { hp: 17, speed: 162, r: 13, dmg: 10, score: 16, xp: 1, color: C.amber, sides: 3, inner: 1, spin: 0 },
  shooter: { hp: 34, speed: 84, r: 18, dmg: 9, score: 22, xp: 2, color: C.violet, sides: 6, inner: 0.86, spin: -0.4 },
  brute: { hp: 118, speed: 60, r: 30, dmg: 20, score: 52, xp: 4, color: C.orange, sides: 5, inner: 0.8, spin: 0.35 },
  boss: { hp: 760, speed: 72, r: 58, dmg: 30, score: 600, xp: 16, color: C.magenta, sides: 12, inner: 0.78, spin: 0.3 },
};

/* ---------------------------------------------------------- spawning */

function startWave(n) {
  const g = game;
  g.wave = n;
  const boss = n % 5 === 0;
  const queue = [];
  if (boss) {
    queue.push("boss");
    const extra = 2 + Math.floor(n / 5) * 2;
    for (let i = 0; i < extra; i += 1) queue.push(i % 2 ? "hunter" : "drifter");
  } else {
    let count = Math.round(4 + n * 1.8);
    count = Math.min(count, 26 + Math.floor(n * 1.1));
    const pool = ["drifter", "drifter"];
    if (n >= 2) pool.push("hunter");
    if (n >= 3) pool.push("shooter");
    if (n >= 4) pool.push("brute", "hunter");
    if (n >= 6) pool.push("shooter", "brute");
    if (n >= 9) pool.push("hunter", "brute", "shooter");
    for (let i = 0; i < count; i += 1) queue.push(pick(pool));
  }
  g.spawnQueue = queue;
  g.waveState = "spawning";
  g.spawnTimer = n === 1 ? 0.35 : 0.5;
  banner(`DALGA ${n}`, boss ? "DEVRİYE ÇEKİRDEĞİ UYANDI" : `${queue.length} TEMAS BEKLENİYOR`);
  if (boss) audio.boss();
  else audio.wave();
}

function pickSpawnPoint() {
  const g = game;
  const p = g.player;
  let fallback = null;
  for (let i = 0; i < 16; i += 1) {
    const a = rnd(0, TAU);
    const radius = Math.max(300, Math.min(W, H) * 0.42) + rnd(20, 110);
    const x = clamp(p.x + Math.cos(a) * radius, 80, ARENA.w - 80);
    const y = clamp(p.y + Math.sin(a) * radius, 80, ARENA.h - 80);
    const d = dist(x, y, p.x, p.y);
    fallback = { x, y };
    if (d > Math.min(W, H) * 0.44) return fallback;
  }
  return fallback || { x: p.x + 500, y: p.y };
}

function spawnPortal(type) {
  const pos = pickSpawnPoint();
  const max = type === "boss" ? 1.4 : 0.7;
  game.portals.push({ x: pos.x, y: pos.y, t: max, max, type });
  game.rings.push({
    x: pos.x,
    y: pos.y,
    r: 6,
    maxR: type === "boss" ? 110 : 54,
    life: max,
    max,
    color: type === "boss" ? C.magenta : C.violet,
    w: 1.5,
  });
}

function spawnEnemyAt(type, x, y) {
  const g = game;
  const cfg = TYPES[type];
  const boss = type === "boss";
  const hpMul = boss ? 1 + Math.max(0, g.wave - 5) * 0.12 : 1 + (g.wave - 1) * 0.17;
  const spMul = 1 + Math.min(0.5, (g.wave - 1) * 0.03);
  const e = {
    type,
    x,
    y,
    vx: 0,
    vy: 0,
    r: cfg.r,
    hp: cfg.hp * hpMul,
    maxHp: cfg.hp * hpMul,
    speed: cfg.speed * spMul,
    dmg: cfg.dmg,
    score: cfg.score,
    xp: cfg.xp,
    color: cfg.color,
    sides: cfg.sides,
    inner: cfg.inner,
    rot: rnd(0, TAU),
    spin: cfg.spin,
    flash: 0,
    alive: true,
    wind: 0,
    dashT: 0,
    dashDir: { x: 1, y: 0 },
    dashCd: rnd(0.8, 2.0),
    fireT: rnd(1.2, 2.4),
    atk: rnd(1.6, 2.6),
    mode: 0,
    phase: rnd(0, TAU),
  };
  g.enemies.push(e);
  spark(x, y, cfg.color, boss ? 30 : 10, boss ? 400 : 200);
  return e;
}

/* --------------------------------------------------------- effects */

function spark(x, y, color, count, power) {
  const g = game;
  if (!g) return;
  for (let i = 0; i < count; i += 1) {
    const a = rnd(0, TAU);
    const sp = rnd(power * 0.15, power);
    const life = rnd(0.22, 0.65);
    g.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life,
      max: life,
      size: rnd(1.4, 3.4),
      color,
    });
  }
  if (g.particles.length > 760) g.particles.splice(0, g.particles.length - 760);
}

function explode(x, y, color, count, power) {
  spark(x, y, color, count, power);
  const g = game;
  g.rings.push({ x, y, r: 8, maxR: Math.max(50, power * 0.16), life: 0.42, max: 0.42, color, w: 2.5 });
}

function floatText(x, y, text, color, size = 11) {
  const g = game;
  if (!g) return;
  g.texts.push({ x, y, text, color, life: 0.7, max: 0.7, size, vy: -48 });
  if (g.texts.length > 40) g.texts.shift();
}

/* ----------------------------------------------------------- combat */

function damageEnemy(e, amount, crit, angle) {
  const g = game;
  if (!e || !e.alive) return;
  e.hp -= amount;
  e.flash = 1;
  e.vx += Math.cos(angle) * (e.type === "boss" ? 3 : 34);
  e.vy += Math.sin(angle) * (e.type === "boss" ? 3 : 34);
  const txt = `${Math.round(amount)}`;
  floatText(e.x + rnd(-7, 7), e.y - e.r - 6, crit ? `✶ ${txt}` : txt, crit ? C.amber : C.white, crit ? 14 : 10);
  spark(e.x, e.y, e.color, crit ? 6 : 3, 150);
  if (e.hp <= 0) killEnemy(e, angle);
  else audio.hit();
}

function killEnemy(e, angle) {
  if (!e.alive) return;
  e.alive = false;
  const g = game;
  const p = g.player;
  g.kills += 1;
  g.combo = Math.min(60, g.combo + 1);
  g.comboTimer = g.comboMax;
  const mult = 1 + Math.min(g.combo, 60) * 0.05;
  g.score += Math.round(e.score * mult);
  const big = e.type === "boss";
  g.shake = Math.max(g.shake, big ? 24 : e.type === "brute" ? 7 : 2.5);
  explode(e.x, e.y, e.color, big ? 70 : 10 + Math.round(e.r * 0.4), big ? 640 : 220);
  g.rings.push({
    x: e.x,
    y: e.y,
    r: e.r,
    maxR: big ? 300 : e.r * 4.5,
    life: big ? 0.9 : 0.5,
    max: big ? 0.9 : 0.5,
    color: e.color,
    w: big ? 4 : 2,
  });
  audio.kill(big);

  if (big) {
    g.flash = Math.max(g.flash, 0.8);
    g.hitstop = 0.1;
    g.score += 250;
    spawnOrbs(e.x, e.y, 18);
    spawnPickup(e.x + rnd(-60, 60), e.y + rnd(-60, 60));
    p.shield = p.maxShield;
    for (let i = 0; i < 4; i += 1) {
      spawnEnemyAt(i % 2 ? "hunter" : "drifter", e.x + rnd(-120, 120), e.y + rnd(-120, 120));
    }
    banner("ÇEKİRDEK KIRILDI", "ARENA TEMİZLENİYOR");
  } else {
    spawnOrbs(e.x, e.y, e.xp);
    if (Math.random() < (e.type === "brute" ? 0.6 : 0.045)) spawnPickup(e.x, e.y);
    if (e.type === "brute") {
      for (let i = 0; i < 2; i += 1) {
        spawnEnemyAt("drifter", e.x + rnd(-44, 44), e.y + rnd(-44, 44));
      }
    }
  }

  p.killsSinceHeal += 1;
  if (g.stats.vampEvery > 0 && p.killsSinceHeal >= g.stats.vampEvery) {
    p.killsSinceHeal = 0;
    p.hp = Math.min(p.maxHp, p.hp + 6);
    floatText(p.x, p.y - 24, "+6", C.green, 12);
    audio.heal();
  }
}

function damagePlayer(amount, source) {
  const g = game;
  if (!g || !g.player) return;
  const p = g.player;
  if (!p.alive || g.mode !== "playing" || p.invuln > 0) return;
  let dmg = amount;
  let absorbed = 0;
  if (p.shield > 0) {
    absorbed = Math.min(p.shield, dmg);
    p.shield -= absorbed;
    dmg -= absorbed;
  }
  p.hp -= dmg;
  p.invuln = 0.58;
  p.hurt = 0.6;
  p.shieldDelay = 3.4;
  g.shake = Math.max(g.shake, 10);
  g.flash = Math.max(g.flash, 0.65);
  g.combo = 0;
  g.comboTimer = 0;
  if (absorbed > 0) audio.shieldHit();
  else audio.hurt();
  explode(p.x, p.y, absorbed > 0 ? C.cyan : C.red, 14, 250);
  if (source && Number.isFinite(source.x)) {
    const a = Math.atan2(p.y - source.y, p.x - source.x);
    p.vx += Math.cos(a) * 260;
    p.vy += Math.sin(a) * 260;
  }
  if (p.hp <= 0) reserveDeath();
}

function spawnOrbs(x, y, totalValue) {
  const count = clamp(Math.round(totalValue / 1.4), 1, 7);
  const per = totalValue / count;
  for (let i = 0; i < count; i += 1) {
    game.orbs.push({
      x: x + rnd(-10, 10),
      y: y + rnd(-10, 10),
      vx: rnd(-130, 130),
      vy: rnd(-130, 130),
      value: per,
      phase: rnd(0, TAU),
      life: 26,
      r: 4.6,
    });
  }
}

function spawnPickup(x, y) {
  game.pickups.push({ x, y, life: 18, phase: rnd(0, TAU), r: 10 });
}

function addXp(value) {
  const g = game;
  g.xp += value;
  while (g.xp >= g.xpNeed) {
    g.xp -= g.xpNeed;
    g.level += 1;
    g.xpNeed = Math.round(7 + g.level * 3.4 + g.level * g.level * 0.45);
    g.pendingLevels += 1;
  }
}

/* ------------------------------------------------------ player tick */

function tryDash() {
  if (!game || game.mode !== "playing" || !game.player) return;
  const g = game;
  const p = g.player;
  if (p.dashCd > 0 || !p.alive) return;
  let dx = p.vx;
  let dy = p.vy;
  if (Math.hypot(dx, dy) < 40) {
    dx = Math.cos(p.aim);
    dy = Math.sin(p.aim);
  }
  const m = Math.hypot(dx, dy) || 1;
  p.dashDir.x = dx / m;
  p.dashDir.y = dy / m;
  p.dashTime = 0.17;
  p.dashCd = g.stats.dashCd;
  p.invuln = Math.max(p.invuln, 0.32);
  p.dashHits.clear();
  audio.dash();
  g.shake = Math.max(g.shake, 4);
  g.rings.push({ x: p.x, y: p.y, r: 6, maxR: 84, life: 0.4, max: 0.4, color: C.cyan, w: 2 });
  spark(p.x, p.y, C.cyan, 12, 230);
  if (g.stats.dashBoom) {
    g.rings.push({ x: p.x, y: p.y, r: 18, maxR: 150, life: 0.45, max: 0.45, color: C.amber, w: 3 });
    for (const e of g.enemies) {
      if (e.alive && dist(e.x, e.y, p.x, p.y) < 150 + e.r) {
        damageEnemy(e, 28, false, Math.atan2(e.y - p.y, e.x - p.x));
      }
    }
    game.shake = Math.max(game.shake, 7);
  }
}

function updateMovement(dt) {
  const g = game;
  const p = g.player;
  let dx = 0;
  let dy = 0;
  if (keys.has("w") || keys.has("arrowup")) dy -= 1;
  if (keys.has("s") || keys.has("arrowdown")) dy += 1;
  if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
  if (keys.has("d") || keys.has("arrowright")) dx += 1;
  let mag = Math.hypot(dx, dy);
  if (mag > 0) {
    dx /= mag;
    dy /= mag;
    mag = 1;
  }
  if (joy.active && joy.mag > 0.1) {
    dx = joy.dx;
    dy = joy.dy;
    mag = clamp(joy.mag, 0, 1);
  }

  if (p.dashTime > 0) {
    p.dashTime -= dt;
    p.vx = p.dashDir.x * 1500;
    p.vy = p.dashDir.y * 1500;
    if (Math.random() < 0.85) {
      g.particles.push({
        x: p.x - p.dashDir.x * 10,
        y: p.y - p.dashDir.y * 10,
        vx: rnd(-40, 40) - p.dashDir.x * 120,
        vy: rnd(-40, 40) - p.dashDir.y * 120,
        life: 0.34,
        max: 0.34,
        size: rnd(2, 4.4),
        color: C.cyan,
      });
    }
    for (const e of g.enemies) {
      if (!e.alive || p.dashHits.has(e)) continue;
      if (dist(e.x, e.y, p.x, p.y) < e.r + p.r + 14) {
        p.dashHits.add(e);
        damageEnemy(e, 36, false, Math.atan2(e.y - p.y, e.x - p.x));
        g.rings.push({ x: e.x, y: e.y, r: 6, maxR: 46, life: 0.3, max: 0.3, color: C.cyan, w: 2 });
      }
    }
  } else {
    const k = ease(12, dt);
    p.vx = lerp(p.vx, dx * g.stats.speed * mag, k);
    p.vy = lerp(p.vy, dy * g.stats.speed * mag, k);
  }

  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.x = clamp(p.x, p.r + 20, ARENA.w - p.r - 20);
  p.y = clamp(p.y, p.r + 20, ARENA.h - p.r - 20);

  p.trail.unshift({ x: p.x, y: p.y });
  if (p.trail.length > 10) p.trail.pop();
}

function updateAim(dt) {
  const g = game;
  const p = g.player;
  let target = null;
  const mouseFresh = pointer.active && !g.touch && performance.now() - pointer.lastMove < 3500;
  if (mouseFresh) {
    target = screenToWorld(pointer.x, pointer.y);
  } else {
    let best = null;
    let bestD = Infinity;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const d = dist(p.x, p.y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (best) {
      const t = bestD / g.stats.bulletSpeed;
      target = { x: best.x + best.vx * t * 0.85, y: best.y + best.vy * t * 0.85 };
    }
  }
  if (!target) return;
  const want = Math.atan2(target.y - p.y, target.x - p.x);
  p.aim = angleLerp(p.aim, want, ease(mouseFresh ? 30 : 13, dt));
}

function shoot() {
  const g = game;
  const p = g.player;
  const n = g.stats.bullets;
  for (let i = 0; i < n; i += 1) {
    const offset = (i - (n - 1) / 2) * g.stats.spread;
    const a = p.aim + offset + rnd(-0.02, 0.02);
    const crit = Math.random() < g.stats.crit;
    const speed = g.stats.bulletSpeed * rnd(0.97, 1.03);
    const mx = p.x + Math.cos(a) * 20;
    const my = p.y + Math.sin(a) * 20;
    g.bullets.push({
      x: mx,
      y: my,
      px: mx,
      py: my,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      r: 3.4 * g.stats.bulletSize,
      dmg: g.stats.damage * (crit ? g.stats.critMult : 1),
      crit,
      pierce: g.stats.pierce,
      hit: new Set(),
      life: 1.15,
      color: crit ? C.amber : C.cyan,
      dead: false,
    });
  }
  const mx = p.x + Math.cos(p.aim) * 22;
  const my = p.y + Math.sin(p.aim) * 22;
  spark(mx, my, C.cyan, 2, 130);
  p.recoil = 1;
  g.shake = Math.max(g.shake, 0.8);
  audio.shoot();
}

function updateFiring(dt) {
  const g = game;
  const p = g.player;
  p.fireCd -= dt;
  if (p.fireCd <= 0) {
    shoot();
    p.fireCd = g.stats.fireInterval;
  }
}

/* -------------------------------------------------------- waves tick */

function updateWaves(dt) {
  const g = game;
  if (g.waveState === "spawning") {
    g.spawnTimer -= dt;
    if (g.spawnQueue.length && g.spawnTimer <= 0) {
      const type = g.spawnQueue[0];
      if (type !== "boss" && g.enemies.length >= 58) {
        g.spawnTimer = 0.4;
      } else {
        g.spawnQueue.shift();
        spawnPortal(type);
        g.spawnTimer = type === "boss" ? 1.5 : Math.max(0.15, 0.46 - g.wave * 0.012);
      }
    }
    if (!g.spawnQueue.length) g.waveState = "clearing";
  }

  if (g.waveState === "clearing" && g.enemies.length === 0 && g.portals.length === 0 && g.spawnQueue.length === 0) {
    g.waveState = "clear";
    g.clearTimer = 2.7;
    const bonus = 50 + g.wave * 20;
    g.score += bonus;
    banner("DALGA TEMİZ", `+${bonus} BONUS`);
    audio.clear();
    const p = g.player;
    p.hp = Math.min(p.maxHp, p.hp + 10);
    p.shield = p.maxShield;
    p.shieldDelay = 0;
    g.rings.push({ x: p.x, y: p.y, r: 20, maxR: 190, life: 0.7, max: 0.7, color: C.green, w: 2 });
    spark(p.x, p.y, C.green, 20, 280);
  }

  if (g.waveState === "clear") {
    g.clearTimer -= dt;
    if (g.clearTimer <= 0) startWave(g.wave + 1);
  }
}

/* ------------------------------------------------------- enemy tick */

function enemyShoot(e, count = 1, spread = 0.1, speed = 215) {
  const g = game;
  const p = g.player;
  const base = Math.atan2(p.y - e.y, p.x - e.x);
  for (let i = 0; i < count; i += 1) {
    const a = base + (i - (count - 1) / 2) * spread;
    g.ebullets.push({
      x: e.x + Math.cos(a) * (e.r + 6),
      y: e.y + Math.sin(a) * (e.r + 6),
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      r: 6,
      life: 8,
      color: e.type === "boss" ? C.magenta : C.violet,
      dmg: e.type === "boss" ? 10 : 8,
      dead: false,
    });
  }
  e.flash = 0.7;
  audio.enemyShot();
}

function bossAttack(e) {
  const g = game;
  const p = g.player;
  const kind = e.mode % 3;
  e.mode += 1;
  e.flash = 1;
  if (kind === 0) {
    const n = 18;
    const off = rnd(0, TAU);
    for (let i = 0; i < n; i += 1) {
      const a = off + (i / n) * TAU;
      g.ebullets.push({
        x: e.x + Math.cos(a) * e.r,
        y: e.y + Math.sin(a) * e.r,
        vx: Math.cos(a) * 185,
        vy: Math.sin(a) * 185,
        r: 7,
        life: 9,
        color: C.magenta,
        dmg: 10,
        dead: false,
      });
    }
    g.rings.push({ x: e.x, y: e.y, r: e.r, maxR: 240, life: 0.6, max: 0.6, color: C.magenta, w: 3 });
    audio.enemyShot();
  } else if (kind === 1) {
    const base = Math.atan2(p.y - e.y, p.x - e.x);
    for (let i = -2; i <= 2; i += 1) {
      const a = base + i * 0.13;
      g.ebullets.push({
        x: e.x + Math.cos(a) * e.r,
        y: e.y + Math.sin(a) * e.r,
        vx: Math.cos(a) * 300,
        vy: Math.sin(a) * 300,
        r: 6.5,
        life: 7,
        color: C.orange,
        dmg: 10,
        dead: false,
      });
    }
    audio.enemyShot();
  } else {
    for (let i = 0; i < 2; i += 1) {
      spawnEnemyAt(Math.random() < 0.5 ? "hunter" : "drifter", e.x + rnd(-80, 80), e.y + rnd(-80, 80));
    }
    g.rings.push({ x: e.x, y: e.y, r: e.r, maxR: 160, life: 0.5, max: 0.5, color: C.violet, w: 2 });
    audio.boss();
  }
  g.shake = Math.max(g.shake, 5);
}

function updateEnemies(dt) {
  const g = game;
  const p = g.player;
  for (const e of g.enemies) {
    if (!e.alive) continue;
    e.flash = Math.max(0, e.flash - dt * 5);
    e.rot += e.spin * dt;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d;
    const ny = dy / d;
    let tx = 0;
    let ty = 0;
    let accel = 4;

    if (e.type === "boss") {
      const want = 400;
      if (d > want + 100) {
        tx = nx * e.speed;
        ty = ny * e.speed;
      } else if (d < want - 100) {
        tx = -nx * e.speed;
        ty = -ny * e.speed;
      } else {
        tx = -ny * e.speed * 0.8;
        ty = nx * e.speed * 0.8;
      }
      e.atk -= dt;
      if (e.atk <= 0) {
        bossAttack(e);
        e.atk = Math.max(1.3, 2.3 - g.wave * 0.02);
      }
    } else if (e.type === "hunter") {
      e.dashCd -= dt;
      if (e.dashT > 0) {
        e.dashT -= dt;
        tx = e.dashDir.x * 640;
        ty = e.dashDir.y * 640;
        accel = 20;
        if (Math.random() < 0.5) spark(e.x, e.y, C.amber, 1, 60);
      } else if (e.wind > 0) {
        e.wind -= dt;
        tx = 0;
        ty = 0;
        if (e.wind <= 0) {
          e.dashT = 0.3;
          e.dashDir = { x: nx, y: ny };
        }
      } else {
        tx = nx * e.speed;
        ty = ny * e.speed;
        if (d < 560 && e.dashCd <= 0) {
          e.wind = 0.4;
          e.dashCd = rnd(2.0, 2.9);
          e.flash = 0.6;
        }
      }
    } else if (e.type === "shooter") {
      const want = 340;
      if (d > want + 50) {
        tx = nx * e.speed;
        ty = ny * e.speed;
      } else if (d < want - 90) {
        tx = -nx * e.speed;
        ty = -ny * e.speed;
      } else {
        tx = -ny * e.speed * 0.9;
        ty = nx * e.speed * 0.9;
      }
      e.fireT -= dt;
      if (e.fireT <= 0 && d < 820) {
        e.fireT = Math.max(1.2, 2.4 - g.wave * 0.05) + rnd(0, 0.5);
        enemyShoot(e, g.wave >= 9 ? 2 : 1, 0.1, 220);
      }
    } else if (e.type === "brute") {
      tx = nx * e.speed;
      ty = ny * e.speed;
    } else {
      const wob = Math.sin(g.time * 2.4 + e.phase) * 0.55;
      tx = (nx - ny * wob) * e.speed;
      ty = (ny + nx * wob) * e.speed;
    }

    const k = Math.min(1, dt * accel);
    e.vx = lerp(e.vx, tx, k);
    e.vy = lerp(e.vy, ty, k);
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.x = clamp(e.x, e.r, ARENA.w - e.r);
    e.y = clamp(e.y, e.r, ARENA.h - e.r);

    if (d < e.r + p.r - 2) {
      damagePlayer(e.dmg, e);
    }
  }

  for (let i = 0; i < g.enemies.length; i += 1) {
    const a = g.enemies[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < g.enemies.length; j += 1) {
      const b = g.enemies[j];
      if (!b.alive) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const minD = a.r + b.r + 4;
      const dd = dx * dx + dy * dy;
      if (dd > 0.01 && dd < minD * minD) {
        const d2 = Math.sqrt(dd);
        const push = ((minD - d2) / d2) * 0.5;
        a.x -= dx * push;
        a.y -= dy * push;
        b.x += dx * push;
        b.y += dy * push;
      }
    }
  }
}

/* ------------------------------------------------------- bullet tick */

function updateBullets(dt) {
  const g = game;
  for (const b of g.bullets) {
    b.px = b.x;
    b.py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < -60 || b.y < -60 || b.x > ARENA.w + 60 || b.y > ARENA.h + 60) {
      b.dead = true;
      continue;
    }
    for (const e of g.enemies) {
      if (!e.alive || b.hit.has(e)) continue;
      if (segDist(e.x, e.y, b.px, b.py, b.x, b.y) < e.r + b.r) {
        b.hit.add(e);
        damageEnemy(e, b.dmg, b.crit, Math.atan2(b.vy, b.vx));
        if (b.pierce > 0) {
          b.pierce -= 1;
        } else {
          b.dead = true;
        }
        if (b.dead) break;
      }
    }
  }
  g.bullets = g.bullets.filter((b) => !b.dead);
}

function updateEnemyBullets(dt) {
  const g = game;
  const p = g.player;
  for (const b of g.ebullets) {
    b.px = b.x;
    b.py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < -60 || b.y < -60 || b.x > ARENA.w + 60 || b.y > ARENA.h + 60) {
      b.dead = true;
      continue;
    }
    if (segDist(p.x, p.y, b.px, b.py, b.x, b.y) < p.r + b.r) {
      b.dead = true;
      damagePlayer(b.dmg, b);
    }
  }
  g.ebullets = g.ebullets.filter((b) => !b.dead);
}

/* ----------------------------------------------------------- pickups */

function updateOrbs(dt) {
  const g = game;
  const p = g.player;
  const keep = [];
  for (const o of g.orbs) {
    o.life -= dt;
    o.phase += dt * 4;
    const dx = p.x - o.x;
    const dy = p.y - o.y;
    const d = Math.hypot(dx, dy) || 0.001;
    if (d < g.stats.magnet + 20) {
      const pull = 700 + Math.max(0, g.stats.magnet - d) * 5;
      o.vx += (dx / d) * pull * dt;
      o.vy += (dy / d) * pull * dt;
    }
    const drag = Math.exp(-1.9 * dt);
    o.vx *= drag;
    o.vy *= drag;
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    if (d < 22) {
      addXp(o.value);
      spark(o.x, o.y, C.cyan, 4, 120);
      audio.pickup();
      continue;
    }
    if (o.life > 0) keep.push(o);
  }
  g.orbs = keep;
}

function updatePickups(dt) {
  const g = game;
  const p = g.player;
  const keep = [];
  for (const it of g.pickups) {
    it.life -= dt;
    it.phase += dt * 3;
    if (dist(p.x, p.y, it.x, it.y) < 26) {
      p.hp = Math.min(p.maxHp, p.hp + 26);
      floatText(it.x, it.y - 14, "+26", C.green, 12);
      spark(it.x, it.y, C.green, 14, 180);
      audio.heal();
      continue;
    }
    if (it.life > 0) keep.push(it);
  }
  g.pickups = keep;
}

/* ------------------------------------------------------------ effects */

function updateEffects(dt) {
  const g = game;
  const drag = Math.exp(-2.1 * dt);
  for (const pt of g.particles) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= drag;
    pt.vy *= drag;
  }
  g.particles = g.particles.filter((pt) => pt.life > 0);

  for (const r of g.rings) {
    r.life -= dt;
    const speed = r.maxR > 150 ? 4 : 9;
    r.r += (r.maxR - r.r) * Math.min(1, dt * speed);
  }
  g.rings = g.rings.filter((r) => r.life > 0);

  for (const t of g.texts) {
    t.life -= dt;
    t.y += t.vy * dt;
    t.vy *= Math.exp(-3 * dt);
  }
  g.texts = g.texts.filter((t) => t.life > 0);

  for (const s of g.portals) {
    s.t -= dt;
    if (s.t <= 0) {
      spawnEnemyAt(s.type, s.x, s.y);
      s.done = true;
    }
  }
  g.portals = g.portals.filter((s) => !s.done);

  g.enemies = g.enemies.filter((e) => e.alive);
}

/* ------------------------------------------------------------- camera */

function updateCamera(dt) {
  const g = game;
  const p = g.player;
  const tx = W >= ARENA.w ? ARENA.w / 2 : clamp(p.x, W / 2, ARENA.w - W / 2);
  const ty = H >= ARENA.h ? ARENA.h / 2 : clamp(p.y, H / 2, ARENA.h - H / 2);
  const k = Math.min(1, ease(3.6, dt) + dt * 1.6);
  cam.x = lerp(cam.x, tx, k);
  cam.y = lerp(cam.y, ty, k);
  cam.sx = rnd(-g.shake, g.shake);
  cam.sy = rnd(-g.shake, g.shake);
}

/* --------------------------------------------------------------- main */

function update(dt) {
  const g = game;
  if (!g || !g.player) return;
  const p = g.player;
  g.time += dt;

  p.invuln = Math.max(0, p.invuln - dt);
  p.hurt = Math.max(0, p.hurt - dt);
  p.recoil = Math.max(0, p.recoil - dt * 6);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.shieldDelay = Math.max(0, p.shieldDelay - dt);
  if (p.shieldDelay <= 0 && p.shield < p.maxShield) {
    p.shield = Math.min(p.maxShield, p.shield + g.stats.shieldRegen * dt);
  }
  if (g.comboTimer > 0) {
    g.comboTimer -= dt;
    if (g.comboTimer <= 0) g.combo = 0;
  }

  updateMovement(dt);
  updateAim(dt);
  updateFiring(dt);
  updateWaves(dt);
  updateEnemies(dt);
  updateBullets(dt);
  updateEnemyBullets(dt);
  updateOrbs(dt);
  updatePickups(dt);
  updateEffects(dt);
  updateCamera(dt);

  g.shake = Math.max(0, g.shake * (1 - Math.min(1, dt * 6)) - dt * 1.5);
  g.flash = Math.max(0, g.flash - dt * 2.2);
  updateHUD();

  if (g.pendingLevels > 0 && g.mode === "playing") openLevelUp();
}

function updateSlow(dt) {
  const g = game;
  if (!g) return;
  g.time += dt;
  updateEffects(dt * 0.3);
  g.shake *= 1 - Math.min(1, dt * 3);
  g.flash = Math.max(0, g.flash - dt);
}

function updateDead(dt) {
  const g = game;
  if (!g) return;
  g.time += dt;
  g.deadTimer += dt;
  updateEffects(dt * 0.5);
  updateOrbs(dt * 0.5);
  g.shake = Math.max(0, g.shake * (1 - Math.min(1, dt * 4)) - dt);
  g.flash = Math.max(0, g.flash - dt * 1.6);
  updateHUD();
  if (g.deadTimer > 0.9 && !g.deadShown) {
    g.deadShown = true;
    revealDeath();
  }
}
