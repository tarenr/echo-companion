/**
 * Luna // Assistente Pessoal Inteligente
 * Motor 2D oficial (clone do Echo/MochiBot) com física fluida, laço animado e voz Thalita Neural
 */
(() => {
  'use strict';

  // ========================================================
  // 1. UTILITÁRIOS MATEMÁTICOS & EASING (CLONE MOCHIBOT)
  // ========================================================
  const NOW = () => performance.now();
  const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));
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
    x.bezierCurveTo(s * 0.5, -s * 0.95, s * 1.05, -s * 0.15, 0, -s * 0.38);
    x.closePath();
  }

  // ========================================================
  // 2. SINTETIZADOR DE ÁUDIO WEB AUDIO (SONS RETRÔ DA LUNA)
  // ========================================================
  const Snd = {
    ctx: null, on: true, vol: 0.45,
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
      if (name === 'pop') {
        this.tone({ f: 520, to: 880, d: 0.09, type: 'sine', g: 0.12 });
      } else if (name === 'love') {
        this.tone({ f: 587, to: 784, d: 0.25, type: 'sine', g: 0.1 });
      } else if (name === 'listen') {
        this.tone({ f: 493, to: 740, d: 0.15, type: 'sine', g: 0.1 });
      } else if (name === 'finish') {
        this.tone({ f: 587, to: 1174, d: 0.32, type: 'triangle', g: 0.14 });
      } else if (name === 'slap') {
        this.tone({ f: 320, to: 140, d: 0.12, type: 'triangle', g: 0.14 });
      }
    }
  };

  // ========================================================
  // 3. IDENTIDADE VISUAL LUMINOSA DA LUNA
  // ========================================================
  const LUNA_SPEC = {
    shape: 'mochi',
    eye: { w: 0.25, h: 0.27, sp: 0.37, p: -0.12 },
    base: ['#faf5ff', '#ebd8fd'], // Corpo Lavanda Claro LUMINOSO e Limpo
    ink: '#2e1065',                // Traço Roxo Real Escuro para olhos e boca super nítidos
    accent: '#c084fc',             // Lavanda Neon Vibrante
    outline: 'rgba(192, 132, 252, 0.75)',
    blush: '#f472b6',              // Bochechas Rosadas Vivas
    bow1: '#c084fc',               // Laço Lavanda
    bow2: '#9333ea',               // Sombra Ametista do Laço
    knot: '#ffffff'                // Nó Central Brilhante
  };

  const STATES = {
    idle: { label: 'Pronta', col: '#c084fc', tint: 0, eye: 'pill' },
    talking: { label: 'Falando', col: '#c084fc', tint: 0.35, eye: 'pill' },
    thinking: { label: 'Pensando', col: '#e879f9', tint: 0.55, eye: 'pill' },
    listening: { label: 'Ouvindo', col: '#a855f7', tint: 0.40, eye: 'dot' },
    happy: { label: 'Feliz', col: '#f472b6', tint: 0.35, eye: 'happy' },
    sleeping: { label: 'Dormindo', col: '#818cf8', tint: 0.15, eye: 'sleep' }
  };

  // ========================================================
  // 4. CLASSE BOT 2D DA LUNA (CLONE DO MOTOR MOCHIBOT)
  // ========================================================
  class LunaBot {
    constructor(canvas) {
      this.c = canvas;
      this.x = canvas.getContext('2d');
      this.s = {
        yaw: 0, pitch: 0, roll: 0, tilt: 0,
        open: 1, sx: 1, sy: 1, oy: 0, ox: 0,
        tint: 0, morph: 0, hands: 0, blush: 0.4,
        es: 1, badgeS: 0,
        mouthOpen: 0
      };
      this.tg = { ...this.s };
      this.tw = [];
      this.lock = {};
      this.col = [192, 132, 252];
      this.colT = [192, 132, 252];
      this.state = 'idle';
      this.cfg = STATES.idle;
      this.eyeOv = null;
      this.ovUntil = 0;
      this.parts = [];
      this.nextBlink = NOW() + 2000 + Math.random() * 2000;
      this.nextSaccade = NOW() + 1500;
      this.look = { x: 0, y: 0 };
      this.t0 = NOW();
      this.last = NOW();
      this.speaking = false;

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = 280 * dpr;
      canvas.height = 280 * dpr;
      canvas.style.width = '280px';
      canvas.style.height = '280px';
      this.x.scale(dpr, dpr);
    }

    anim(p, keys, after) {
      this.tw = this.tw.filter(t => t.p !== p);
      this.tw.push({ p, keys, i: 0, from: this.s[p], t0: NOW(), after });
      this.lock[p] = 1;
    }

    setState(n) {
      if (!STATES[n]) return;
      this.state = n;
      const c = this.cfg = STATES[n];
      this.colT = hexRgb(c.col);
      this.tg.tint = c.tint;

      if (n === 'thinking') {
        this.anim('tilt', [[-0.14, 220, E.out]]);
        Snd.play('love');
      } else if (n === 'listening') {
        this.anim('tilt', [[0.16, 220, E.out]]);
        this.anim('es', [[1.20, 180, E.out]]);
        Snd.play('listen');
      } else if (n === 'happy') {
        this.anim('oy', [[-0.15, 140, E.out], [0, 260, E.back]]);
        Snd.play('pop');
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

    spawnSleepZ() {
      this.parts.push({
        type: 'zzz',
        char: Math.random() > 0.4 ? 'z' : 'Z',
        x: 0.42 + Math.random() * 0.15,
        y: -0.45 - Math.random() * 0.1,
        vx: 0.12 + Math.random() * 0.08,
        vy: -0.38 - Math.random() * 0.18,
        sz: 0.16,
        life: 2.8,
        age: 0
      });
    }

    update() {
      const n = NOW(), dt = Math.min(0.05, (n - this.last) / 1000);
      this.last = n;
      const s = this.s, tg = this.tg, t = (n - this.t0) / 1000;

      // Execução dos tweens
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

      // Micro-sacadas orgânicas do olhar quando ociosa
      if (this.state !== 'sleeping' && n > this.nextSaccade) {
        if (Math.random() < 0.6) {
          this.look.x = (Math.random() - 0.5) * 0.65;
          this.look.y = (Math.random() - 0.5) * 0.35;
        } else {
          this.look.x = 0;
          this.look.y = 0;
        }
        this.nextSaccade = n + 2200 + Math.random() * 3000;
      }

      // Clamp suave de rotação de cabeça
      tg.yaw = clamp(this.look.x * 0.45, -0.42, 0.42);
      tg.pitch = clamp(this.look.y * 0.28, -0.24, 0.16);
      tg.sy = 1 + Math.sin(t * 1.8) * 0.025;
      tg.sx = 1 - Math.sin(t * 1.8) * 0.015;

      // SINCRONISMO DE BOCA E MÃOS (IDÊNTICO AO ECHO)
      if (this.speaking) {
        s.mouthOpen = (Math.sin(t * 16) + 1) / 2;
        tg.tilt = Math.sin(t * 6) * 0.06;
        s.hands = 1;
      } else {
        s.mouthOpen = 0;
        s.hands = 0;
      }

      // Modo Dormindo
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

      for (const p of this.parts) p.age += dt;
      this.parts = this.parts.filter(p => p.age < p.life);
    }

    draw() {
      const x = this.x, W = 280, H = 280, s = this.s, P = LUNA_SPEC;
      x.clearRect(0, 0, W, H);

      const R = W * 0.3;
      let rx = R * 1.14, ry = R * 0.88;
      const cx = W / 2 + s.ox * R, cy = H / 2 + s.oy * R + R * 0.06;

      x.save();
      x.translate(cx, cy);
      x.rotate(s.tilt);
      x.scale(s.sx, s.sy);

      // 1. Corpo Superelipse LUMINOSO
      const path = new Path2D();
      for (let i = 0; i <= 72; i++) {
        const a = i / 72 * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const px = rx * Math.sign(ca) * Math.pow(Math.abs(ca), 2 / 2.7);
        const py = ry * Math.sign(sa) * Math.pow(Math.abs(sa), 2 / 2.7);
        i ? path.lineTo(px, py) : path.moveTo(px, py);
      }
      path.closePath();

      // Gradiente Base Claro Lavanda
      const c0 = hexRgb(P.base[0]), c1 = hexRgb(P.base[1]);
      const g = x.createLinearGradient(0, -ry, 0, ry);
      g.addColorStop(0, rgba(c0, 1));
      g.addColorStop(1, rgba(c1, 1));
      x.fillStyle = g;
      x.fill(path);

      // Tintura de Estado
      if (s.tint > 0.01) {
        const tg2 = x.createLinearGradient(0, ry, 0, -ry * 0.3);
        tg2.addColorStop(0, rgba(this.col, 0.75 * s.tint));
        tg2.addColorStop(1, rgba(this.col, 0));
        x.fillStyle = tg2;
        x.fill(path);
      }

      // Borda Lavanda Neon Iluminada
      x.strokeStyle = P.outline;
      x.lineWidth = 2.4;
      x.stroke(path);

      // 2. Bochechas Rosadas Vivas
      const bl = Math.max(s.blush, 0.38);
      if (bl > 0.01) {
        x.save();
        x.clip(path);
        const yo = Math.sin(s.yaw) * rx * 0.7;
        x.fillStyle = `rgba(244, 114, 182, ${0.55 * bl})`;
        for (const sd of [-1, 1]) {
          x.beginPath();
          x.ellipse(sd * rx * 0.52 + yo, ry * 0.18, R * 0.16, R * 0.09, 0, 0, Math.PI * 2);
          x.fill();
        }
        x.restore();
      }

      // 3. Mãos Gesticulando
      if (s.hands > 0.05) {
        const hr = R * 0.18 * s.hands;
        const t = NOW() / 1000;
        x.fillStyle = '#fdf4ff';
        x.strokeStyle = '#c084fc';
        x.lineWidth = 2.2;

        for (const sd of [-1, 1]) {
          const hx = sd * rx * 1.25 * s.sx;
          const hy = ry * 0.35 + Math.sin(t * 8 + sd) * 6;
          x.beginPath();
          x.arc(hx, hy, hr, 0, Math.PI * 2);
          x.fill();
          x.stroke();
        }
      }

      // 4. Boca (Sincronizada perfeitamente com a fala e centralizada na face)
      const mouthYaw = s.yaw;
      let mouthPitch = P.eye.p - 0.20 + s.pitch + s.roll;
      mouthPitch = ((mouthPitch + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;

      const cpMouth = Math.cos(mouthPitch);
      if (Math.cos(mouthYaw) * cpMouth >= 0.04) {
        let mx = Math.sin(mouthYaw) * cpMouth * rx;
        let my = -Math.sin(mouthPitch) * ry;

        mx = clamp(mx, -rx * 0.45, rx * 0.45);
        my = clamp(my, ry * 0.12, ry * 0.55);

        const mfx = Math.max(0.20, Math.cos(mouthYaw));
        const mfy = Math.max(0.20, cpMouth);

        x.save();
        x.clip(path);
        x.translate(mx, my);
        x.scale(mfx, mfy);

        if (s.mouthOpen > 0.05) {
          // Boca aberta falando 'o' (perfeitamente sincronizada com o áudio)
          x.fillStyle = P.ink;
          x.beginPath();
          x.ellipse(0, 0, 5.5, 2.5 + s.mouthOpen * 6.5, 0, 0, Math.PI * 2);
          x.fill();
        } else if (this.state !== 'sleeping') {
          // Sorriso suave fechado
          x.strokeStyle = P.ink;
          x.lineWidth = 2.4;
          x.lineCap = 'round';
          x.beginPath();
          x.moveTo(-3.5, 0);
          x.lineTo(3.5, 0);
          x.stroke();
        }
        x.restore();
      }

      // 5. Olhos 2D com Projeção 3D da Face
      x.save();
      x.clip(path);
      x.fillStyle = P.ink;
      x.strokeStyle = P.ink;

      const shape = this.cfg.eye;
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

      // ========================================================
      // 6. O LAÇO NA CABEÇA (ORGANICAMENTE ACOPLADO AO CORPO)
      // ========================================================
      const bowX = rx * 0.42;
      const bowY = -ry * 0.94;
      const bowScale = R * 0.34;
      const tRibbon = NOW() / 1000 * 3.5;
      const bowWobble = Math.sin(tRibbon) * 0.06 + s.tilt * 0.45;

      x.save();
      x.translate(bowX, bowY);
      x.rotate(0.26 + bowWobble);

      // Fitas caídas do laço balançando
      for (const dir of [-1, 1]) {
        const wave = Math.sin(tRibbon + dir * 1.3) * 4;
        x.save();
        x.translate(dir * 5, 6);
        x.fillStyle = P.bow2;
        x.strokeStyle = P.bow1;
        x.lineWidth = 1.4;

        x.beginPath();
        x.moveTo(0, 0);
        x.quadraticCurveTo(dir * 8 + wave, bowScale * 0.6, dir * 12 + wave, bowScale * 1.05);
        x.lineTo(dir * 4 + wave, bowScale * 0.94);
        x.quadraticCurveTo(dir * 2, bowScale * 0.5, 0, 0);
        x.closePath();
        x.fill();
        x.stroke();
        x.restore();
      }

      // Asas do Laço com gradiente brilhante
      for (const dir of [-1, 1]) {
        x.save();
        x.scale(dir, 1);

        const loopGrad = x.createLinearGradient(0, 0, bowScale * 0.95, -bowScale * 0.3);
        loopGrad.addColorStop(0, P.bow1);
        loopGrad.addColorStop(1, P.bow2);

        x.fillStyle = loopGrad;
        x.strokeStyle = '#ffffff';
        x.lineWidth = 1.6;

        x.beginPath();
        x.moveTo(3, 0);
        x.bezierCurveTo(bowScale * 0.5, -bowScale * 0.68, bowScale * 1.15, -bowScale * 0.25, bowScale * 0.98, 0);
        x.bezierCurveTo(bowScale * 1.15, bowScale * 0.25, bowScale * 0.5, bowScale * 0.68, 3, 0);
        x.closePath();
        x.fill();

        x.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        x.stroke();

        // Vinco interno
        x.strokeStyle = 'rgba(76, 29, 149, 0.5)';
        x.lineWidth = 1.5;
        x.beginPath();
        x.moveTo(8, -1);
        x.lineTo(bowScale * 0.45, 0);
        x.stroke();

        x.restore();
      }

      // Nó Central do Laço
      const knotGrad = x.createRadialGradient(0, 0, 1, 0, 0, bowScale * 0.28);
      knotGrad.addColorStop(0, '#ffffff');
      knotGrad.addColorStop(0.45, P.knot);
      knotGrad.addColorStop(1, P.bow1);

      x.fillStyle = knotGrad;
      x.strokeStyle = P.bow2;
      x.lineWidth = 2.0;
      x.beginPath();
      x.ellipse(0, 0, bowScale * 0.25, bowScale * 0.21, 0, 0, Math.PI * 2);
      x.fill();
      x.stroke();

      x.restore(); // Fim do Laço

      x.restore(); // Fim da Cabeça

      // Partículas ZZZ dormindo
      for (const p of this.parts) {
        const a = 1 - p.age / p.life;
        const px = cx + p.x * R, py = cy + p.y * R;
        const sz = p.sz * R * (0.8 + 0.4 * (1 - a));

        x.save();
        x.translate(px, py);
        x.fillStyle = 'rgba(216, 180, 254, ' + clamp(a * 0.9, 0, 0.9) + ')';
        x.font = `bold ${sz * 1.3}px -apple-system, sans-serif`;
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillText(p.char || 'z', 0, 0);
        x.restore();
      }
    }

    eye(shape, w, h, open, sd, P) {
      const x = this.x;
      switch (shape) {
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
        default:
          rr(x, -w / 2, -h / 2, w, h, w / 2);
          x.fill();
      }
    }
  }

  // ========================================================
  // 5. INICIALIZAÇÃO DA INTERFACE & CONTROLE
  // ========================================================
  const canvas = document.getElementById('luna-canvas');
  const mochi = new LunaBot(canvas);

  const micBtn = document.getElementById('mic-btn');
  const micLabel = document.getElementById('mic-label');
  const transcriptionText = document.getElementById('transcription-text');
  const voiceTranscription = document.getElementById('voice-transcription');
  const badgeTop = document.getElementById('badge-top');
  const audioToast = document.getElementById('audio-toast');

  const pinModal = document.getElementById('pin-modal');
  const pinInput = document.getElementById('pin-input');
  const pinBtn = document.getElementById('pin-btn');
  const pinError = document.getElementById('pin-error');

  let isListening = false;
  let recognition = null;
  let audioUnlocked = false;
  let currentAudio = null;

  // Rastreamento Ocular Tangencial idêntico ao Echo
  function trackMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - (rect.left + rect.width / 2);
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - (rect.top + rect.height / 2);
    mochi.look.x = Math.tanh(x / 120);
    mochi.look.y = Math.tanh(y / 100);
  }

  window.addEventListener('pointermove', trackMove);
  window.addEventListener('touchmove', trackMove, { passive: true });

  // Toque / Slap na Luna
  canvas.addEventListener('pointerdown', () => {
    mochi.squash();
  });

  // Loop de renderização 60 FPS
  function tick() {
    mochi.update();
    mochi.draw();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  function getLunaPin() {
    return localStorage.getItem('luna_pin') || '';
  }

  function getAuthHeaders() {
    const pin = getLunaPin();
    const headers = {
      'Content-Type': 'application/json'
    };
    if (pin) {
      headers['x-luna-pin'] = pin;
    }
    return headers;
  }

  // Tela acesa: o navegador solta o pedido quando o app sai da frente (outro app, notificações, tela
  // bloqueada); por isso pede de novo ao voltar e a cada toque, se tiver sido perdido
  let wakeLock = null;
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

  function unlockAudio() {
    requestWakeLock();
    if (audioUnlocked) return;
    audioUnlocked = true;
    audioToast.classList.add('hidden');
    Snd.init();
    const silent = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
    silent.play().catch(() => {});
    if (handsFreeMode) {
      setTimeout(startListening, 600);
    }
  }

  window.addEventListener('pointerdown', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });

  // Sem zoom por gesto: cancela pinça (dois ou mais dedos) e o gesto de zoom do Safari
  document.addEventListener('touchmove', (event) => {
    if (event.touches && event.touches.length > 1) event.preventDefault();
  }, { passive: false });
  document.addEventListener('gesturestart', (event) => event.preventDefault());
  if (audioToast) {
    audioToast.addEventListener('click', unlockAudio);
  }

  // ========================================================
  // 6. SÍNTESE DE VOZ COM SINCRONISMO EXATO DE BOCA
  // ========================================================
  function startSpeakingAnim() {
    mochi.speaking = true;
    mochi.setState('talking');
    badgeTop.textContent = 'FALANDO';
  }

  function stopSpeakingAnim() {
    mochi.speaking = false;
    mochi.setState('idle');
    badgeTop.textContent = 'PRONTA';
  }

  async function speak(text) {
    if (!text) return;
    unlockAudio();

    if (recognition && isListening) {
      try { recognition.stop(); } catch(e){}
    }

    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
      stopSpeakingAnim();
    }

    try {
      const res = await fetch('/api/speak', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          text,
          voice: 'pt-BR-ThalitaNeural'
        })
      });

      if (!res.ok) throw new Error('Falha no áudio');

      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      currentAudio = new Audio(audioUrl);

      // Inicia a boca no exato instante em que o áudio começa a tocar
      currentAudio.onplay = () => {
        startSpeakingAnim();
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
    } catch (e) {
      console.warn('Erro ao reproduzir voz:', e);
      stopSpeakingAnim();
      resumeListeningIfHandsFree();
    }
  }

  // ========================================================
  // 7. ESCUTA ATIVA CONTÍNUA POR VOZ (MÃOS LIVRES)
  // ========================================================
  let handsFreeMode = true; // Mãos livres ativo por padrão
  let processingSpeech = false;
  let speechDebounceTimer = null;
  let resumeTimer = null;

  function resumeListeningIfHandsFree() {
    if (!handsFreeMode || !audioUnlocked || mochi.speaking || processingSpeech) return;
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      if (handsFreeMode && audioUnlocked && !mochi.speaking && !processingSpeech) {
        startListening();
      }
    }, 1200);
  }

  function pauseRecognition() {
    if (recognition && isListening) {
      try { recognition.stop(); } catch(e) {}
    }
    isListening = false;
  }

  // Conversação Inteligente com a Luna
  async function askLuna(message) {
    if (processingSpeech) return;
    processingSpeech = true;
    pauseRecognition();

    mochi.setState('thinking');
    badgeTop.textContent = 'PENSANDO';
    transcriptionText.textContent = `"${message}"`;
    voiceTranscription.classList.remove('hidden');

    try {
      const res = await fetch('/api/luna/converse', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ message })
      });

      const data = await res.json();
      sharedLocation.show(data);
      const reply = data.reply || "Desculpe, não consegui entender direitinho. Pode repetir?";

      transcriptionText.textContent = reply;
      voiceTranscription.classList.remove('hidden');

      if (data.state === 'sleeping') {
        mochi.setState('sleeping');
        badgeTop.textContent = 'SONO';
      }

      await speak(reply);
    } catch (err) {
      console.warn('Erro ao falar com a Luna:', err);
      mochi.setState('idle');
      badgeTop.textContent = 'PRONTA';
      resumeListeningIfHandsFree();
    } finally {
      processingSpeech = false;
    }
  }

  // Reconhecimento de Voz (Microfone)
  function setupSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      micBtn.style.display = 'none';
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false; // Sentença única para zerar buffers e impedir duplicações no Android
    recognition.interimResults = true;

    recognition.onstart = () => {
      isListening = true;
      micBtn.classList.add('listening');
      micLabel.textContent = handsFreeMode ? 'ATIVO' : 'OUVIR';
      badgeTop.textContent = 'OUVINDO';
      mochi.setState('listening');
      transcriptionText.textContent = 'Ouvindo você...';
      voiceTranscription.classList.remove('hidden');
    };

    recognition.onresult = (event) => {
      if (processingSpeech || mochi.speaking) return;

      const current = event.results[event.results.length - 1];
      if (!current || !current[0]) return;
      const text = current[0].transcript.trim();

      if (text) {
        voiceTranscription.classList.remove('hidden');
        transcriptionText.textContent = text;
      }

      if (current.isFinal && text.length >= 2) {
        clearTimeout(speechDebounceTimer);
        speechDebounceTimer = setTimeout(() => {
          if (!processingSpeech && !mochi.speaking) {
            pauseRecognition();
            askLuna(text);
          }
        }, 500);
      } else if (text.length >= 2) {
        clearTimeout(speechDebounceTimer);
        speechDebounceTimer = setTimeout(() => {
          if (!processingSpeech && !mochi.speaking) {
            pauseRecognition();
            askLuna(text);
          }
        }, 900);
      }
    };

    recognition.onerror = (e) => {
      console.warn('[LUNA] Status SpeechRecognition:', e.error);
      if (e.error === 'not-allowed') {
        handsFreeMode = false;
        stopListening();
      }
    };

    recognition.onend = () => {
      isListening = false;
      micBtn.classList.remove('listening');
      micLabel.textContent = handsFreeMode ? 'ATIVO' : 'OUVIR';
      if (!mochi.speaking && !processingSpeech) {
        badgeTop.textContent = 'PRONTA';
        if (mochi.state === 'listening') mochi.setState('idle');
      }
      if (handsFreeMode && !mochi.speaking && !processingSpeech && audioUnlocked) {
        setTimeout(startListening, 400);
      } else if (!handsFreeMode) {
        stopListening();
      }
    };
  }

  function startListening() {
    if (!recognition || isListening || mochi.speaking || processingSpeech) return;
    try {
      recognition.start();
    } catch (e) {}
  }

  function stopListening() {
    pauseRecognition();
    micBtn.classList.remove('listening');
    micLabel.textContent = handsFreeMode ? 'ATIVO' : 'OUVIR';
    if (!mochi.speaking && !processingSpeech) {
      badgeTop.textContent = 'PRONTA';
      mochi.setState('idle');
    }
  }

  micBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    unlockAudio();
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
      micBtn.title = 'Ativar microfone para falar com a Luna';
      pauseRecognition();
    }
  });

  const sharedLocation = window.createEchoLocation({ scope: 'luna', getHeaders: getAuthHeaders, speak });

  // Autenticação por PIN
  async function checkAuth() {
    try {
      const res = await fetch('/api/luna/auth/status', {
        headers: getAuthHeaders()
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
      const res = await fetch('/api/luna/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();
      if (data.ok) {
        localStorage.setItem('luna_pin', pin);
        pinModal.classList.add('hidden');
        pinError.style.display = 'none';
        speak("Olá! Que bom te ver por aqui! Como posso te ajudar hoje?");
      } else {
        pinError.style.display = 'block';
      }
    } catch (e) {
      pinError.textContent = 'Erro ao verificar o PIN.';
      pinError.style.display = 'block';
    }
  }

  pinBtn.addEventListener('click', submitPin);
  pinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitPin();
  });

  // Toque na mascote para saudação
  document.getElementById('luna-wrapper').addEventListener('click', () => {
    if (!mochi.speaking && !isListening) {
      mochi.squash();
      speak("Oi! Eu sou a Luna. Toque no microfone para falar comigo!");
    }
  });

  // Inicialização
  setupSpeech();

  const urlParams = new URLSearchParams(window.location.search);
  const pinFromUrl = urlParams.get('pin');
  if (pinFromUrl) {
    pinInput.value = pinFromUrl;
    submitPin();
  } else {
    checkAuth();
  }
})();
