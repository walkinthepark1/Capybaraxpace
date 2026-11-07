/* Capybara Xpace — a neon space-survival game for phones.
 * Plain Canvas 2D + Web Audio, no dependencies. */
'use strict';
(() => {
  // ---------------------------------------------------------------- setup
  const cvs = document.getElementById('game');
  let ctx = cvs.getContext('2d');   // swapped temporarily to draw closet previews
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

  // Gamertags: no account, just a name saved on this device next to a local leaderboard.
  const TAG_ADJ = ['COSMIC', 'TURBO', 'ASTRO', 'HYPER', 'LASER', 'ROCKET', 'STAR', 'COMET', 'NEON', 'MEGA', 'NOVA', 'ZOOM', 'CHILL', 'SPACE'];
  const TAG_NOUN = ['CAPY', 'BARA', 'CHONK', 'PILOT', 'ACE', 'BEAN', 'NUGGET', 'POTATO', 'RIDER', 'BUN'];
  const cleanTag = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 12);
  function randomTag() {
    for (;;) { const t = pick(TAG_ADJ) + pick(TAG_NOUN) + randi(1, 99); if (t.length <= 12) return t; }
  }
  let tag = cleanTag(store.get('tag', ''));
  function loadBoard() {
    const b = store.get('board', []);
    return Array.isArray(b) ? b.filter((e) => e && typeof e.score === 'number').slice(0, 10) : [];
  }
  function addScore(entry) {      // returns the entry's rank index, or -1 if outside the top 10
    const b = loadBoard();
    b.push(entry);
    b.sort((a, c) => c.score - a.score);
    const top = b.slice(0, 10);
    store.set('board', top);
    return top.indexOf(entry);
  }

  // Capy Closet: cosmetic gear. [id, name, level needed]; higher levels unlock rarer items.
  const GEAR = {
    outfit: { label: 'OUTFITS', items: [['none', 'Fur Only', 1], ['tracksuit', '80s Tracksuit', 1], ['hawaiian', 'Aloha Shirt', 1], ['disco', 'Disco Suit', 3], ['leather', 'Biker Jacket', 5], ['tuxedo', 'Tuxedo', 7]] },
    eyes:   { label: 'SHADES',  items: [['none', 'No Shades', 1], ['aviators', 'Aviators', 1], ['pixel', 'Pixel Shades', 1], ['hearts', 'Heart Specs', 2], ['stars', 'Star Specs', 4], ['3d', '3D Glasses', 6]] },
    neck:   { label: 'BLING',   items: [['none', 'No Bling', 1], ['chain', 'Gold Chain', 1], ['bowtie', 'Bow Tie', 1], ['bandana', 'Bandana', 2], ['pearls', 'Pearls', 4], ['lei', 'Flower Lei', 6]] },
    head:   { label: 'HAIR & HATS', items: [['none', 'Natural', 1], ['sweatband', 'Sweatband', 1], ['cap', 'Retro Cap', 2], ['afro', 'Afro', 3], ['mohawk', 'Neon Mohawk', 5], ['crown', 'Crown', 8]] },
    jet:    { label: 'JETPACK', items: [['blue', 'Blue', 1], ['pink', 'Hot Pink', 1], ['lime', 'Lime', 1], ['black', 'Stealth', 4], ['gold', 'Solid Gold', 6], ['rainbow', 'Rainbow', 8]] },
  };
  let maxLevel = Math.max(1, Number(store.get('maxLevel', 1)) || 1);
  const DEFAULT_LOOK = { outfit: 'none', eyes: 'none', neck: 'none', head: 'none', jet: 'blue' };
  function sanitizeLook(l) {
    const o = { ...DEFAULT_LOOK };
    if (l && typeof l === 'object') {
      for (const k in GEAR) if (GEAR[k].items.some(([id, , lv]) => id === l[k] && lv <= maxLevel)) o[k] = l[k];
    }
    return o;
  }
  let myLook = sanitizeLook(store.get('look', null));
  function gearUnlockedAt(lv) {
    const out = [];
    for (const k in GEAR) for (const [, name, need] of GEAR[k].items) if (need === lv) out.push(name);
    return out;
  }

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
  // Everything is synthesized live with Web Audio: no sound files.
  // Chain: voices -> [stereo pan] -> sfx/music bus -> master -> compressor -> speakers,
  // with a filtered "space echo" send for the big moments.
  const Snd = {
    ac: null, master: null, sfx: null, music: null, echoIn: null, noiseBuf: null, curve: null,
    last: {}, boomLog: [], beam: null, musicTimer: null, step: 0, nextTime: 0,
    init() {
      if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ac = this.ac = new AC();
      this.master = ac.createGain();
      this.master.gain.value = opts.sound ? 0.6 : 0;
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 6;
      comp.attack.value = 0.003; comp.release.value = 0.25;
      this.master.connect(comp); comp.connect(ac.destination);
      this.sfx = ac.createGain(); this.sfx.connect(this.master);
      this.music = ac.createGain(); this.music.gain.value = 0.65; this.music.connect(this.master);
      // space echo
      const d = ac.createDelay(1), fb = ac.createGain(), lp = ac.createBiquadFilter();
      d.delayTime.value = 0.19; fb.gain.value = 0.33; lp.type = 'lowpass'; lp.frequency.value = 2200;
      this.echoIn = ac.createGain();
      this.echoIn.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(this.sfx);
      // 2s of white noise, reused by every noise voice
      const len = ac.sampleRate * 2;
      this.noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
      const nd = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;
      // soft-clip curve for crunchy distortion
      this.curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) this.curve[i] = Math.tanh((i / 1023 * 2 - 1) * 4);
    },
    setOn(on) { if (this.master) this.master.gain.value = on ? 0.6 : 0; if (!on) this.beamOff(true); },
    // true if sound may play now; with a key, also rate-limits that sound to one per `gap` seconds
    ok(key, gap) {
      if (!this.ac || !opts.sound) return false;
      if (key) {
        const now = this.ac.currentTime;
        if (now - (this.last[key] || 0) < gap) return false;
        this.last[key] = now;
      }
      return true;
    },
    panX(x) { return x === undefined || !W ? 0 : clamp((x / W) * 2 - 1, -1, 1) * 0.7; },
    out(node, pan, echo, bus) {
      let n = node;
      if (pan && this.ac.createStereoPanner) {
        const p = this.ac.createStereoPanner();
        p.pan.value = clamp(pan, -1, 1);
        n.connect(p); n = p;
      }
      n.connect(bus || this.sfx);
      if (echo) { const s = this.ac.createGain(); s.gain.value = echo; n.connect(s); s.connect(this.echoIn); }
    },
    env(g, t, vol, attack, dur) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, attack + 0.01));
    },
    shape(n) { const ws = this.ac.createWaveShaper(); ws.curve = this.curve; n.connect(ws); return ws; },
    // pitched voice: {type, freq, to, slide, dur, vol, attack, when, pan, echo, dist, detune, bus}
    voice(o) {
      const ac = this.ac, t = ac.currentTime + (o.when || 0), dur = o.dur;
      const osc = ac.createOscillator();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.freq, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + (o.slide || dur));
      if (o.detune) osc.detune.value = o.detune;
      const n = o.dist ? this.shape(osc) : osc;
      const g = ac.createGain();
      this.env(g, t, o.vol || 0.1, o.attack || 0.004, dur);
      n.connect(g);
      this.out(g, o.pan, o.echo, o.bus);
      osc.start(t); osc.stop(t + dur + 0.05);
    },
    // filtered noise voice: {type, f0, f1, q, dur, vol, attack, when, pan, echo, dist, bus}
    hiss(o) {
      const ac = this.ac, t = ac.currentTime + (o.when || 0), dur = o.dur;
      const s = ac.createBufferSource();
      s.buffer = this.noiseBuf;
      const f = ac.createBiquadFilter();
      f.type = o.type || 'lowpass';
      f.Q.value = o.q || 1;
      f.frequency.setValueAtTime(o.f0 || 2000, t);
      if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
      s.connect(f);
      const n = o.dist ? this.shape(f) : f;
      const g = ac.createGain();
      this.env(g, t, o.vol || 0.2, o.attack || 0.003, dur);
      n.connect(g);
      this.out(g, o.pan, o.echo, o.bus);
      s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    },

    // ---- weapons
    shoot(kind, x) {
      const pan = this.panX(x);
      if (kind === 'spread') {
        if (!this.ok('shot', 0.09)) return;
        this.voice({ type: 'sawtooth', freq: 1400, to: 180, dur: 0.14, vol: 0.05, pan });
        this.voice({ type: 'sawtooth', freq: 1420, to: 190, dur: 0.14, vol: 0.04, pan, detune: 15 });
        this.hiss({ type: 'bandpass', f0: 5000, f1: 800, q: 3, dur: 0.08, vol: 0.05, pan });
      } else if (kind === 'rapid') {
        if (!this.ok('shot', 0.055)) return;
        this.voice({ type: 'triangle', freq: rand(2200, 2600), to: 700, dur: 0.06, vol: 0.07, pan });
        this.hiss({ type: 'highpass', f0: 6000, dur: 0.02, vol: 0.03, pan });
      } else {
        if (!this.ok('shot', 0.08)) return;
        const f = rand(1500, 1800);                         // classic "pew", slightly varied
        this.voice({ type: 'square', freq: f, to: f * 0.18, dur: 0.11, vol: 0.045, pan });
        this.voice({ type: 'sine', freq: f / 2, to: f * 0.1, dur: 0.11, vol: 0.06, pan });
      }
    },
    // Mega Laser: one sustained, wobbling beam sound while it's held on
    beamOn(x) {
      if (!this.ok()) return;
      const ac = this.ac;
      if (!this.beam) {
        const t = ac.currentTime;
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.14, t + 0.08);
        const f = ac.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 1400; f.Q.value = 8;
        const lfo = ac.createOscillator(), lg = ac.createGain();
        lfo.frequency.value = 9; lg.gain.value = 700;
        lfo.connect(lg); lg.connect(f.frequency);
        const mk = (type, freq) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = freq; o.connect(f); return o; };
        const o1 = mk('sawtooth', 110), o2 = mk('sawtooth', 111.4), o3 = mk('square', 55);
        const whine = ac.createOscillator(), wg = ac.createGain(), vib = ac.createOscillator(), vg = ac.createGain();
        whine.frequency.value = 1760; wg.gain.value = 0.18;
        vib.frequency.value = 6; vg.gain.value = 30;
        vib.connect(vg); vg.connect(whine.frequency);
        whine.connect(wg); wg.connect(g);
        f.connect(g);
        let pan = null, n = g;
        if (ac.createStereoPanner) { pan = ac.createStereoPanner(); g.connect(pan); n = pan; }
        n.connect(this.sfx);
        const send = ac.createGain(); send.gain.value = 0.2; n.connect(send); send.connect(this.echoIn);
        const nodes = [o1, o2, o3, lfo, whine, vib];
        nodes.forEach((o) => o.start(t));
        this.beam = { g, pan, nodes };
        this.voice({ type: 'sawtooth', freq: 200, to: 2400, dur: 0.25, vol: 0.08, echo: 0.3 }); // charge-up zap
      }
      if (this.beam.pan) this.beam.pan.pan.setTargetAtTime(this.panX(x), ac.currentTime, 0.05);
    },
    beamOff(silent) {
      if (!this.beam || !this.ac) return;
      const t = this.ac.currentTime, b = this.beam;
      this.beam = null;
      b.g.gain.cancelScheduledValues(t);
      b.g.gain.setValueAtTime(Math.max(0.0001, b.g.gain.value), t);
      b.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      b.nodes.forEach((o) => o.stop(t + 0.2));
      if (!silent && this.ok()) this.voice({ type: 'sawtooth', freq: 900, to: 60, dur: 0.3, vol: 0.05 }); // power-down
    },
    sizzle(x) {
      if (!this.ok('sizzle', 0.07)) return;
      this.hiss({ type: 'highpass', f0: rand(4000, 8000), dur: 0.06, vol: 0.06, pan: this.panX(x) });
      this.voice({ type: 'square', freq: rand(80, 140), dur: 0.05, vol: 0.03 });
    },
    missile(x) {
      if (!this.ok('missile', 0.06)) return;
      const pan = this.panX(x);
      this.hiss({ type: 'bandpass', f0: 500, f1: 4000, q: 2, dur: 0.35, vol: 0.12, attack: 0.05, pan });
      this.voice({ type: 'sawtooth', freq: 140, to: 700, dur: 0.3, vol: 0.05, pan });
    },
    missileBoom(x) {
      this.boom(2, x);
      if (this.ok('mping', 0.05)) this.voice({ type: 'triangle', freq: 880, to: 440, dur: 0.2, vol: 0.06, pan: this.panX(x), echo: 0.4 });
    },

    // ---- explosions: sub thump + rumbling body + crunch + flying-debris crackles
    boom(size, x) {
      if (!this.ok()) return;
      const now = this.ac.currentTime;
      this.boomLog = this.boomLog.filter((t) => now - t < 0.15);
      if (this.boomLog.length >= 4 && size < 3) return;     // voice limit so chain reactions don't clip
      this.boomLog.push(now);
      const pan = this.panX(x), k = size / 3, p = rand(0.85, 1.15);
      this.voice({ type: 'sine', freq: 160 * p, to: 32, dur: 0.25 + k * 0.6, vol: 0.18 + k * 0.42, pan });
      this.hiss({ type: 'lowpass', f0: (2500 + k * 2500) * p, f1: 90, dur: 0.3 + k * 0.9, vol: 0.14 + k * 0.38, pan, echo: k * 0.5, dist: size >= 3 });
      this.hiss({ type: 'bandpass', f0: 1200 * p, f1: 300, q: 0.8, dur: 0.15 + k * 0.2, vol: 0.15, pan });
      if (size >= 2) {
        for (let i = 0; i < size * 2; i++) {
          this.hiss({ type: 'highpass', f0: rand(3000, 7000), dur: rand(0.02, 0.05), vol: rand(0.04, 0.09), when: rand(0.05, 0.35), pan: pan + rand(-0.3, 0.3) });
        }
      }
    },
    nova() {
      if (!this.ok()) return;
      // reverse swell...
      this.hiss({ type: 'lowpass', f0: 300, f1: 8000, dur: 0.35, attack: 0.3, vol: 0.25 });
      this.voice({ type: 'sawtooth', freq: 60, to: 1200, dur: 0.35, attack: 0.3, vol: 0.06 });
      // ...then the biggest bang in the game
      this.voice({ type: 'sine', freq: 120, to: 25, dur: 1.6, vol: 0.5, when: 0.35 });
      this.hiss({ type: 'lowpass', f0: 6000, f1: 60, dur: 1.8, vol: 0.5, when: 0.35, dist: true, echo: 0.6 });
      this.voice({ type: 'sawtooth', freq: 1500, to: 40, dur: 1.2, vol: 0.08, when: 0.35, echo: 0.5 });
    },

    // ---- the capybara
    squeak(when = 0) {
      if (!this.ok()) return;
      this.voice({ type: 'sine', freq: 1100, to: 1900, slide: 0.06, dur: 0.14, vol: 0.12, when });
      this.voice({ type: 'sine', freq: 1900, to: 900, dur: 0.12, vol: 0.1, when: when + 0.07 });
    },
    hit() {
      if (!this.ok()) return;
      this.voice({ type: 'square', freq: 240, to: 50, dur: 0.35, vol: 0.18, dist: true });
      this.hiss({ type: 'lowpass', f0: 1800, f1: 100, dur: 0.3, vol: 0.3 });
      this.squeak(0.05);
    },
    shieldHit() {
      if (!this.ok()) return;
      this.voice({ type: 'triangle', freq: 700, to: 1800, dur: 0.3, vol: 0.08, echo: 0.5 });
      this.voice({ type: 'sine', freq: 2400, to: 3200, dur: 0.2, vol: 0.05, echo: 0.5 });
      this.hiss({ type: 'highpass', f0: 5000, dur: 0.12, vol: 0.06 });
    },
    over() {
      if (!this.ok()) return;                               // sad trombone "womp womp womp"
      [[392, 370, 0.3], [349, 330, 0.3], [311, 233, 0.8]].forEach(([a, b, d], i) =>
        this.voice({ type: 'triangle', freq: a, to: b, dur: d, vol: 0.14, when: 0.5 + i * 0.34, echo: 0.2 }));
    },

    alarm() {
      if (!this.ok('alarm', 1)) return;                     // two-tone warning siren
      [0, 0.22, 0.44, 0.66].forEach((w, i) => this.voice({ type: 'square', freq: i % 2 ? 660 : 880, dur: 0.2, vol: 0.05, when: w, echo: 0.2 }));
    },

    // ---- rewards
    pickup() {
      if (!this.ok()) return;
      [880, 1109, 1319, 1760].forEach((f, i) => this.voice({ type: 'triangle', freq: f, dur: 0.14, vol: 0.12, when: i * 0.045, echo: 0.3 }));
      this.hiss({ type: 'highpass', f0: 8000, dur: 0.25, vol: 0.03, attack: 0.05 });
    },
    power() {
      if (!this.ok()) return;
      this.voice({ type: 'sawtooth', freq: 150, to: 1500, dur: 0.4, vol: 0.07, echo: 0.3 });
      [523, 659, 784, 1047].forEach((f) => this.voice({ type: 'square', freq: f, dur: 0.35, vol: 0.03, when: 0.3 }));
      this.squeak(0.45);
    },
    combo(n) {
      if (!this.ok('combo', 0.05)) return;                  // pitch climbs with the multiplier
      const f = 440 * Math.pow(2, (n * 2) / 12);
      this.voice({ type: 'square', freq: f, dur: 0.07, vol: 0.035 });
      this.voice({ type: 'square', freq: f * 1.5, dur: 0.07, vol: 0.03, when: 0.05 });
    },
    whoosh(fromLeft) {
      if (!this.ok('whoosh', 0.3)) return;                  // comet fly-by
      this.hiss({ type: 'bandpass', f0: 300, f1: 2500, q: 3, dur: 0.9, attack: 0.35, vol: 0.14, pan: fromLeft ? -0.8 : 0.8, echo: 0.3 });
    },
    level() {
      if (!this.ok()) return;
      [523, 659, 784, 1047, 1319].forEach((f, i) => this.voice({ type: 'square', freq: f, dur: 0.2, vol: 0.05, when: i * 0.08, echo: 0.3 }));
      [1047, 1319, 1568].forEach((f) => this.voice({ type: 'sawtooth', freq: f, dur: 0.7, vol: 0.035, when: 0.42, echo: 0.4 }));
      this.hiss({ type: 'bandpass', f0: 200, f1: 6000, q: 1.5, dur: 1.4, attack: 0.6, vol: 0.12 }); // warp
    },

    // music helpers (routed to the music bus)
    tone(freq, dur, type, vol, slide = 0, when = 0) {
      this.voice({ type, freq, to: slide || undefined, dur, vol, when, bus: this.music });
    },
    noise(dur, vol, freq, when = 0) {
      this.hiss({ type: 'lowpass', f0: freq, f1: 80, dur, vol, when, bus: this.music });
    },

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
      warp: 1, warpT: 0, survivalAcc: 0, showerT: 0, showerSpawn: 0, showerDone: false, newGear: [],
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
    const d = game.level - 1;  // difficulty steps past level 1
    const sizes = { 3: 46, 2: 28, 1: 16 };
    const r = sizes[size] * U * rand(0.9, 1.1);
    const speedMul = Math.min(2.6, 1 + d * 0.12 + Math.max(0, d - 5) * 0.05);
    const hue = pick([280, 320, 20, 190, 45, 260]);
    rocks.push({
      kind: 'rock', size, r,
      x: x !== undefined ? x : rand(r, W - r),
      y: y !== undefined ? y : -r,
      vx: vx !== undefined ? vx : rand(-0.06, 0.06) * W,
      vy: vy !== undefined ? vy : rand(0.13, 0.24) * H * speedMul * (size === 3 ? 0.8 : 1),
      rot: rand(0, TAU), vr: rand(-2, 2),
      hp: [0, 1, 3, 7][size] + Math.floor(d / 2) * size,
      pts: makeShape(randi(8, 12), 0.35),
      craters: Array.from({ length: size + 1 }, () => [rand(-0.5, 0.5), rand(-0.5, 0.5), rand(0.12, 0.25)]),
      hue, hitT: 0,
    });
  }

  function spawnDebris() {
    const d = game.level - 1, r = rand(14, 22) * U, x = rand(r, W - r);
    const vy = rand(0.28, 0.38) * H * Math.min(2.4, 1 + d * 0.1);
    let vx = rand(-0.1, 0.1) * W;
    // from level 4, more and more debris is thrown straight at the capybara
    if (d >= 3 && player && Math.random() < Math.min(0.7, 0.2 + d * 0.06)) vx = (player.x - x) / ((player.y + r) / vy);
    rocks.push({
      kind: 'debris', size: 1, r, x, y: -r, vx, vy,
      rot: rand(0, TAU), vr: rand(-6, 6), hp: 2 + Math.floor(d / 3), hitT: 0,
      w: rand(1.2, 1.8), color: pick(['#c0c8ff', '#ffd0a0', '#a0ffe8']),
    });
  }

  function spawnComet() {
    const fromLeft = Math.random() < 0.5, r = 12 * U;
    rocks.push({
      kind: 'comet', size: 1, r,
      x: fromLeft ? -r : W + r, y: rand(-H * 0.1, H * 0.35),
      vx: (fromLeft ? 1 : -1) * rand(0.35, 0.55) * W * (1 + (game.level - 1) * 0.05), vy: rand(0.35, 0.5) * H * (1 + (game.level - 1) * 0.05),
      rot: 0, vr: 0, hp: 1, hitT: 0, color: pick(['#3dfcff', '#ff8a3d', '#7dff6a']),
    });
    Snd.whoosh(fromLeft);
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
    Snd.missile(player.x);
  }

  function fireWeapon(dt) {
    const p = player;
    p.fireT -= dt;
    p.laserOn = p.weapon === 'laser';
    const bspd = -H * 1.3;
    if (p.weapon === 'laser') {
      // continuous beam — damage applied in updateLaser
      // its sustained hum is driven from update() via Snd.beamOn/beamOff
    } else if (p.fireT <= 0) {
      const mk = (x, vx, color, dmg = 1, r = 4) => bullets.push({ kind: 'shot', x, y: p.y - p.r, vx, vy: bspd, r: r * U, dmg, life: 1.5, color });
      if (p.weapon === 'blaster') {
        p.fireT = 0.17;
        if (p.twin) { mk(p.x - 10 * U, 0, '#ffe14d'); mk(p.x + 10 * U, 0, '#ffe14d'); }
        else mk(p.x, 0, '#ffe14d');
        Snd.shoot('blaster', p.x);
      } else if (p.weapon === 'rapid') {
        p.fireT = 0.065;
        mk(p.x + rand(-6, 6) * U, rand(-30, 30) * U, '#ff8a3d');
        if (p.twin) mk(p.x + rand(-12, 12) * U, rand(-30, 30) * U, '#ffe14d');
        Snd.shoot('rapid', p.x);
      } else if (p.weapon === 'spread') {
        p.fireT = 0.2;
        const n = p.twin ? 7 : 5;
        for (let i = 0; i < n; i++) {
          const a = (i / (n - 1) - 0.5) * 0.8;
          bullets.push({ kind: 'shot', x: p.x, y: p.y - p.r, vx: Math.sin(a) * -bspd, vy: Math.cos(a) * bspd, r: 5 * U, dmg: 1, life: 1.5, color: i % 2 ? '#ff3df2' : '#8a5cff' });
        }
        Snd.shoot('spread', p.x);
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
    Snd.boom(r.kind === 'comet' ? 2 : r.size, r.x);
    if (r.kind === 'rock' && r.size > 1) {
      for (let i = 0; i < 2; i++) {
        spawnRock(r.size - 1, r.x + rand(-5, 5), r.y, r.vx + (i ? 1 : -1) * rand(40, 110) * U, r.vy * rand(0.8, 1.1));
      }
    }
    if (noScore) return;
    const base = r.kind === 'comet' ? 150 : r.kind === 'debris' ? 75 : [0, 60, 40, 25][r.size];
    game.combo = Math.min(8, game.combo + 0.25);
    game.comboT = 1.6;
    if (Math.floor(game.combo) > 1) Snd.combo(Math.floor(game.combo));
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
    Snd.beamOff(true);
    Snd.boom(4, p.x);
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
    g.showerDone = false;
    g.showerT = 0;
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
    if (lv > maxLevel) {
      maxLevel = lv;
      store.set('maxLevel', lv);
      gearUnlockedAt(lv).forEach((name, i) => {
        g.newGear.push(name);
        addText(p.x, p.y - (70 + i * 24) * U, '🔓 ' + name.toUpperCase(), '#ffe14d', 16);
      });
    }
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
    updateShip(dt);

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
        const lv = g.level, d = lv - 1;
        // spawn gap shrinks 13% every level: L1 1.0s, L2 0.87s, L4 0.66s, L6 0.50s, L10 0.29s
        g.spawnT = Math.max(0.15, Math.pow(0.87, d)) * rand(0.6, 1.3);
        const roll = Math.random();
        if (lv >= 3 && roll < Math.min(0.16, 0.06 + d * 0.012)) spawnComet();
        else if (lv >= 2 && roll < Math.min(0.45, 0.24 + d * 0.025)) spawnDebris();
        else spawnRock(Math.random() < Math.min(0.5, 0.25 + d * 0.04) ? 3 : Math.random() < 0.5 ? 2 : 1);
        if (lv >= 3 && Math.random() < Math.min(0.5, d * 0.06)) spawnRock(Math.random() < 0.5 ? 2 : 1);
        if (lv >= 6 && Math.random() < Math.min(0.35, (d - 4) * 0.05)) spawnDebris();
      }
      // meteor shower halfway through every level from 3 on, longer and denser each time
      if (g.level >= 3 && !g.showerDone && g.levelT >= LEVEL_TIME * 0.45) {
        g.showerDone = true;
        g.showerT = Math.min(7, 3 + (g.level - 3) * 0.6);
        showBanner('METEOR SHOWER!', 'INCOMING', '#ff4d6d');
        doFlash('#ff4d6d', 0.3);
        Snd.alarm();
        buzz([40, 40, 40]);
      }
      if (g.showerT > 0) {
        g.showerT -= dt;
        g.showerSpawn -= dt;
        if (g.showerSpawn <= 0) {
          g.showerSpawn = Math.max(0.06, 0.16 - g.level * 0.008);
          spawnRock(Math.random() < 0.8 ? 1 : 2, undefined, undefined, rand(-0.12, 0.12) * W, rand(0.35, 0.5) * H * Math.min(2, 1 + (g.level - 1) * 0.06));
        }
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
            Snd.missileBoom(b.x);
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
          Snd.sizzle(r.x);
          r.laserAcc = (r.laserAcc || 0) + dt * 16;
          if (r.laserAcc >= 1) { const d = Math.floor(r.laserAcc); r.laserAcc -= d; damageRock(r, d, r.x, r.y + r.r * 0.6); }
          else r.hitT = 0.05;
        }
      }
    }

    if (p.alive && p.laserOn) Snd.beamOn(p.x); else Snd.beamOff();

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
          const dmg = Math.round((r.kind === 'comet' ? 25 : r.kind === 'debris' ? 15 : [0, 12, 20, 32][r.size]) * (1 + (game.level - 1) * 0.06));
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
  function drawCapy(p, t, look = myLook) {
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
    ctx.fillStyle = jetColor(look.jet, t);
    roundRect(-s * 0.75, s * 0.15, s * 1.5, s * 0.85, s * 0.2); ctx.fill();
    ctx.fillStyle = look.jet === 'gold' ? '#fff4c0' : '#3dfcff';
    ctx.fillRect(-s * 0.62, s * 0.78, s * 0.34, s * 0.2);
    ctx.fillRect(s * 0.28, s * 0.78, s * 0.34, s * 0.2);

    drawOutfit(s, look, t);
    // paws
    ctx.fillStyle = '#7a4524';
    ctx.beginPath(); ctx.ellipse(-s * 0.55, s * 0.5, s * 0.16, s * 0.12, 0.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.55, s * 0.5, s * 0.16, s * 0.12, -0.5, 0, TAU); ctx.fill();
    drawNeckGear(s, look.neck, t);
    if (look.head === 'afro') drawAfro(s);

    // head
    ctx.fillStyle = '#b97a45';
    roundRect(-s * 0.58, -s * 0.95, s * 1.16, s * 1.05, s * 0.45); ctx.fill();
    ctx.fillStyle = '#6e3d1f';
    ctx.beginPath(); ctx.arc(-s * 0.45, -s * 0.9, s * 0.14, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.45, -s * 0.9, s * 0.14, 0, TAU); ctx.fill();
    // snout
    ctx.fillStyle = '#8c5430';
    roundRect(-s * 0.4, -s * 0.38, s * 0.8, s * 0.45, s * 0.2); ctx.fill();
    ctx.fillStyle = '#2b140a';
    ctx.beginPath(); ctx.ellipse(-s * 0.15, -s * 0.25, s * 0.06, s * 0.04, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.15, -s * 0.25, s * 0.06, s * 0.04, 0, 0, TAU); ctx.fill();
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
    drawHeadGear(s, look.head, t);
    drawEyeGear(s, look.eyes, t);

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

  function jetColor(id, t) {
    if (id === 'rainbow') return `hsl(${(t * 90) % 360},90%,58%)`;
    return { blue: '#5a6cff', pink: '#ff3df2', lime: '#4ccf3a', black: '#2a2a3a', gold: '#ffc23d' }[id] || '#5a6cff';
  }

  function furV(s) {   // open collar showing the fur underneath
    ctx.fillStyle = '#c98a55';
    ctx.beginPath(); ctx.moveTo(-s * 0.24, -s * 0.05); ctx.lineTo(s * 0.24, -s * 0.05); ctx.lineTo(0, s * 0.42); ctx.closePath(); ctx.fill();
  }
  function flower(x, y, r, color) {
    ctx.fillStyle = color;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.5, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#fff6c0';
    ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, TAU); ctx.fill();
  }

  function drawOutfit(s, look, t) {
    const o = look.outfit;
    const bodyPath = () => { ctx.beginPath(); ctx.ellipse(0, s * 0.45, s * 0.68, s * 0.58, 0, 0, TAU); };
    const base = { none: '#a8683a', tracksuit: '#18c8c0', hawaiian: '#ff8a3d', disco: '#f6f2ff', leather: '#1d1b26', tuxedo: '#16161e' }[o] || '#a8683a';
    bodyPath();
    ctx.fillStyle = base;
    ctx.fill();
    if (o === 'none') {
      ctx.fillStyle = '#c98a55';
      ctx.beginPath(); ctx.ellipse(0, s * 0.55, s * 0.4, s * 0.35, 0, 0, TAU); ctx.fill();
      return;
    }
    ctx.save();
    bodyPath();
    ctx.clip();
    if (o === 'tracksuit') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-s * 0.64, -s * 0.2, s * 0.1, s * 1.4); ctx.fillRect(s * 0.54, -s * 0.2, s * 0.1, s * 1.4);
      ctx.fillStyle = '#8a3dff';
      ctx.fillRect(-s * 0.51, -s * 0.2, s * 0.06, s * 1.4); ctx.fillRect(s * 0.45, -s * 0.2, s * 0.06, s * 1.4);
      ctx.fillRect(-s * 0.7, -s * 0.2, s * 1.4, s * 0.22);                              // collar band
      ctx.strokeStyle = '#e8e8ff'; ctx.lineWidth = s * 0.04;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, s * 1.1); ctx.stroke();          // zipper
      ctx.fillStyle = '#e8e8ff'; ctx.fillRect(-s * 0.04, s * 0.18, s * 0.08, s * 0.12);
    } else if (o === 'hawaiian') {
      furV(s);
      [[-0.42, 0.3, '#ff3df2'], [0.38, 0.22, '#ffe14d'], [-0.12, 0.72, '#ffe14d'], [0.36, 0.72, '#ff3df2'], [-0.5, 0.82, '#8a5cff'], [0.1, 0.98, '#ff3df2']]
        .forEach(([x, y, c]) => {
          ctx.fillStyle = '#2fbf5f';
          ctx.beginPath(); ctx.ellipse((x + 0.12) * s, (y + 0.08) * s, s * 0.11, s * 0.05, 0.6, 0, TAU); ctx.fill();
          flower(x * s, y * s, s * 0.13, c);
        });
    } else if (o === 'disco') {
      furV(s);
      ctx.globalCompositeOperation = 'lighter';                                          // flashing sequins
      for (let i = 0; i < 9; i++) {
        const x = Math.sin(i * 2.4) * 0.5 * s, y = (0.25 + (i % 5) * 0.17) * s;
        const tw = 0.5 + 0.5 * Math.sin(t * 6 + i * 1.7);
        drawGlow(`hsl(${(i * 40 + t * 120) % 360},100%,65%)`, x, y, s * (0.08 + tw * 0.08), 0.9);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#d8c8ff';                                                         // belt + buckle
      ctx.fillRect(-s * 0.7, s * 0.8, s * 1.4, s * 0.1);
      ctx.fillStyle = '#ffd84d'; ctx.fillRect(-s * 0.1, s * 0.78, s * 0.2, s * 0.14);
    } else if (o === 'leather') {
      furV(s);
      ctx.strokeStyle = '#4a4760'; ctx.lineWidth = s * 0.06;
      ctx.beginPath(); ctx.moveTo(-s * 0.24, -s * 0.05); ctx.lineTo(-s * 0.36, s * 0.6); ctx.moveTo(s * 0.24, -s * 0.05); ctx.lineTo(s * 0.36, s * 0.6); ctx.stroke();
      ctx.strokeStyle = '#c9ccd8'; ctx.lineWidth = s * 0.035;
      ctx.beginPath(); ctx.moveTo(s * 0.2, s * 0.35); ctx.lineTo(-s * 0.15, s * 1.05); ctx.stroke();   // diagonal zip
      ctx.fillStyle = '#d8dbe6';
      [[-0.5, 0.15], [-0.4, 0.05], [0.5, 0.15], [0.4, 0.05], [-0.56, 0.28], [0.56, 0.28]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x * s, y * s, s * 0.035, 0, TAU); ctx.fill(); });
    } else if (o === 'tuxedo') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(-s * 0.26, -s * 0.15); ctx.lineTo(s * 0.26, -s * 0.15); ctx.lineTo(s * 0.06, s * 1.1); ctx.lineTo(-s * 0.06, s * 1.1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#16161e';
      [0.45, 0.62, 0.79].forEach((y) => { ctx.beginPath(); ctx.arc(0, y * s, s * 0.035, 0, TAU); ctx.fill(); });
      ctx.fillStyle = '#ff3df2';                                                         // pocket square
      ctx.beginPath(); ctx.moveTo(-s * 0.48, s * 0.38); ctx.lineTo(-s * 0.32, s * 0.38); ctx.lineTo(-s * 0.4, s * 0.28); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    if (o === 'disco') {                                                                 // giant 70s collar
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#b9a8e8'; ctx.lineWidth = s * 0.03;
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(side * s * 0.12, s * 0.02); ctx.lineTo(side * s * 0.72, s * 0.08); ctx.lineTo(side * s * 0.26, s * 0.38); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    if (o === 'tuxedo' && look.neck === 'none') {                                        // tux comes with a bow tie
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.moveTo(0, s * 0.16); ctx.lineTo(-s * 0.2, s * 0.06); ctx.lineTo(-s * 0.2, s * 0.26); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, s * 0.16); ctx.lineTo(s * 0.2, s * 0.06); ctx.lineTo(s * 0.2, s * 0.26); ctx.closePath(); ctx.fill();
    }
  }

  function alongNeck(n, rx, ry, cy, fn) {   // places n things along a hanging necklace curve
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.12 + 0.76 * (i / (n - 1)));
      fn(Math.cos(a) * rx, cy + Math.sin(a) * ry, a);
    }
  }
  function drawNeckGear(s, item, t) {
    if (item === 'chain') {
      alongNeck(13, s * 0.44, s * 0.36, s * 0.02, (x, y, a) => {
        ctx.fillStyle = '#ffd84d'; ctx.strokeStyle = '#a8740a'; ctx.lineWidth = s * 0.02;
        ctx.beginPath(); ctx.ellipse(x, y, s * 0.075, s * 0.05, a + Math.PI / 2, 0, TAU); ctx.fill(); ctx.stroke();
      });
      ctx.fillStyle = '#ffd84d'; ctx.strokeStyle = '#a8740a'; ctx.lineWidth = s * 0.035;
      ctx.beginPath(); ctx.arc(0, s * 0.5, s * 0.15, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#a8740a';
      ctx.font = `900 ${Math.max(6, s * 0.2)}px "Trebuchet MS", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('C', 0, s * 0.51);
      ctx.globalCompositeOperation = 'lighter';
      drawGlow('#fff6c0', s * 0.07, s * 0.44, s * (0.12 + 0.1 * Math.max(0, Math.sin(t * 3))), 1);
      ctx.globalCompositeOperation = 'source-over';
    } else if (item === 'bowtie') {
      ctx.fillStyle = '#ff2d55';
      ctx.beginPath(); ctx.moveTo(0, s * 0.18); ctx.lineTo(-s * 0.26, s * 0.04); ctx.lineTo(-s * 0.26, s * 0.32); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, s * 0.18); ctx.lineTo(s * 0.26, s * 0.04); ctx.lineTo(s * 0.26, s * 0.32); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c41a3d'; ctx.beginPath(); ctx.arc(0, s * 0.18, s * 0.07, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      [[-0.17, 0.12], [-0.15, 0.24], [0.17, 0.12], [0.15, 0.24]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x * s, y * s, s * 0.025, 0, TAU); ctx.fill(); });
    } else if (item === 'bandana') {
      ctx.fillStyle = '#e0245e';
      ctx.beginPath(); ctx.moveTo(-s * 0.48, s * 0.04); ctx.lineTo(s * 0.48, s * 0.04); ctx.lineTo(0, s * 0.56); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff';
      [[-0.25, 0.12], [0, 0.14], [0.25, 0.12], [-0.12, 0.28], [0.12, 0.28], [0, 0.42]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x * s, y * s, s * 0.03, 0, TAU); ctx.fill(); });
    } else if (item === 'pearls') {
      alongNeck(14, s * 0.42, s * 0.32, s * 0.04, (x, y) => {
        ctx.fillStyle = '#f4f0ff'; ctx.beginPath(); ctx.arc(x, y, s * 0.055, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - s * 0.015, y - s * 0.015, s * 0.02, 0, TAU); ctx.fill();
      });
    } else if (item === 'lei') {
      const cols = ['#ff3df2', '#ffe14d', '#8a5cff', '#ff8a3d'];
      let i = 0;
      alongNeck(10, s * 0.46, s * 0.38, s * 0.02, (x, y) => flower(x, y, s * 0.1, cols[i++ % cols.length]));
    }
  }

  function drawAfro(s) {
    ctx.fillStyle = '#3a2414';
    [[0, -1.0, 0.5], [-0.46, -0.82, 0.34], [0.46, -0.82, 0.34], [-0.3, -1.16, 0.32], [0.3, -1.16, 0.32]]
      .forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x * s, y * s, r * s, 0, TAU); ctx.fill(); });
    ctx.fillStyle = '#ff3df2';                                                           // afro pick
    ctx.fillRect(s * 0.3, -s * 1.38, s * 0.06, s * 0.3);
    ctx.fillRect(s * 0.24, -s * 1.12, s * 0.18, s * 0.06);
  }
  function drawHeadGear(s, item, t) {
    if (item === 'sweatband') {
      ctx.save();
      roundRect(-s * 0.58, -s * 0.95, s * 1.16, s * 1.05, s * 0.45); ctx.clip();
      ctx.fillStyle = '#ff3df2'; ctx.fillRect(-s * 0.6, -s * 0.9, s * 1.2, s * 0.15);
      ctx.fillStyle = '#fff'; ctx.fillRect(-s * 0.6, -s * 0.85, s * 1.2, s * 0.04);
      ctx.restore();
    } else if (item === 'cap') {
      ctx.fillStyle = '#ff2d55';
      ctx.beginPath(); ctx.ellipse(0, -s * 0.86, s * 0.62, s * 0.36, 0, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = '#3dfcff';
      ctx.beginPath(); ctx.ellipse(0, -s * 0.86, s * 0.62, s * 0.36, 0, Math.PI * 1.35, Math.PI * 1.65); ctx.lineTo(0, -s * 0.86); ctx.fill();
      ctx.fillStyle = '#c41a3d';
      ctx.beginPath(); ctx.ellipse(s * 0.5, -s * 0.84, s * 0.34, s * 0.08, -0.12, 0, TAU); ctx.fill();   // brim
      ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(0, -s * 1.22, s * 0.06, 0, TAU); ctx.fill();
    } else if (item === 'mohawk') {
      const xs = [-0.24, -0.12, 0, 0.12, 0.24], hs = [0.28, 0.38, 0.45, 0.38, 0.28];
      xs.forEach((x, i) => {
        ctx.fillStyle = `hsl(${(i * 30 + t * 80) % 360},100%,62%)`;
        ctx.beginPath(); ctx.moveTo((x - 0.08) * s, -s * 0.86); ctx.lineTo(x * s, -(0.9 + hs[i]) * s); ctx.lineTo((x + 0.08) * s, -s * 0.86); ctx.closePath(); ctx.fill();
      });
    } else if (item === 'crown') {
      ctx.fillStyle = '#ffd84d'; ctx.strokeStyle = '#a8740a'; ctx.lineWidth = s * 0.03;
      ctx.beginPath();
      ctx.moveTo(-s * 0.42, -s * 0.86);
      [[-0.42, -1.22], [-0.21, -1.04], [0, -1.3], [0.21, -1.04], [0.42, -1.22], [0.42, -0.86]].forEach(([x, y]) => ctx.lineTo(x * s, y * s));
      ctx.closePath(); ctx.fill(); ctx.stroke();
      [[-0.25, '#ff2d55'], [0, '#3dfcff'], [0.25, '#7dff6a']].forEach(([x, c]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x * s, -s * 0.96, s * 0.055, 0, TAU); ctx.fill(); });
    }
  }

  function heartPath(x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.9);
    ctx.bezierCurveTo(x - r * 1.5, y - r * 0.2, x - r * 0.6, y - r * 1.25, x, y - r * 0.4);
    ctx.bezierCurveTo(x + r * 0.6, y - r * 1.25, x + r * 1.5, y - r * 0.2, x, y + r * 0.9);
    ctx.closePath();
  }
  function starPath(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * TAU, rr = i % 2 ? r * 0.45 : r;
      i ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }
  function drawEyeGear(s, item, t) {
    const ey = -s * 0.6, ex = s * 0.28;
    ctx.lineCap = 'round';
    if (item === 'aviators') {
      for (const side of [-1, 1]) {
        const g = ctx.createLinearGradient(0, ey - s * 0.14, 0, ey + s * 0.16);
        g.addColorStop(0, '#2a0a3a'); g.addColorStop(1, '#ff6ad5');
        ctx.fillStyle = g; ctx.strokeStyle = '#ffd84d'; ctx.lineWidth = s * 0.04;
        ctx.beginPath(); ctx.ellipse(side * ex, ey + s * 0.02, s * 0.18, s * 0.14, side * -0.2, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = s * 0.03;
        ctx.beginPath(); ctx.arc(side * ex - s * 0.04, ey - s * 0.01, s * 0.08, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
      }
      ctx.strokeStyle = '#ffd84d'; ctx.lineWidth = s * 0.035;
      ctx.beginPath(); ctx.moveTo(-s * 0.12, ey - s * 0.05); ctx.quadraticCurveTo(0, ey - s * 0.11, s * 0.12, ey - s * 0.05); ctx.stroke();
    } else if (item === 'pixel') {
      ctx.fillStyle = '#0a0a10';
      ctx.fillRect(-s * 0.56, ey - s * 0.12, s * 1.12, s * 0.08);
      for (const side of [-1, 1]) {
        ctx.fillRect(side * ex - s * 0.18, ey - s * 0.05, s * 0.36, s * 0.12);
        ctx.fillRect(side * ex - s * 0.12, ey + s * 0.07, s * 0.24, s * 0.06);
        ctx.fillStyle = '#fff';
        ctx.fillRect(side * ex - s * 0.13, ey - s * 0.03, s * 0.05, s * 0.05);
        ctx.fillRect(side * ex - s * 0.07, ey + s * 0.02, s * 0.05, s * 0.05);
        ctx.fillStyle = '#0a0a10';
      }
    } else if (item === 'hearts') {
      ctx.strokeStyle = '#ff9ad0'; ctx.lineWidth = s * 0.035;
      ctx.beginPath(); ctx.moveTo(-s * 0.1, ey - s * 0.04); ctx.lineTo(s * 0.1, ey - s * 0.04); ctx.stroke();
      for (const side of [-1, 1]) {
        heartPath(side * ex, ey, s * 0.17);
        ctx.fillStyle = '#ff3d7f'; ctx.fill(); ctx.strokeStyle = '#ffd0e6'; ctx.stroke();
      }
    } else if (item === 'stars') {
      ctx.strokeStyle = '#ff8a3d'; ctx.lineWidth = s * 0.035;
      ctx.beginPath(); ctx.moveTo(-s * 0.1, ey); ctx.lineTo(s * 0.1, ey); ctx.stroke();
      for (const side of [-1, 1]) {
        starPath(side * ex, ey, s * 0.22);
        ctx.fillStyle = `hsl(${50 + 10 * Math.sin(t * 4)},100%,58%)`; ctx.fill(); ctx.stroke();
      }
    } else if (item === '3d') {
      ctx.fillStyle = '#ffffff';
      roundRect(-s * 0.54, ey - s * 0.13, s * 1.08, s * 0.26, s * 0.05); ctx.fill();
      ctx.fillStyle = 'rgba(255,40,70,0.85)'; ctx.fillRect(-s * 0.46, ey - s * 0.08, s * 0.36, s * 0.16);
      ctx.fillStyle = 'rgba(40,220,255,0.85)'; ctx.fillRect(s * 0.1, ey - s * 0.08, s * 0.36, s * 0.16);
    }
    ctx.lineCap = 'butt';
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
    ctx.textAlign = 'right';
    ctx.fillStyle = '#d9c6ff';
    ctx.fillText(tag, W - 12, by);
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
    drawShip(t);
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

  // ---------------------------------------------------------------- DJ capybara fly-by
  // Every so often a friendly ship cruises across the background. Its pilot is a capybara
  // vibing to music on headphones under a glass dome, with LED lights cycling inside.
  let ship = null, shipT = 9, notes = [];
  function spawnShip() {
    const dir = Math.random() < 0.5 ? 1 : -1, L = 74 * U;
    ship = { dir, L, x: dir > 0 ? -L * 2 : W + L * 2, y: rand(H * 0.2, H * 0.55), vx: dir * rand(0.13, 0.18) * W, t: 0, noteT: 0 };
    Snd.whoosh(dir > 0);
  }
  function updateShip(dt) {
    shipT -= dt;
    if (!ship && shipT <= 0) { spawnShip(); shipT = rand(20, 35); }
    if (ship) {
      ship.t += dt;
      ship.x += ship.vx * dt;
      ship.noteT -= dt;
      if (ship.noteT <= 0) {
        ship.noteT = rand(0.25, 0.5);
        notes.push({
          x: ship.x + ship.dir * ship.L * 0.15 + rand(-10, 10) * U, y: ship.y - ship.L * 0.7,
          vx: -ship.vx * 0.3 + rand(-15, 15) * U, vy: -rand(30, 55) * U, life: 2,
          ch: pick(['♪', '♫', '♬']), hue: randi(0, 360), ph: rand(0, TAU),
        });
      }
      if (ship.x < -ship.L * 3 || ship.x > W + ship.L * 3) ship = null;
    }
    for (const n of notes) { n.x += n.vx * dt + Math.sin(time * 4 + n.ph) * 20 * U * dt; n.y += n.vy * dt; n.life -= dt; }
    notes = notes.filter((n) => n.life > 0);
  }

  function drawDjCapy(x, y, s, t) {
    const beat = Math.sin(t * 12.6);  // head-bob at ~120 bpm
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#a8683a';
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.75, s * 0.4, 0, 0, TAU); ctx.fill();   // shoulders
    ctx.translate(0, -s * 0.12 + Math.abs(beat) * s * 0.06);
    ctx.rotate(beat * 0.12);
    ctx.fillStyle = '#b97a45';
    roundRect(-s * 0.58, -s * 0.95, s * 1.16, s * 1.05, s * 0.45); ctx.fill();
    ctx.fillStyle = '#6e3d1f';
    ctx.beginPath(); ctx.arc(-s * 0.45, -s * 0.9, s * 0.14, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.45, -s * 0.9, s * 0.14, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8c5430';
    roundRect(-s * 0.4, -s * 0.38, s * 0.8, s * 0.45, s * 0.2); ctx.fill();
    ctx.fillStyle = '#2b140a';
    ctx.beginPath(); ctx.ellipse(-s * 0.15, -s * 0.25, s * 0.06, s * 0.04, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.15, -s * 0.25, s * 0.06, s * 0.04, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#120804';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.2, s * 0.07);
    for (const side of [-1, 1]) {   // blissed-out closed eyes
      ctx.beginPath(); ctx.arc(side * s * 0.28, -s * 0.54, s * 0.09, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    }
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.beginPath(); ctx.arc(0, -s * 0.12, s * 0.1, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,90,150,0.5)';
    ctx.beginPath(); ctx.ellipse(-s * 0.42, -s * 0.36, s * 0.1, s * 0.06, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.42, -s * 0.36, s * 0.1, s * 0.06, 0, 0, TAU); ctx.fill();
    // headphones
    ctx.strokeStyle = '#2a2a3a';
    ctx.lineWidth = s * 0.12;
    ctx.beginPath(); ctx.arc(0, -s * 0.5, s * 0.66, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#ff3df2';
      roundRect(side * s * 0.62 - s * 0.13, -s * 0.66, s * 0.26, s * 0.38, s * 0.1); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(`hsl(${(t * 140 + (side > 0 ? 180 : 0)) % 360},100%,60%)`, side * s * 0.62, -s * 0.47, s * 0.16, 1);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  function drawShip(t) {
    if (ship) {
      const s = ship, L = s.L;
      ctx.save();
      ctx.translate(s.x, s.y + Math.sin(s.t * 2) * 6 * U);
      ctx.scale(s.dir, 1);
      ctx.rotate(Math.sin(s.t * 1.3) * 0.04);
      // engine flame
      ctx.globalCompositeOperation = 'lighter';
      const fl = L * (0.7 + Math.random() * 0.35);
      const fg = ctx.createLinearGradient(-L * 0.85, 0, -L * 0.85 - fl, 0);
      fg.addColorStop(0, '#ffffff'); fg.addColorStop(0.3, '#3dfcff'); fg.addColorStop(0.7, '#8a5cff'); fg.addColorStop(1, 'rgba(138,92,255,0)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.moveTo(-L * 0.82, -L * 0.16); ctx.quadraticCurveTo(-L * 0.85 - fl * 1.2, 0, -L * 0.82, L * 0.16); ctx.fill();
      drawGlow('#3dfcff', -L * 0.9, 0, L * 0.4, 0.9);
      ctx.globalCompositeOperation = 'source-over';
      // fins
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath(); ctx.moveTo(-L * 0.45, -L * 0.22); ctx.lineTo(-L * 0.88, -L * 0.55); ctx.lineTo(-L * 0.75, -L * 0.15); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-L * 0.45, L * 0.22); ctx.lineTo(-L * 0.88, L * 0.55); ctx.lineTo(-L * 0.75, L * 0.15); ctx.fill();
      // hull
      const hg = ctx.createLinearGradient(0, -L * 0.35, 0, L * 0.35);
      hg.addColorStop(0, '#ff9ae8'); hg.addColorStop(0.5, '#c44dff'); hg.addColorStop(1, '#4a1a8a');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.moveTo(L, L * 0.02);
      ctx.bezierCurveTo(L * 0.7, -L * 0.34, -L * 0.3, -L * 0.34, -L * 0.85, -L * 0.2);
      ctx.lineTo(-L * 0.85, L * 0.2);
      ctx.bezierCurveTo(-L * 0.3, L * 0.36, L * 0.7, L * 0.34, L, L * 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#3dfcff'; ctx.lineWidth = 2 * U; ctx.stroke();
      const hueBase = (t * (opts.reduceFlash ? 30 : 110)) % 360;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) drawGlow(`hsl(${(hueBase + i * 72) % 360},100%,60%)`, -L * 0.5 + i * L * 0.28, L * 0.18, 6 * U, 0.9);
      ctx.globalCompositeOperation = 'source-over';
      // cockpit interior (clipped to the dome)
      const cx = L * 0.15, cy = -L * 0.2, R = L * 0.42;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, 0); ctx.closePath(); ctx.clip();
      ctx.fillStyle = '#140a2a'; ctx.fillRect(cx - R, cy - R, R * 2, R);
      ctx.fillStyle = `hsla(${hueBase},100%,60%,0.25)`; ctx.fillRect(cx - R, cy - R, R * 2, R);  // LED wash
      drawDjCapy(cx, cy + R * 0.02, R * 0.66, s.t);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 11; i++) {   // LED strip around the inside of the dome
        const a = Math.PI + ((i + 0.5) / 11) * Math.PI;
        drawGlow(`hsl(${(hueBase + i * 33) % 360},100%,60%)`, cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9, 5 * U, 1);
      }
      for (let i = 0; i < 7; i++) {    // blinking console LEDs
        if (opts.reduceFlash || (Math.floor(t * 8) + i) % 3 !== 0) drawGlow(`hsl(${(hueBase + 180 + i * 50) % 360},100%,60%)`, cx - R * 0.8 + i * R * 0.27, cy - R * 0.06, 4 * U, 1);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      // clear glass dome
      ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, 0); ctx.closePath();
      ctx.fillStyle = 'rgba(170,235,255,0.14)'; ctx.fill();
      ctx.strokeStyle = 'rgba(220,250,255,0.9)'; ctx.lineWidth = 2.5 * U; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3 * U; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.78, Math.PI * 1.15, Math.PI * 1.4); ctx.stroke();
      ctx.restore();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.round(18 * U)}px "Trebuchet MS", sans-serif`;
    for (const n of notes) {
      ctx.globalAlpha = clamp(n.life, 0, 1);
      ctx.fillStyle = `hsl(${(n.hue + time * 60) % 360},100%,70%)`;
      ctx.fillText(n.ch, n.x, n.y);
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- menu demo capy
  function menuTick(dt) {
    time += dt;
    updateBackground(dt, 1.5);
    updateShip(dt);
  }
  function renderMenu(t) {
    drawBackground(t, 1.5);
    drawShip(t);
    const fake = { x: W / 2 + Math.sin(t * 1.3) * W * 0.3, y: H - safeBottom - 60 * U + Math.sin(t * 2.1) * 8, r: 24 * U, tilt: Math.cos(t * 1.3) * 0.3, inv: 0, shieldOn: false };
    drawCapy(fake, t);
  }

  // ---------------------------------------------------------------- loop
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state === 'play') { update(dt); render(time); }
    else if (state === 'menu') {
      menuTick(dt); renderMenu(time);
      if (!closet.classList.contains('hidden')) drawPortrait(preview, myLook, time, 0.25, 0.42);
    }
    else render(time); // paused / over — frozen scene
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- UI wiring
  const ui = {
    menu: $('menu'), pause: $('pause'), over: $('over'), pauseBtn: $('pauseBtn'),
  };
  function show(el, on) { el.classList.toggle('hidden', !on); }

  const tagInput = $('tagInput');
  tagInput.value = tag;
  function setTag(v) { tag = cleanTag(v); tagInput.value = tag; store.set('tag', tag); }
  tagInput.addEventListener('input', () => {
    const c = cleanTag(tagInput.value);
    if (c !== tagInput.value) tagInput.value = c;
    tag = c;
    store.set('tag', tag);
  });
  $('diceBtn').addEventListener('click', () => setTag(randomTag()));

  function renderBoard(el, mine) {
    const list = loadBoard();
    el.textContent = '';
    const h = document.createElement('h3');
    h.textContent = 'TOP PILOTS ON THIS DEVICE';
    el.appendChild(h);
    if (!list.length) {
      const e = document.createElement('p');
      e.className = 'empty';
      e.textContent = 'No flights yet. Be the first!';
      el.appendChild(e);
      return;
    }
    list.forEach((r, i) => {
      if (i >= 5 && i !== mine) return;
      const row = document.createElement('div');
      row.className = 'row' + (i === mine ? ' me' : '');
      [['rk', '#' + (i + 1)], ['tg', r.tag || '???'], ['sc', r.score.toLocaleString()]].forEach(([c, txt]) => {
        const sp = document.createElement('span');
        sp.className = c;
        sp.textContent = txt;
        row.appendChild(sp);
      });
      el.appendChild(row);
    });
  }
  renderBoard($('boardMenu'), -1);   // initial menu board

  // ---- Capy Closet
  const closet = $('closet'), preview = $('preview');
  let closetTab = 'outfit';
  function withCtx(c, fn) { const old = ctx; ctx = c; try { fn(); } finally { ctx = old; } }
  function sizeCanvas(c, w, h) {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(w * d); c.height = Math.round(h * d);
    c.style.width = w + 'px'; c.style.height = h + 'px';
    c._d = d; c._w = w; c._h = h;
  }
  function drawPortrait(c, look, t, scale, cy) {
    const g = c.getContext('2d');
    g.setTransform(c._d, 0, 0, c._d, 0, 0);
    g.clearRect(0, 0, c._w, c._h);
    withCtx(g, () => drawCapy({ x: c._w / 2, y: c._h * cy, r: c._h * scale, tilt: Math.sin(t * 1.5) * 0.06, inv: 0, shieldOn: false }, t, look));
  }
  function renderTabs() {
    const tabs = $('tabs');
    tabs.textContent = '';
    for (const k in GEAR) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab' + (k === closetTab ? ' on' : '');
      b.setAttribute('aria-pressed', String(k === closetTab));
      b.textContent = GEAR[k].label;
      b.addEventListener('click', () => { closetTab = k; $('lockHint').textContent = ''; renderTabs(); renderItems(); });
      tabs.appendChild(b);
    }
  }
  function renderItems() {
    const box = $('items');
    box.textContent = '';
    for (const [id, name, lv] of GEAR[closetTab].items) {
      const locked = lv > maxLevel, on = myLook[closetTab] === id;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'item' + (on ? ' sel' : '') + (locked ? ' locked' : '');
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', locked ? `${name}, locked until level ${lv}` : name);
      const c = document.createElement('canvas');
      sizeCanvas(c, 64, 64);
      const lab = document.createElement('span');
      lab.textContent = locked ? '🔒 LV ' + lv : name;
      b.append(c, lab);
      drawPortrait(c, { ...myLook, [closetTab]: id }, 1, 0.3, 0.52);
      b.addEventListener('click', () => {
        Snd.init();
        if (locked) { $('lockHint').textContent = `Reach level ${lv} in a run to unlock ${name}.`; Snd.shieldHit(); return; }
        myLook = { ...myLook, [closetTab]: id };
        store.set('look', myLook);
        $('lockHint').textContent = '';
        Snd.pickup();
        renderItems();
      });
      box.appendChild(b);
    }
  }
  function openCloset() {
    Snd.init();
    sizeCanvas(preview, 140, 140);
    renderTabs();
    renderItems();
    show(ui.menu, false);
    show(closet, true);
  }
  function closeCloset() {
    show(closet, false);
    show(ui.menu, true);
  }
  $('closetBtn').addEventListener('click', openCloset);
  $('closetDone').addEventListener('click', closeCloset);
  $('randomLook').addEventListener('click', () => {
    for (const k in GEAR) myLook[k] = pick(GEAR[k].items.filter(([, , lv]) => lv <= maxLevel))[0];
    store.set('look', myLook);
    Snd.init(); Snd.power();
    renderItems();
  });

  function startGame() {
    if (!tag) setTag(randomTag());
    tagInput.blur();
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
    Snd.beamOff(true);
    const s = game.score;
    const isBest = s > best;
    if (isBest) { best = s; store.set('best', best); }
    const rank = addScore({ tag, score: s, level: game.level });
    $('overTag').textContent = tag;
    $('rankLine').textContent = rank >= 0 ? '#' + (rank + 1) + ' ON THIS DEVICE' : '';
    $('unlockLine').textContent = game.newGear.length ? '🔓 NEW GEAR: ' + game.newGear.join(', ').toUpperCase() : '';
    renderBoard($('boardOver'), rank);
    renderBoard($('boardMenu'), -1);
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
    Snd.beamOff(true);
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
    Snd.beamOff(true);
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
  const optSound2 = $('optSound2');
  optSound2.checked = opts.sound;
  const setSound = (on) => { opts.sound = on; optSound.checked = optSound2.checked = on; store.set('sound', on); Snd.setOn(on); };
  optSound.addEventListener('change', () => setSound(optSound.checked));
  optSound2.addEventListener('change', () => setSound(optSound2.checked));
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
    if (e.target === tagInput) { if (e.key === 'Enter') tagInput.blur(); return; }
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'p' || k === 'Escape') { state === 'play' ? pauseGame() : resumeGame(); return; }
    if (!closet.classList.contains('hidden')) { if (k === 'Escape') closeCloset(); return; }
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
  window.__capyx = { get state() { return state; }, get game() { return game; }, get player() { return player; }, levelUp: () => levelUp(), hurt: (d) => hurtPlayer(d), snd: Snd, spawnShip: () => spawnShip(), get rocks() { return rocks; }, spawnPickup: (t) => spawnPickup(t, player.x, player.y - 60) };
})();
