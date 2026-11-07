/* Capybara Xpace — a neon space-survival game for phones.
 * Plain Canvas 2D + Web Audio, no dependencies. */
'use strict';
(() => {
  // ---------------------------------------------------------------- setup
  const cvs = document.getElementById('game');
  const ctx = cvs.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const NEON = ['#ff3df2', '#3dfcff', '#ffe14d', '#7dff6a', '#ff8a3d', '#8a5cff', '#ff4d6d'];

  const store = {
    get(k, d) { try { const v = localStorage.getItem('capyx.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('capyx.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };
  const opts = { sound: store.get('sound', true), reduceFlash: store.get('reduceFlash', false) };
  let best = store.get('best', 0);

  let W = 0, H = 0, DPR = 1, U = 1, safeTop = 0, safeBottom = 0;

  // ---------------------------------------------------------------- glow sprites
  const glowCache = new Map();
  function glow(color) {
    let c = glowCache.get(color);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.2, color);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    glowCache.set(color, c);
    return c;
  }
  function drawGlow(color, x, y, r, a = 1) {
    ctx.globalAlpha = a;
    ctx.drawImage(glow(color), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- background
  let nebula = null;
  const starLayers = [];
  let shootingStars = [];
  let planet = null;

  function buildNebula() {
    nebula = document.createElement('canvas');
    const nw = Math.ceil(W / 2), nh = Math.ceil(H);  // half-res, upscaled (it's blurry anyway)
    nebula.width = nw; nebula.height = nh;
    const g = nebula.getContext('2d');
    g.fillStyle = '#0b0420';
    g.fillRect(0, 0, nw, nh);
    g.globalCompositeOperation = 'lighter';
    const cols = ['rgba(255,61,242,', 'rgba(61,120,255,', 'rgba(61,252,255,', 'rgba(140,60,255,', 'rgba(255,90,60,'];
    for (let i = 0; i < 14; i++) {
      // draw each blob also wrapped vertically so the texture tiles seamlessly
      const x = rand(0, nw), y = rand(0, nh), r = rand(nw * 0.25, nw * 0.8);
      const c = pick(cols), a = rand(0.08, 0.22);
      for (const oy of [-nh, 0, nh]) {
        const grd = g.createRadialGradient(x, y + oy, 0, x, y + oy, r);
        grd.addColorStop(0, c + a + ')');
        grd.addColorStop(1, c + '0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, nw, nh);
      }
    }
  }

  function initStars() {
    starLayers.length = 0;
    const area = W * H / 1000;
    [[0.25, 0.04, 0.8], [0.12, 0.1, 1.4], [0.04, 0.25, 2.2]].forEach(([density, speed, size]) => {
      const n = Math.floor(area * density);
      const stars = [];
      for (let i = 0; i < n; i++) {
        stars.push({ x: rand(0, W), y: rand(0, H), s: rand(0.5, 1) * size, tw: rand(0, TAU), tws: rand(1, 5), hue: randi(0, 360) });
      }
      starLayers.push({ stars, speed });
    });
  }

  function newPlanet() {
    const r = rand(40, 110) * U;
    planet = { x: rand(r, W - r), y: -r * 2, r, vy: rand(6, 14), hue: randi(0, 360), ring: Math.random() < 0.6, tilt: rand(-0.5, 0.5) };
  }

  let nebulaY = 0;
  function updateBackground(dt, warp) {
    nebulaY = (nebulaY + dt * 8 * warp) % H;
    for (const L of starLayers) {
      const v = L.speed * H * warp * dt;
      for (const s of L.stars) {
        s.y += v;
        s.tw += s.tws * dt;
        if (s.y > H) { s.y -= H; s.x = rand(0, W); }
      }
    }
    if (Math.random() < dt * 0.6) {
      shootingStars.push({ x: rand(0, W), y: rand(-20, H * 0.4), vx: rand(-1, 1) * W * 0.8, vy: rand(0.3, 0.7) * H, life: 0.7, color: pick(NEON) });
    }
    for (const s of shootingStars) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; }
    shootingStars = shootingStars.filter((s) => s.life > 0);
    if (!planet) newPlanet();
    planet.y += planet.vy * warp * dt;
    if (planet.y - planet.r * 2 > H) planet = null;
  }

  function drawBackground(t, warp) {
    // nebula: two stacked copies scrolling down
    const ny = nebulaY;
    ctx.drawImage(nebula, 0, ny - H, W, H);
    ctx.drawImage(nebula, 0, ny, W, H);

    if (planet) drawPlanet(planet);

    ctx.globalCompositeOperation = 'lighter';
    const flashy = !opts.reduceFlash;
    for (let li = 0; li < starLayers.length; li++) {
      const L = starLayers[li];
      const streak = warp > 1.5 ? (warp - 1) * L.speed * 60 : 0;
      for (const s of L.stars) {
        const tw = 0.55 + 0.45 * Math.sin(s.tw);
        if (li === 2) {
          const hue = flashy ? (s.hue + t * 40) % 360 : s.hue;
          drawGlow(`hsl(${hue},100%,70%)`, s.x, s.y, s.s * 4 * (0.6 + tw * 0.6), 0.9);
        } else {
          ctx.globalAlpha = tw;
          ctx.fillStyle = li === 1 ? `hsl(${s.hue},90%,85%)` : '#cfd8ff';
          ctx.fillRect(s.x, s.y - streak, s.s, s.s + streak);
        }
      }
    }
    ctx.globalAlpha = 1;
    for (const s of shootingStars) {
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = Math.min(1, s.life * 2);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 0.08, s.y - s.vy * 0.08);
      ctx.stroke();
      drawGlow(s.color, s.x, s.y, 8, ctx.globalAlpha);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawPlanet(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    drawGlow(`hsl(${p.hue},100%,60%)`, 0, 0, p.r * 1.8, 0.25);
    const grd = ctx.createRadialGradient(-p.r * 0.4, -p.r * 0.4, p.r * 0.1, 0, 0, p.r);
    grd.addColorStop(0, `hsl(${p.hue},90%,70%)`);
    grd.addColorStop(0.7, `hsl(${(p.hue + 40) % 360},80%,35%)`);
    grd.addColorStop(1, `hsl(${(p.hue + 60) % 360},80%,15%)`);
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill();
    if (p.ring) {
      ctx.rotate(p.tilt);
      ctx.strokeStyle = `hsla(${(p.hue + 180) % 360},100%,75%,0.6)`;
      ctx.lineWidth = p.r * 0.12;
      ctx.beginPath(); ctx.ellipse(0, 0, p.r * 1.7, p.r * 0.35, 0, 0, TAU); ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- audio
  const Snd = {
    ac: null, master: null, noiseBuf: null, lastShot: 0, musicTimer: null, step: 0, nextTime: 0,
    init() {
      if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ac = new AC();
      this.master = this.ac.createGain();
      this.master.gain.value = opts.sound ? 0.4 : 0;
      this.master.connect(this.ac.destination);
      const len = this.ac.sampleRate;
      this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    },
    setOn(on) { if (this.master) this.master.gain.value = on ? 0.4 : 0; },
    tone(freq, dur, type = 'square', vol = 0.2, slide = 0, when = 0) {
      if (!this.ac || !opts.sound) return;
      const t = this.ac.currentTime + when;
      const o = this.ac.createOscillator(), g = this.ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    },
    noise(dur, vol = 0.3, freq = 1200, when = 0) {
      if (!this.ac || !opts.sound) return;
      const t = this.ac.currentTime + when;
      const s = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
      s.buffer = this.noiseBuf;
      f.type = 'lowpass';
      f.frequency.setValueAtTime(freq, t);
      f.frequency.exponentialRampToValueAtTime(80, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      s.connect(f); f.connect(g); g.connect(this.master);
      s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    },
    shoot(kind) {
      if (!this.ac) return;
      const now = this.ac.currentTime;
      if (now - this.lastShot < 0.07) return;
      this.lastShot = now;
      if (kind === 'spread') this.tone(900, 0.08, 'sawtooth', 0.05, 300);
      else if (kind === 'rapid') this.tone(1400, 0.05, 'square', 0.035, 700);
      else this.tone(1100, 0.07, 'square', 0.045, 450);
    },
    missile() { this.tone(200, 0.3, 'sawtooth', 0.08, 900); this.noise(0.25, 0.08, 3000); },
    boom(big) { this.noise(big ? 0.9 : 0.4, big ? 0.6 : 0.3, big ? 1500 : 2500); this.tone(big ? 90 : 140, big ? 0.6 : 0.25, 'sine', 0.3, 30); },
    hit() { this.tone(160, 0.3, 'sawtooth', 0.25, 50); this.noise(0.2, 0.3, 900); },
    shieldHit() { this.tone(600, 0.25, 'triangle', 0.2, 1500); },
    pickup() { [660, 880, 1320].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.18, 0, i * 0.06)); },
    power() { [440, 660, 880, 1320, 1760].forEach((f, i) => this.tone(f, 0.14, 'square', 0.1, 0, i * 0.05)); },
    level() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.18, 'square', 0.1, 0, i * 0.08)); },
    nova() { this.noise(1.4, 0.7, 4000); this.tone(1200, 1.2, 'sawtooth', 0.15, 40); },
    over() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.22, 0, i * 0.18)); },

    // tiny lookahead sequencer for driving synthwave-ish music
    startMusic() {
      if (!this.ac || this.musicTimer) return;
      this.step = 0;
      this.nextTime = this.ac.currentTime + 0.05;
      this.musicTimer = setInterval(() => this.schedule(), 25);
    },
    stopMusic() { clearInterval(this.musicTimer); this.musicTimer = null; },
    schedule() {
      if (!this.ac || !opts.sound) { if (this.ac) this.nextTime = this.ac.currentTime + 0.05; return; }
      const bpm = 120 + Math.min(40, (game ? game.level - 1 : 0) * 4);
      const stepDur = 60 / bpm / 4;
      const roots = [45, 45, 41, 43]; // A, A, F, G (midi)
      while (this.nextTime < this.ac.currentTime + 0.12) {
        const s = this.step % 64, bar = (s / 16) | 0, i = s % 16;
        const root = roots[bar];
        const delay = Math.max(0, this.nextTime - this.ac.currentTime);
        const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
        if (i % 2 === 0) this.tone(mtof(root + (i % 4 === 2 ? 12 : 0)), stepDur * 1.6, 'sawtooth', 0.05, 0, delay);
        const arp = [0, 7, 12, 15, 19, 15, 12, 7];
        if (game && game.level >= 2) this.tone(mtof(root + 24 + arp[i % 8]), stepDur * 0.9, 'square', 0.018, 0, delay);
        if (i % 4 === 0) this.tone(120, 0.12, 'sine', 0.15, 40, delay);       // kick
        if (i % 4 === 2) this.noise(0.03, 0.05, 8000, delay);                  // hat
        if (i === 4 || i === 12) this.noise(0.12, 0.08, 3000, delay);           // snare
        this.nextTime += stepDur;
        this.step++;
      }
    },
  };

  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* unsupported */ } }

  // ---------------------------------------------------------------- game state
  const WEAPONS = {
    blaster: { name: 'BLASTER', color: '#ffe14d' },
    rapid:   { name: 'RAPID FIRE', color: '#ff8a3d' },
    spread:  { name: 'SPREAD GUN', color: '#ff3df2' },
    laser:   { name: 'MEGA LASER', color: '#3dfcff' },
  };
  const PICKUPS = {
    rapid:   { label: 'R', color: '#ff8a3d', text: 'RAPID FIRE!' },
    spread:  { label: 'S', color: '#ff3df2', text: 'SPREAD GUN!' },
    laser:   { label: 'L', color: '#3dfcff', text: 'MEGA LASER!' },
    missile: { label: 'M', color: '#ff4d6d', text: '+12 MISSILES!' },
    health:  { label: '+', color: '#7dff6a', text: '+35 HEALTH' },
    shield:  { label: '◆', color: '#4dc3ff', text: 'SHIELD FULL' },
    nova:    { label: '✸', color: '#ffffff', text: 'NOVA BOMB!!' },
  };
  const LEVEL_TIME = 25;
  const UNLOCKS = {
    2: 'SHIELDS ONLINE',
    3: 'HEALTH REGEN',
    4: 'AUTO MISSILE POD',
    5: 'TWIN BLASTERS',
    6: 'SHIELD BOOST',
    7: 'TURBO REGEN',
  };

  let state = 'menu';
  let game = null;
  let player = null;
  let bullets = [], rocks = [], pickups = [], particles = [], texts = [], rings = [];
  let shake = 0, flash = 0, flashColor = '#fff', banner = null, deathTimer = 0;
  let time = 0;

  function newGame() {
    game = {
      score: 0, level: 1, levelT: 0, spawnT: 0.5, pickupT: 6, combo: 1, comboT: 0,
      warp: 1, warpT: 0, survivalAcc: 0,
    };
    player = {
      x: W / 2, y: H * 0.78, tx: W / 2, ty: H * 0.78, r: 22 * U, tilt: 0,
      hp: 100, maxHp: 100, shield: 0, maxShield: 0, shieldDelay: 0, shieldOn: false,
      regen: 0, inv: 1.5, weapon: 'blaster', weaponT: 0, fireT: 0,
      missiles: 0, missileT: 0, podT: 0, pod: false, twin: false, laserOn: false, alive: true,
    };
    bullets = []; rocks = []; pickups = []; particles = []; texts = []; rings = [];
    shake = 0; flash = 0; banner = null; deathTimer = 0;
  }

  // ---------------------------------------------------------------- spawners
  function makeShape(n, jag) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, m = 1 - Math.random() * jag;
      pts.push([Math.cos(a) * m, Math.sin(a) * m]);
    }
    return pts;
  }

  function spawnRock(size, x, y, vx, vy) {
    const lv = game.level;
    const sizes = { 3: 46, 2: 28, 1: 16 };
    const r = sizes[size] * U * rand(0.9, 1.1);
    const speedMul = 1 + (lv - 1) * 0.08;
    const hue = pick([280, 320, 20, 190, 45, 260]);
    rocks.push({
      kind: 'rock', size, r,
      x: x !== undefined ? x : rand(r, W - r),
      y: y !== undefined ? y : -r,
      vx: vx !== undefined ? vx : rand(-0.06, 0.06) * W,
      vy: vy !== undefined ? vy : rand(0.13, 0.24) * H * speedMul * (size === 3 ? 0.8 : 1),
      rot: rand(0, TAU), vr: rand(-2, 2),
      hp: [0, 1, 3, 7][size] + Math.floor((lv - 1) / 3) * size,
      pts: makeShape(randi(8, 12), 0.35),
      craters: Array.from({ length: size + 1 }, () => [rand(-0.5, 0.5), rand(-0.5, 0.5), rand(0.12, 0.25)]),
      hue, hitT: 0,
    });
  }

  function spawnDebris() {
    const r = rand(14, 22) * U;
    rocks.push({
      kind: 'debris', size: 1, r, x: rand(r, W - r), y: -r,
      vx: rand(-0.1, 0.1) * W, vy: rand(0.28, 0.38) * H * (1 + game.level * 0.05),
      rot: rand(0, TAU), vr: rand(-6, 6), hp: 2, hitT: 0,
      w: rand(1.2, 1.8), color: pick(['#c0c8ff', '#ffd0a0', '#a0ffe8']),
    });
  }

  function spawnComet() {
    const fromLeft = Math.random() < 0.5, r = 12 * U;
    rocks.push({
      kind: 'comet', size: 1, r,
      x: fromLeft ? -r : W + r, y: rand(-H * 0.1, H * 0.35),
      vx: (fromLeft ? 1 : -1) * rand(0.35, 0.55) * W, vy: rand(0.35, 0.5) * H,
      rot: 0, vr: 0, hp: 1, hitT: 0, color: pick(['#3dfcff', '#ff8a3d', '#7dff6a']),
    });
  }

  function spawnPickup(type, x, y) {
    if (!type) {
      const pool = ['rapid', 'spread', 'laser', 'missile', 'missile', 'health'];
      if (player.shieldOn) pool.push('shield');
      if (game.level >= 3) pool.push('nova');
      if (player.hp < player.maxHp * 0.4) pool.push('health', 'health');
      type = pick(pool);
    }
    pickups.push({ type, x: x !== undefined ? x : rand(30 * U, W - 30 * U), y: y !== undefined ? y : -20, vy: H * 0.12, t: 0, r: 16 * U });
  }

  // ---------------------------------------------------------------- effects
  const MAX_PARTICLES = 700;
  function burst(x, y, n, colors, speed = 1, size = 1) {
    for (let i = 0; i < n && particles.length < MAX_PARTICLES; i++) {
      const a = rand(0, TAU), v = rand(0.2, 1) * 260 * speed * U;
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.35, 0.9), max: 0.9, s: rand(2, 5) * size * U, color: pick(colors) });
    }
  }
  function addText(x, y, str, color = '#fff', size = 18) {
    texts.push({ x, y, str, color, size: size * U, life: 1.1 });
  }
  function doFlash(color, a) {
    flashColor = color;
    flash = Math.max(flash, opts.reduceFlash ? a * 0.2 : a);
  }
  function showBanner(title, subtitle, color) {
    banner = { title, subtitle, color, t: 0 };
  }

  // ---------------------------------------------------------------- combat
  function nearestRock(x, y, taken) {
    let bestR = null, bd = Infinity;
    for (const r of rocks) {
      if (r.dead || r.y < -r.r || r.y > H) continue;
      let d = (r.x - x) ** 2 + (r.y - y) ** 2;
      if (taken && taken.has(r)) d *= 4;
      if (d < bd) { bd = d; bestR = r; }
    }
    return bestR;
  }

  function fireMissile(fromPod) {
    const side = Math.random() < 0.5 ? -1 : 1;
    bullets.push({
      kind: 'missile', x: player.x + side * player.r * 0.8, y: player.y, vx: side * 120 * U, vy: -200 * U,
      r: 6 * U, dmg: 5, life: 3, target: null, color: '#ff4d6d', pod: fromPod,
    });
    Snd.missile();
  }

  function fireWeapon(dt) {
    const p = player;
    p.fireT -= dt;
    p.laserOn = p.weapon === 'laser';
    const bspd = -H * 1.3;
    if (p.weapon === 'laser') {
      // continuous beam — damage applied in updateLaser
      if (p.fireT <= 0) { p.fireT = 0.12; Snd.tone(220 + Math.random() * 40, 0.12, 'sawtooth', 0.03); }
    } else if (p.fireT <= 0) {
      const mk = (x, vx, color, dmg = 1, r = 4) => bullets.push({ kind: 'shot', x, y: p.y - p.r, vx, vy: bspd, r: r * U, dmg, life: 1.5, color });
      if (p.weapon === 'blaster') {
        p.fireT = 0.17;
        if (p.twin) { mk(p.x - 10 * U, 0, '#ffe14d'); mk(p.x + 10 * U, 0, '#ffe14d'); }
        else mk(p.x, 0, '#ffe14d');
        Snd.shoot('blaster');
      } else if (p.weapon === 'rapid') {
        p.fireT = 0.065;
        mk(p.x + rand(-6, 6) * U, rand(-30, 30) * U, '#ff8a3d');
        if (p.twin) mk(p.x + rand(-12, 12) * U, rand(-30, 30) * U, '#ffe14d');
        Snd.shoot('rapid');
      } else if (p.weapon === 'spread') {
        p.fireT = 0.2;
        const n = p.twin ? 7 : 5;
        for (let i = 0; i < n; i++) {
          const a = (i / (n - 1) - 0.5) * 0.8;
          bullets.push({ kind: 'shot', x: p.x, y: p.y - p.r, vx: Math.sin(a) * -bspd, vy: Math.cos(a) * bspd, r: 5 * U, dmg: 1, life: 1.5, color: i % 2 ? '#ff3df2' : '#8a5cff' });
        }
        Snd.shoot('spread');
      }
    }
    // missiles (pickup ammo)
    p.missileT -= dt;
    if (p.missiles > 0 && p.missileT <= 0 && rocks.length) {
      p.missileT = 0.22;
      p.missiles--;
      fireMissile(false);
    }
    // unlocked auto pod
    if (p.pod) {
      p.podT -= dt;
      if (p.podT <= 0 && rocks.length) { p.podT = Math.max(0.9, 2.2 - (game.level - 4) * 0.15); fireMissile(true); }
    }
  }

  function damageRock(r, dmg, hx, hy) {
    if (r.dead) return;
    r.hp -= dmg;
    r.hitT = 0.08;
    if (r.hp <= 0) destroyRock(r);
    else if (particles.length < MAX_PARTICLES) burst(hx, hy, 2, ['#fff', '#ffe14d'], 0.4, 0.6);
  }

  function destroyRock(r, noScore) {
    if (r.dead) return;
    r.dead = true;
    const cols = r.kind === 'rock' ? [`hsl(${r.hue},100%,65%)`, '#ffe14d', '#fff', '#ff8a3d'] : [r.color, '#fff', '#3dfcff'];
    burst(r.x, r.y, 10 + r.size * 10, cols, 0.6 + r.size * 0.3, 1 + r.size * 0.3);
    rings.push({ x: r.x, y: r.y, r: r.r * 0.5, max: r.r * 2.4, life: 0.4, color: cols[0] });
    shake = Math.max(shake, 3 + r.size * 3);
    if (r.size >= 2) doFlash(cols[0], 0.12 + r.size * 0.04);
    Snd.boom(r.size >= 3);
    if (r.kind === 'rock' && r.size > 1) {
      for (let i = 0; i < 2; i++) {
        spawnRock(r.size - 1, r.x + rand(-5, 5), r.y, r.vx + (i ? 1 : -1) * rand(40, 110) * U, r.vy * rand(0.8, 1.1));
      }
    }
    if (noScore) return;
    const base = r.kind === 'comet' ? 150 : r.kind === 'debris' ? 75 : [0, 60, 40, 25][r.size];
    game.combo = Math.min(8, game.combo + 0.25);
    game.comboT = 1.6;
    const pts = Math.round(base * Math.floor(game.combo));
    game.score += pts;
    addText(r.x, r.y, '+' + pts, Math.floor(game.combo) > 1 ? '#ffe14d' : '#fff', 14 + Math.floor(game.combo) * 2);
    const dropChance = r.kind === 'comet' ? 0.6 : 0.05 + r.size * 0.025;
    if (Math.random() < dropChance) spawnPickup(null, r.x, r.y);
  }

  function hurtPlayer(dmg) {
    const p = player;
    if (p.inv > 0 || !p.alive) return;
    p.shieldDelay = 2.5;
    if (p.shield > 0) {
      const absorbed = Math.min(p.shield, dmg);
      p.shield -= absorbed;
      dmg -= absorbed;
      Snd.shieldHit();
      rings.push({ x: p.x, y: p.y, r: p.r, max: p.r * 3, life: 0.35, color: '#3dfcff' });
      doFlash('#3dfcff', 0.25);
      if (dmg <= 0) { p.inv = 0.4; buzz(20); return; }
    }
    p.hp -= dmg;
    p.inv = 1.0;
    game.combo = 1;
    shake = 14;
    doFlash('#ff2050', 0.45);
    Snd.hit();
    buzz(60);
    burst(p.x, p.y, 18, ['#ff4d6d', '#ffe14d', '#c08550'], 0.7);
    if (p.hp <= 0) killPlayer();
  }

  function killPlayer() {
    const p = player;
    p.hp = 0;
    p.alive = false;
    p.laserOn = false;
    burst(p.x, p.y, 120, NEON, 1.6, 1.6);
    rings.push({ x: p.x, y: p.y, r: 10, max: Math.max(W, H) * 0.6, life: 0.8, color: '#ff3df2' });
    shake = 30;
    doFlash('#ffffff', 0.9);
    Snd.boom(true);
    Snd.over();
    buzz([80, 40, 160]);
    deathTimer = 1.6;
  }

  function nova() {
    Snd.nova();
    doFlash('#ffffff', 1);
    shake = 25;
    buzz([40, 30, 90]);
    rings.push({ x: player.x, y: player.y, r: 10, max: Math.hypot(W, H), life: 0.7, color: '#ffffff' });
    rings.push({ x: player.x, y: player.y, r: 10, max: Math.hypot(W, H) * 0.8, life: 0.9, color: '#ff3df2' });
    for (const r of rocks) if (r.y > -r.r) { r.size = 1; destroyRock(r); }
  }

  function collect(pk) {
    const p = player, def = PICKUPS[pk.type];
    Snd.pickup();
    buzz(15);
    burst(pk.x, pk.y, 20, [def.color, '#fff'], 0.6);
    addText(pk.x, pk.y - 20, def.text, def.color, 20);
    switch (pk.type) {
      case 'rapid': case 'spread': case 'laser':
        p.weapon = pk.type; p.weaponT = 12; Snd.power(); break;
      case 'missile': p.missiles += 12; break;
      case 'health': p.hp = Math.min(p.maxHp, p.hp + 35); break;
      case 'shield': p.shield = p.maxShield; break;
      case 'nova': nova(); break;
    }
  }

  function levelUp() {
    const g = game, p = player;
    g.level++;
    g.levelT = 0;
    g.warpT = 1.8;
    const lv = g.level;
    let unlock = UNLOCKS[lv];
    if (lv === 2) { p.shieldOn = true; p.maxShield = 50; p.shield = 50; }
    else if (lv === 3) { p.regen = 2; }
    else if (lv === 4) { p.pod = true; p.podT = 0.5; }
    else if (lv === 5) { p.twin = true; }
    else if (lv === 6) { p.maxShield = 100; p.shield = 100; }
    else if (lv === 7) { p.regen = 4; }
    else { p.maxHp += 20; unlock = 'MAX HEALTH +20'; }
    p.hp = Math.min(p.maxHp, p.hp + 25);
    if (p.shieldOn) p.shield = p.maxShield;
    showBanner('LEVEL ' + lv, unlock, pick(NEON));
    doFlash(pick(NEON), 0.5);
    Snd.level();
    buzz([30, 30, 30]);
    spawnPickup();
  }

  // ---------------------------------------------------------------- update
  const keys = new Set();
  let drag = null;

  function update(dt) {
    time += dt;
    const g = game, p = player;
    g.warpT = Math.max(0, g.warpT - dt);
    g.warp = 1 + (g.warpT > 0 ? Math.sin((g.warpT / 1.8) * Math.PI) * 5 : 0);
    updateBackground(dt, g.warp * (1 + g.level * 0.05));

    if (p.alive) {
      // movement
      const kx = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0);
      const ky = (keys.has('ArrowDown') || keys.has('s') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('w') ? 1 : 0);
      if (kx || ky) { p.tx += kx * W * 0.9 * dt; p.ty += ky * H * 0.7 * dt; }
      const minY = safeTop + 90 * U;
      p.tx = clamp(p.tx, p.r, W - p.r);
      p.ty = clamp(p.ty, minY, H - p.r - safeBottom - 10);
      const ox = p.x;
      const k = Math.min(1, dt * 16);
      p.x += (p.tx - p.x) * k;
      p.y += (p.ty - p.y) * k;
      const vx = (p.x - ox) / Math.max(dt, 1e-3);
      p.tilt += (clamp(vx / (W * 1.5), -0.45, 0.45) - p.tilt) * Math.min(1, dt * 10);

      // jet exhaust
      if (particles.length < MAX_PARTICLES) {
        for (let i = 0; i < 2; i++) {
          const side = i ? 1 : -1;
          particles.push({ x: p.x + side * p.r * 0.45, y: p.y + p.r * 1.05, vx: rand(-30, 30) * U, vy: rand(160, 260) * U, life: rand(0.15, 0.35), max: 0.35, s: rand(3, 6) * U, color: pick(['#ffe14d', '#ff8a3d', '#ff3df2', '#3dfcff']) });
        }
      }

      // timers
      p.inv = Math.max(0, p.inv - dt);
      if (p.weapon !== 'blaster') {
        p.weaponT -= dt;
        if (p.weaponT <= 0) { p.weapon = 'blaster'; addText(p.x, p.y - 40 * U, 'POWER DOWN', '#aaa', 14); }
      }
      if (p.regen && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
      if (p.shieldOn) {
        p.shieldDelay -= dt;
        if (p.shieldDelay <= 0 && p.shield < p.maxShield) p.shield = Math.min(p.maxShield, p.shield + p.maxShield * 0.12 * dt);
      }
      fireWeapon(dt);

      // level progression + survival points
      g.levelT += dt;
      if (g.levelT >= LEVEL_TIME) levelUp();
      g.survivalAcc += dt * 10 * g.level;
      if (g.survivalAcc >= 1) { const s = Math.floor(g.survivalAcc); g.score += s; g.survivalAcc -= s; }
      g.comboT -= dt;
      if (g.comboT <= 0) g.combo = Math.max(1, g.combo - dt * 4);

      // spawning
      g.spawnT -= dt;
      if (g.spawnT <= 0) {
        const lv = g.level;
        g.spawnT = Math.max(0.22, 1.05 - lv * 0.08) * rand(0.6, 1.3);
        const roll = Math.random();
        if (lv >= 3 && roll < 0.08) spawnComet();
        else if (lv >= 2 && roll < 0.3) spawnDebris();
        else spawnRock(Math.random() < 0.25 + lv * 0.04 ? 3 : Math.random() < 0.5 ? 2 : 1);
        if (lv >= 5 && Math.random() < 0.15) spawnRock(1);
      }
      g.pickupT -= dt;
      if (g.pickupT <= 0) { g.pickupT = rand(7, 11); spawnPickup(); }
    } else {
      deathTimer -= dt;
      if (deathTimer <= 0 && state === 'play') gameOver();
    }

    // bullets
    for (const b of bullets) {
      b.life -= dt;
      if (b.kind === 'missile') {
        if (!b.target || b.target.dead) b.target = nearestRock(b.x, b.y);
        const sp = 620 * U;
        if (b.target) {
          const a = Math.atan2(b.target.y - b.y, b.target.x - b.x);
          const ca = Math.atan2(b.vy, b.vx);
          let da = a - ca;
          while (da > Math.PI) da -= TAU;
          while (da < -Math.PI) da += TAU;
          const na = ca + clamp(da, -8 * dt, 8 * dt);
          const cur = Math.min(sp, Math.hypot(b.vx, b.vy) + 900 * U * dt);
          b.vx = Math.cos(na) * cur; b.vy = Math.sin(na) * cur;
        } else {
          b.vy -= 900 * U * dt;
        }
        if (particles.length < MAX_PARTICLES) particles.push({ x: b.x, y: b.y, vx: -b.vx * 0.1, vy: -b.vy * 0.1, life: 0.35, max: 0.35, s: 4 * U, color: pick(['#ff8a3d', '#ffe14d', '#ff4d6d']) });
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y < -40 || b.y > H + 40 || b.x < -40 || b.x > W + 40) b.life = 0;
      if (b.life <= 0) continue;
      for (const r of rocks) {
        if (r.dead) continue;
        const rr = r.r + b.r;
        if ((r.x - b.x) ** 2 + (r.y - b.y) ** 2 < rr * rr) {
          b.life = 0;
          if (b.kind === 'missile') {
            // splash damage
            const R = 55 * U;
            burst(b.x, b.y, 16, ['#ff4d6d', '#ffe14d', '#fff'], 0.7);
            rings.push({ x: b.x, y: b.y, r: 5, max: R, life: 0.3, color: '#ff8a3d' });
            for (const o of rocks) if (!o.dead && (o.x - b.x) ** 2 + (o.y - b.y) ** 2 < (R + o.r) ** 2) damageRock(o, o === r ? b.dmg : 2, b.x, b.y);
          } else {
            damageRock(r, b.dmg, b.x, b.y);
          }
          break;
        }
      }
    }
    bullets = bullets.filter((b) => b.life > 0);

    // laser beam
    if (p.alive && p.laserOn) {
      const half = 9 * U;
      for (const r of rocks) {
        if (r.dead || r.y > p.y || r.y < -r.r) continue;
        if (Math.abs(r.x - p.x) < r.r + half) {
          r.laserAcc = (r.laserAcc || 0) + dt * 16;
          if (r.laserAcc >= 1) { const d = Math.floor(r.laserAcc); r.laserAcc -= d; damageRock(r, d, r.x, r.y + r.r * 0.6); }
          else r.hitT = 0.05;
        }
      }
    }

    // rocks
    for (const r of rocks) {
      if (r.dead) continue;
      r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.vr * dt;
      r.hitT = Math.max(0, r.hitT - dt);
      if (r.kind === 'rock' && (r.x < r.r && r.vx < 0 || r.x > W - r.r && r.vx > 0)) r.vx *= -1;
      if (r.kind === 'comet' && particles.length < MAX_PARTICLES) {
        particles.push({ x: r.x, y: r.y, vx: -r.vx * 0.2 + rand(-20, 20), vy: -r.vy * 0.2 + rand(-20, 20), life: 0.5, max: 0.5, s: rand(4, 8) * U, color: pick([r.color, '#fff']) });
      }
      if (r.y - r.r > H + 20 || r.x < -r.r * 3 || r.x > W + r.r * 3) { r.dead = true; continue; }
      if (p.alive) {
        const rr = r.r * 0.85 + p.r * 0.8;
        if ((r.x - p.x) ** 2 + (r.y - p.y) ** 2 < rr * rr && p.inv <= 0) {
          const dmg = r.kind === 'comet' ? 25 : r.kind === 'debris' ? 15 : [0, 12, 20, 32][r.size];
          hurtPlayer(dmg);
          destroyRock(r, true);
        }
      }
    }
    rocks = rocks.filter((r) => !r.dead);

    // pickups (magnet pull when close)
    for (const pk of pickups) {
      pk.t += dt;
      pk.y += pk.vy * dt;
      pk.x += Math.sin(pk.t * 3) * 20 * U * dt;
      if (p.alive) {
        const dx = p.x - pk.x, dy = p.y - pk.y, d = Math.hypot(dx, dy);
        if (d < 110 * U) { pk.x += dx / d * 300 * U * dt; pk.y += dy / d * 300 * U * dt; }
        if (d < p.r + pk.r) { pk.dead = true; collect(pk); }
      }
      if (pk.y > H + 30) pk.dead = true;
    }
    pickups = pickups.filter((pk) => !pk.dead);

    // particles & fx
    for (const q of particles) {
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.vx *= 1 - dt * 2.5; q.vy *= 1 - dt * 2.5;
      q.life -= dt;
    }
    particles = particles.filter((q) => q.life > 0);
    for (const t of texts) { t.y -= 50 * U * dt; t.life -= dt; }
    texts = texts.filter((t) => t.life > 0);
    for (const r of rings) { r.life -= dt; r.r += (r.max - r.r) * Math.min(1, dt * 8); }
    rings = rings.filter((r) => r.life > 0);
    if (banner) { banner.t += dt; if (banner.t > 2.6) banner = null; }
    shake = Math.max(0, shake - dt * 40);
    flash = Math.max(0, flash - dt * 2.2);
  }

  // ---------------------------------------------------------------- draw
  function drawCapy(p, t) {
    const s = p.r;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.tilt);
    if (p.inv > 0 && Math.floor(t * 20) % 2 === 0) ctx.globalAlpha = 0.45;

    // jet flames
    ctx.globalCompositeOperation = 'lighter';
    for (const side of [-1, 1]) {
      const fl = s * (0.9 + Math.random() * 0.6);
      const fx = side * s * 0.45, fy = s * 0.95;
      const grd = ctx.createLinearGradient(fx, fy, fx, fy + fl);
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(0.3, '#ffe14d');
      grd.addColorStop(0.7, '#ff3df2');
      grd.addColorStop(1, 'rgba(61,252,255,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(fx - s * 0.18, fy);
      ctx.quadraticCurveTo(fx, fy + fl * 1.2, fx + s * 0.18, fy);
      ctx.fill();
      drawGlow('#ff8a3d', fx, fy + s * 0.2, s * 0.6, 0.8);
    }
    ctx.globalCompositeOperation = 'source-over';

    // jetpack
    ctx.fillStyle = '#5a6cff';
    roundRect(-s * 0.75, s * 0.15, s * 1.5, s * 0.85, s * 0.2); ctx.fill();
    ctx.fillStyle = '#3dfcff';
    ctx.fillRect(-s * 0.62, s * 0.78, s * 0.34, s * 0.2);
    ctx.fillRect(s * 0.28, s * 0.78, s * 0.34, s * 0.2);

    // body
    ctx.fillStyle = '#a8683a';
    ctx.beginPath(); ctx.ellipse(0, s * 0.45, s * 0.68, s * 0.58, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c98a55';
    ctx.beginPath(); ctx.ellipse(0, s * 0.55, s * 0.4, s * 0.35, 0, 0, TAU); ctx.fill();
    // paws
    ctx.fillStyle = '#7a4524';
    ctx.beginPath(); ctx.ellipse(-s * 0.55, s * 0.5, s * 0.16, s * 0.12, 0.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.55, s * 0.5, s * 0.16, s * 0.12, -0.5, 0, TAU); ctx.fill();

    // head
    ctx.fillStyle = '#b97a45';
    roundRect(-s * 0.58, -s * 0.95, s * 1.16, s * 1.05, s * 0.45); ctx.fill();
    // ears
    ctx.fillStyle = '#6e3d1f';
    ctx.beginPath(); ctx.arc(-s * 0.45, -s * 0.9, s * 0.14, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.45, -s * 0.9, s * 0.14, 0, TAU); ctx.fill();
    // snout
    ctx.fillStyle = '#8c5430';
    roundRect(-s * 0.4, -s * 0.38, s * 0.8, s * 0.45, s * 0.2); ctx.fill();
    ctx.fillStyle = '#2b140a';
    ctx.beginPath(); ctx.ellipse(-s * 0.15, -s * 0.25, s * 0.06, s * 0.04, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.15, -s * 0.25, s * 0.06, s * 0.04, 0, 0, TAU); ctx.fill();
    // little smile
    ctx.strokeStyle = '#2b140a'; ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.beginPath(); ctx.arc(0, -s * 0.12, s * 0.1, 0.2, Math.PI - 0.2); ctx.stroke();
    // eyes (blink every few seconds)
    const blink = (t % 3.5) < 0.12;
    ctx.fillStyle = '#120804';
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(side * s * 0.28, -s * 0.6, s * 0.09, blink ? s * 0.015 : s * 0.09, 0, 0, TAU); ctx.fill();
      if (!blink) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(side * s * 0.28 + s * 0.03, -s * 0.63, s * 0.03, 0, TAU); ctx.fill(); ctx.fillStyle = '#120804'; }
    }
    // blush
    ctx.fillStyle = 'rgba(255,90,150,0.45)';
    ctx.beginPath(); ctx.ellipse(-s * 0.45, -s * 0.38, s * 0.1, s * 0.06, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.45, -s * 0.38, s * 0.1, s * 0.06, 0, 0, TAU); ctx.fill();

    // bubble helmet
    ctx.fillStyle = 'rgba(140,220,255,0.12)';
    ctx.strokeStyle = 'rgba(200,245,255,0.8)';
    ctx.lineWidth = Math.max(1.5, s * 0.07);
    ctx.beginPath(); ctx.arc(0, -s * 0.42, s * 0.88, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = Math.max(1.5, s * 0.09);
    ctx.beginPath(); ctx.arc(0, -s * 0.42, s * 0.7, -2.6, -1.9); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;

    // shield bubble
    if (p.shieldOn && p.shield > 0) {
      const a = 0.35 + 0.25 * (p.shield / p.maxShield) + 0.1 * Math.sin(t * 6);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(61,252,255,${a})`;
      ctx.lineWidth = 3 * U;
      ctx.beginPath();
      const R = p.r * 1.75;
      for (let i = 0; i <= 6; i++) {
        const ang = (i / 6) * TAU + t * 0.8;
        const px = p.x + Math.cos(ang) * R, py = p.y - p.r * 0.1 + Math.sin(ang) * R;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
      ctx.fillStyle = `rgba(61,200,255,${a * 0.18})`;
      ctx.fill();
      ctx.restore();
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawRock(r) {
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.rot);
    const lit = r.hitT > 0;
    if (r.kind === 'rock') {
      ctx.beginPath();
      r.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * r.r, y * r.r) : ctx.moveTo(x * r.r, y * r.r)));
      ctx.closePath();
      ctx.fillStyle = lit ? '#ffffff' : `hsl(${r.hue},45%,${r.size === 3 ? 26 : 32}%)`;
      ctx.fill();
      ctx.lineWidth = 2.5 * U;
      ctx.strokeStyle = `hsl(${r.hue},100%,65%)`;
      ctx.stroke();
      if (!lit) {
        ctx.fillStyle = `hsla(${r.hue},50%,15%,0.7)`;
        for (const [cx, cy, cr] of r.craters) { ctx.beginPath(); ctx.arc(cx * r.r, cy * r.r, cr * r.r, 0, TAU); ctx.fill(); }
      }
    } else if (r.kind === 'debris') {
      const w = r.r * r.w, h = r.r * 0.7;
      ctx.fillStyle = lit ? '#fff' : '#4a4f6a';
      ctx.fillRect(-w, -h * 0.5, w * 2, h);
      ctx.fillStyle = lit ? '#fff' : '#2a6cff';
      ctx.fillRect(-w * 1.6, -h * 0.35, w * 0.55, h * 0.7);
      ctx.fillRect(w * 1.05, -h * 0.35, w * 0.55, h * 0.7);
      ctx.strokeStyle = r.color; ctx.lineWidth = 2 * U;
      ctx.strokeRect(-w, -h * 0.5, w * 2, h);
      if (Math.floor(time * 4) % 2 === 0) { ctx.globalCompositeOperation = 'lighter'; drawGlow('#ff4d6d', 0, 0, r.r * 0.8, 1); }
    } else {
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(r.color, 0, 0, r.r * 3, 1);
      drawGlow('#ffffff', 0, 0, r.r * 1.4, 1);
    }
    ctx.restore();
  }

  function drawPickup(pk, t) {
    const def = PICKUPS[pk.type];
    const bob = Math.sin(pk.t * 5) * 3 * U;
    const r = pk.r;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(def.color, 0, 0, r * 2.6, 0.7 + 0.3 * Math.sin(pk.t * 8));
    ctx.globalCompositeOperation = 'source-over';
    ctx.rotate(Math.sin(pk.t * 2) * 0.25);
    ctx.fillStyle = 'rgba(20,0,40,0.85)';
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 3 * U;
    roundRect(-r, -r, r * 2, r * 2, r * 0.35);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = def.color;
    ctx.font = `900 ${Math.round(r * 1.25)}px "Trebuchet MS", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(def.label, 0, r * 0.08);
    ctx.restore();
  }

  function drawBullets() {
    ctx.globalCompositeOperation = 'lighter';
    for (const b of bullets) {
      if (b.kind === 'missile') {
        const a = Math.atan2(b.vy, b.vx);
        ctx.save();
        ctx.translate(b.x, b.y); ctx.rotate(a);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#eef';
        ctx.fillRect(-b.r * 1.4, -b.r * 0.45, b.r * 2.2, b.r * 0.9);
        ctx.fillStyle = b.color;
        ctx.beginPath(); ctx.moveTo(b.r * 0.8, -b.r * 0.45); ctx.lineTo(b.r * 1.7, 0); ctx.lineTo(b.r * 0.8, b.r * 0.45); ctx.fill();
        ctx.fillRect(-b.r * 1.5, -b.r * 0.8, b.r * 0.5, b.r * 1.6);
        ctx.restore();
        ctx.globalCompositeOperation = 'lighter';
        drawGlow('#ff8a3d', b.x - Math.cos(a) * b.r * 1.6, b.y - Math.sin(a) * b.r * 1.6, b.r * 2.2, 1);
      } else {
        drawGlow(b.color, b.x, b.y, b.r * 3.2, 1);
        ctx.fillStyle = '#fff';
        ctx.fillRect(b.x - b.r * 0.35, b.y - b.r * 1.6, b.r * 0.7, b.r * 3.2);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawLaser(t) {
    const p = player;
    if (!p.alive || !p.laserOn) return;
    const w = (9 + Math.sin(t * 50) * 2.5) * U;
    const top = 0, bottom = p.y - p.r * 1.1;
    ctx.globalCompositeOperation = 'lighter';
    const hue = opts.reduceFlash ? 185 : (185 + Math.sin(t * 8) * 40);
    ctx.fillStyle = `hsla(${hue},100%,60%,0.35)`;
    ctx.fillRect(p.x - w * 2.2, top, w * 4.4, bottom - top);
    ctx.fillStyle = `hsla(${hue},100%,70%,0.8)`;
    ctx.fillRect(p.x - w, top, w * 2, bottom - top);
    ctx.fillStyle = '#fff';
    ctx.fillRect(p.x - w * 0.35, top, w * 0.7, bottom - top);
    drawGlow('#3dfcff', p.x, bottom, w * 4, 1);
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawFx() {
    ctx.globalCompositeOperation = 'lighter';
    for (const q of particles) {
      const a = clamp(q.life / q.max, 0, 1);
      drawGlow(q.color, q.x, q.y, q.s * (0.5 + a), a);
    }
    for (const r of rings) {
      ctx.globalAlpha = clamp(r.life * 2.5, 0, 1);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 4 * U;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of texts) {
      ctx.globalAlpha = clamp(t.life * 1.5, 0, 1);
      ctx.font = `900 ${Math.round(t.size)}px "Trebuchet MS", sans-serif`;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,0,40,0.8)';
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function bar(x, y, w, h, frac, c1, c2, label) {
    ctx.fillStyle = 'rgba(10,0,30,0.65)';
    roundRect(x - 2, y - 2, w + 4, h + 4, (h + 4) / 2); ctx.fill();
    if (frac > 0) {
      const grd = ctx.createLinearGradient(x, 0, x + w, 0);
      grd.addColorStop(0, c1); grd.addColorStop(1, c2);
      ctx.fillStyle = grd;
      roundRect(x, y, Math.max(h, w * frac), h, h / 2); ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.font = `900 ${Math.round(h * 0.8)}px "Trebuchet MS", sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 6, y + h / 2 + 1);
  }

  function drawHud(t) {
    const g = game, p = player;
    const top = safeTop + 12;
    const bw = Math.min(170 * U, W * 0.42), bh = 14 * U;
    const low = p.hp < p.maxHp * 0.3;
    const hpPulse = low && !opts.reduceFlash && Math.floor(t * 6) % 2 === 0;
    bar(12, top, bw, bh, p.hp / p.maxHp, hpPulse ? '#ffffff' : '#ff4d6d', low ? '#ff4d6d' : '#7dff6a', `HP ${Math.ceil(p.hp)}`);
    let y = top + bh + 8;
    if (p.shieldOn) {
      bar(12, y, bw, bh * 0.8, p.shield / p.maxShield, '#4d7dff', '#3dfcff', `SHIELD`);
      y += bh * 0.8 + 8;
    }
    // level progress
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(12, y, bw, 4 * U);
    ctx.fillStyle = `hsl(${(t * 120) % 360},100%,65%)`;
    ctx.fillRect(12, y, bw * (g.levelT / LEVEL_TIME), 4 * U);
    ctx.font = `900 ${Math.round(12 * U)}px "Trebuchet MS", sans-serif`;
    ctx.fillStyle = '#ffe14d';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    let tags = 'LV ' + g.level;
    if (p.regen) tags += '  ✚REGEN';
    if (p.pod) tags += '  ➶POD';
    ctx.fillText(tags, 12, y + 8 * U);

    // score (right side, leaving room for the pause button)
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.font = `900 ${Math.round(24 * U)}px "Trebuchet MS", sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#ff3df2'; ctx.shadowBlur = 10;
    ctx.fillText(g.score.toLocaleString(), W - 66, top - 2);
    ctx.shadowBlur = 0;
    const cm = Math.floor(g.combo);
    if (cm > 1) {
      ctx.font = `900 ${Math.round((16 + cm) * U)}px "Trebuchet MS", sans-serif`;
      ctx.fillStyle = opts.reduceFlash ? '#ffe14d' : `hsl(${(t * 400) % 360},100%,65%)`;
      ctx.fillText('x' + cm + ' COMBO', W - 66, top + 26 * U);
    }

    // weapon panel bottom-left
    const by = H - safeBottom - 14;
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    const wdef = WEAPONS[p.weapon];
    ctx.font = `900 ${Math.round(14 * U)}px "Trebuchet MS", sans-serif`;
    ctx.fillStyle = wdef.color;
    let wl = wdef.name + (p.twin && p.weapon !== 'laser' ? ' x2' : '');
    if (p.weapon !== 'blaster') wl += ' ' + Math.ceil(p.weaponT) + 's';
    ctx.fillText(wl, 12, by);
    if (p.missiles > 0) {
      ctx.fillStyle = '#ff4d6d';
      ctx.fillText('MISSILES ' + p.missiles, 12, by - 18 * U);
    }
  }

  function drawBanner() {
    if (!banner) return;
    const b = banner, t = b.t;
    const inA = clamp(t * 4, 0, 1), outA = clamp((2.6 - t) * 3, 0, 1), a = Math.min(inA, outA);
    const scale = 1 + (1 - inA) * 1.5;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(W / 2, H * 0.4);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.round(48 * U)}px "Trebuchet MS", sans-serif`;
    ctx.shadowColor = b.color; ctx.shadowBlur = 25;
    ctx.fillStyle = '#fff';
    ctx.fillText(b.title, 0, 0);
    if (b.subtitle) {
      ctx.font = `900 ${Math.round(22 * U)}px "Trebuchet MS", sans-serif`;
      ctx.fillStyle = b.color;
      ctx.fillText('★ ' + b.subtitle + ' ★', 0, 42 * U);
    }
    ctx.restore();
  }

  function render(t) {
    const g = game;
    ctx.save();
    if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));
    drawBackground(t, g ? g.warp : 1);
    if (g) {
      for (const pk of pickups) drawPickup(pk, t);
      for (const r of rocks) drawRock(r);
      drawLaser(t);
      drawBullets();
      if (player.alive) drawCapy(player, t);
      drawFx();
    }
    ctx.restore();
    if (flash > 0) {
      ctx.globalAlpha = Math.min(0.85, flash);
      ctx.fillStyle = flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    if (g && state !== 'menu') {
      drawBanner();
      drawHud(t);
    }
  }

  // ---------------------------------------------------------------- menu demo capy
  function menuTick(dt) {
    time += dt;
    updateBackground(dt, 1.5);
  }
  function renderMenu(t) {
    drawBackground(t, 1.5);
    const fake = { x: W / 2 + Math.sin(t * 1.3) * W * 0.3, y: H - safeBottom - 60 * U + Math.sin(t * 2.1) * 8, r: 24 * U, tilt: Math.cos(t * 1.3) * 0.3, inv: 0, shieldOn: false };
    drawCapy(fake, t);
  }

  // ---------------------------------------------------------------- loop
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state === 'play') { update(dt); render(time); }
    else if (state === 'menu') { menuTick(dt); renderMenu(time); }
    else render(time); // paused / over — frozen scene
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- UI wiring
  const ui = {
    menu: $('menu'), pause: $('pause'), over: $('over'), pauseBtn: $('pauseBtn'),
  };
  function show(el, on) { el.classList.toggle('hidden', !on); }

  function startGame() {
    Snd.init();
    Snd.startMusic();
    newGame();
    state = 'play';
    show(ui.menu, false); show(ui.over, false); show(ui.pause, false); show(ui.pauseBtn, true);
    showBanner('GO GO CAPY!', 'DODGE THE DEBRIS', '#ff3df2');
    drag = null;
  }
  function gameOver() {
    state = 'over';
    Snd.stopMusic();
    const s = game.score;
    const isBest = s > best;
    if (isBest) { best = s; store.set('best', best); }
    $('finalScore').textContent = s.toLocaleString();
    $('finalLevel').textContent = game.level;
    $('bestOver').textContent = best.toLocaleString();
    show($('newBest'), isBest && s > 0);
    show(ui.pauseBtn, false);
    show(ui.over, true);
  }
  function pauseGame() {
    if (state !== 'play') return;
    state = 'pause';
    Snd.stopMusic();
    show(ui.pause, true);
    show(ui.pauseBtn, false);
  }
  function resumeGame() {
    if (state !== 'pause') return;
    state = 'play';
    last = performance.now();
    Snd.init();
    Snd.startMusic();
    show(ui.pause, false);
    show(ui.pauseBtn, true);
  }
  function toMenu() {
    state = 'menu';
    game = null;
    Snd.stopMusic();
    $('bestMenu').textContent = best.toLocaleString();
    show(ui.over, false); show(ui.pause, false); show(ui.pauseBtn, false); show(ui.menu, true);
  }

  $('startBtn').addEventListener('click', startGame);
  $('retryBtn').addEventListener('click', startGame);
  $('menuBtn').addEventListener('click', toMenu);
  $('quitBtn').addEventListener('click', toMenu);
  $('resumeBtn').addEventListener('click', resumeGame);
  ui.pauseBtn.addEventListener('click', pauseGame);
  $('bestMenu').textContent = best.toLocaleString();

  const optSound = $('optSound'), optFlash = $('optFlash');
  optSound.checked = opts.sound;
  optFlash.checked = opts.reduceFlash;
  optSound.addEventListener('change', () => { opts.sound = optSound.checked; store.set('sound', opts.sound); Snd.setOn(opts.sound); });
  optFlash.addEventListener('change', () => { opts.reduceFlash = optFlash.checked; store.set('reduceFlash', opts.reduceFlash); });
  if (!store.get('reduceFlash', null) && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    opts.reduceFlash = true; optFlash.checked = true;
  }

  // relative-drag touch controls: the capy moves with your finger's motion,
  // so your thumb never covers it.
  const SENS = 1.35;
  cvs.addEventListener('pointerdown', (e) => {
    if (state !== 'play' || !player) return;
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, px: player.tx, py: player.ty };
    try { cvs.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
  });
  cvs.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId || !player) return;
    player.tx = drag.px + (e.clientX - drag.sx) * SENS;
    player.ty = drag.py + (e.clientY - drag.sy) * SENS;
    // re-anchor when clamped so reversing direction responds immediately
    const cx = clamp(player.tx, player.r, W - player.r);
    if (cx !== player.tx) { drag.px = cx; drag.sx = e.clientX; player.tx = cx; }
    e.preventDefault();
  });
  const endDrag = (e) => { if (drag && drag.id === e.pointerId) drag = null; };
  cvs.addEventListener('pointerup', endDrag);
  cvs.addEventListener('pointercancel', endDrag);

  window.addEventListener('keydown', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'p' || k === 'Escape') { state === 'play' ? pauseGame() : resumeGame(); return; }
    if ((k === 'Enter' || k === ' ') && (state === 'menu' || state === 'over')) { startGame(); e.preventDefault(); return; }
    keys.add(k);
    if (k.startsWith('Arrow') || k === ' ') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
  window.addEventListener('blur', () => keys.clear());

  function readSafe() {
    const cs = getComputedStyle($('safe'));
    safeTop = parseFloat(cs.paddingTop) || 0;
    safeBottom = parseFloat(cs.paddingBottom) || 0;
  }
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    const oldW = W, oldH = H;
    W = window.innerWidth; H = window.innerHeight;
    U = clamp(Math.min(W, H * 0.6) / 400, 0.75, 1.5);
    cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR);
    cvs.style.width = W + 'px'; cvs.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    readSafe();
    buildNebula();
    initStars();
    if (player && oldW) {
      const sx = W / oldW, sy = H / oldH;
      player.x *= sx; player.tx *= sx; player.y *= sy; player.ty *= sy;
      player.r = 22 * U;
    }
  }
  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);

  // offline / installable support
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  // test hook (harmless in production)
  window.__capyx = { get state() { return state; }, get game() { return game; }, get player() { return player; }, levelUp: () => levelUp(), hurt: (d) => hurtPlayer(d), spawnPickup: (t) => spawnPickup(t, player.x, player.y - 60) };
})();
