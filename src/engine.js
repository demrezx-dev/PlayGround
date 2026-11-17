// ============================================================
// NABER — game controller
// ============================================================
import { AudioEngine } from './audio.js';
import {
  ARENA_R, WAVES, COLORS, COMBO_TIME, ROPE_MAX, ROPE_MIN, TAU,
  clamp, rand, randInt, fmt, loadNum, loadStr, save, dist,
} from './core.js';
import { initGlows, renderGame, buildBackdrop } from './render.js';
import {
  createAnchors, updateAnchors, spawnShard, updateShards, spawnLeech,
  updateLeeches, stepPlayer, updateParticles, updateTexts,
  burst, shock, floatText,
} from './world.js';

const $ = (id) => document.getElementById(id);

export class Game {
  constructor() {
    this.canvas = $('stage');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.audio = new AudioEngine();
    this.best = loadNum('naber.best', 0);
    this.muted = loadStr('naber.muted', '0') === '1';
    this.audio.muted = this.muted;
    this.reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.state = 'menu';
    this.t = 0;
    this.last = performance.now();
    this.w = 1;
    this.h = 1;
    this.dpr = 1;
    this.scale = 1;
    this.cx = 0;
    this.cy = 0;
    this.entityScale = 1;

    this.pointer = { x: 0, y: 0, sx: 0, sy: 0, active: false };
    this.hover = null;
    this.attached = null;
    this.ropeLen = 0;
    this.attachTime = 0;
    this.lastReleaseAt = -99;
    this.cooldown = 0;

    this.anchors = [];
    this.shards = [];
    this.leeches = [];
    this.particles = [];
    this.texts = [];
    this.player = null;

    this.score = 0;
    this.wave = 1;
    this.hull = 3;
    this.waveGoal = 8;
    this.waveShards = 0;
    this.totalShards = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestChain = 1;
    this.intermission = 0;
    this.victoryQueued = false;
    this.voidR = ARENA_R;
    this.hitstop = 0;
    this.shake = 0;
    this.flash = 0;
    this.flashColor = COLORS.magenta;
    this.surgeWash = 0;
    this.deathT = 0;
    this.hudTimer = 0;
    this.lastHudSync = -1;
    this.hintTimer = 0;
    this.hasTethered = false;
    this.edgeOn = false;
    this.menuWait = 0.5;
    this.menuHold = 1.2;

    this.dom = {
      hud: $('hud'), waveNum: $('wave-num'), waveName: $('wave-name'),
      hearts: $('hearts'), goalNum: $('goal-num'), goalTarget: $('goal-target'),
      score: $('score'), best: $('best'), combo: $('combo'), comboX: $('combo-x'),
      comboLabel: $('combo-label'), comboFill: $('combo-fill'), surge: $('surge-meter'),
      surgeFill: $('surge-fill'), banner: $('banner'), bannerKicker: $('banner-kicker'),
      bannerTitle: $('banner-title'), bannerSub: $('banner-sub'), hint: $('hint'),
      edge: $('edge-warning'), menu: $('menu'), pause: $('pause'), over: $('over'),
      menuBest: $('menu-best'), pauseWave: $('pause-wave'), pauseScore: $('pause-score'),
      pauseHull: $('pause-hull'), overKicker: $('over-kicker'), overTitle: $('over-title'),
      finalScore: $('final-score'), newBest: $('new-best'), overWave: $('over-wave'),
      overShards: $('over-shards'), overChain: $('over-chain'), overNote: $('over-note'), mute: $('mute-btn'),
      pauseBtn: $('pause-btn'), play: $('play-btn'), resume: $('resume-btn'),
      menuSound: $('menu-sound'), pauseSound: $('pause-sound'),
      quit: $('quit-btn'), again: $('again-btn'), toMenu: $('menu-btn'),
    };

    this.resize();
    this.buildStars();
    initGlows(this);
    this.buildHearts();
    this.setupMenuWorld();
    this.bindEvents();
    this.updateBestLabels();
    this.updateSoundLabels();
    document.body.classList.toggle('muted', this.muted);
    this.dom.edge.classList.remove('on');
    this.dom.hint.classList.add('hidden');
    this.dom.combo.classList.add('hidden');
    this.dom.surge.classList.add('hidden');
    this.dom.hud.classList.add('hidden');

    this.frameBound = this.frame.bind(this);
    requestAnimationFrame(this.frameBound);
  }

  // ---------------- setup ----------------
  resize() {
    this.w = Math.max(1, window.innerWidth);
    this.h = Math.max(1, window.innerHeight);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.scale = Math.min(this.w * 0.94, this.h * 0.94) / (2 * ARENA_R + 66);
    this.cx = this.w / 2;
    this.cy = this.h * 0.5;
    this.entityScale = clamp(0.64 / this.scale, 1, 1.65);
    buildBackdrop(this);
  }

  buildStars() {
    const chars = ['#bfe9ff', '#ffffff', '#d9ffd0', '#ffe4b8'];
    this.stars = Array.from({ length: 210 }, () => ({
      x: rand(0, this.w),
      y: rand(0, this.h),
      size: rand(0.6, 2.2),
      a: rand(0.12, 0.75),
      tw: rand(0.25, 1.6),
      phase: rand(0, TAU),
      drift: rand(-3, 9),
      c: chars[randInt(0, chars.length - 1)],
    }));
  }

  makePlayer() {
    return {
      x: 0, y: -190, vx: 160, vy: 0,
      angle: 0, invuln: 0, surge: 0,
      trail: [], look: { x: 1, y: 0 }, fade: 1,
    };
  }

  setupMenuWorld() {
    this.voidR = ARENA_R;
    this.anchors = createAnchors();
    updateAnchors(this, 0);
    this.shards = [];
    this.leeches = [];
    this.particles = [];
    this.texts = [];
    this.player = this.makePlayer();
    this.player.x = 0;
    this.player.y = -205;
    this.player.vx = 170;
    this.attached = null;
    this.ropeLen = 0;
    this.menuWait = 0.35;
    this.menuHold = 1.1;
    this.intermission = 0;
    this.shake = 0;
    this.flash = 0;
    this.surgeWash = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.hintTimer = 0;
    for (let i = 0; i < 7; i++) spawnShard(this, 'cyan');
  }

  buildHearts() {
    this.dom.hearts.innerHTML = '';
    this.heartEls = [];
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span');
      s.className = 'heart full';
      this.dom.hearts.appendChild(s);
      this.heartEls.push(s);
    }
    this.updateHearts();
  }

  updateHearts(pulse = false) {
    if (!this.heartEls) return;
    this.heartEls.forEach((el, i) => {
      el.classList.toggle('full', i < this.hull);
      el.classList.toggle('empty', i >= this.hull);
      if (pulse) {
        el.classList.remove('pulse');
        void el.offsetWidth;
        el.classList.add('pulse');
        setTimeout(() => el.classList.remove('pulse'), 550);
      }
    });
  }

  updateBestLabels() {
    this.dom.menuBest.textContent = fmt(this.best);
    this.dom.best.textContent = fmt(this.best);
  }

  // ---------------- screens ----------------
  hideScreens() {
    this.dom.menu.classList.add('hidden');
    this.dom.pause.classList.add('hidden');
    this.dom.over.classList.add('hidden');
  }

  showHud() {
    this.dom.hud.classList.remove('hidden');
  }
  hideHud() {
    this.dom.hud.classList.add('hidden');
    this.dom.combo.classList.add('hidden');
    this.dom.surge.classList.add('hidden');
    this.dom.hint.classList.add('hidden');
    this.dom.edge.classList.remove('on');
    this.edgeOn = false;
  }

  startRun() {
    this.audio.init();
    this.audio.setMuted(this.muted);
    this.audio.duck(false);
    this.audio.startMusic();
    this.hideScreens();
    this.beginRun();
  }

  beginRun() {
    this.state = 'playing';
    this.score = 0;
    this.wave = 1;
    this.hull = 3;
    this.waveGoal = WAVES[0].goal;
    this.waveShards = 0;
    this.totalShards = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestChain = 1;
    this.intermission = 0;
    this.victoryQueued = false;
    this.voidR = ARENA_R;
    this.hitstop = 0;
    this.shake = 0;
    this.flash = 0;
    this.surgeWash = 0;
    this.deathT = 0;
    this.hudTimer = 0;
    this.lastHudSync = -1;
    this.hintTimer = 9;
    this.hasTethered = false;
    this.edgeOn = false;
    this.pointer.active = false;
    this.t = 0;

    this.anchors = createAnchors();
    updateAnchors(this, 0);
    this.shards = [];
    this.leeches = [];
    this.particles = [];
    this.texts = [];
    this.player = this.makePlayer();
    this.player.x = 0;
    this.player.y = -215;
    this.player.vx = 175;
    this.player.vy = 0;
    this.attached = null;
    this.ropeLen = 0;
    this.attachTime = 0;
    this.lastReleaseAt = -99;
    this.cooldown = 0;

    this.buildHearts();
    this.updateBestLabels();
    this.showHud();
    this.dom.hint.classList.remove('hidden');
    this.dom.combo.classList.add('hidden');
    this.dom.surge.classList.add('hidden');
    this.dom.edge.classList.remove('on');

    this.startWave(1, true);
    for (let i = 0; i < 3; i++) spawnShard(this, 'cyan');
    this.syncHud(true);
    this.audio.warn();
  }

  startWave(n, initial = false) {
    this.wave = n;
    const spec = WAVES[n - 1];
    this.waveGoal = spec.goal;
    this.waveShards = 0;
    this.intermission = 0;
    this.voidR = ARENA_R;
    this.leechTimer = initial ? 6.5 : 4.5;
    this.shardTimer = 0.4;
    this.victoryQueued = false;
    this.player.invuln = Math.max(this.player.invuln, 1.2);
    this.showBanner(`WAVE ${String(n).padStart(2, '0')}`, spec.name, spec.sub);
    this.syncHud(true);
  }

  clearWave() {
    if (this.intermission > 0 || this.state !== 'playing') return;
    const n = this.wave;
    const bonus = 400 + n * 150;
    this.score += bonus;
    this.intermission = 2.8;
    this.victoryQueued = n >= WAVES.length;
    this.audio.waveClear();
    this.flash = 0.4;
    this.flashColor = COLORS.lime;
    this.shake = Math.max(this.shake, 10);
    this.player.invuln = Math.max(this.player.invuln, 3.2);
    if (this.hull < 3) {
      this.hull += 1;
      this.updateHearts(true);
    }
    for (const l of this.leeches) {
      burst(this, l.x, l.y, COLORS.magenta, 10, 180);
      l.dead = true;
    }
    this.leeches = [];
    shock(this, 0, 0, COLORS.lime, 430, 1.1);
    burst(this, this.player.x, this.player.y, COLORS.lime, 30, 300, { sparks: true });
    this.showBanner('WAVE CLEAR', `${WAVES[n - 1].name} SECURED`, `+${fmt(bonus)} · VOID REPELLED`);
    this.syncHud(true);
  }

  win() {
    this.state = 'victory';
    this.attached = null;
    this.audio.victory();
    this.audio.duck(true);
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        if (this.state !== 'victory') return;
        burst(this, rand(-220, 220), rand(-220, 220), i % 2 ? COLORS.gold : COLORS.lime, 26, 280, { sparks: true });
        shock(this, 0, 0, i % 2 ? COLORS.gold : COLORS.cyan, 240, 0.9);
      }, i * 180);
    }
    this.showResults(true);
  }

  die() {
    if (this.state !== 'playing') return;
    this.state = 'dying';
    this.deathT = 1.55;
    this.attached = null;
    this.ropeLen = 0;
    this.audio.gameOver();
    this.audio.duck(true);
    this.audio.stopMusic();
    this.shake = 32;
    this.flash = 1;
    this.flashColor = COLORS.magenta;
    this.burstDeath = true;
    burst(this, this.player.x, this.player.y, COLORS.magenta, 40, 380, { sparks: true });
    burst(this, this.player.x, this.player.y, COLORS.gold, 18, 220);
    shock(this, this.player.x, this.player.y, COLORS.magenta, 300, 0.9);
    this.dom.combo.classList.add('hidden');
    this.dom.surge.classList.add('hidden');
    this.dom.hint.classList.add('hidden');
    this.dom.edge.classList.remove('on');
    this.edgeOn = false;
  }

  showResults(victory) {
    this.state = victory ? 'victory' : 'over';
    this.hideHud();
    this.hideScreens();
    let newBest = false;
    if (this.score > this.best) {
      this.best = this.score;
      save('naber.best', this.best);
      newBest = true;
    }
    this.updateBestLabels();
    this.dom.overKicker.textContent = victory ? 'ALL EIGHT WAVES CLEARED' : 'SIGNAL LOST';
    this.dom.overTitle.innerHTML = victory ? 'VOID<br>NABBED' : 'EATEN BY<br>THE VOID';
    this.dom.finalScore.textContent = fmt(this.score);
    this.dom.newBest.classList.toggle('hidden', !newBest);
    this.dom.overWave.textContent = victory ? '8/8' : String(this.wave);
    this.dom.overShards.textContent = fmt(this.totalShards);
    this.dom.overChain.textContent = '×' + this.bestChain;
    this.dom.overNote.textContent = victory
      ? 'The last light is yours. Orbit 07 goes quiet.'
      : 'The dark kept your light. It always asks for one more run.';
    this.dom.over.classList.toggle('victory', victory);
    this.dom.over.classList.remove('hidden');
    this.audio.duck(true);
    this.syncHud(true);
  }

  returnToMenu() {
    this.state = 'menu';
    this.hideScreens();
    this.hideHud();
    this.setupMenuWorld();
    this.dom.menu.classList.remove('hidden');
    this.updateBestLabels();
    this.audio.duck(false);
    if (this.audio.ready) {
      this.audio.startMusic();
      this.audio.tick(0);
    }
    this.last = performance.now();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.dom.pauseWave.textContent = String(this.wave);
    this.dom.pauseScore.textContent = fmt(this.score);
    this.dom.pauseHull.textContent = String(this.hull);
    this.dom.pause.classList.remove('hidden');
    this.dom.hint.classList.add('hidden');
    this.audio.duck(true);
    this.shake = 0;
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.dom.pause.classList.add('hidden');
    this.audio.duck(false);
    this.last = performance.now();
  }

  togglePause() {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') this.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    save('naber.muted', this.muted ? '1' : '0');
    document.body.classList.toggle('muted', this.muted);
    this.updateSoundLabels();
    if (!this.muted) {
      this.audio.init();
      if (this.state === 'menu' && !this.audio.musicOn) this.audio.startMusic();
    }
    this.audio.setMuted(this.muted);
    if (!this.muted && this.audio.ready) this.audio.ui();
  }

  updateSoundLabels() {
    const label = this.muted ? 'SOUND OFF' : 'SOUND ON';
    for (const el of [this.dom.menuSound, this.dom.pauseSound]) {
      if (!el) continue;
      el.textContent = label;
      el.setAttribute('aria-pressed', String(!this.muted));
    }
  }

  showBanner(kicker, title, sub) {
    this.dom.bannerKicker.textContent = kicker || '';
    this.dom.bannerTitle.textContent = title || '';
    this.dom.bannerSub.textContent = sub || '';
    this.dom.banner.classList.remove('show');
    void this.dom.banner.offsetWidth;
    this.dom.banner.classList.add('show');
  }

  // ---------------- input ----------------
  bindEvents() {
    window.addEventListener('resize', () => {
      this.resize();
      this.buildStars();
    });
    window.addEventListener('orientationchange', () => setTimeout(() => {
      this.resize();
      this.buildStars();
    }, 120));

    this.canvas.addEventListener('pointerdown', (e) => {
      this.updatePointer(e);
      if (this.state === 'playing') {
        e.preventDefault();
        this.pressTether();
      }
    });
    window.addEventListener('pointermove', (e) => this.updatePointer(e), { passive: true });
    window.addEventListener('pointerup', () => this.inputRelease());
    window.addEventListener('pointercancel', () => this.inputRelease());
    window.addEventListener('blur', () => {
      if (this.state === 'playing') this.releaseTether();
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') {
        e.preventDefault();
        this.toggleMute();
        return;
      }
      if (e.code === 'Space' || e.code === 'Enter') {
        if (e.target && e.target.tagName === 'BUTTON') return;
      }
      if (e.repeat) return;
      if (this.state === 'playing') {
        if (e.code === 'Space') {
          e.preventDefault();
          this.pressTether();
        } else if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          this.pause();
        }
      } else if (this.state === 'paused') {
        if (e.code === 'Escape' || e.code === 'KeyP' || e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          this.resume();
        }
      } else if (this.state === 'menu') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          this.audio.ui();
          this.startRun();
        }
      } else if (this.state === 'over' || this.state === 'victory') {
        if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyR') {
          e.preventDefault();
          this.audio.ui();
          this.startRun();
        } else if (e.code === 'Escape') {
          this.returnToMenu();
        }
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.inputRelease();
    });

    this.dom.play.addEventListener('click', () => { this.audio.ui(); this.startRun(); });
    this.dom.resume.addEventListener('click', () => this.resume());
    this.dom.quit.addEventListener('click', () => this.returnToMenu());
    this.dom.again.addEventListener('click', () => { this.audio.ui(); this.startRun(); });
    this.dom.toMenu.addEventListener('click', () => this.returnToMenu());
    this.dom.pauseBtn.addEventListener('click', () => this.togglePause());
    this.dom.mute.addEventListener('click', () => this.toggleMute());
    this.dom.menuSound.addEventListener('click', () => this.toggleMute());
    this.dom.pauseSound.addEventListener('click', () => this.toggleMute());
  }

  updatePointer(e) {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.sx = e.clientX - r.left;
    this.pointer.sy = e.clientY - r.top;
    this.pointer.x = (this.pointer.sx - this.cx) / this.scale;
    this.pointer.y = (this.pointer.sy - this.cy) / this.scale;
    this.pointer.active = true;
  }

  inputRelease() {
    if (this.state === 'playing') this.releaseTether();
  }

  // ---------------- main loop ----------------
  frame(now) {
    const raw = (now - this.last) / 1000;
    this.last = now;
    const dt = Math.min(0.1, Math.max(0, raw || 0));
    if (this.state === 'playing') {
      if (this.hitstop > 0) {
        this.hitstop -= dt;
        this.shake = Math.max(0, this.shake - dt * 50);
      } else {
        this.updatePlaying(dt);
      }
    } else if (this.state === 'dying') {
      this.updateDying(dt);
    } else if (this.state === 'menu') {
      this.updateMenu(dt);
    } else if (this.state === 'over' || this.state === 'victory') {
      this.updateAfter(dt);
    }
    if (!window.__NABER_NO_RENDER__) renderGame(this);
    requestAnimationFrame(this.frameBound);
  }

  // ---------------- menu attract mode ----------------
  updateMenu(dt) {
    this.t += dt;
    updateAnchors(this, dt);
    const p = this.player;
    if (!p) return;

    if (!this.attached) {
      this.menuWait -= dt;
      if (this.menuWait <= 0) {
        const near = this.anchors.filter((a) => Math.hypot(a.x - p.x, a.y - p.y) < ROPE_MAX * 0.92);
        if (near.length) {
          const a = near[randInt(0, near.length - 1)];
          this.attached = a;
          this.ropeLen = Math.max(ROPE_MIN + 12, Math.hypot(a.x - p.x, a.y - p.y));
          this.attachTime = 0;
          this.menuHold = rand(0.65, 1.45);
          this.lastReleaseAt = -99;
          burst(this, a.x, a.y, COLORS.cyan, 7, 120);
          shock(this, a.x, a.y, COLORS.cyan, 38, 0.4);
        } else {
          this.menuWait = 0.2;
        }
      }
    } else {
      this.menuHold -= dt;
      this.attachTime += dt;
      if (this.menuHold <= 0) {
        this.releaseTether(true);
        this.menuWait = rand(0.3, 0.85);
      }
    }

    stepPlayer(this, dt, true);
    const d = Math.hypot(p.x, p.y);
    if (d > 440) {
      const nx = p.x / d, ny = p.y / d;
      p.x = nx * 440;
      p.y = ny * 440;
      const vr = p.vx * nx + p.vy * ny;
      if (vr > 0) { p.vx -= nx * vr * 1.45; p.vy -= ny * vr * 1.45; }
    }
    p.invuln = 0;
    p.surge = 0;
    p.fade = 1;

    const lx = (this.pointer.active ? this.pointer.x : p.x + p.vx) - p.x;
    const ly = (this.pointer.active ? this.pointer.y : p.y + p.vy) - p.y;
    const ld = Math.hypot(lx, ly);
    if (ld > 1) {
      const k = Math.min(1, dt * 8);
      p.look.x += (lx / ld - p.look.x) * k;
      p.look.y += (ly / ld - p.look.y) * k;
    }

    // ambient shards
    for (const s of this.shards) {
      s.rot += s.spin * dt;
      s.phase += dt * 2;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const sd = Math.hypot(s.x, s.y);
      if (sd > 468) {
        s.x *= 468 / sd;
        s.y *= 468 / sd;
        s.vx *= -0.85;
        s.vy *= -0.85;
      }
    }
    if (this.shards.length < 7 && Math.random() < dt * 0.9) spawnShard(this, 'cyan');

    updateParticles(this, dt);
    updateTexts(this, dt);
    this.shake = Math.max(0, this.shake - dt * 50);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.surgeWash = Math.max(0, this.surgeWash - dt * 1.5);
    this.audio.tick(0.12);
  }

  // ---------------- live play ----------------
  updatePlaying(dt) {
    this.t += dt;
    this.shake = Math.max(0, this.shake - dt * 48);
    this.flash = Math.max(0, this.flash - dt * 2.8);
    this.surgeWash = Math.max(0, this.surgeWash - dt * 1.5);
    this.cooldown = Math.max(0, this.cooldown - dt);

    updateAnchors(this, dt);
    this.hover = this.attached || this.hoverAnchor();

    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0 || this.hasTethered) this.dom.hint.classList.add('hidden');
    }

    if (this.intermission > 0) {
      this.intermission -= dt;
      this.voidR += (ARENA_R - this.voidR) * (1 - Math.exp(-dt * 2.1));
      if (this.intermission <= 0) {
        if (this.victoryQueued) {
          this.win();
          return;
        }
        this.startWave(this.wave + 1);
      }
    } else {
      const spec = WAVES[this.wave - 1];
      const factor = clamp((this.voidR - 352) / 148, 0, 1);
      this.voidR -= spec.shrink * factor * dt * (this.player.surge > 0 ? 0.5 : 1);

      this.shardTimer -= dt;
      const cap = 7 + Math.floor(this.wave / 2);
      if (this.shardTimer <= 0 && this.shards.length < cap) {
        spawnShard(this);
        this.shardTimer = rand(0.48, 0.78);
      }

      this.leechTimer -= dt;
      if (spec.leeches > 0 && this.leechTimer <= 0 && this.leeches.length < spec.leeches) {
        spawnLeech(this);
        this.leechTimer = rand(6.5, 10);
      }
    }

    const p = this.player;
    p.invuln = Math.max(0, p.invuln - dt);
    if (p.surge > 0) {
      p.surge = Math.max(0, p.surge - dt);
      if (p.surge === 0) p.invuln = Math.max(p.invuln, 0.8);
    }
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.comboTimer = 0;
      }
    }

    const lx = (this.pointer.active ? this.pointer.x : p.x + p.vx) - p.x;
    const ly = (this.pointer.active ? this.pointer.y : p.y + p.vy) - p.y;
    const ld = Math.hypot(lx, ly);
    if (ld > 1) {
      const k = Math.min(1, dt * 9);
      p.look.x += (lx / ld - p.look.x) * k;
      p.look.y += (ly / ld - p.look.y) * k;
    }

    stepPlayer(this, dt, false);
    if (this.state === 'playing') updateShards(this, dt);
    if (this.state === 'playing') updateLeeches(this, dt);
    updateParticles(this, dt);
    updateTexts(this, dt);

    if (this.hasTethered) this.dom.hint.classList.add('hidden');
    const near = Math.hypot(p.x, p.y) > this.voidR - 112;
    if (near !== this.edgeOn) {
      this.edgeOn = near;
      this.dom.edge.classList.toggle('on', near && this.state === 'playing');
    }
    if (this.state !== 'playing') this.dom.edge.classList.remove('on');
    this.syncHud();
    this.audio.tick(clamp((this.wave / WAVES.length) * 0.7 + this.combo / 30, 0, 1));
  }

  updateDying(dt) {
    this.t += dt * 0.45;
    this.deathT -= dt;
    this.shake = Math.max(0, this.shake - dt * 32);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.player.fade = clamp(this.deathT / 1.35, 0, 1);
    this.player.x += this.player.vx * dt * 0.08;
    this.player.y += this.player.vy * dt * 0.08;
    updateParticles(this, dt);
    updateTexts(this, dt);
    updateAnchors(this, dt * 0.3);
    if (this.deathT <= 0) this.showResults(false);
  }

  updateAfter(dt) {
    this.t += dt * 0.5;
    updateAnchors(this, dt * 0.25);
    updateParticles(this, dt);
    updateTexts(this, dt);
    this.shake = Math.max(0, this.shake - dt * 34);
    this.flash = Math.max(0, this.flash - dt * 2);
    if (this.state === 'over' && this.player) {
      this.player.fade = Math.max(0, this.player.fade - dt * 0.6);
    }
    this.audio.tick(0.2);
  }

  // ---------------- tether ----------------
  getTargetAnchor(wx, wy) {
    const p = this.player;
    if (!p) return null;
    let byPtr = null, bp = Infinity;
    for (const a of this.anchors) {
      const dp = Math.hypot(a.x - wx, a.y - wy);
      if (dp < bp) { bp = dp; byPtr = a; }
    }
    if (byPtr && bp < 235 && Math.hypot(byPtr.x - p.x, byPtr.y - p.y) <= ROPE_MAX) return byPtr;
    let best = null, bd = ROPE_MAX;
    for (const a of this.anchors) {
      const d = Math.hypot(a.x - p.x, a.y - p.y);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  findAnchor(wx, wy) {
    return this.getTargetAnchor(wx, wy);
  }

  hoverAnchor() {
    const p = this.player;
    if (!p || !this.pointer.active) return null;
    return this.getTargetAnchor(this.pointer.x, this.pointer.y);
  }

  pressTether() {
    if (this.state !== 'playing' || this.attached || !this.player) return;
    if (this.cooldown > 0) return;
    const a = this.findAnchor(this.pointer.x, this.pointer.y);
    if (!a) {
      this.cooldown = 0.22;
      floatText(this, this.player.x, this.player.y - 30, 'OUT OF REACH', '#8da39e', 9);
      this.audio.warn();
      return;
    }
    this.attached = a;
    this.ropeLen = Math.max(ROPE_MIN + 12, Math.hypot(a.x - this.player.x, a.y - this.player.y));
    this.attachTime = 0;
    this.hasTethered = true;
    this.hover = a;
    this.audio.attach();
    this.shake = Math.max(this.shake, 2.5);
    burst(this, a.x, a.y, COLORS.cyan, 10, 150, { sparks: true });
    shock(this, a.x, a.y, COLORS.cyan, 46, 0.35);
    this.dom.hint.classList.add('hidden');
  }

  releaseTether(silent = false) {
    if (!this.attached) return;
    const p = this.player;
    const sp = Math.hypot(p.vx, p.vy);
    p.vx *= 1.07;
    p.vy *= 1.07;
    if (sp > 1) {
      p.vx += (p.vx / sp) * 62;
      p.vy += (p.vy / sp) * 62;
    }
    const sp2 = Math.hypot(p.vx, p.vy);
    if (sp2 > 1120) { p.vx *= 1120 / sp2; p.vy *= 1120 / sp2; }
    this.attached = null;
    this.ropeLen = 0;
    this.cooldown = 0.06;
    this.lastReleaseAt = this.t;
    this.hover = null;
    if (!silent) {
      this.audio.release();
      burst(this, p.x, p.y, COLORS.cyan, 8, 170, { sparks: true });
      shock(this, p.x, p.y, COLORS.cyan, 36, 0.3);
    }
  }

  // ---------------- scoring / damage ----------------
  comboMult() {
    return clamp(1 + Math.floor(this.combo / 2), 1, 9);
  }

  progress() {
    if (this.state === 'menu') return 0.32 + Math.sin(this.t * 0.8) * 0.06;
    if (this.intermission > 0) return 1;
    return clamp(this.waveShards / Math.max(1, this.waveGoal), 0, 1);
  }

  hurt(source, sx, sy) {
    if (this.state !== 'playing') return;
    const p = this.player;
    if (!p || p.invuln > 0 || p.surge > 0) return;
    this.hull -= 1;
    this.combo = 0;
    this.comboTimer = 0;
    p.invuln = 1.7;
    this.audio.hurt();
    this.flash = 0.95;
    this.flashColor = COLORS.magenta;
    this.shake = this.reduceMotion ? 12 : 27;
    this.hitstop = 0.07;
    this.dom.edge.classList.remove('on');
    this.edgeOn = false;
    burst(this, p.x, p.y, COLORS.magenta, 26, 260, { sparks: true });
    burst(this, p.x, p.y, COLORS.gold, 8, 130);
    shock(this, p.x, p.y, COLORS.magenta, 120, 0.55);
    floatText(this, p.x, p.y - 30, '-1 HULL', COLORS.magenta, 11);
    this.updateHearts(true);
    if (this.hull <= 0) this.die();
    else this.syncHud(true);
  }

  syncHud(force = false) {
    if (this.state === 'menu') return;
    if (!force && this.t - this.lastHudSync < 0.06) return;
    this.lastHudSync = this.t;
    const spec = WAVES[this.wave - 1] || WAVES[0];
    this.dom.waveNum.textContent = `WAVE ${this.wave}`;
    this.dom.waveName.textContent = spec.name;
    this.dom.goalNum.textContent = String(Math.min(this.waveShards, this.waveGoal));
    this.dom.goalTarget.textContent = String(this.waveGoal);
    this.dom.score.textContent = fmt(this.score);
    this.dom.best.textContent = fmt(this.best);

    const showCombo = this.combo > 0 && (this.state === 'playing' || this.state === 'paused');
    this.dom.combo.classList.toggle('hidden', !showCombo);
    if (showCombo) {
      this.dom.comboX.textContent = '×' + this.comboMult();
      this.dom.comboLabel.textContent = 'CHAIN ' + this.combo;
      this.dom.comboFill.style.transform = `scaleX(${clamp(this.comboTimer / COMBO_TIME, 0, 1)})`;
    }
    const showSurge = this.player && this.player.surge > 0 && this.state === 'playing';
    this.dom.surge.classList.toggle('hidden', !showSurge);
    if (showSurge) {
      this.dom.surgeFill.style.transform = `scaleX(${clamp(this.player.surge / 6.5, 0, 1)})`;
    }
  }
}

// keep the class reachable for debugging / automated checks
window.__NABER_GAME_CLASS__ = Game;
