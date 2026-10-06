// Echo // Estratégia Nerd Companion Client
// Motor Vetorial 2D (Mochi / Coucou) com Escuta por Microfone e Telemetria

(function () {
  'use strict';

  // ========================================================
  // 1. HELPERS MATEMÁTICOS E CURVAS DE ANIMAÇÃO
  // ========================================================
  const NOW = () => performance.now();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const E = {
    out: t => 1 - Math.pow(1 - t, 3),
    inOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    back: t => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    lin: t => t
  };

  const hexRgb = h => {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const rgba = (c, a) => `rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  function rr(x, X, Y, W, H, R) {
    R = Math.max(0, Math.min(R, W / 2, H / 2));
    x.beginPath();
    x.moveTo(X + R, Y);
    x.arcTo(X + W, Y, X + W, Y + H, R);
    x.arcTo(X + W, Y + H, X, Y + H, R);
    x.arcTo(X, Y + H, X, Y, R);
    x.arcTo(X, Y, X + W, Y, R);
    x.closePath();
  }
  function heart(x, s) {
    x.beginPath();
    x.moveTo(0, s * 0.38);
    x.bezierCurveTo(-s * 1.05, -s * 0.15, -s * 0.5, -s * 0.95, 0, -s * 0.38);
    x.bezierCurveTo(s * 0.5, -s * 0.95, s * 1.05, -s * 0.15, 0, s * 0.38);
    x.closePath();
  }
  function star(x, ro, ri) {
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? ri : ro, a = -Math.PI / 2 + i * Math.PI / 5;
      x.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    x.closePath();
  }

  // ========================================================
  // 2. SINTETIZADOR DE ÁUDIO WEB AUDIO
  // ========================================================
  // Sons gravados opcionais (servidos com PIN por /api/sounds); sem eles, valem os tons sintetizados
  const SAMPLE_NAMES = ['finish', 'error', 'approval', 'think', 'work', 'sleep', 'slap', 'love', 'pop', 'proud', 'greet'];
  // Som gravado sem arquivo cai no tom sintetizado equivalente
  const TONE_FALLBACK = { error: 'slap', approval: 'pop', think: 'love', work: 'proud' };

  const Snd = {
    ctx: null, on: true, vol: 0.5,
    samples: {},
    sampleGain: 0.24, // 0,24 × volume geral 0,5 = 0,12, o volume padrão do Coucou
    async loadSamples(pin) {
      this.init();
      if (!this.ctx || this._samplesRequested) return;
      this._samplesRequested = true;
      const headers = pin ? { 'x-echo-pin': pin } : {};
      await Promise.all(SAMPLE_NAMES.map(async (name) => {
        try {
          const res = await fetch(`/api/sounds/${name}.wav`, { headers, credentials: 'same-origin' });
          if (!res.ok) return;
          this.samples[name] = await this.ctx.decodeAudioData(await res.arrayBuffer());
        } catch (_) {
          // Mantém o tom sintetizado para este som
        }
      }));
    },
    playSample(name) {
      const buffer = this.samples[name];
      if (!buffer || !this.ctx) return false;
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.value = this.sampleGain;
      source.connect(gain);
      gain.connect(this.master);
      source.start();
      return true;
    },
    init() {
      if (this.ctx) return;
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      const c = this.ctx = new C();
      this.master = c.createGain();
      this.master.gain.value = this.vol;
      this.master.connect(c.destination);
    },
    tone({ f = 440, to = 0, d = 0.2, type = 'sine', g = 0.1, a = 0.006 }) {
      this.init();
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + d * 0.9);
      const gn = c.createGain();
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.exponentialRampToValueAtTime(g, t + a);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(gn);
      gn.connect(this.master);
      o.start(t);
      o.stop(t + d + 0.05);
    },
    play(name) {
      if (!this.on) return;
      if (this.playSample(name)) return;
      name = TONE_FALLBACK[name] || name;
      if (name === 'slap') {
        this.tone({ f: 280, to: 120, d: 0.14, type: 'triangle', g: 0.15 });
      } else if (name === 'pop') {
        this.tone({ f: 450, to: 820, d: 0.09, type: 'sine', g: 0.12 });
      } else if (name === 'love') {
        this.tone({ f: 523, to: 659, d: 0.25, type: 'sine', g: 0.1 });
      } else if (name === 'proud') {
        this.tone({ f: 659, to: 880, d: 0.22, type: 'sine', g: 0.12 });
      } else if (name === 'finish') {
        this.tone({ f: 523, to: 1046, d: 0.35, type: 'triangle', g: 0.15 });
      } else if (name === 'speech') {
        this.tone({ f: 340 + Math.random() * 260, to: 420 + Math.random() * 200, d: 0.08, type: 'sine', g: 0.07 });
      } else if (name === 'listen') {
        this.tone({ f: 440, to: 660, d: 0.15, type: 'sine', g: 0.1 });
      }
    }
  };

  // ========================================================
  // 3. IDENTIDADE ESTRATÉGIA NERD & ESTADOS DO MASCOTE
  // ========================================================
  const MOCHI_SPEC = {
    shape: 'mochi',
    eye: { w: 0.25, h: 0.27, sp: 0.37, p: -0.12 },
    base: ['#f0f9ff', '#cbe3f5'], // Cyber-clean light body
    ink: '#041622'                 // Dark Ink oficial
  };

  const STATES = {
    idle: { label: 'Ao Repouso', col: '#00d4ff', tint: 0, eye: 'pill', badge: null },
    working: { label: 'Trabalhando', col: '#00d4ff', tint: 0.65, eye: 'pill', badge: ['dots', '#00d4ff'] },
    multi: { label: 'Multi-Agente', col: '#00e5ff', tint: 0.85, eye: 'pill', badge: ['dots', '#ff7a45'] },
    thinking: { label: 'Pensando', col: '#b829dd', tint: 0.72, eye: 'pill', badge: ['dots', '#b829dd'] },
    approval: { label: 'Aguardando', col: '#F5A524', tint: 0.78, eye: 'wide', badge: ['bang', '#F5A524'] },
    finished: { label: 'Concluído', col: '#10b981', tint: 0.35, eye: 'happy', badge: ['dot', '#10b981'] },
    error: { label: 'Erro', col: '#F4505E', tint: 0.78, eye: 'flat', badge: ['dot', '#F4505E'] },
    listening: { label: 'Ouvindo', col: '#00d4ff', tint: 0.45, eye: 'dot', badge: ['dots', '#00d4ff'] },
    sleeping: { label: 'Dormindo', col: '#8b5cf6', tint: 0.12, eye: 'sleep', badge: null }
  };

  const EMOTES = {
    love: { eye: 'heart', snd: 'love' },
    surprised: { eye: 'dot', snd: 'pop' },
    proud: { eye: 'star', snd: 'proud' },
    happy: { eye: 'happy' }
  };

  // ========================================================
  // 4. CLASSE BOT 2D OFICIAL (MOTOR DO COUCOU)
  // ========================================================
  class Bot {
    constructor(canvas) {
      this.c = canvas;
      this.x = canvas.getContext('2d');
      this.s = {
        yaw: 0, pitch: 0, roll: 0, tilt: 0,
        open: 1, sx: 1, sy: 1, oy: 0, ox: 0,
        tint: 0, morph: 0, hands: 0, blush: 0,
        es: 1, badgeS: 0,
        mouthOpen: 0
      };
      this.tg = { ...this.s };
      this.tw = [];
      this.lock = {};
      this.col = [0, 212, 255];
      this.colT = [0, 212, 255];
      this.state = 'idle';
      this.cfg = STATES.idle;
      this.eyeOv = null;
      this.ovUntil = 0;
      this.badge = null;
      this.badgeCol = '#00d4ff';
      this._bk = 'none';
      this._bt = 0;
      this.parts = [];
      this.nextBlink = NOW() + 2000 + Math.random() * 2000;
      this.look = { x: 0, y: 0 };
      this.t0 = NOW();
      this.last = NOW();
      this.accessory = 'none';
      this.confetti = [];

      this.size = 0;
      this.setSize(280);
    }

    // Tamanho na tela em CSS px; o desenho continua em coordenadas de 280 × 280, só muda a escala
    setSize(size) {
      const cssSize = Math.round(size);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cssSize === this.size && this.dpr === dpr) return;
      this.size = cssSize;
      this.dpr = dpr;
      this.c.width = Math.round(cssSize * dpr);
      this.c.height = Math.round(cssSize * dpr);
      this.c.style.width = `${cssSize}px`;
      this.c.style.height = `${cssSize}px`;
      const k = (cssSize / 280) * dpr;
      this.x.setTransform(k, 0, 0, k, 0, 0);
    }

    setAccessory(name, duration = 0) {
      this.accessory = name || 'none';
      if (name === 'celebration') {
        this.emote('proud', 3000);
        this.anim('oy', [[-0.18, 180, E.out], [0.05, 140, E.inOut], [0, 160, E.back]]);
        this.initConfetti();
        Snd.play('finish');
      } else if (name === 'lupa') {
        this.anim('oy', [[-0.05, 200, E.out], [0, 200, E.back]]);
      } else if (name === 'typing') {
        this.anim('hands', [[1, 150, E.out]]);
      } else if (name === 'coffee') {
        this.anim('hands', [[1, 200, E.out]]);
      }
      if (duration > 0) {
        clearTimeout(this._accTimer);
        this._accTimer = setTimeout(() => {
          if (this.accessory === name) {
            this.accessory = 'none';
          }
        }, duration);
      }
    }

    initConfetti() {
      this.confetti = [];
      const colors = ['#00d4ff', '#b829dd', '#10b981', '#f5a524', '#ff4081', '#ffffff'];
      for (let i = 0; i < 28; i++) {
        this.confetti.push({
          x: (Math.random() - 0.5) * 220,
          y: -110 - Math.random() * 80,
          vx: (Math.random() - 0.5) * 60,
          vy: 50 + Math.random() * 70,
          w: 5 + Math.random() * 6,
          h: 4 + Math.random() * 5,
          rot: Math.random() * 6,
          vRot: (Math.random() - 0.5) * 8,
          color: colors[i % colors.length],
          life: 2.5 + Math.random() * 1.5,
          age: 0
        });
      }
    }

    anim(p, keys, after) {
      this.tw = this.tw.filter(t => t.p !== p);
      this.tw.push({ p, keys, i: 0, from: this.s[p], t0: NOW(), after });
      this.lock[p] = 1;
    }

    setBadge(b) {
      const key = b ? b.join() : 'none';
      if (key === this._bk) return;
      this._bk = key;
      const tok = ++this._bt;
      this.anim('badgeS', [[0, 80, E.inOut]]);
      setTimeout(() => {
        if (tok !== this._bt) return;
        this.badge = b ? b[0] : null;
        this.badgeCol = b ? b[1] : null;
        if (b) this.anim('badgeS', [[1, 260, E.back]]);
      }, 90);
    }

    setState(n) {
      if (!STATES[n]) return;
      // Som só na troca de estado, não a cada evento repetido do mesmo estado
      const changed = this.state !== n;
      const sound = (name) => { if (changed) Snd.play(name); };
      this.state = n;
      const c = this.cfg = STATES[n];
      this.colT = hexRgb(c.col);
      this.tg.tint = c.tint;
      this.tg.tilt = c.tilt || 0;
      this.setBadge(c.badge);

      if (n === 'finished') {
        this.roll(850, 1);
        setTimeout(() => this.emit('spark', 6), 450);
        sound('finish');
      } else if (n === 'error') {
        this.anim('ox', [[0.08, 50, E.out], [-0.08, 70, E.inOut], [0.05, 70, E.inOut], [0, 90, E.out]]);
        sound('error');
      } else if (n === 'approval') {
        this.anim('oy', [[-0.2, 140, E.out], [0, 280, E.back]]);
        sound('approval');
      } else if (n === 'thinking') {
        this.anim('tilt', [[-0.12, 220, E.out]]);
        sound('think');
      } else if (n === 'listening') {
        this.anim('tilt', [[0.18, 220, E.out]]);
        this.anim('es', [[1.22, 180, E.out]]);
        sound('listen');
      } else if (n === 'working') {
        this.anim('sy', [[0.95, 120, E.out], [1, 140, E.inOut]]);
        sound('work');
      } else {
        if (n === 'sleeping') sound('sleep');
        this.blink();
      }
    }

    blink() {
      if (this.lock.open) return;
      this.anim('open', [[0.05, 60, E.inOut], [1, 120, E.out]]);
    }

    squash() {
      Snd.play('slap');
      this.anim('sy', [[0.78, 70, E.out], [1.12, 130, E.out], [1, 160, E.inOut]]);
      this.anim('sx', [[1.18, 70, E.out], [0.94, 130, E.out], [1, 160, E.inOut]]);
    }

    roll(d = 900, turns = 1) {
      this.s.roll = 0;
      this.anim('roll', [[Math.PI * 2 * turns, d, E.inOut]], () => {
        this.s.roll = 0;
        this.tg.roll = 0;
      });
    }

    emote(n, d = 1600) {
      const em = EMOTES[n];
      if (!em) return;
      this.eyeOv = em.eye;
      this.ovUntil = NOW() + d;

      if (n === 'love') {
        this.anim('blush', [[1, 300, E.out], [1, d - 600, E.lin], [0, 300, E.inOut]]);
        this.emit('heart', 4);
        this.anim('oy', [[-0.1, 160, E.out], [0, 300, E.back]]);
      } else if (n === 'surprised') {
        this.anim('oy', [[-0.2, 140, E.out], [0, 350, E.back]]);
        this.anim('es', [[1.25, 120, E.out], [1, 400, E.inOut]]);
      } else if (n === 'proud') {
        this.emit('star', 5);
        this.anim('tilt', [[-0.12, 220, E.out], [-0.12, d - 500, E.lin], [0, 260, E.inOut]]);
      } else if (n === 'happy') {
        this.anim('blush', [[0.6, 200, E.out], [0, 600, E.inOut]]);
      }
      if (em.snd) Snd.play(em.snd);
    }

    emit(type, n) {
      for (let i = 0; i < n; i++) {
        this.parts.push({
          type,
          x: (Math.random() - 0.5) * 0.9,
          y: -0.7 - Math.random() * 0.2,
          vx: (Math.random() - 0.5) * 0.3,
          vy: -(0.4 + Math.random() * 0.3),
          age: -i * 0.12,
          life: 1.2 + Math.random() * 0.4,
          rot: Math.random() * 6,
          sz: 0.14 + Math.random() * 0.08
        });
      }
    }

    update() {
      const n = NOW(), dt = Math.min(0.05, (n - this.last) / 1000);
      this.last = n;
      const s = this.s, tg = this.tg, t = (n - this.t0) / 1000;

      for (const tw of [...this.tw]) {
        const k = tw.keys[tw.i];
        const p = clamp((n - tw.t0) / k[1], 0, 1);
        s[tw.p] = tw.from + (k[0] - tw.from) * k[2](p);
        if (p >= 1) {
          tw.from = k[0];
          tw.i++;
          tw.t0 = n;
          if (tw.i >= tw.keys.length) {
            this.tw.splice(this.tw.indexOf(tw), 1);
            delete this.lock[tw.p];
            this.tg[tw.p] = tw.keys[tw.keys.length - 1][0];
            if (tw.after) tw.after();
          }
        }
      }

      // Clamp seguro de yaw e pitch
      tg.yaw = clamp(this.look.x * 0.45, -0.42, 0.42);
      tg.pitch = clamp(this.look.y * 0.28, -0.24, 0.16);
      tg.sy = 1 + Math.sin(t * 1.8) * 0.025;
      tg.sx = 1 - Math.sin(t * 1.8) * 0.015;

      // Sincronia de voz
      if (this.speaking) {
        s.mouthOpen = (Math.sin(t * 16) + 1) / 2;
        tg.tilt = Math.sin(t * 6) * 0.06;
        s.hands = 1;
      } else {
        s.mouthOpen = 0;
        s.hands = 0;
      }

      // Física de respiração lenta no modo soneca
      if (this.state === 'sleeping') {
        const breath = Math.sin(t * 1.5);
        s.sy = 1 + breath * 0.045;
        s.sx = 1 - breath * 0.02;
        s.mouthOpen = 0;
        s.hands = 0;
        if (n > (this.nextZ || 0)) {
          this.spawnSleepZ();
          this.nextZ = n + 1200 + Math.random() * 600;
        }
      }

      const kLook = 1 - Math.pow(0.002, dt), kGen = 1 - Math.pow(0.0008, dt);
      for (const k in tg) {
        if (this.lock[k]) continue;
        s[k] += (tg[k] - s[k]) * ((k === 'yaw' || k === 'pitch') ? kLook : kGen);
      }

      this.col = mix(this.col, this.colT, 1 - Math.pow(0.002, dt));

      if (this.state !== 'sleeping' && n > this.nextBlink) {
        this.blink();
        this.nextBlink = n + 2200 + Math.random() * 3200;
      }
      if (this.eyeOv && n > this.ovUntil) this.eyeOv = null;

      for (const p of this.parts) p.age += dt;
      this.parts = this.parts.filter(p => p.age < p.life);
    }

    spawnSleepZ() {
      const chars = ['z', 'Z', 'z'];
      const ch = chars[Math.floor(Math.random() * chars.length)];
      this.parts.push({
        type: 'zzz',
        char: ch,
        x: 0.38 + (Math.random() - 0.5) * 0.15,
        y: -0.32,
        vx: 0.12 + Math.random() * 0.08,
        vy: -0.38 - Math.random() * 0.18,
        sz: 0.16 + (ch === 'Z' ? 0.07 : 0),
        life: 2.8,
        age: 0
      });
    }

    draw() {
      const x = this.x, W = 280, H = 280, s = this.s, P = MOCHI_SPEC;
      x.clearRect(0, 0, W, H);

      const R = W * 0.3;
      let rx = R * 1.14, ry = R * 0.88;
      const cx = W / 2 + s.ox * R, cy = H / 2 + s.oy * R + R * 0.06;

      x.save();
      x.translate(cx, cy);
      x.rotate(s.tilt);
      x.scale(s.sx, s.sy);

      // 1. Corpo Superelipse
      const path = new Path2D();
      for (let i = 0; i <= 72; i++) {
        const a = i / 72 * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const px = rx * Math.sign(ca) * Math.pow(Math.abs(ca), 2 / 2.7);
        const py = ry * Math.sign(sa) * Math.pow(Math.abs(sa), 2 / 2.7);
        i ? path.lineTo(px, py) : path.moveTo(px, py);
      }
      path.closePath();

      // Gradiente Base
      const c0 = hexRgb(P.base[0]), c1 = hexRgb(P.base[1]);
      const g = x.createLinearGradient(0, -ry, 0, ry);
      g.addColorStop(0, rgba(c0, 1));
      g.addColorStop(1, rgba(c1, 1));
      x.fillStyle = g;
      x.fill(path);

      // 2. Tintura de Estado
      if (s.tint > 0.01) {
        const tg2 = x.createLinearGradient(0, ry, 0, -ry * 0.3);
        tg2.addColorStop(0, rgba(this.col, 0.88 * s.tint));
        tg2.addColorStop(1, rgba(this.col, 0));
        x.fillStyle = tg2;
        x.fill(path);
      }

      // Borda sutil cyan
      x.strokeStyle = 'rgba(0, 212, 255, 0.22)';
      x.lineWidth = 1.6;
      x.stroke(path);

      // 3. Bochechas Magenta
      const bl = Math.max(s.blush, 0.32);
      if (bl > 0.01) {
        x.save();
        x.clip(path);
        const yo = Math.sin(s.yaw) * rx * 0.7;
        x.fillStyle = `rgba(184, 41, 221, ${0.45 * bl})`; // Magenta #b829dd
        for (const sd of [-1, 1]) {
          x.beginPath();
          x.ellipse(sd * rx * 0.52 + yo, ry * 0.18, R * 0.16, R * 0.09, 0, 0, Math.PI * 2);
          x.fill();
        }
        x.restore();
      }

      // 4. Mãos Gesticulando
      if (s.hands > 0.05) {
        const hr = R * 0.18 * s.hands;
        const t = NOW() / 1000;
        x.fillStyle = '#7fe3f5';
        x.strokeStyle = '#00d4ff';
        x.lineWidth = 2;

        for (const sd of [-1, 1]) {
          const hx = sd * rx * 1.25 * s.sx;
          const hy = ry * 0.35 + Math.sin(t * 8 + sd) * 6;
          x.beginPath();
          x.arc(hx, hy, hr, 0, Math.PI * 2);
          x.fill();
          x.stroke();
        }
      }

      // 5. Boca (projeção esférica 3D centralizada na face com envelope de segurança)
      const mouthYaw = s.yaw;
      let mouthPitch = P.eye.p - 0.20 + s.pitch + s.roll;
      mouthPitch = ((mouthPitch + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;

      const cpMouth = Math.cos(mouthPitch);
      if (Math.cos(mouthYaw) * cpMouth >= 0.04) {
        let mx = Math.sin(mouthYaw) * cpMouth * rx;
        let my = -Math.sin(mouthPitch) * ry;

        // Envelope rígido de segurança: jamais permite a boca escapar do rosto
        mx = clamp(mx, -rx * 0.45, rx * 0.45);
        my = clamp(my, ry * 0.12, ry * 0.55);

        const mfx = Math.max(0.20, Math.cos(mouthYaw));
        const mfy = Math.max(0.20, cpMouth);

        x.save();
        x.clip(path);
        x.translate(mx, my);
        x.scale(mfx, mfy);

        if (s.mouthOpen > 0.05) {
          // Boca falando 'o' (abertura dinâmica sincronizada com as sílabas)
          x.fillStyle = P.ink;
          x.beginPath();
          x.ellipse(0, 0, 5.5, 2.5 + s.mouthOpen * 6.5, 0, 0, Math.PI * 2);
          x.fill();
        } else if (this.state !== 'sleeping') {
          // Boca fechada '_' (traço sutil Kaomoji com cantos arredondados)
          x.strokeStyle = P.ink;
          x.lineWidth = 2.2;
          x.lineCap = 'round';
          x.beginPath();
          x.moveTo(-3.5, 0);
          x.lineTo(3.5, 0);
          x.stroke();
        }
        x.restore();
      }

      // 6. Olhos 2D
      x.save();
      x.clip(path);
      x.fillStyle = P.ink;
      x.strokeStyle = P.ink;

      const shape = this.eyeOv || this.cfg.eye;
      for (const sd of [-1, 1]) {
        const yaw = sd * P.eye.sp + s.yaw;
        let pitch = P.eye.p + s.pitch + s.roll;
        pitch = ((pitch + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;

        const cp = Math.cos(pitch);
        if (Math.cos(yaw) * cp < 0.04) continue;

        let px = Math.sin(yaw) * cp * rx, py = -Math.sin(pitch) * ry;
        const fx = Math.max(0.18, Math.cos(yaw));
        const fy = Math.max(0.18, cp);

        x.save();
        x.translate(px, py);
        x.scale(fx, fy);
        this.eye(shape, R * P.eye.w * s.es, R * P.eye.h * s.es, s.open, sd, P);
        x.restore();
      }
      x.restore();

      // 7. Badges na Cabeça
      if (this.badge && s.badgeS > 0.01) {
        const bs = s.badgeS;
        const bx = -rx * 0.72 * s.sx, by = -ry * 0.72 * s.sy;
        x.save();
        x.translate(bx, by);
        x.scale(bs, bs);
        const bcol = this.badgeCol;

        if (this.badge === 'dots') {
          const w = R * 0.74, h = R * 0.42;
          x.fillStyle = '#041622';
          rr(x, -w / 2 - R * 0.06, -h / 2 - R * 0.06, w + R * 0.12, h + R * 0.12, (h + R * 0.12) / 2);
          x.fill();
          x.fillStyle = bcol;
          rr(x, -w / 2, -h / 2, w, h, h / 2);
          x.fill();

          const tt = NOW() / 1000;
          for (let i = 0; i < 3; i++) {
            const ph = ((tt * 2.4 - i * 0.22) % 1 + 1) % 1;
            const r = R * 0.058 * (1 + 0.4 * Math.max(0, Math.sin(ph * Math.PI * 2)));
            x.fillStyle = '#ffffff';
            x.beginPath();
            x.arc((i - 1) * R * 0.19, 0, r, 0, Math.PI * 2);
            x.fill();
          }
        } else if (this.badge === 'bang') {
          x.fillStyle = '#041622';
          x.beginPath(); x.arc(0, 0, R * 0.28, 0, Math.PI * 2); x.fill();
          x.fillStyle = bcol;
          x.beginPath(); x.arc(0, 0, R * 0.22, 0, Math.PI * 2); x.fill();
          x.fillStyle = '#fff';
          x.font = `800 ${R * 0.3}px -apple-system, sans-serif`;
          x.textAlign = 'center';
          x.textBaseline = 'middle';
          x.fillText('!', 0, R * 0.02);
        } else {
          x.fillStyle = '#041622';
          x.beginPath(); x.arc(0, 0, R * 0.19, 0, Math.PI * 2); x.fill();
          x.fillStyle = bcol;
          x.beginPath(); x.arc(0, 0, R * 0.13, 0, Math.PI * 2); x.fill();
        }
        x.restore();
      }

      // ========================================================
      // RENDERIZAÇÃO DOS 5 ACESSÓRIOS 2D DO MASCOTE
      // ========================================================
      if (this.accessory === 'lupa') {
        const t = NOW() / 1000;
        const lx = rx * 0.45 + Math.sin(t * 3.5) * 8;
        const ly = ry * 0.12 + Math.cos(t * 2.8) * 6;
        const lRad = R * 0.32;

        x.save();
        x.translate(lx, ly);

        // Vidro com reflexo azul translúcido
        x.fillStyle = 'rgba(0, 212, 255, 0.22)';
        x.beginPath();
        x.arc(0, 0, lRad, 0, Math.PI * 2);
        x.fill();

        // Arco de reflexo branco no topo
        x.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        x.lineWidth = 2.5;
        x.beginPath();
        x.arc(0, 0, lRad * 0.78, -Math.PI * 0.85, -Math.PI * 0.15);
        x.stroke();

        // Aro metálico neon cyan
        x.strokeStyle = '#00d4ff';
        x.lineWidth = 4;
        x.beginPath();
        x.arc(0, 0, lRad, 0, Math.PI * 2);
        x.stroke();

        // Cabo da lupa
        x.strokeStyle = '#041622';
        x.lineWidth = 6;
        x.lineCap = 'round';
        x.beginPath();
        x.moveTo(lRad * 0.7, lRad * 0.7);
        x.lineTo(lRad * 1.5, lRad * 1.5);
        x.stroke();

        x.strokeStyle = '#00d4ff';
        x.lineWidth = 3;
        x.beginPath();
        x.moveTo(lRad * 0.75, lRad * 0.75);
        x.lineTo(lRad * 1.45, lRad * 1.45);
        x.stroke();

        x.restore();
      } else if (this.accessory === 'typing') {
        const t = NOW() / 1000;
        const kw = R * 1.55, kh = R * 0.46;
        const kx = -kw / 2, ky = ry * 0.65;

        x.save();
        x.fillStyle = '#041622';
        x.strokeStyle = '#00d4ff';
        x.lineWidth = 2;
        rr(x, kx, ky, kw, kh, 8);
        x.fill();
        x.stroke();

        const rows = 3, cols = 7;
        const tw = (kw - 18) / cols, th = (kh - 12) / rows;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const active = Math.sin(t * 12 + r * 3 + c * 2) > 0.4;
            x.fillStyle = active ? '#00d4ff' : 'rgba(0, 212, 255, 0.28)';
            rr(x, kx + 9 + c * tw, ky + 6 + r * th, tw - 3, th - 3, 2);
            x.fill();
          }
        }
        x.restore();
      } else if (this.accessory === 'printer') {
        const t = NOW() / 1000;
        const pw = R * 0.85, ph = R * 0.52;
        const px = rx * 0.45, py = ry * 0.45;

        x.save();
        x.translate(px, py);

        x.fillStyle = '#041622';
        x.strokeStyle = '#10b981';
        x.lineWidth = 2.5;
        rr(x, -pw / 2, -ph / 2, pw, ph, 6);
        x.fill();
        x.stroke();

        x.fillStyle = '#10b981';
        x.beginPath();
        x.arc(pw / 2 - 8, -ph / 2 + 8, 3, 0, Math.PI * 2);
        x.fill();

        const rw = pw * 0.65, rh = R * 0.75;
        const scrollOff = (t * 28) % 8;
        x.fillStyle = '#ffffff';
        x.strokeStyle = '#cbd5e1';
        x.lineWidth = 1;
        rr(x, -rw / 2, -ph / 2 - rh + 4, rw, rh, 3);
        x.fill();
        x.stroke();

        x.fillStyle = '#0284c7';
        for (let l = 0; l < 5; l++) {
          const ly = -ph / 2 - rh + 12 + l * 9 + scrollOff;
          if (ly < -ph / 2) {
            x.fillRect(-rw / 2 + 5, ly, rw - 10, 2);
          }
        }
        x.restore();
      } else if (this.accessory === 'coffee') {
        const t = NOW() / 1000;
        const cxMug = rx * 0.72, cyMug = ry * 0.35;
        const mw = R * 0.55, mh = R * 0.48;

        x.save();
        x.translate(cxMug, cyMug);

        x.fillStyle = '#f8fafc';
        x.strokeStyle = '#0284c7';
        x.lineWidth = 2.2;
        rr(x, -mw / 2, -mh / 2, mw, mh, 5);
        x.fill();
        x.stroke();

        x.strokeStyle = '#f8fafc';
        x.lineWidth = 4;
        x.beginPath();
        x.arc(mw / 2 + 2, 0, mh * 0.28, -Math.PI / 2, Math.PI / 2);
        x.stroke();

        x.fillStyle = '#451a03';
        x.beginPath();
        x.ellipse(0, -mh / 2 + 4, mw * 0.42, 4, 0, 0, Math.PI * 2);
        x.fill();

        x.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        x.lineWidth = 2;
        x.lineCap = 'round';
        for (let s = -1; s <= 1; s++) {
          const sx = s * 7;
          const wave = Math.sin(t * 3.5 + s) * 4;
          x.beginPath();
          x.moveTo(sx, -mh / 2 - 2);
          x.quadraticCurveTo(sx + wave, -mh / 2 - 14, sx - wave / 2, -mh / 2 - 26);
          x.stroke();
        }
        x.restore();
      } else if (this.accessory === 'celebration' && this.confetti.length > 0) {
        const dtConf = 0.016;
        for (const c of this.confetti) {
          c.age += dtConf;
          c.x += c.vx * dtConf;
          c.y += c.vy * dtConf;
          c.rot += c.vRot * dtConf;

          x.save();
          x.translate(c.x, c.y);
          x.rotate(c.rot);
          x.fillStyle = c.color;
          x.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
          x.restore();
        }
      }

      x.restore();

      // 8. Partículas
      for (const p of this.parts) {
        if (p.age < 0) continue;
        const k = p.age / p.life, a = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
        const px = cx + (p.x + p.vx * p.age) * R * 1.3, py = cy + (p.y + p.vy * p.age) * R * 1.3;
        const sz = R * p.sz * (1 + k * 0.4);

        x.save();
        x.translate(px, py);
        x.globalAlpha = clamp(a, 0, 1);
        if (p.type === 'heart') {
          x.fillStyle = '#b829dd';
          heart(x, sz);
          x.fill();
        } else if (p.type === 'star') {
          x.fillStyle = '#00d4ff';
          x.rotate(p.rot + p.age * 2);
          star(x, sz, sz * 0.45);
          x.fill();
        } else if (p.type === 'spark') {
          x.fillStyle = '#10b981';
          x.rotate(p.rot);
          star(x, sz * 0.8, sz * 0.18);
          x.fill();
        } else if (p.type === 'zzz') {
          x.fillStyle = 'rgba(167, 139, 250, ' + clamp(a * 0.9, 0, 0.9) + ')';
          x.font = `bold ${sz * 1.3}px -apple-system, sans-serif`;
          x.textAlign = 'center';
          x.textBaseline = 'middle';
          x.fillText(p.char || 'z', 0, 0);
        }
        x.restore();
      }
    }

    eye(shape, w, h, open, sd, P) {
      const x = this.x;
      switch (shape) {
        case 'wide': w *= 1.15; h *= 1.15; /* fallthrough */
        case 'pill': {
          const hh = Math.max(h * open, w * 0.3);
          rr(x, -w / 2, -hh / 2, w, hh, Math.min(w / 2, hh / 2));
          x.fill();
          break;
        }
        case 'dot':
          x.beginPath();
          x.arc(0, 0, w * 0.48, 0, Math.PI * 2);
          x.fill();
          break;
        case 'flat':
          rr(x, -w * 0.72, -w * 0.2, w * 1.44, w * 0.4, w * 0.2);
          x.fill();
          break;
        case 'happy':
          x.lineWidth = w * 0.46;
          x.lineCap = 'round';
          x.beginPath();
          x.arc(0, h * 0.16, w * 0.82, Math.PI * 1.12, Math.PI * 1.88);
          x.stroke();
          break;
        case 'sleep':
          x.lineWidth = w * 0.36;
          x.lineCap = 'round';
          x.beginPath();
          x.arc(0, -h * 0.04, w * 0.65, Math.PI * 0.15, Math.PI * 0.85);
          x.stroke();
          break;
        case 'heart':
          x.fillStyle = '#b829dd';
          heart(x, w * 1.2);
          x.fill();
          break;
        case 'star':
          x.fillStyle = '#00d4ff';
          star(x, w * 1.05, w * 0.46);
          x.fill();
          break;
        default:
          rr(x, -w / 2, -h / 2, w, h, w / 2);
          x.fill();
      }
    }
  }

  // ========================================================
  // 5. INICIALIZAÇÃO DA INTERFACE & ELEMENTOS DO DOM
  // ========================================================
  const screen = document.getElementById('screen');
  const echoWrapper = document.getElementById('echo-wrapper');
  const echoCanvas = document.getElementById('echo-canvas');
  const mochi = new Bot(echoCanvas);

  const brandProject = document.getElementById('brand-project');
  const agentLabel = document.getElementById('agent-label');
  const badgeTop = document.getElementById('badge-top');
  const statusDot = document.getElementById('status-dot');

  const infoPanel = document.getElementById('info-panel');
  const panelBadge = document.getElementById('panel-badge');
  const panelMainText = document.getElementById('panel-main-text');
  const panelFill = document.getElementById('panel-fill');
  const panelSubLine1 = document.getElementById('panel-sub-line1');
  const panelSubLine2 = document.getElementById('panel-sub-line2');
  const panelVoice = document.getElementById('panel-voice');
  const voiceText = document.getElementById('voice-text');
  const panelExtraItems = document.getElementById('panel-extra-items');

  const connectionStatus = document.getElementById('connection-status');
  const telemetryBar = document.getElementById('telemetry-bar');
  const audioToast = document.getElementById('audio-toast');
  const briefingBtn = document.getElementById('briefing-btn');
  const briefingLabel = document.getElementById('briefing-label');
  const micBtn = document.getElementById('mic-btn');
  const micLabel = document.getElementById('mic-label');
  const voiceTranscription = document.getElementById('voice-transcription');
  const transcriptionText = document.getElementById('transcription-text');

  const pinModal = document.getElementById('pin-modal');
  const pinInput = document.getElementById('pin-input');
  const pinBtn = document.getElementById('pin-btn');
  const pinError = document.getElementById('pin-error');
  const rotateBtn = document.getElementById('rotate-btn');
  const wazeLink = document.getElementById('waze-link');
  const calendarActions = document.getElementById('calendar-actions');
  const calendarBtn = document.getElementById('calendar-btn');
  const calendarConnect = document.getElementById('calendar-connect');
  const calendarList = document.getElementById('calendar-list');
  const calendarDisconnect = document.getElementById('calendar-disconnect');
  const calendarConfirm = document.getElementById('calendar-confirm');
  const calendarCancel = document.getElementById('calendar-cancel');
  let calendarCsrf = '';
  let calendarConfirmation = null;
  let calendarStatus = null;
  let calendarBusy = false;

  function showNavigationAction(action) {
    if (!wazeLink || action?.type !== 'open_waze') return null;
    try {
      const url = new URL(action.url);
      const sharedDestination = /^\/ul\/[a-z0-9]{6,20}$/.test(url.pathname);
      const queryDestination = url.pathname === '/ul' && !!url.searchParams.get('q');
      const allowedParams = ['q', 'navigate', 'utm_source'];
      if (url.origin !== 'https://waze.com' || url.username || url.password || url.hash ||
          (!sharedDestination && !queryDestination) ||
          (url.searchParams.has('navigate') && url.searchParams.get('navigate') !== 'yes') ||
          [...url.searchParams.keys()].some(key => !allowedParams.includes(key))) return null;
      wazeLink.href = url.href;
      wazeLink.hidden = false;
      return url.href;
    } catch (_) { return null; }
  }

  function openNavigationOnAndroid(url) {
    if (url && /Android/i.test(navigator.userAgent) && document.visibilityState === 'visible') {
      try { window.location.assign(url); } catch (_) {}
    }
  }

  function getAuthHeaders() {
    const pin = localStorage.getItem('echo_pin') || '';
    const headers = {
      'Content-Type': 'application/json'
    };
    if (pin) {
      headers['x-echo-pin'] = pin;
    }
    if (calendarCsrf) headers['x-agenda-csrf'] = calendarCsrf;
    return headers;
  }

  async function initializeCalendar() {
    const res = await fetch('/api/calendar/status', { headers: getAuthHeaders(), credentials: 'same-origin' });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.reply || 'Desbloqueie o Echo antes de abrir sua agenda.');
    calendarCsrf = data.csrf;
    calendarStatus = data;
    return data;
  }

  function showCalendarActions(data) {
    if (!calendarActions) return;
    if (data.source !== 'google-calendar') return;
    calendarActions.hidden = false;
    calendarConfirmation = data.confirmation?.id || null;
    calendarConfirm.hidden = !calendarConfirmation;
    calendarCancel.hidden = !calendarConfirmation;
    calendarConfirm.textContent = data.confirmation?.action === 'delete' ? 'Confirmar exclusão' : 'Confirmar';
    calendarConnect.hidden = !!calendarConfirmation;
    calendarConnect.textContent = calendarStatus?.connected ? 'Reconectar Google Agenda' : 'Conectar Google Agenda';
    calendarConnect.disabled = !calendarStatus?.configured;
    calendarList.hidden = !!calendarConfirmation || !calendarStatus?.connected;
    calendarDisconnect.hidden = !!calendarConfirmation || !calendarStatus?.connected;
  }

  async function calendarRequest(path, body) {
    if (calendarBusy) return;
    calendarBusy = true;
    let failureData = null;
    for (const button of calendarActions.querySelectorAll('button')) button.disabled = true;
    try {
      if (!calendarCsrf) await initializeCalendar();
      const res = await fetch('/api/calendar/' + path, { method: 'POST', headers: getAuthHeaders(), credentials: 'same-origin', body: JSON.stringify(body || {}) });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        failureData = data;
        throw new Error(data.reply || 'Não foi possível concluir o pedido.');
      }
      if (path === 'oauth/start') {
        const url = new URL(data.url);
        if (url.origin !== 'https://accounts.google.com') throw new Error('Endereço de autorização inválido.');
        window.location.assign(url.href);
        return;
      }
      if (path === 'disconnect') await initializeCalendar();
      displayInfoCard(data.card || { badge: 'GOOGLE AGENDA', title: data.reply, detail1: '', detail2: '' }, data.reply);
      showCalendarActions({ ...data, source: 'google-calendar' });
      await speak(data.reply);
    } catch (error) {
      await initializeCalendar().catch(() => {});
      displayInfoCard({ badge: 'GOOGLE AGENDA', title: error.message, detail1: '', detail2: 'Abra Agenda para verificar a conexão.' });
      showCalendarActions({ source: 'google-calendar', confirmation: failureData?.confirmation });
      await speak(error.message);
    } finally {
      calendarBusy = false;
      for (const button of calendarActions.querySelectorAll('button')) button.disabled = false;
      if (calendarConnect) calendarConnect.disabled = !calendarStatus?.configured;
    }
  }

  calendarBtn?.addEventListener('click', async event => {
    event.stopPropagation();
    try {
      const status = await initializeCalendar();
      const reply = status.connected ? 'Sua agenda está conectada.' : status.configured ? 'Conecte sua conta Google para usar a agenda.' : 'A configuração do Google Agenda no servidor ainda está pendente.';
      displayInfoCard({ badge: 'GOOGLE AGENDA', title: reply, detail1: 'Consultar, criar, editar e excluir compromissos', detail2: status.configured ? 'Alterações exigem sua confirmação.' : 'Siga o guia docs/google-agenda.md no projeto.' }, reply);
      showCalendarActions({ source: 'google-calendar' });
    } catch (error) { displayInfoCard({ badge: 'GOOGLE AGENDA', title: error.message }); }
  });
  calendarConnect?.addEventListener('click', () => calendarRequest('oauth/start'));
  calendarList?.addEventListener('click', () => calendarRequest('list'));
  calendarConfirm?.addEventListener('click', () => calendarRequest('confirm', { id: calendarConfirmation }));
  calendarCancel?.addEventListener('click', () => calendarRequest('cancel', { id: calendarConfirmation }));
  calendarDisconnect?.addEventListener('click', () => {
    if (window.confirm('Desconectar o Google Agenda do Echo? Seus eventos serão preservados.')) calendarRequest('disconnect', { confirm: 'disconnect' });
  });

  // Estado da Aplicação
  let audioUnlocked = false;
  let currentAudio = null;
  let lastVoicePlayed = '';
  let wakeLock = null;
  let sseSource = null;
  let currentState = null;
  let isListening = false;
  let recognition = null;
  let speechTimer = null;

  // Eye Tracking tangencial pelo cursor ou toque
  function trackMove(e) {
    // Se o painel de info estiver aberto, o robô olha para a direita por padrão
    if (currentState && currentState.mode === 'info') return;

    const rect = echoCanvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - (rect.left + rect.width / 2);
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - (rect.top + rect.height / 2);
    mochi.look.x = Math.tanh(x / 120);
    mochi.look.y = Math.tanh(y / 100);
  }
  window.addEventListener('pointermove', trackMove);
  window.addEventListener('touchmove', trackMove, { passive: true });

  // Toque / Slap no Mascote
  echoCanvas.addEventListener('pointerdown', () => {
    mochi.squash();
  });

  // Loop de renderização 60 FPS
  function tick() {
    mochi.update();
    mochi.draw();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ========================================================
  // 6. DESIGN RESPONSIVO HÍBRIDO (RETRATO & PAISAGEM)
  // ========================================================
  function isPortrait() {
    return window.innerHeight > window.innerWidth;
  }

  function setLookForInfoMode() {
    if (isPortrait()) {
      // No modo retrato, o painel fica embaixo: olha para baixo
      mochi.look.x = 0;
      mochi.look.y = 0.85;
    } else {
      // No modo paisagem, o painel fica à direita: olha para a direita
      mochi.look.x = 0.85;
      mochi.look.y = 0.05;
    }
  }

  function handleOrientationUpdate() {
    if (echoWrapper.classList.contains('mode-info')) {
      setLookForInfoMode();
    }
  }

  window.addEventListener('resize', handleOrientationUpdate);
  window.addEventListener('orientationchange', () => {
    setTimeout(handleOrientationUpdate, 150);
  });

  // ========================================================
  // 6B. LAYOUT PROPORCIONAL: MASCOTE NA ÁREA LIVRE E BALÃO QUE NÃO O COBRE
  // ========================================================
  const stageEl = document.querySelector('.stage');
  let layoutFrame = 0;

  function bubbleIsVisible() {
    return !voiceTranscription.classList.contains('hidden') && transcriptionText.textContent.trim() !== '';
  }

  // Topo do balão quando fica em cima do mascote (guardado para o cálculo enquanto ele está ao lado)
  let bubbleTopAbove = 0;

  // Mascote do tamanho da área livre do palco; com o balão visível, a área começa abaixo dele.
  // Tela deitada e baixa: o balão vai para o lado do mascote, que mantém o tamanho cheio.
  function layoutMascot() {
    layoutFrame = 0;
    if (!stageEl || !mochi) return;
    const rect = stageEl.getBoundingClientRect();
    const portrait = window.innerHeight >= window.innerWidth;
    const fit = height => Math.max(120, Math.min(rect.width * (portrait ? 0.8 : 0.42), Math.max(0, height) * 0.9, portrait ? 380 : 340));
    const full = fit(rect.height);
    let reserve = 0;
    let beside = false;
    // Com o cartão aberto o mascote já encolhe e sai do caminho (classe mode-info): sem reserva nem balão ao lado
    if (bubbleIsVisible() && !infoPanel.classList.contains('visible')) {
      if (!voiceTranscription.classList.contains('beside')) bubbleTopAbove = voiceTranscription.offsetTop;
      reserve = Math.ceil(bubbleTopAbove + voiceTranscription.offsetHeight + 8);
      const roomBeside = rect.width / 2 - full / 2 - 26;
      beside = !portrait && roomBeside >= 180 && fit(rect.height - reserve) < full * 0.85;
      if (beside) reserve = 0;
    }
    voiceTranscription.classList.toggle('beside', beside);
    stageEl.style.paddingTop = reserve ? `${reserve}px` : '';
    const size = reserve ? fit(rect.height - reserve) : full;
    stageEl.style.setProperty('--echo-half', `${Math.round(size / 2)}px`);
    mochi.setSize(size);
    placeForCard(portrait, size);
  }

  // Cartão aberto: o mascote vai, reduzido, para a área livre — acima do cartão (em pé) ou à esquerda
  // dele (deitado), abaixo do balão quando houver. Deitado, o balão fica centrado nessa área.
  function placeForCard(portrait, size) {
    const open = infoPanel.classList.contains('visible') && echoWrapper.classList.contains('mode-info');
    voiceTranscription.style.left = '';
    voiceTranscription.style.maxWidth = '';
    if (!open) {
      echoWrapper.style.transform = '';
      infoPanel.style.maxHeight = '';
      return;
    }
    // Posições sem as animações (offset*), para o cálculo não depender do meio da transição
    const right = portrait ? stageEl.clientWidth : Math.max(0, infoPanel.offsetLeft - 8);
    if (!portrait) {
      voiceTranscription.style.left = `${Math.round(right / 2)}px`;
      voiceTranscription.style.maxWidth = `${Math.max(160, Math.round(right - 24))}px`;
    }
    const top = bubbleIsVisible() ? voiceTranscription.offsetTop + voiceTranscription.offsetHeight + 8 : 0;
    // Em pé o cartão fica preso embaixo: com o balão em cima, ele encolhe (e rola) para sobrar
    // espaço para o mascote entre os dois
    let panelLimit = '';
    if (portrait && top) {
      const panelBottom = infoPanel.offsetTop + infoPanel.offsetHeight;
      panelLimit = `min(64%, ${Math.max(120, panelBottom - (top + Math.round(Math.min(size * 0.5, 140)) + 16))}px)`;
    }
    setPanelLimit(panelLimit);
    const bottom = portrait ? infoPanel.offsetTop - 8 : stageEl.clientHeight;
    const visual = Math.max(70, Math.min(size * (portrait ? 0.74 : 0.66), right * 0.9, (bottom - top) * 0.9));
    const dx = right / 2 - (echoWrapper.offsetLeft + echoWrapper.offsetWidth / 2);
    const dy = (top + bottom) / 2 - (echoWrapper.offsetTop + echoWrapper.offsetHeight / 2);
    echoWrapper.style.transform = `translate(${Math.round(dx)}px, ${Math.round(dy)}px) scale(${(visual / size).toFixed(3)})`;
  }

  // Altura máxima do cartão sem animação: a posição final já vale para o cálculo do lugar do mascote
  function setPanelLimit(value) {
    if (infoPanel.style.maxHeight === value) return;
    infoPanel.style.transition = 'none';
    infoPanel.style.maxHeight = value;
    void infoPanel.offsetHeight;
    infoPanel.style.transition = '';
  }

  // setTimeout (não requestAnimationFrame): o ajuste roda mesmo com o app em segundo plano,
  // e ele volta à frente já no tamanho certo
  function scheduleLayout() {
    if (!layoutFrame) layoutFrame = setTimeout(layoutMascot, 0);
  }

  if (window.ResizeObserver && stageEl) new ResizeObserver(scheduleLayout).observe(stageEl);
  window.addEventListener('resize', scheduleLayout);
  window.addEventListener('orientationchange', () => setTimeout(scheduleLayout, 150));
  // Balão aparecendo ou sumindo (classe "hidden") muda a área livre
  new MutationObserver(scheduleLayout).observe(voiceTranscription, { attributes: true, attributeFilter: ['class'] });
  // Cartão abrindo, fechando ou mudando de altura muda o lugar do mascote e do balão
  new MutationObserver(scheduleLayout).observe(infoPanel, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(scheduleLayout).observe(echoWrapper, { attributes: true, attributeFilter: ['class'] });
  if (window.ResizeObserver) new ResizeObserver(scheduleLayout).observe(infoPanel);

  // Balão de altura fixa (3 linhas): o texto sobe acompanhando a fala
  const bubble = { mode: 'static', text: '', shownAt: 0, audio: null, audioText: '', charIndex: null, charText: '', frame: 0 };
  const speechKey = t => String(t || '').replace(/^"|"$/g, '').trim();

  // mode: 'transcript' (sua fala: mostra as últimas palavras), 'speech' (resposta falada) ou 'static'
  function showBubble(text, mode = 'static') {
    bubble.mode = mode;
    bubble.text = speechKey(text);
    bubble.shownAt = performance.now();
    transcriptionText.textContent = text;
    transcriptionText.scrollTop = mode === 'transcript' ? transcriptionText.scrollHeight : 0;
    voiceTranscription.classList.remove('hidden');
    scheduleLayout();
    startBubbleScroll();
  }

  // Quanto da fala já passou (0 a 1): áudio do Edge, palavra da voz do navegador ou ritmo de leitura
  function speechProgress() {
    if (bubble.audio && bubble.audioText === bubble.text) {
      const audio = bubble.audio;
      if (audio.ended) return 1;
      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Math.max(2, bubble.text.length / 14);
      return Math.min(1, audio.currentTime / duration);
    }
    if (bubble.charIndex !== null && bubble.charText === bubble.text) {
      return Math.min(1, bubble.charIndex / Math.max(1, bubble.text.length));
    }
    return Math.min(1, (performance.now() - bubble.shownAt) / 1000 / Math.max(3, bubble.text.length / 16));
  }

  function bubbleScrollStep() {
    bubble.frame = 0;
    if (voiceTranscription.classList.contains('hidden')) return;
    const el = transcriptionText;
    const max = el.scrollHeight - el.clientHeight;
    if (max <= 1) return; // cabe em 3 linhas: não rola
    if (bubble.mode === 'transcript') {
      el.scrollTop = max;
      return;
    }
    const progress = speechProgress();
    // Mantém a parte que está sendo falada no meio do balão
    const target = Math.min(max, Math.max(0, progress * el.scrollHeight - el.clientHeight * 0.5));
    el.scrollTop += (target - el.scrollTop) * 0.2;
    if (progress < 1 || Math.abs(target - el.scrollTop) > 0.5) bubble.frame = requestAnimationFrame(bubbleScrollStep);
  }

  function startBubbleScroll() {
    if (!bubble.frame) bubble.frame = requestAnimationFrame(bubbleScrollStep);
  }

  // Chamados pela fala: o balão passa a seguir o áudio (ou a palavra falada) quando é o mesmo texto
  function bubbleFollowAudio(audio, text) {
    bubble.audio = audio;
    bubble.audioText = speechKey(text);
    bubble.charIndex = null;
    startBubbleScroll();
  }

  function bubbleFollowChar(charIndex, text) {
    bubble.charIndex = charIndex;
    bubble.charText = speechKey(text);
    startBubbleScroll();
  }

  scheduleLayout();

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen().catch(() => {});
      } else if (document.exitFullscreen) {
        await document.exitFullscreen().catch(() => {});
      }
    } catch (e) {}
  }

  if (rotateBtn) {
    rotateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFullscreen();
    });
  }

  async function unlockAudioAndWakeLock() {
    // A cada toque: recupera a tela acesa se o navegador tiver soltado o pedido
    if (audioUnlocked) requestWakeLock();
    if (audioToast) {
      audioToast.classList.add('hidden');
      audioToast.style.display = 'none';
    }
    if (!audioUnlocked) {
      audioUnlocked = true;
      Snd.init();
      if (Snd.ctx && Snd.ctx.state === 'suspended') {
        try { await Snd.ctx.resume(); } catch (_) {}
      }
      // Carrega os sons gravados e cumprimenta ao liberar o áudio
      Snd.loadSamples(localStorage.getItem('echo_pin') || '').then(() => Snd.play('greet'));

      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        gain.gain.value = 0.001;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(0);
        osc.stop(0.05);
      } catch (e) {
        console.warn('AudioContext unlock:', e);
      }

      requestWakeLock();

      // Inicia escuta mãos livres contínua após o primeiro toque
      if (handsFreeMode) {
        setTimeout(startListening, 600);
      }
    }
  }
  if (screen) {
    screen.addEventListener('click', unlockAudioAndWakeLock);
    screen.addEventListener('touchstart', unlockAudioAndWakeLock, { passive: true });
  }
  window.addEventListener('click', unlockAudioAndWakeLock);
  window.addEventListener('touchstart', unlockAudioAndWakeLock, { passive: true });
  if (audioToast) {
    audioToast.addEventListener('click', (e) => {
      e.stopPropagation();
      unlockAudioAndWakeLock();
    });
    audioToast.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      unlockAudioAndWakeLock();
    }, { passive: false });
  }

  // Tela acesa: o navegador solta o pedido quando o app sai da frente (outro app, notificações, tela
  // bloqueada); por isso pede de novo ao voltar e a cada toque, se tiver sido perdido
  let wakeLockPending = false;
  async function requestWakeLock() {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible' || wakeLockPending) return;
    if (wakeLock && !wakeLock.released) return;
    wakeLockPending = true;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (err) {
      console.warn('WakeLock:', err.message);
    } finally {
      wakeLockPending = false;
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (audioUnlocked) requestWakeLock();
  });

  // ========================================================
  // 7. SÍNTESE DE VOZ COM SINCRONIA DE BOCA E MÃOS
  // ========================================================
  function startSpeakingAnim(withCoucouBleeps = false) {
    mochi.speaking = true;
    clearInterval(speechTimer);
    if (withCoucouBleeps) {
      speechTimer = setInterval(() => {
        Snd.play('speech');
      }, 180);
    }
  }

  function stopSpeakingAnim() {
    mochi.speaking = false;
    clearInterval(speechTimer);
    speechTimer = null;
  }

  async function speak(text) {
    if (!text) return;
    
    // Pausa reconhecimento temporariamente para o Echo não ouvir a própria voz
    pauseRecognition();

    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
      stopSpeakingAnim();
    }
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }

    let playedServerAudio = false;

    // 1. Tenta áudio de alta qualidade do servidor (Edge TTS oficial pt-BR-AntonioNeural)
    try {
      const response = await fetch('/api/speak', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify({ text })
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('audio')) {
          const blob = await response.blob();
          const audioUrl = URL.createObjectURL(blob);
          currentAudio = new Audio(audioUrl);
          // Balão com o mesmo texto sobe acompanhando este áudio
          bubbleFollowAudio(currentAudio, text);

          currentAudio.onplay = () => {
            // Inicia o movimento da boca no exato instante em que o áudio começa a tocar
            startSpeakingAnim(false);
          };

          currentAudio.onended = () => {
            stopSpeakingAnim();
            currentAudio = null;
            URL.revokeObjectURL(audioUrl);
            resumeListeningIfHandsFree();
          };
          currentAudio.onerror = () => {
            stopSpeakingAnim();
            currentAudio = null;
            resumeListeningIfHandsFree();
          };

          await currentAudio.play();
          playedServerAudio = true;
          return;
        }
      }
    } catch (err) {
      console.warn('Servidor TTS indisponível ou sem cota:', err.message);
    }

    // 2. Fallback de voz nativo do dispositivo (SpeechSynthesis em pt-BR)
    // Funciona 100% no celular (Android/iOS) sem depender de cota de API
    if (!playedServerAudio && 'speechSynthesis' in window) {
      try {
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'pt-BR';
        utter.rate = 1.08;
        utter.pitch = 1.04;

        const voices = window.speechSynthesis.getVoices();
        const ptVoice = voices.find(v => v.lang === 'pt-BR' || v.lang.startsWith('pt')) || null;
        if (ptVoice) utter.voice = ptVoice;

        utter.onstart = () => {
          startSpeakingAnim(false);
        };
        // Voz do navegador: o balão segue a palavra que está sendo falada
        utter.onboundary = (event) => bubbleFollowChar(event.charIndex, text);
        utter.onend = () => {
          stopSpeakingAnim();
          resumeListeningIfHandsFree();
        };
        utter.onerror = () => {
          stopSpeakingAnim();
          resumeListeningIfHandsFree();
        };

        window.speechSynthesis.speak(utter);
        return;
      } catch (synthErr) {
        console.warn('SpeechSynthesis error:', synthErr);
      }
    }

    // 3. Fallback acústico com bips do mascote CouCou
    startSpeakingAnim(true);
    setTimeout(() => {
      stopSpeakingAnim();
      resumeListeningIfHandsFree();
    }, Math.min(3000, Math.max(1200, text.length * 60)));
  }

  function resumeListeningIfHandsFree() {
    // Limpa a bolha de diálogo para não deixar texto antigo retido na tela
    setTimeout(() => {
      if (!isListening && !mochi.speaking) {
        voiceTranscription.classList.add('hidden');
      }
    }, 1200);

    if (handsFreeMode && audioUnlocked) {
      // Cooldown de 1.5s para garantir que todo o eco do alto-falante se dissipe no ambiente
      setTimeout(startListening, 1500);
    }
  }

  // ========================================================
  // 8. ESCUTA ATIVA CONTÍNUA POR VOZ (MÃOS LIVRES)
  // ========================================================
  let handsFreeMode = true; // Modo Mãos Livres ativo por padrão
  let processingSpeech = false;
  let speechDebounceTimer = null;

  function setupSpeechRecognition() {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) {
      micBtn.style.display = 'none';
      return;
    }

    recognition = new Speech();
    recognition.lang = 'pt-BR';
    recognition.continuous = false; // Modo sentença única: zera buffer e impede o bug de duplicação do Android
    recognition.interimResults = true;

    recognition.onstart = () => {
      isListening = true;
      micBtn.classList.add('listening');
      micLabel.textContent = handsFreeMode ? 'ATIVO' : 'OUVIR';
      // O botão roxo e a pose de escuta já indicam o microfone ligado;
      // o balão só aparece com a fala reconhecida (onresult)
      voiceTranscription.classList.add('hidden');
      transcriptionText.textContent = '';
      mochi.setState('listening');
    };

    recognition.onresult = (event) => {
      if (processingSpeech || mochi.speaking) return;

      // Pega apenas a sentença atual sem concatenar com históricos anteriores
      const current = event.results[event.results.length - 1];
      if (!current || !current[0]) return;
      const text = current[0].transcript.trim();

      if (text) showBubble(text, 'transcript');

      // Se a frase finalizou ou teve pausa de silêncio, processa imediatamente
      if (current.isFinal && text.length >= 2) {
        clearTimeout(speechDebounceTimer);
        speechDebounceTimer = setTimeout(() => {
          if (!processingSpeech && !mochi.speaking) {
            try { recognition.stop(); } catch(e) {}
            processAndRespond(text);
          }
        }, 500);
      } else if (text.length >= 2) {
        clearTimeout(speechDebounceTimer);
        speechDebounceTimer = setTimeout(() => {
          if (!processingSpeech && !mochi.speaking) {
            try { recognition.stop(); } catch(e) {}
            processAndRespond(text);
          }
        }, 900);
      }
    };

    recognition.onerror = (e) => {
      console.warn('SpeechRecognition status:', e.error);
      if (e.error === 'not-allowed') {
        handsFreeMode = false;
        stopListening();
      }
    };

    recognition.onend = () => {
      isListening = false;
      micBtn.classList.remove('listening');
      micLabel.textContent = handsFreeMode ? 'ATIVO' : 'OUVIR';
      // Reinicia escuta limpa no modo mãos livres se não estiver falando
      if (handsFreeMode && !mochi.speaking && !processingSpeech && audioUnlocked) {
        setTimeout(startListening, 400);
      } else if (!handsFreeMode) {
        stopListening();
      }
    };
  }

  let infoCardTimeout = null;
  const panelTrack = document.getElementById('panel-track');
  const ROW_STATUSES = ['ok', 'warn', 'error'];

  // Linhas do cartão: formato novo (rows: rótulo, valor e status) e o antigo (items), sempre como texto
  function renderCardRows(card) {
    if (!panelExtraItems) return 0;
    const nodes = [];
    (Array.isArray(card?.rows) ? card.rows : []).forEach(row => {
      const element = document.createElement('div');
      element.className = `panel-row status-${ROW_STATUSES.includes(row?.status) ? row.status : 'none'}`;
      const dot = document.createElement('span');
      dot.className = 'row-dot';
      element.append(dot, makeSpan('row-label', String(row?.label ?? '')), makeSpan('row-value', String(row?.value ?? '')));
      nodes.push(element);
    });
    (Array.isArray(card?.items) ? card.items : []).forEach(item => {
      const element = document.createElement('div');
      element.className = 'panel-extra-item';
      element.textContent = String(item);
      nodes.push(element);
    });
    panelExtraItems.replaceChildren(...nodes);
    panelExtraItems.style.display = nodes.length ? 'flex' : 'none';
    infoPanel.classList.toggle('has-rows', nodes.length > 0);
    return nodes.length;
  }

  // A barra só aparece quando o cartão traz um percentual de verdade
  function setPanelProgress(percent, color) {
    if (!panelTrack) return;
    const hasValue = typeof percent === 'number' && Number.isFinite(percent);
    panelTrack.style.display = hasValue ? '' : 'none';
    if (hasValue) {
      panelFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
      panelFill.style.backgroundColor = color || '';
    }
  }

  // Fechamento agendado do cartão atual (reaproveitado para adiar enquanto você rola)
  let infoCardCloser = null;

  // Enquanto você rola ou toca no cartão, ele não fecha
  ['scroll', 'touchmove', 'pointerdown', 'wheel'].forEach(type => {
    infoPanel.addEventListener(type, () => {
      if (infoCardTimeout && infoCardCloser && infoPanel.classList.contains('visible')) {
        clearTimeout(infoCardTimeout);
        infoCardTimeout = window.setTimeout(infoCardCloser, 12000);
      }
    }, { passive: true });
  });

  function displayInfoCard(card, replyText) {
    if (!card) return;
    if (wazeLink) { wazeLink.hidden = true; wazeLink.removeAttribute('href'); }
    if (calendarActions) calendarActions.hidden = true;
    calendarConfirmation = null;
    echoWrapper.className = 'echo-wrapper mode-info';
    infoPanel.classList.add('visible');
    // Atualizações em tempo real (eventos dos agentes) não fecham o cartão antes do tempo
    infoPanel.dataset.card = 'open';

    // Esconde o balão flutuante superior para manter o mascote livre e sem texto na frente
    voiceTranscription.classList.add('hidden');

    panelBadge.textContent = card.badge || 'INFORMAÇÃO';
    panelMainText.textContent = card.title ?? '';
    panelMainText.style.color = '';
    panelSubLine1.textContent = card.detail1 ?? '';
    panelSubLine2.textContent = card.detail2 ?? '';
    setPanelProgress(card.progress);

    // Linhas detalhadas (serviços, backups, contas, tarefas do Forge etc.)
    const rowCount = renderCardRows(card);
    infoPanel.scrollTop = 0;

    // Não duplica a fala no rodapé com aspas azuis quando houver card de dados
    panelVoice.style.display = 'none';
    voiceText.textContent = '';

    // Robô olha expressivamente em direção aos dados (direita no landscape, baixo no portrait)
    setLookForInfoMode();

    // Tempo na tela: o maior entre o tamanho da fala e a quantidade de linhas para ler
    clearTimeout(infoCardTimeout);
    const duration = Math.max(20000, ((replyText || '').length * 100) + 12000, 8000 + rowCount * 2500);
    infoCardTimeout = setTimeout(infoCardCloser = () => {
      // Consultas fecham; propostas aguardam a confirmação do usuário.
      if (typeof calendarActions !== 'undefined' && calendarActions &&
          (typeof calendarConfirmation === 'undefined' || !calendarConfirmation)) {
        calendarActions.hidden = true;
      }
      // O tempo do cartão acabou: a marca sai sempre, para a próxima atualização poder fechar o painel
      if (infoPanel.dataset) delete infoPanel.dataset.card;
      if (echoWrapper.classList.contains('mode-info') && currentState?.mode !== 'info' && (!wazeLink || wazeLink.hidden) && (typeof calendarActions === 'undefined' || !calendarActions || calendarActions.hidden)) {
        echoWrapper.className = 'echo-wrapper mode-full';
        infoPanel.classList.remove('visible');
        if (panelExtraItems) {
          panelExtraItems.replaceChildren();
          panelExtraItems.style.display = 'none';
        }
        mochi.look.x = 0;
        mochi.look.y = 0;
      }
    }, duration);
  }

  async function processAndRespond(text) {
    if (processingSpeech || mochi.speaking) return;
    processingSpeech = true;
    pauseRecognition();

    mochi.setState('thinking');
    showBubble(`"${text}"`, 'transcript');

    try {
      if (!calendarCsrf) await initializeCalendar().catch(() => {});
      const res = await fetch('/api/converse', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify({ message: text, calendarConfirmation })
      });
      const data = await res.json();
      if (!res.ok || data?.ok === false) {
        if (data?.source === 'google-calendar') {
          await initializeCalendar().catch(() => {});
          displayInfoCard({ badge: 'GOOGLE AGENDA', title: data.reply || 'Não foi possível concluir o pedido.' });
          showCalendarActions({ source: 'google-calendar' });
        }
        await speak(data?.reply || 'Não consegui preparar seu pedido. Tente novamente.');
        return;
      }
      const reply = data?.reply || "Olá, Mestre! Estratégia Nerd online.";

      if (data?.accessory && data.accessory !== 'none') {
        mochi.setAccessory(data.accessory, 5000);
      }

      // Se a resposta contém dados/cartão, desliza para a esquerda e exibe o painel
      if (data?.card) {
        displayInfoCard(data.card, reply);
      } else {
        // Sem card: se for mensagem curta (<= 45 caracteres), mostra no balão flutuante
        if (reply && reply.length <= 45) {
          showBubble(reply, 'speech');
        } else {
          voiceTranscription.classList.add('hidden');
        }
      }

      const navigationUrl = showNavigationAction(data?.action);
      showCalendarActions(data);
      sharedLocation.show(data);
      // Responde falando com voz oficial neural, mexendo a boca e mãos
      await speak(reply);
      // O botão continua disponível se Android bloquear a abertura sem gesto.
      openNavigationOnAndroid(navigationUrl);

      // Se entrou em modo soneca/sono por comando de voz
      if (data?.state === 'sleeping') {
        mochi.setAccessory('none');
        mochi.setState('sleeping');
        document.body.classList.add('sleep-mode');
      }

      resetInactivity();
    } catch (err) {
      console.warn('Erro ao conversar:', err);
      mochi.setState('idle');
      resumeListeningIfHandsFree();
    } finally {
      processingSpeech = false;
    }
  }

  function pauseRecognition() {
    if (recognition && isListening) {
      try { recognition.stop(); } catch(e){}
    }
  }

  function startListening() {
    if (!recognition || isListening || mochi.speaking || processingSpeech) return;
    try {
      recognition.start();
    } catch (e) {}
  }

  function stopListening() {
    isListening = false;
    micBtn.classList.remove('listening');
    micLabel.textContent = handsFreeMode ? 'ATIVO' : 'OUVIR';
    setTimeout(() => {
      if (!isListening && !mochi.speaking) voiceTranscription.classList.add('hidden');
    }, 7000);

    if (currentState) {
      renderState(currentState);
    } else {
      mochi.setState('idle');
    }
  }

  micBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    unlockAudioAndWakeLock();
    handsFreeMode = !handsFreeMode;
    if (handsFreeMode) {
      micBtn.classList.add('listening');
      micLabel.textContent = 'ATIVO';
      micBtn.title = 'Mãos livres ativo (toque para pausar)';
      startListening();
    } else {
      handsFreeMode = false;
      micBtn.classList.remove('listening');
      micLabel.textContent = 'OUVIR';
      micBtn.title = 'Ativar microfone para falar com Echo';
      pauseRecognition();
      stopListening();
    }
  });

  // Briefing Consolidado (Verificações, Saudação e Status do Dia)
  let isBriefingRunning = false;

  async function triggerBriefing() {
    if (isBriefingRunning || processingSpeech || mochi.speaking) return;
    isBriefingRunning = true;
    unlockAudioAndWakeLock();
    pauseRecognition();

    if (briefingBtn) {
      briefingBtn.classList.add('loading');
      briefingLabel.textContent = '...';
    }

    mochi.setState('thinking');
    showBubble('"Executando Briefing do Sistema..."', 'static');

    try {
      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'same-origin'
      });
      const data = await res.json();
      const reply = data?.reply || "Briefing concluído com sucesso, Mestre!";

      if (data?.accessory && data.accessory !== 'none') {
        mochi.setAccessory(data.accessory, 6000);
      }

      if (data?.card) {
        displayInfoCard(data.card, reply);
      } else {
        if (reply && reply.length <= 45) {
          showBubble(reply, 'speech');
        } else {
          voiceTranscription.classList.add('hidden');
        }
      }

      // Fala neural brasileira de alta fidelidade
      await speak(reply);
      resetInactivity();
    } catch (err) {
      console.warn('Erro ao executar briefing:', err);
      mochi.setState('idle');
      resumeListeningIfHandsFree();
    } finally {
      isBriefingRunning = false;
      if (briefingBtn) {
        briefingBtn.classList.remove('loading');
        briefingLabel.textContent = 'CHECK';
      }
    }
  }

  if (briefingBtn) {
    briefingBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerBriefing();
    });
  }

  // ========================================================
  // 9C. FAIXA DE ATIVIDADE: O QUE OS AGENTES ESTÃO FAZENDO (Plano 2B)
  // ========================================================
  const activityTicker = document.getElementById('activity-ticker');
  const activitySteps = []; // mais recente primeiro
  const ACTIVITY_MAX_STEPS = 4;
  const DEFAULT_PROJECT = 'ESTRATÉGIA NERD'; // projeto padrão do servidor quando o agente não informa a pasta
  let lastActivityKey = '';

  function activityIcon(state) {
    const detail = String(state.detail || '');
    if (state.state === 'success') return '✓';
    if (state.state === 'error') return '⚠';
    if (state.state === 'waiting') return state.badge === 'PERGUNTA DO CLAUDE' ? '❓' : '✋';
    if (state.actionType === 'executing') return '✏️';
    if (/^[\w ]+: /.test(detail)) return '⌘';
    return '🔍';
  }

  function activityText(state) {
    // Ferramentas externas (MCP) chegam como mcp__servidor__ferramenta: mostra só a ferramenta
    const detail = String(state.detail || '').replace(/\bmcp__.+?__/g, '');
    if (state.state === 'success') return 'Turno concluído';
    if (state.state === 'waiting') return `Aguardando você: ${detail || 'aprovação'}`;
    return detail || 'Trabalhando';
  }

  // Chamado a cada estado recebido; só registra um passo novo quando algo mudou
  function updateActivityTicker(state) {
    if (!activityTicker || !state) return;
    const active = ['working', 'waiting', 'success', 'error'].includes(state.state) && state.agent && state.agent !== 'ECHO';
    if (!active) {
      activitySteps.length = 0;
      lastActivityKey = '';
      activityTicker.classList.add('hidden');
      activityTicker.replaceChildren();
      return;
    }
    const key = `${state.agent}|${state.state}|${state.actionType}|${state.detail}`;
    if (key === lastActivityKey) return;
    lastActivityKey = key;
    const project = state.project && state.project !== DEFAULT_PROJECT ? String(state.project).toLowerCase() : '';
    activitySteps.unshift({
      agent: state.isMultiAgent ? String(state.agent) : '',
      icon: activityIcon(state),
      text: activityText(state),
      project
    });
    activitySteps.length = Math.min(activitySteps.length, ACTIVITY_MAX_STEPS);
    activityTicker.replaceChildren(...activitySteps.map((step, index) => {
      const line = document.createElement('div');
      line.className = index === 0 ? 'activity-step current' : 'activity-step';
      if (step.agent) line.append(makeSpan('step-agent', step.agent));
      line.append(makeSpan('step-text', `${step.icon} ${step.text}`));
      if (step.project) line.append(makeSpan('step-project', `• ${step.project}`));
      return line;
    }));
    activityTicker.classList.remove('hidden');
  }

  // ========================================================
  // 9B. MODO CELULAR: APROVAR, NEGAR E RESPONDER AO CLAUDE CODE (Plano 2A)
  // ========================================================
  const phoneModeBtn = document.getElementById('phone-mode-btn');
  const approvalSheet = document.getElementById('approval-sheet');
  const approvalBadge = document.getElementById('approval-badge');
  const approvalTimer = document.getElementById('approval-timer');
  const approvalTitle = document.getElementById('approval-title');
  const approvalSummary = document.getElementById('approval-summary');
  const approvalProject = document.getElementById('approval-project');
  const approvalQuestions = document.getElementById('approval-questions');
  const approvalPin = document.getElementById('approval-pin');
  const approvalError = document.getElementById('approval-error');
  const approvalPrimary = document.getElementById('approval-allow');
  const approvalSecondary = document.getElementById('approval-deny');
  const approvalTerminal = document.getElementById('approval-terminal');

  let phoneModeEnabled = false;
  let approvalConfigured = false;
  let sheetMode = null; // 'permission' | 'question' | 'mode'
  let currentRequest = null;
  let questionIndex = 0;
  let collectedAnswers = {};
  let selectedOptions = new Set();
  let approvalCountdown = null;
  let approvalBusy = false;
  const pendingRequests = [];
  // Segundo PIN lembrado só na memória enquanto o modo celular estiver ligado (nunca gravado no aparelho)
  let rememberedApprovalPin = '';

  function setPhoneMode(enabled) {
    phoneModeEnabled = Boolean(enabled);
    if (!phoneModeEnabled) rememberedApprovalPin = '';
    if (!phoneModeBtn) return;
    phoneModeBtn.classList.toggle('active', phoneModeEnabled);
    phoneModeBtn.setAttribute('aria-pressed', String(phoneModeEnabled));
    // Ligado = botão verde (o texto não muda, para caber no rodapé em pé)
    phoneModeBtn.title = phoneModeEnabled ? 'Modo celular ligado: toque para desligar' : 'Ligar a aprovação pelo celular';
  }

  function showApprovalError(message) {
    approvalError.textContent = message || '';
    approvalError.hidden = !message;
  }

  function setApprovalBusy(busy) {
    approvalBusy = busy;
    [approvalPrimary, approvalSecondary, approvalTerminal].forEach(btn => { btn.disabled = busy; });
  }

  async function postApprovalJson(url, body, extraHeaders = {}) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...getAuthHeaders(), ...extraHeaders },
      credentials: 'same-origin',
      body: JSON.stringify(body)
    });
    let data = {};
    try { data = await res.json(); } catch (_) { data = {}; }
    if (!res.ok) {
      const error = new Error(data.error || `Falha (${res.status})`);
      error.status = res.status;
      throw error;
    }
    return data;
  }

  function openApprovalSheet() {
    approvalSheet.classList.remove('hidden');
    showApprovalError('');
    approvalPin.value = '';
  }

  function closeApprovalSheet() {
    approvalSheet.classList.add('hidden');
    clearInterval(approvalCountdown);
    approvalCountdown = null;
    approvalPin.value = '';
    currentRequest = null;
    sheetMode = null;
    showNextRequest();
  }

  function startCountdown(expiresAt) {
    clearInterval(approvalCountdown);
    const tick = () => {
      const left = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      approvalTimer.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      if (left <= 0) {
        clearInterval(approvalCountdown);
        showApprovalError('Prazo encerrado: o pedido voltou para o terminal.');
        setTimeout(() => { if (currentRequest && currentRequest.expiresAt <= Date.now()) closeApprovalSheet(); }, 2500);
      }
    };
    tick();
    approvalCountdown = setInterval(tick, 1000);
  }

  function renderQuestionStep() {
    const q = currentRequest.questions[questionIndex];
    const total = currentRequest.questions.length;
    selectedOptions = new Set();
    approvalBadge.textContent = total > 1 ? `PERGUNTA ${questionIndex + 1}/${total}` : 'PERGUNTA DO CLAUDE';
    approvalTitle.textContent = q.question;
    approvalSummary.textContent = q.multiSelect ? 'Escolha uma ou mais opções.' : 'Escolha uma opção.';
    const buttons = q.options.map(option => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'approval-option';
      btn.append(makeSpan('option-label', option.label));
      if (option.description) btn.append(makeSpan('option-desc', option.description));
      btn.addEventListener('click', () => {
        if (q.multiSelect) {
          if (selectedOptions.has(option.label)) selectedOptions.delete(option.label);
          else selectedOptions.add(option.label);
          btn.classList.toggle('selected', selectedOptions.has(option.label));
        } else {
          selectedOptions = new Set([option.label]);
          approvalQuestions.querySelectorAll('.approval-option').forEach(el => el.classList.toggle('selected', el === btn));
        }
      });
      return btn;
    });
    approvalQuestions.replaceChildren(...buttons);
    approvalQuestions.hidden = false;
    approvalPrimary.textContent = questionIndex + 1 < total ? 'PRÓXIMA' : 'ENVIAR';
  }

  function showRequest(request) {
    currentRequest = request;
    sheetMode = request.kind === 'question' ? 'question' : 'permission';
    openApprovalSheet();
    approvalProject.textContent = request.project ? `Projeto: ${request.project}` : '';
    approvalTerminal.hidden = false;
    // Com o PIN lembrado, o campo some e a decisão vai direto
    approvalPin.hidden = Boolean(rememberedApprovalPin);
    if (sheetMode === 'question') {
      questionIndex = 0;
      collectedAnswers = {};
      approvalSecondary.hidden = true;
      renderQuestionStep();
    } else {
      approvalBadge.textContent = 'APROVAÇÃO NECESSÁRIA';
      approvalTitle.textContent = 'Claude Code precisa de aprovação';
      approvalSummary.textContent = request.summary || '';
      approvalQuestions.replaceChildren();
      approvalQuestions.hidden = true;
      approvalPrimary.textContent = 'PERMITIR';
      approvalSecondary.textContent = 'NEGAR';
      approvalSecondary.hidden = false;
    }
    startCountdown(request.expiresAt);
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    Snd.play('approval');
  }

  function showNextRequest() {
    while (pendingRequests.length && pendingRequests[0].expiresAt <= Date.now()) pendingRequests.shift();
    const next = pendingRequests.shift();
    if (next) showRequest(next);
  }

  function enqueueRequest(request) {
    if (!request || !request.id || request.expiresAt <= Date.now()) return;
    if (currentRequest?.id === request.id || pendingRequests.some(r => r.id === request.id)) return;
    pendingRequests.push(request);
    if (!sheetMode) showNextRequest();
  }

  function removeRequest(id) {
    const index = pendingRequests.findIndex(r => r.id === id);
    if (index !== -1) pendingRequests.splice(index, 1);
    if (currentRequest?.id === id) closeApprovalSheet();
  }

  async function sendDecision(action, answers) {
    if (!currentRequest || approvalBusy) return;
    const typedPin = approvalPin.value.trim();
    const pin = typedPin || rememberedApprovalPin;
    if (action !== 'terminal' && !pin) {
      approvalPin.hidden = false;
      showApprovalError('Digite o segundo PIN.');
      approvalPin.focus();
      return;
    }
    setApprovalBusy(true);
    try {
      await postApprovalJson(
        `/api/approvals/${encodeURIComponent(currentRequest.id)}/decision`,
        { action, ...(answers ? { answers } : {}) },
        action === 'terminal' ? {} : { 'x-echo-approval-pin': pin }
      );
      // PIN digitado depois de reabrir o app: volta a ser lembrado enquanto o modo estiver ligado
      if (typedPin && phoneModeEnabled) rememberedApprovalPin = typedPin;
      Snd.play(action === 'deny' ? 'error' : 'pop');
      closeApprovalSheet();
    } catch (err) {
      // PIN recusado (trocado no PC, por exemplo): esquece e pede de novo
      if (err.status === 401 || err.status === 429) {
        rememberedApprovalPin = '';
        approvalPin.hidden = false;
      }
      showApprovalError(err.message);
    } finally {
      setApprovalBusy(false);
    }
  }

  // Converte a chave pública VAPID (base64url) para o formato do PushManager
  function urlBase64ToUint8Array(base64) {
    const padded = (base64 + '='.repeat((4 - base64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(padded);
    return Uint8Array.from([...raw].map(ch => ch.charCodeAt(0)));
  }

  // Notificações: pede permissão (no toque que ligou o modo) e inscreve este celular
  async function enablePushNotifications() {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'sem suporte';
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permission !== 'granted') return 'permissão negada';
      const registration = await navigator.serviceWorker.ready;
      const keyRes = await fetch('/api/push/key', { headers: getAuthHeaders(), credentials: 'same-origin' });
      const { publicKey } = await keyRes.json();
      if (!publicKey) return 'servidor sem notificações';
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      }
      await postApprovalJson('/api/push/subscribe', { subscription: subscription.toJSON() });
      return 'ok';
    } catch (err) {
      console.warn('Notificações:', err.message);
      return err.message;
    }
  }

  function openModeSheet() {
    sheetMode = 'mode';
    currentRequest = null;
    openApprovalSheet();
    clearInterval(approvalCountdown);
    approvalTimer.textContent = '';
    approvalBadge.textContent = 'MODO CELULAR';
    approvalTitle.textContent = 'Aprovar pelo celular';
    approvalSummary.textContent = 'Com o modo ligado, cada pedido do Claude Code espera até 110 s pela sua resposta aqui antes de aparecer no terminal.';
    approvalProject.textContent = 'O segundo PIN fica lembrado neste celular enquanto o modo estiver ligado. Desligue o modo quando estiver no PC.';
    approvalQuestions.replaceChildren();
    approvalQuestions.hidden = true;
    approvalPrimary.textContent = 'ATIVAR';
    approvalSecondary.textContent = 'CANCELAR';
    approvalSecondary.hidden = false;
    approvalTerminal.hidden = true;
    approvalPin.hidden = false;
    approvalPin.focus();
  }

  async function activatePhoneMode() {
    const pin = approvalPin.value.trim();
    if (!pin) {
      showApprovalError('Digite o segundo PIN.');
      return;
    }
    setApprovalBusy(true);
    try {
      await postApprovalJson('/api/approvals/mode', { enabled: true }, { 'x-echo-approval-pin': pin });
      setPhoneMode(true);
      rememberedApprovalPin = pin;
      // Ainda dentro do toque: o Android só mostra o pedido de permissão de notificação com um gesto
      const push = await enablePushNotifications();
      closeApprovalSheet();
      displayInfoCard({
        badge: 'MODO CELULAR',
        title: 'Aprovação pelo celular ligada',
        rows: [{ label: 'Notificações', value: push === 'ok' ? 'ativas neste celular' : `não ativadas (${push})`, status: push === 'ok' ? 'ok' : 'warn' }]
      });
    } catch (err) {
      showApprovalError(err.message);
    } finally {
      setApprovalBusy(false);
    }
  }

  async function refreshApprovals() {
    try {
      const res = await fetch('/api/approvals', { headers: getAuthHeaders(), credentials: 'same-origin' });
      if (!res.ok) return;
      const data = await res.json();
      approvalConfigured = Boolean(data.configured);
      setPhoneMode(data.mode?.enabled);
      (data.pending || []).forEach(enqueueRequest);
    } catch (_) {
      // Sem conexão: a próxima reconexão tenta de novo
    }
  }

  approvalPrimary?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (sheetMode === 'mode') return activatePhoneMode();
    if (sheetMode === 'permission') return sendDecision('allow');
    if (sheetMode === 'question') {
      const q = currentRequest.questions[questionIndex];
      if (!selectedOptions.size) return showApprovalError('Escolha uma opção.');
      collectedAnswers[q.question] = q.multiSelect ? [...selectedOptions] : [...selectedOptions][0];
      showApprovalError('');
      if (questionIndex + 1 < currentRequest.questions.length) {
        questionIndex += 1;
        return renderQuestionStep();
      }
      return sendDecision('answer', collectedAnswers);
    }
    return undefined;
  });

  approvalSecondary?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (sheetMode === 'mode') return closeApprovalSheet();
    if (sheetMode === 'permission') return sendDecision('deny');
    return undefined;
  });

  approvalTerminal?.addEventListener('click', (e) => {
    e.stopPropagation();
    sendDecision('terminal');
  });

  approvalPin?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') approvalPrimary.click();
  });

  // Toques dentro do cartão não acionam o resto da tela
  approvalSheet?.addEventListener('click', (e) => e.stopPropagation());

  phoneModeBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (phoneModeEnabled) {
      try {
        await postApprovalJson('/api/approvals/mode', { enabled: false });
        setPhoneMode(false);
      } catch (err) {
        displayInfoCard({ badge: 'MODO CELULAR', title: 'Não foi possível desligar', detail1: err.message });
      }
      return;
    }
    if (!approvalConfigured) {
      displayInfoCard({
        badge: 'MODO CELULAR',
        title: 'Segundo PIN não configurado',
        detail1: 'Defina ECHO_APPROVAL_PIN no .env do PC e reinicie o Echo.'
      });
      return;
    }
    openModeSheet();
  });

  // Aviso único: página montada bem mais larga que a tela do aparelho de toque ("Site para computador")
  (function checkDesktopMode() {
    const hint = document.getElementById('desktop-hint');
    if (!hint) return;
    // window.screen: aqui "screen" é o elemento da tela do app
    const device = window.screen;
    const touch = navigator.maxTouchPoints > 0;
    const narrowScreen = Math.min(device.width, device.height) < 600;
    if (!touch || !narrowScreen || window.innerWidth < device.width * 1.5) return;
    let seen = false;
    try { seen = localStorage.getItem('echo_desktop_hint') === '1'; } catch (_) { seen = false; }
    if (seen) return;
    hint.classList.remove('hidden');
    document.getElementById('desktop-hint-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      hint.classList.add('hidden');
      try { localStorage.setItem('echo_desktop_hint', '1'); } catch (_) { /* só nesta sessão */ }
    });
  })();

  // ========================================================
  // 9. RENDERIZAÇÃO DE ESTADOS DO PC VIA SSE
  // ========================================================
  // Nomes de agentes chegam do servidor: sempre como texto, nunca como HTML
  function makeSpan(className, text) {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = text;
    return span;
  }

  function makeAgentChip(name) {
    const label = String(name ?? '');
    const lower = label.toLowerCase();
    let chipClass = 'chip-antigravity';
    let icon = '⚡';
    if (lower.includes('claude')) {
      chipClass = 'chip-claude';
      icon = '🔥';
    } else if (lower.includes('codex')) {
      chipClass = 'chip-codex';
      icon = '💻';
    }
    return makeSpan(`agent-chip ${chipClass}`, `${icon} ${label}`);
  }

  function renderAgentChips(state) {
    const container = document.getElementById('agents-chips-container');
    if (!container) return;

    if (state.isMultiAgent && state.activeAgents && state.activeAgents.length > 0) {
      const nodes = [makeSpan('agents-header-tag', '// CONCORRENTES:'), document.createTextNode(' ')];
      state.activeAgents.forEach((name, index) => {
        if (index > 0) nodes.push(document.createTextNode(' '), makeSpan('plus-sep', '+'), document.createTextNode(' '));
        nodes.push(makeAgentChip(name));
      });
      container.replaceChildren(...nodes);
    } else if (state.agent && state.agent !== 'ECHO' && state.state !== 'idle') {
      container.replaceChildren(makeSpan('agents-header-tag', '// AGENTE:'), document.createTextNode(' '), makeAgentChip(state.agent));
    } else {
      container.replaceChildren(makeSpan('agents-header-tag', '// SESSÃO:'), document.createTextNode(' '), makeSpan('agent-chip chip-idle', '💤 AGUARDANDO AGENTES'));
    }
  }

  function renderState(state) {
    currentState = state;

    if (state.project) brandProject.textContent = state.project;
    if (state.badge) badgeTop.textContent = state.badge;

    renderAgentChips(state);

    if (state.isMultiAgent) {
      echoWrapper.classList.add('theme-multi-agent');
    } else {
      echoWrapper.classList.remove('theme-multi-agent');
    }

    // Comportamento: Chegar para o lado quando mostrar algo (mode: 'info')
    // Uma ação local continua visível mesmo quando SSE envia telemetria/idle.
    // Cartão de dados aberto (CHECK, consultas) também continua até o próprio tempo acabar
    const isInfoMode = state.mode === 'info' || (wazeLink && !wazeLink.hidden) || (calendarActions && !calendarActions.hidden) || infoPanel.dataset?.card === 'open';
    if (isInfoMode) {
      echoWrapper.className = `echo-wrapper mode-info ${state.isMultiAgent ? 'theme-multi-agent' : ''}`;
      infoPanel.classList.add('visible');
      // O robô olha expressivamente em direção aos dados (direita no landscape, baixo no portrait)
      setLookForInfoMode();
    } else {
      echoWrapper.className = `echo-wrapper mode-full ${state.isMultiAgent ? 'theme-multi-agent' : ''}`;
      infoPanel.classList.remove('visible');
      mochi.look.x = 0;
      mochi.look.y = 0;
    }

    // Se estiver no meio do reconhecimento de fala, preserva escuta — exceto alertas (aprovação e erro), que têm prioridade
    const isAlert = state.state === 'waiting' || state.badge === 'APROVAÇÃO NECESSÁRIA' || state.state === 'error';
    if (isListening && !isAlert) return;

    // Mapeamento de Estados para o 2D Bot
    if (state.state === 'waiting' || state.badge === 'APROVAÇÃO NECESSÁRIA') {
      mochi.setState('approval');
      panelBadge.textContent = state.badge || 'APROVAÇÃO NECESSÁRIA';
      panelMainText.textContent = state.title || 'APROVAR?';
      panelMainText.style.color = 'var(--amber-neon)';
      setPanelProgress(null);
      renderCardRows(null);
      panelSubLine1.textContent = state.detail || 'Aguardando autorização no PC';
      panelSubLine2.textContent = 'Verifique o plano proposto no console';
    } else if (state.state === 'error') {
      mochi.setState('error');
      panelBadge.textContent = state.badge || 'ERRO';
      panelMainText.textContent = state.title || 'FALHA NA TAREFA';
      panelMainText.style.color = 'var(--rose-neon)';
      setPanelProgress(null);
      renderCardRows(null);
      panelSubLine1.textContent = state.detail || 'Ocorreu um erro durante a execução';
      panelSubLine2.textContent = 'Consulte o log de erro no PC';
    } else if (state.state === 'success') {
      mochi.setState('finished');
    } else if (state.state === 'working') {
      mochi.setState(state.isMultiAgent ? 'multi' : 'working');
    } else {
      mochi.setState('idle');
    }

    // Alerta durante a escuta: só o visual; a fala espera o fim do reconhecimento
    if (isListening) return;

    // Voz
    if (state.voiceMessage && state.voiceMessage !== lastVoicePlayed) {
      lastVoicePlayed = state.voiceMessage;
      voiceText.textContent = state.voiceMessage;
      panelVoice.style.display = 'block';
      // Se a mensagem veio da conversa ativa, o próprio chat já disparou a fala
      if (state.voiceOrigin !== 'converse') {
        speak(state.voiceMessage);
      }
    }
  }

  // ========================================================
  // 10. CONEXÃO SSE & AUTENTICAÇÃO
  // ========================================================
  function connectSSE() {
    if (sseSource) sseSource.close();

    connectionStatus.textContent = 'CONECTANDO...';
    connectionStatus.style.color = 'var(--cyan-neon)';

    const pin = localStorage.getItem('echo_pin');
    const streamUrl = pin ? `/api/stream?pin=${encodeURIComponent(pin)}` : '/api/stream';
    sseSource = new EventSource(streamUrl);

    sseSource.onopen = () => {
      connectionStatus.textContent = 'ONLINE // CONECTADO';
      connectionStatus.style.color = 'var(--matrix-neon)';
      statusDot.style.backgroundColor = 'var(--cyan-neon)';
      pinModal.classList.add('hidden');
      // Modo celular: estado do interruptor e pedidos que chegaram enquanto estava desconectado
      refreshApprovals();
    };

    sseSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        renderState(data);
        updateActivityTicker(data);
        resetInactivity();
      } catch (e) {
        console.error('Erro ao processar estado SSE:', e);
      }
    };

    sseSource.addEventListener('mascot_state', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.accessory) {
          mochi.setAccessory(data.accessory, 5000);
        }
        if (data.text) showBubble(data.text, 'speech');
        resetInactivity();
      } catch (_) {}
    });

    sseSource.addEventListener('telemetry_alert', () => {
      resetInactivity();
    });

    sseSource.addEventListener('approval_request', (event) => {
      try { enqueueRequest(JSON.parse(event.data)); } catch (_) { /* evento inválido */ }
      wakeUp();
      resetInactivity();
    });

    sseSource.addEventListener('approval_resolved', (event) => {
      try { removeRequest(JSON.parse(event.data).id); } catch (_) { /* evento inválido */ }
    });

    sseSource.addEventListener('approval_mode', (event) => {
      try { setPhoneMode(JSON.parse(event.data).enabled); } catch (_) { /* evento inválido */ }
    });

    sseSource.onerror = (err) => {
      connectionStatus.textContent = 'DESCONECTADO // RECONECTANDO...';
      connectionStatus.style.color = 'var(--amber-neon)';
      statusDot.style.backgroundColor = 'var(--amber-neon)';
      sseSource.close();
      checkAuthAndPromptPin();
      setTimeout(connectSSE, 4000);
    };
  }

  async function checkAuthAndPromptPin() {
    try {
      const res = await fetch('/api/auth/status', {
        headers: getAuthHeaders(),
        credentials: 'same-origin'
      });
      const data = await res.json();
      if (!data.authorized) {
        pinModal.classList.remove('hidden');
        pinInput.focus();
      } else {
        pinModal.classList.add('hidden');
      }
    } catch (e) {}
  }

  async function submitPin() {
    const pin = pinInput.value.trim();
    if (!pin) return;

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();

      if (data.ok) {
        pinModal.classList.add('hidden');
        pinError.style.display = 'none';
        localStorage.setItem('echo_pin', pin);
        connectSSE();
      } else {
        pinError.style.display = 'block';
      }
    } catch (err) {
      pinError.textContent = 'Erro ao validar PIN. Tente novamente.';
      pinError.style.display = 'block';
    }
  }

  pinBtn.addEventListener('click', submitPin);
  pinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitPin();
  });

  // PWA Service Worker com auto-update
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        reg.update();
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                window.location.reload();
              }
            });
          }
        });
      }).catch(() => {});
    });
  }

  // Inicialização
  const urlParams = new URLSearchParams(window.location.search);
  const pinFromUrl = urlParams.get('pin');
  if (pinFromUrl) {
    pinInput.value = pinFromUrl;
    submitPin();
  } else {
    checkAuthAndPromptPin();
  }

  // ========================================================
  // 11. TEMPORIZADOR DE INATIVIDADE (CAFÉ AOS 3 MIN & SONO AOS 6 MIN)
  // ========================================================
  let inactivityTimer = null;
  let sleepTimer = null;

  function wakeUp() {
    if (mochi && mochi.state === 'sleeping') {
      mochi.setState('idle');
      document.body.classList.remove('sleep-mode');
      Snd.play('pop');
      if (handsFreeMode) {
        resumeListeningIfHandsFree();
      }
    }
  }

  function resetInactivity() {
    clearTimeout(inactivityTimer);
    clearTimeout(sleepTimer);

    if (mochi && mochi.state === 'sleeping') {
      wakeUp();
    }

    if (mochi && mochi.accessory === 'coffee') {
      mochi.setAccessory('none');
    }

    // Nível 1: 3 minutos (180s) -> Caneca de café
    inactivityTimer = setTimeout(() => {
      if (mochi && !mochi.speaking && !isListening && !processingSpeech && mochi.state !== 'sleeping') {
        mochi.setAccessory('coffee');
      }
    }, 180000);

    // Nível 2: 6 minutos (360s) -> Adormece em modo sono
    sleepTimer = setTimeout(() => {
      if (mochi && !mochi.speaking && !isListening && !processingSpeech) {
        mochi.setAccessory('none');
        mochi.setState('sleeping');
        document.body.classList.add('sleep-mode');
      }
    }, 360000);
  }

  window.addEventListener('pointerdown', () => {
    wakeUp();
    resetInactivity();
  }, { passive: true });

  window.addEventListener('keydown', () => {
    wakeUp();
    resetInactivity();
  }, { passive: true });

  // Sem zoom por gesto: cancela pinça (dois ou mais dedos) e o gesto de zoom do Safari
  document.addEventListener('touchmove', (event) => {
    if (event.touches && event.touches.length > 1) event.preventDefault();
  }, { passive: false });
  document.addEventListener('gesturestart', (event) => event.preventDefault());

  resetInactivity();

  const sharedLocation = window.createEchoLocation({ scope: 'echo', getHeaders: getAuthHeaders, speak });
  setupSpeechRecognition();
  connectSSE();
  initializeCalendar().catch(() => {});
})();
