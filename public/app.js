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
  const Snd = {
    ctx: null, on: true, vol: 0.5,
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

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = 280 * dpr;
      canvas.height = 280 * dpr;
      canvas.style.width = '280px';
      canvas.style.height = '280px';
      this.x.scale(dpr, dpr);
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
      this.state = n;
      const c = this.cfg = STATES[n];
      this.colT = hexRgb(c.col);
      this.tg.tint = c.tint;
      this.tg.tilt = c.tilt || 0;
      this.setBadge(c.badge);

      if (n === 'finished') {
        this.roll(850, 1);
        setTimeout(() => this.emit('spark', 6), 450);
        Snd.play('finish');
      } else if (n === 'error') {
        this.anim('ox', [[0.08, 50, E.out], [-0.08, 70, E.inOut], [0.05, 70, E.inOut], [0, 90, E.out]]);
        Snd.play('slap');
      } else if (n === 'approval') {
        this.anim('oy', [[-0.2, 140, E.out], [0, 280, E.back]]);
        Snd.play('pop');
      } else if (n === 'thinking') {
        this.anim('tilt', [[-0.12, 220, E.out]]);
        Snd.play('love');
      } else if (n === 'listening') {
        this.anim('tilt', [[0.18, 220, E.out]]);
        this.anim('es', [[1.22, 180, E.out]]);
        Snd.play('listen');
      } else if (n === 'working') {
        this.anim('sy', [[0.95, 120, E.out], [1, 140, E.inOut]]);
        Snd.play('proud');
      } else {
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

  const connectionStatus = document.getElementById('connection-status');
  const telemetryBar = document.getElementById('telemetry-bar');
  const audioToast = document.getElementById('audio-toast');
  const micBtn = document.getElementById('mic-btn');
  const micLabel = document.getElementById('mic-label');
  const voiceTranscription = document.getElementById('voice-transcription');
  const transcriptionText = document.getElementById('transcription-text');

  const pinModal = document.getElementById('pin-modal');
  const pinInput = document.getElementById('pin-input');
  const pinBtn = document.getElementById('pin-btn');
  const pinError = document.getElementById('pin-error');
  const rotateBtn = document.getElementById('rotate-btn');

  function getAuthHeaders() {
    const pin = localStorage.getItem('echo_pin') || '4884';
    return {
      'Content-Type': 'application/json',
      'x-echo-pin': pin
    };
  }

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
  // 6. ÁUDIO, WAKE LOCK & TRAVA DE ORIENTAÇÃO PAISAGEM
  // ========================================================
  async function enforceLandscape() {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen().catch(() => {});
      }
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape').catch(() => {});
      }
    } catch (e) {}
  }
  window.addEventListener('load', enforceLandscape);
  window.addEventListener('orientationchange', enforceLandscape);

  if (rotateBtn) {
    rotateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      enforceLandscape();
    });
    rotateBtn.addEventListener('touchend', (e) => {
      e.stopPropagation();
      enforceLandscape();
    });
  }

  async function unlockAudioAndWakeLock() {
    enforceLandscape();
    if (!audioUnlocked) {
      audioUnlocked = true;
      audioToast.classList.add('hidden');
      Snd.init();

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
  screen.addEventListener('click', unlockAudioAndWakeLock);
  screen.addEventListener('touchstart', unlockAudioAndWakeLock, { passive: true });

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (err) {
      console.warn('WakeLock:', err.message);
    }
  }

  // ========================================================
  // 7. SÍNTESE DE VOZ COM SINCRONIA DE BOCA E MÃOS
  // ========================================================
  function startSpeakingAnim() {
    mochi.speaking = true;
    clearInterval(speechTimer);
    speechTimer = setInterval(() => {
      Snd.play('speech');
    }, 180);
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

    startSpeakingAnim();

    let playedServerAudio = false;

    // 1. Tenta áudio de alta qualidade do servidor (OpenAI TTS voz 'echo')
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
      micLabel.textContent = handsFreeMode ? 'MÃOS LIVRES' : 'OUVINDO...';
      voiceTranscription.classList.remove('hidden');
      transcriptionText.textContent = 'Ouvindo você...';
      mochi.setState('listening');
    };

    recognition.onresult = (event) => {
      if (processingSpeech || mochi.speaking) return;

      // Pega apenas a sentença atual sem concatenar com históricos anteriores
      const current = event.results[event.results.length - 1];
      if (!current || !current[0]) return;
      const text = current[0].transcript.trim();

      if (text) {
        voiceTranscription.classList.remove('hidden');
        transcriptionText.textContent = text;
      }

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
      micLabel.textContent = handsFreeMode ? 'MÃOS LIVRES' : 'MUDO';
      // Reinicia escuta limpa no modo mãos livres se não estiver falando
      if (handsFreeMode && !mochi.speaking && !processingSpeech && audioUnlocked) {
        setTimeout(startListening, 400);
      } else if (!handsFreeMode) {
        stopListening();
      }
    };
  }

  let infoCardTimeout = null;

  function displayInfoCard(card, replyText) {
    if (!card) return;
    echoWrapper.className = 'echo-wrapper mode-info';
    infoPanel.classList.add('visible');

    panelBadge.textContent = card.badge || 'INFORMAÇÃO';
    panelMainText.textContent = card.title || '';
    panelSubLine1.textContent = card.detail1 || '';
    panelSubLine2.textContent = card.detail2 || '';

    panelVoice.style.display = 'block';
    voiceText.textContent = replyText;

    // Robô olha expressivamente para a direita em direção aos dados
    mochi.look.x = 0.85;
    mochi.look.y = 0.05;

    clearTimeout(infoCardTimeout);
    const duration = Math.max(9000, (replyText.length * 75) + 5000);
    infoCardTimeout = setTimeout(() => {
      if (echoWrapper.classList.contains('mode-info') && currentState?.mode !== 'info') {
        echoWrapper.className = 'echo-wrapper mode-full';
        infoPanel.classList.remove('visible');
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
    transcriptionText.textContent = `"${text}"`;

    try {
      const res = await fetch('/api/converse', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();
      const reply = data?.reply || "Olá, Mestre! Estratégia Nerd online.";

      if (data?.accessory && data.accessory !== 'none') {
        mochi.setAccessory(data.accessory, 5000);
      }

      // Se a resposta contém dados/cartão, desliza para a esquerda e exibe o painel
      if (data?.card) {
        displayInfoCard(data.card, reply);
      }

      transcriptionText.textContent = reply;
      panelVoice.style.display = 'block';
      voiceText.textContent = reply;

      // Responde falando com voz oficial neural, mexendo a boca e mãos
      await speak(reply);

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
    micLabel.textContent = handsFreeMode ? 'MÃOS LIVRES' : 'MUDO';
    setTimeout(() => {
      if (!isListening && !mochi.speaking) voiceTranscription.classList.add('hidden');
    }, 2800);

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
      micLabel.textContent = 'MÃOS LIVRES';
      startListening();
    } else {
      handsFreeMode = false;
      pauseRecognition();
      stopListening();
    }
  });

  // ========================================================
  // 9. RENDERIZAÇÃO DE ESTADOS DO PC VIA SSE
  // ========================================================
  function renderState(state) {
    currentState = state;

    if (state.project) brandProject.textContent = state.project;
    if (state.agent) agentLabel.textContent = state.agent;
    if (state.badge) badgeTop.textContent = state.badge;

    if (state.telemetry) {
      telemetryBar.textContent = `CPU: ${state.telemetry.cpuPercent}% | RAM: ${state.telemetry.ramPercent}%`;
    }

    // Comportamento: Chegar para o lado quando mostrar algo (mode: 'info')
    const isInfoMode = state.mode === 'info';
    if (isInfoMode) {
      echoWrapper.className = 'echo-wrapper mode-info';
      infoPanel.classList.add('visible');
      // O robô olha expressivamente para a direita (em direção aos dados)
      mochi.look.x = 0.85;
      mochi.look.y = 0.05;
    } else {
      echoWrapper.className = 'echo-wrapper mode-full';
      infoPanel.classList.remove('visible');
      mochi.look.x = 0;
      mochi.look.y = 0;
    }

    // Se estiver no meio do reconhecimento de fala, preserva escuta
    if (isListening) return;

    // Mapeamento de Estados para o 2D Bot
    if (state.state === 'waiting' || state.badge === 'APROVAÇÃO NECESSÁRIA') {
      mochi.setState('approval');
      panelBadge.textContent = state.badge || 'APROVAÇÃO NECESSÁRIA';
      panelMainText.textContent = state.title || 'APROVAR?';
      panelMainText.style.color = 'var(--amber-neon)';
      panelFill.style.width = '100%';
      panelFill.style.backgroundColor = 'var(--amber-neon)';
      panelSubLine1.textContent = state.detail || 'Aguardando autorização no PC';
      panelSubLine2.textContent = 'Verifique o plano proposto no console';
    } else if (state.state === 'error') {
      mochi.setState('error');
      panelBadge.textContent = state.badge || 'ERRO';
      panelMainText.textContent = state.title || 'FALHA NA TAREFA';
      panelMainText.style.color = 'var(--rose-neon)';
      panelFill.style.width = '100%';
      panelFill.style.backgroundColor = 'var(--rose-neon)';
      panelSubLine1.textContent = state.detail || 'Ocorreu um erro durante a execução';
      panelSubLine2.textContent = 'Consulte o log de erro no PC';
    } else if (state.state === 'success') {
      mochi.setState('finished');
    } else if (state.state === 'working') {
      mochi.setState('working');
    } else {
      mochi.setState('idle');
    }

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

    sseSource = new EventSource('/api/stream');

    sseSource.onopen = () => {
      connectionStatus.textContent = 'ONLINE // CONECTADO';
      connectionStatus.style.color = 'var(--matrix-neon)';
      statusDot.style.backgroundColor = 'var(--cyan-neon)';
      pinModal.classList.add('hidden');
    };

    sseSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        renderState(data);
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
        if (data.text) {
          transcriptionText.textContent = data.text;
          voiceTranscription.classList.remove('hidden');
        }
        resetInactivity();
      } catch (_) {}
    });

    sseSource.addEventListener('telemetry_alert', () => {
      resetInactivity();
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

  // PWA Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
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

  resetInactivity();

  setupSpeechRecognition();
  connectSSE();
})();
