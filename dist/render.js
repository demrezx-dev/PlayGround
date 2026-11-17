/* PULSAR — rendering, loop, controls */

const menuDust = Array.from({ length: 34 }, () => ({
  x: Math.random(),
  y: Math.random(),
  z: rnd(0.2, 1),
  sp: rnd(3, 16),
  drift: rnd(0.2, 0.8),
  ph: rnd(0, TAU),
  color: Math.random() < 0.45 ? C.magenta : C.cyan,
}));

/* --------------------------------------------------------- rendering */

function drawBackground() {
  ctx.drawImage(bgLayer, 0, 0, W, H);

  const sx = W / 2 - cam.x - cam.sx;
  const sy = H / 2 - cam.y - cam.sy;

  ctx.save();
  ctx.translate(sx, sy);

  const step = 100;
  const l = Math.max(0, cam.x - W / 2 - step);
  const r = Math.min(ARENA.w, cam.x + W / 2 + step);
  const t = Math.max(0, cam.y - H / 2 - step);
  const b = Math.min(ARENA.h, cam.y + H / 2 + step);

  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(120,170,255,0.065)";
  ctx.beginPath();
  for (let x = Math.floor(l / step) * step; x <= r; x += step) {
    ctx.moveTo(x, t);
    ctx.lineTo(x, b);
  }
  for (let y = Math.floor(t / step) * step; y <= b; y += step) {
    ctx.moveTo(l, y);
    ctx.lineTo(r, y);
  }
  ctx.stroke();

  ctx.strokeStyle = "rgba(94,242,255,0.16)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, ARENA.w, ARENA.h);

  const corner = 90;
  ctx.strokeStyle = "rgba(94,242,255,0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, corner);
  ctx.lineTo(0, 0);
  ctx.lineTo(corner, 0);
  ctx.moveTo(ARENA.w - corner, 0);
  ctx.lineTo(ARENA.w, 0);
  ctx.lineTo(ARENA.w, corner);
  ctx.moveTo(ARENA.w, ARENA.h - corner);
  ctx.lineTo(ARENA.w, ARENA.h);
  ctx.lineTo(ARENA.w - corner, ARENA.h);
  ctx.moveTo(corner, ARENA.h);
  ctx.lineTo(0, ARENA.h);
  ctx.lineTo(0, ARENA.h - corner);
  ctx.stroke();
  ctx.restore();
}

function drawRings(g) {
  ctx.globalCompositeOperation = "lighter";
  for (const r of g.rings) {
    const a = clamp(r.life / r.max, 0, 1);
    ctx.strokeStyle = `rgba(${r.color},${(a * 0.75).toFixed(3)})`;
    ctx.lineWidth = r.w;
    ctx.beginPath();
    ctx.arc(r.x, r.y, Math.max(1, r.r), 0, TAU);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawPortals(g) {
  ctx.globalCompositeOperation = "lighter";
  for (const s of g.portals) {
    const pct = 1 - s.t / s.max;
    const color = s.type === "boss" ? C.magenta : C.violet;
    const radius = (s.type === "boss" ? 92 : 46) * (1 - pct * 0.42);
    glow(s.x, s.y, radius * 1.9, color, 0.18 + pct * 0.24);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(visualTime * 2.4);
    ctx.setLineDash([7, 9]);
    ctx.strokeStyle = `rgba(${color},${0.3 + pct * 0.55})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.rotate(-visualTime * 4.2);
    ctx.strokeStyle = `rgba(${color},${0.2 + pct * 0.4})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.66, 0.4, 2.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.66, 3.6, 5.7);
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawOrbs(g) {
  ctx.globalCompositeOperation = "lighter";
  for (const o of g.orbs) {
    const pulse = 0.7 + 0.3 * Math.sin(o.phase);
    glow(o.x, o.y, 17, C.cyan, 0.5 * pulse);
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.phase * 0.6);
    ctx.fillStyle = "rgba(230,255,255,0.95)";
    ctx.fillRect(-2.6, -2.6, 5.2, 5.2);
    ctx.restore();
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawPickups(g) {
  for (const it of g.pickups) {
    const bob = Math.sin(it.phase) * 4;
    const x = it.x;
    const y = it.y + bob;
    ctx.globalCompositeOperation = "lighter";
    glow(x, y, 28, C.green, 0.45);
    ctx.globalCompositeOperation = "source-over";
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(6,20,14,0.9)";
    ctx.strokeStyle = `rgba(${C.green},0.95)`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = `rgba(${C.green},0.95)`;
    ctx.fillRect(-1.6, -5.6, 3.2, 11.2);
    ctx.fillRect(-5.6, -1.6, 11.2, 3.2);
    ctx.restore();
  }
}

function drawEnemyBullets(g) {
  ctx.globalCompositeOperation = "lighter";
  for (const b of g.ebullets) {
    glow(b.x, b.y, 20, b.color, 0.65);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(b.vy, b.vx));
    ctx.fillStyle = "rgba(255,248,255,0.95)";
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(0, 4);
    ctx.lineTo(-5, 0);
    ctx.lineTo(0, -4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(${b.color},0.9)`;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawEnemy(e) {
  const r = e.r;
  ctx.save();
  ctx.translate(e.x, e.y);

  if (e.type === "hunter" && e.wind > 0) {
    ctx.strokeStyle = `rgba(${C.amber},0.85)`;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 7]);
    ctx.lineDashOffset = -visualTime * 40;
    ctx.beginPath();
    ctx.arc(0, 0, r + 10, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.globalCompositeOperation = "lighter";
  glow(0, 0, r * 2.3 + e.flash * 18, e.color, (e.type === "boss" ? 0.36 : 0.24) + e.flash * 0.3);
  ctx.globalCompositeOperation = "source-over";

  if (e.type === "boss") {
    ctx.save();
    ctx.rotate(-e.rot * 0.7);
    ctx.strokeStyle = `rgba(${C.magenta},0.35)`;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([16, 12]);
    ctx.beginPath();
    ctx.arc(0, 0, r + 16, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([4, 9]);
    ctx.strokeStyle = `rgba(${C.amber},0.32)`;
    ctx.beginPath();
    ctx.arc(0, 0, r + 30, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  ctx.rotate(e.rot);
  const sides = e.sides;
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const a = (i / sides) * TAU;
    const rr = i % 2 === 0 ? r : r * e.inner;
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = `rgba(${e.color},${(0.1 + e.flash * 0.28).toFixed(3)})`;
  ctx.fill();
  ctx.strokeStyle = e.flash > 0.55 ? "rgba(255,255,255,0.98)" : `rgba(${e.color},0.92)`;
  ctx.lineWidth = e.type === "boss" ? 3 : 2;
  ctx.stroke();

  const coreR = e.type === "boss" ? r * 0.34 : r * 0.2;
  ctx.beginPath();
  ctx.arc(0, 0, coreR, 0, TAU);
  ctx.fillStyle = `rgba(${e.color},${0.55 + e.flash * 0.4})`;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  if (e.type === "brute") {
    const w = r * 2.3;
    const ratio = clamp(e.hp / e.maxHp, 0, 1);
    ctx.fillStyle = "rgba(4,8,16,0.65)";
    ctx.fillRect(e.x - w / 2, e.y - r - 13, w, 3.5);
    ctx.fillStyle = `rgba(${C.orange},0.95)`;
    ctx.fillRect(e.x - w / 2, e.y - r - 13, w * ratio, 3.5);
  }
}

function drawEnemies(g) {
  for (const e of g.enemies) drawEnemy(e);
}

function drawBullets(g) {
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (const b of g.bullets) {
    ctx.strokeStyle = `rgba(${b.color},0.9)`;
    ctx.lineWidth = b.r * 1.1;
    ctx.beginPath();
    ctx.moveTo(b.px, b.py);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    glow(b.x, b.y, b.r * 4.6, b.color, 0.7);
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawPlayer(g) {
  const p = g.player;
  if (!p || !p.alive) return;

  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < p.trail.length; i += 1) {
    const t = p.trail[i];
    const k = 1 - i / p.trail.length;
    glow(t.x, t.y, 9 + k * 16, C.cyan, k * 0.12);
  }
  glow(p.x, p.y, 52 + Math.sin(visualTime * 4.2) * 4, C.cyan, 0.32);
  if (p.hurt > 0) glow(p.x, p.y, 60, C.red, p.hurt * 0.5);
  ctx.globalCompositeOperation = "source-over";

  if (p.shield > 0) {
    const ratio = clamp(p.shield / p.maxShield, 0, 1);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.strokeStyle = `rgba(${C.cyan},${(0.16 + 0.42 * ratio).toFixed(3)})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 9]);
    ctx.lineDashOffset = -visualTime * 26;
    ctx.beginPath();
    ctx.arc(0, 0, 27, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.strokeStyle = "rgba(94,242,255,0.14)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, TAU);
  ctx.stroke();
  const ready = g.stats.dashCd > 0 ? 1 - clamp(p.dashCd / g.stats.dashCd, 0, 1) : 1;
  ctx.strokeStyle = p.dashCd <= 0 ? `rgba(${C.cyan},0.75)` : `rgba(${C.amber},0.6)`;
  ctx.beginPath();
  ctx.arc(0, 0, 36, -Math.PI / 2, -Math.PI / 2 + TAU * ready);
  ctx.stroke();
  ctx.restore();

  const alpha = p.invuln > 0 ? 0.55 + 0.45 * Math.abs(Math.sin(visualTime * 32)) : 1;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.aim);
  ctx.translate(-p.recoil * 3, 0);
  ctx.globalAlpha = alpha;

  ctx.globalCompositeOperation = "lighter";
  glow(-17, 0, 15 + Math.sin(visualTime * 34) * 3, C.cyan, 0.55);
  ctx.globalCompositeOperation = "source-over";

  ctx.beginPath();
  ctx.moveTo(21, 0);
  ctx.lineTo(2, 4.5);
  ctx.lineTo(-8, 13);
  ctx.lineTo(-5, 4);
  ctx.lineTo(-11, 0);
  ctx.lineTo(-5, -4);
  ctx.lineTo(-8, -13);
  ctx.lineTo(2, -4.5);
  ctx.closePath();
  const grad = ctx.createLinearGradient(-10, 0, 20, 0);
  grad.addColorStop(0, "rgba(48,180,230,0.4)");
  grad.addColorStop(0.5, "rgba(186,248,255,0.95)");
  grad.addColorStop(1, "#ffffff");
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = "rgba(240,255,255,0.95)";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(4, 0, 3.6, 0, TAU);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();
}

function drawParticles(g) {
  ctx.globalCompositeOperation = "lighter";
  for (const pt of g.particles) {
    const a = clamp(pt.life / pt.max, 0, 1);
    const size = pt.size * (0.6 + a * 1.6);
    ctx.globalAlpha = a * 0.72;
    ctx.drawImage(glowSprite(pt.color), pt.x - size * 2, pt.y - size * 2, size * 4, size * 4);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

function drawTexts(g) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const t of g.texts) {
    const a = clamp(t.life / t.max, 0, 1);
    ctx.font = `600 ${t.size}px ${MONO}`;
    ctx.fillStyle = `rgba(${t.color},${(a * 0.95).toFixed(3)})`;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function drawWorld() {
  const g = game;
  const p = g.player;
  if (!p) return;

  drawRings(g);
  drawPortals(g);
  drawOrbs(g);
  drawPickups(g);
  drawEnemyBullets(g);
  drawEnemies(g);
  drawPlayer(g);
  drawBullets(g);
  drawParticles(g);
  drawTexts(g);
}

function drawScreenFx() {
  const g = game;
  const p = g.player;
  if (!p) return;
  if (g.flash > 0.01) {
    ctx.fillStyle = `rgba(190,240,255,${(g.flash * 0.1).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
  const low = p.hp / p.maxHp;
  const danger = p.hurt > 0 ? p.hurt : low < 0.32 ? 0.4 + 0.2 * Math.sin(visualTime * 6) : 0;
  if (danger > 0.01) {
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.18, W / 2, H / 2, Math.max(W, H) * 0.72);
    v.addColorStop(0, "rgba(255,40,80,0)");
    v.addColorStop(1, `rgba(255,40,80,${(0.4 * danger).toFixed(3)})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawReticle() {
  if (!game || game.mode !== "playing" || game.touch || !pointer.active) return;
  ctx.save();
  ctx.translate(pointer.x, pointer.y);
  ctx.rotate(visualTime * 0.6);
  ctx.strokeStyle = "rgba(233,255,255,0.92)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(16, 0);
    ctx.stroke();
    ctx.rotate(TAU / 4);
  }
  ctx.strokeStyle = "rgba(94,242,255,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

function drawJoystick() {
  if (!joy.active) return;
  const kx = joy.ox + joy.dx * joy.mag * 62;
  const ky = joy.oy + joy.dy * joy.mag * 62;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  glow(joy.ox, joy.oy, 96, C.cyan, 0.12);
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "rgba(94,242,255,0.3)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(joy.ox, joy.oy, 62, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([3, 7]);
  ctx.strokeStyle = "rgba(94,242,255,0.22)";
  ctx.beginPath();
  ctx.arc(joy.ox, joy.oy, 44, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  const grd = ctx.createRadialGradient(kx, ky, 0, kx, ky, 26);
  grd.addColorStop(0, "rgba(220,255,255,0.85)");
  grd.addColorStop(1, "rgba(94,242,255,0.12)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(kx, ky, 25, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(94,242,255,0.8)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

function drawMenuAmbient() {
  const sx = W / 2 - cam.x;
  const sy = H / 2 - cam.y;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3; i += 1) {
    const radius = 340 + i * 210 + Math.sin(visualTime * 0.4 + i) * 12;
    ctx.strokeStyle = `rgba(${i === 1 ? C.magenta : C.cyan},${0.13 + i * 0.03})`;
    ctx.lineWidth = 1.2;
    ctx.setLineDash(i === 1 ? [12, 18] : [4, 14]);
    ctx.lineDashOffset = visualTime * (i % 2 ? -14 : 20);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.stroke();
  }
  glow(W * 0.12, H * 0.22, 180, C.magenta, 0.09);
  glow(W * 0.88, H * 0.78, 180, C.cyan, 0.08);
  for (const d of menuDust) {
    const x = (((d.x * W + Math.sin(visualTime * d.drift + d.ph) * 30) % W) + W) % W;
    const y = (((d.y * H - visualTime * d.sp) % H) + H) % H;
    glow(x, y, 6 + d.z * 14, d.color, 0.06 + d.z * 0.12);
  }
  ctx.setLineDash([]);
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawBackground();
  if (game && game.mode !== "menu" && game.player) {
    ctx.save();
    ctx.translate(W / 2 - cam.x - cam.sx, H / 2 - cam.y - cam.sy);
    drawWorld();
    ctx.restore();
    drawScreenFx();
    drawReticle();
    if (game.mode === "playing" || game.mode === "dead") drawJoystick();
  } else {
    drawMenuAmbient();
  }
}

/* --------------------------------------------------------------- loop */

let acc = 0;

function frame(now) {
  if (!lastAt) lastAt = now;
  const dtRaw = clamp((now - lastAt) / 1000, 0.001, 0.25);
  lastAt = now;
  visualTime += Math.min(dtRaw, 0.1);
  if (!game) game = createGame("menu");

  if (game.mode === "playing") {
    acc += dtRaw;
    const step = 1 / 60;
    let steps = 0;
    while (acc >= step && steps < 8) {
      let dt = step;
      if (game.hitstop > 0) {
        game.hitstop -= step;
        dt *= 0.15;
      }
      update(dt);
      acc -= step;
      steps += 1;
      if (game.mode !== "playing") {
        acc = 0;
        break;
      }
    }
    if (steps >= 8) acc = 0;
  } else {
    acc = 0;
    if (game.mode === "levelup") updateSlow(dtRaw);
    else if (game.mode === "dead") updateDead(dtRaw);
    else if (game.mode === "menu") {
      game.time += dtRaw;
      cam.x = ARENA.w / 2 + Math.sin(game.time * 0.09) * 260;
      cam.y = ARENA.h / 2 + Math.cos(game.time * 0.07) * 150;
      cam.sx = 0;
      cam.sy = 0;
    }
  }

  draw();
  document.documentElement.dataset.ready = "true";
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------ controls */

function updateJoy(x, y) {
  const R = 62;
  let dx = x - joy.ox;
  let dy = y - joy.oy;
  const m = Math.hypot(dx, dy);
  if (m > R) {
    dx = (dx / m) * R;
    dy = (dy / m) * R;
  }
  const len = Math.hypot(dx, dy);
  joy.dx = len > 0 ? dx / len : 0;
  joy.dy = len > 0 ? dy / len : 0;
  joy.mag = clamp(len / R, 0, 1);
}

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
  audio.unlock();
  if (e.repeat) return;
  keys.add(k);
  if (k === " ") tryDash();
  if (k === "p" || k === "escape") {
    if (game && (game.mode === "playing" || game.mode === "paused")) togglePause();
  }
  if (k === "m") toggleSound();
  if (k === "enter") {
    if (game && game.mode === "menu") startGame();
    else if (game && game.mode === "dead" && game.deadShown) startGame();
  }
  if (game && game.mode === "levelup" && ["1", "2", "3"].includes(k)) chooseCard(Number(k) - 1);
});

window.addEventListener("keyup", (e) => {
  keys.delete(e.key.toLowerCase());
});

window.addEventListener(
  "pointermove",
  (e) => {
    if (e.pointerType === "mouse" || e.pointerType === "pen") {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
      pointer.lastMove = performance.now();
    } else if (joy.active && e.pointerId === joy.id) {
      updateJoy(e.clientX, e.clientY);
    }
  },
  { passive: true }
);

canvas.addEventListener(
  "pointerdown",
  (e) => {
    audio.unlock();
    if (e.pointerType === "mouse" || e.pointerType === "pen") {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
      pointer.lastMove = performance.now();
      return;
    }
    if (!game || game.mode !== "playing") return;
    game.touch = true;
    document.body.classList.add("touch");
    if (joy.active) return;
    joy.active = true;
    joy.id = e.pointerId;
    joy.ox = e.clientX;
    joy.oy = e.clientY;
    updateJoy(e.clientX, e.clientY);
  },
  { passive: true }
);

window.addEventListener("pointerup", (e) => {
  if (e.pointerId === joy.id) {
    joy.active = false;
    joy.id = null;
    joy.mag = 0;
    joy.dx = 0;
    joy.dy = 0;
  }
});
window.addEventListener("pointercancel", (e) => {
  if (e.pointerId === joy.id) {
    joy.active = false;
    joy.id = null;
    joy.mag = 0;
  }
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

ui.startBtn.addEventListener("click", () => startGame());
ui.retryBtn.addEventListener("click", () => startGame());
ui.resumeBtn.addEventListener("click", () => togglePause());
ui.quitBtn.addEventListener("click", () => goMenu());
ui.homeBtn.addEventListener("click", () => goMenu());
ui.pauseBtn.addEventListener("click", () => {
  if (game && (game.mode === "playing" || game.mode === "paused")) togglePause();
});
ui.soundBtn.addEventListener("click", toggleSound);
ui.dashBtn.addEventListener(
  "pointerdown",
  (e) => {
    e.preventDefault();
    e.stopPropagation();
    tryDash();
  },
  { passive: false }
);

document.addEventListener("visibilitychange", () => {
  if (document.hidden && game && game.mode === "playing") {
    game.mode = "paused";
    showOverlay(ui.pauseScreen);
  }
});

window.addEventListener("resize", resize);

/* --------------------------------------------------------------- boot */

try {
  audio.muted = localStorage.getItem("pulsar.muted.v1") === "1";
} catch {
  audio.muted = false;
}
ui.soundBtn.classList.toggle("muted", audio.muted);
if (matchMedia("(pointer: coarse)").matches) document.body.classList.add("touch");

resize();
game = createGame("menu");
ui.startBest.textContent = fmt(game.best);
ui.best.textContent = fmt(game.best);
showOverlay(ui.startScreen);
requestAnimationFrame(frame);
