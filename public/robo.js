// Robô // página de testes do segundo personagem do Echo
// O motor de animação (tweens, estados, expressões, acessórios e partículas) é uma cópia da classe Bot
// do public/app.js, que deriva do motor MIT do Coucou. O desenho do robô, as roupas (robo-roupas.js),
// as reações ao toque e as animações de entrada e dança são próprios.

(function () {
  'use strict';

  const Roupas = window.RoboRoupas;

  // ========================================================
  // 1. HELPERS MATEMÁTICOS E CURVAS DE ANIMAÇÃO
  // ========================================================
  const NOW = () => performance.now();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const E = {
    in: t => t * t * t,
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
  // Retângulo de cantos "inchados" (superelipse): cabeça do robô
  function superellipse(cx, cy, rx, ry, n) {
    const path = new Path2D();
    for (let i = 0; i <= 72; i++) {
      const a = i / 72 * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const px = cx + rx * Math.sign(ca) * Math.pow(Math.abs(ca), 2 / n);
      const py = cy + ry * Math.sign(sa) * Math.pow(Math.abs(sa), 2 / n);
      i ? path.lineTo(px, py) : path.moveTo(px, py);
    }
    path.closePath();
    return path;
  }
  // Trapézio de cantos arredondados: corpo do robô
  function roundedTrapezoid(cy, topHw, bottomHw, hh, r) {
    const p = new Path2D();
    const top = cy - hh, bottom = cy + hh;
    p.moveTo(-topHw + r, top);
    p.lineTo(topHw - r, top);
    p.quadraticCurveTo(topHw, top, topHw, top + r);
    p.lineTo(bottomHw, bottom - r);
    p.quadraticCurveTo(bottomHw, bottom, bottomHw - r, bottom);
    p.lineTo(-bottomHw + r, bottom);
    p.quadraticCurveTo(-bottomHw, bottom, -bottomHw, bottom - r);
    p.lineTo(-topHw, top + r);
    p.quadraticCurveTo(-topHw, top, -topHw + r, top);
    p.closePath();
    return p;
  }

  // ========================================================
  // 2. GEOMETRIA DO ROBÔ (coordenadas de 280 × 280; y = 0 é a base do corpo, negativo para cima)
  // ========================================================
  const R = 84;            // unidade de medida herdada do motor (acessórios, mãos e partículas)
  const GROUND = 246;      // base do corpo no quadro
  const PIVOT = -100;      // ponto do meio do corpo em torno do qual o robô inclina
  const HEAD = { cy: -151, hw: 91, hh: 65 };
  // Corpo mais largo nos ombros e mais estreito embaixo; o pescoço escuro aparece entre cabeça e corpo
  const BODY = { cy: -39, hw: 50, bottomHw: 40, hh: 39, r: 24 };
  const TAG = { x: -61, y: -206, w: 58, h: 40 };
  const HAT = { x: 18, y: HEAD.cy - HEAD.hh + 2 };   // base dos chapéus: alto da cabeça, à direita da etiqueta

  // [rosto-inicio]
  // ========================================================
  // 3. ROSTO COMO PEÇA ÚNICA
  // ========================================================
  // Visor, olhos, boca e bochechas ficam num só referencial: um ponto (x, y) e uma escala (sx, sy).
  // Olhar para os lados, para cima ou para baixo e o giro de comemoração mexem esse referencial,
  // nunca uma parte sozinha; por isso as partes do rosto sempre andam juntas.
  const FACE = {
    cy: -147,      // centro do visor
    radius: 60,    // raio do "cilindro" em que o rosto desliza ao olhar para os lados e ao girar
    lift: 50,      // quanto o rosto sobe ou desce ao olhar para cima ou para baixo
    maxPitch: 0.3,
    visor: { w: 150, h: 54 },
    eyes: [{ x: -35.5, y: 0 }, { x: 35.5, y: 0 }],
    mouth: { x: 0, y: 38 },
    cheeks: [{ x: -54, y: 33 }, { x: 54, y: 33 }]
  };

  function faceFrame(yaw, pitch, roll) {
    const a = yaw + roll;
    const p = clamp(pitch, -FACE.maxPitch, FACE.maxPitch);
    return {
      x: Math.sin(a) * FACE.radius,
      y: FACE.cy + Math.sin(p) * FACE.lift,
      sx: Math.cos(a),
      sy: Math.cos(p),
      // De costas (meio do giro) o rosto não aparece
      visible: Math.cos(a) > 0.04
    };
  }

  function facePoint(f, local) {
    return { x: f.x + local.x * f.sx, y: f.y + local.y * f.sy };
  }

  // Onde cada parte do rosto fica, sempre a partir do mesmo referencial
  function facePoints(f) {
    return {
      visor: facePoint(f, { x: 0, y: 0 }),
      eyes: FACE.eyes.map(e => facePoint(f, e)),
      mouth: facePoint(f, FACE.mouth),
      cheeks: FACE.cheeks.map(c => facePoint(f, c))
    };
  }
  // [rosto-fim]

  // [gestos-inicio]
  // ========================================================
  // 4. GESTOS SOBRE O ROBÔ
  // ========================================================
  // Toque, dois toques rápidos, vários toques seguidos (bravo), segurar e carinho (arrastar sobre a
  // cabeça). A região tocada (chapéu, visor, peito, cabeça, corpo) vem de quem chama.
  const GESTURE = { doubleMs: 320, burstMs: 2000, burstCount: 5, longMs: 600, strokeMin: 40, moveTolerance: 12 };
  const STROKE_REGIONS = ['cabeca', 'chapeu', 'visor'];

  class GestureReader {
    constructor() {
      this.taps = [];
      this.lastTap = -Infinity;
      this.down = null;
    }

    start(t, x, y, region) {
      this.down = { t, region, path: 0, lastX: x, lastY: y, long: false, stroke: false };
      return [];
    }

    move(t, x, y) {
      const d = this.down;
      if (!d) return [];
      d.path += Math.hypot(x - d.lastX, y - d.lastY);
      d.lastX = x;
      d.lastY = y;
      if (!d.stroke && !d.long && d.path >= GESTURE.strokeMin && STROKE_REGIONS.includes(d.region)) {
        d.stroke = true;
        return ['carinho'];
      }
      return [];
    }

    // Chamado enquanto o dedo está parado: depois de 0,6 s vira "segurar"
    poll(t) {
      const d = this.down;
      if (d && !d.long && !d.stroke && d.path < GESTURE.moveTolerance && t - d.t >= GESTURE.longMs) {
        d.long = true;
        return ['segurar'];
      }
      return [];
    }

    end(t) {
      const d = this.down;
      this.down = null;
      if (!d || d.long || d.stroke || d.path >= GESTURE.moveTolerance) return [];
      this.taps = this.taps.filter(x => t - x < GESTURE.burstMs);
      this.taps.push(t);
      if (this.taps.length >= GESTURE.burstCount) {
        this.taps = [];
        this.lastTap = -Infinity;
        return ['bravo'];
      }
      if (t - this.lastTap <= GESTURE.doubleMs) {
        this.lastTap = -Infinity;
        return ['duplo'];
      }
      this.lastTap = t;
      if (d.region === 'visor') return ['toque-visor'];
      if (d.region === 'peito') return ['toque-peito'];
      if (d.region === 'chapeu') return ['toque-chapeu'];
      return ['toque'];
    }
  }
  // [gestos-fim]

  // [sensor-inicio]
  // ========================================================
  // 5. SENSORES DO CELULAR
  // ========================================================
  // Inclinação (beta: frente/trás; gamma: lados): o robô olha e se inclina para o lado mais baixo.
  // Na mão, o celular fica perto de 45° de beta; por isso esse é o "reto".
  function tiltFromOrientation(beta, gamma) {
    const g = clamp((gamma || 0) / 35, -1, 1);
    const b = clamp(((beta || 0) - 45) / 35, -1, 1);
    return { lookX: g, lookY: b, lean: g * 0.16 };
  }

  // Chacoalhar: dois picos fortes de aceleração (m/s², sem a gravidade) em menos de 0,6 s
  class ShakeDetector {
    constructor(threshold = 14, windowMs = 600, cooldownMs = 2500) {
      this.threshold = threshold;
      this.windowMs = windowMs;
      this.cooldownMs = cooldownMs;
      this.peaks = [];
      this.last = -Infinity;
    }

    push(t, ax, ay, az) {
      const m = Math.hypot(ax || 0, ay || 0, az || 0);
      if (m < this.threshold) return false;
      const lastPeak = this.peaks[this.peaks.length - 1];
      if (lastPeak !== undefined && t - lastPeak < 120) return false;   // ainda é o mesmo pico
      this.peaks = this.peaks.filter(p => t - p <= this.windowMs);
      this.peaks.push(t);
      if (this.peaks.length >= 2 && t - this.last >= this.cooldownMs) {
        this.last = t;
        this.peaks = [];
        return true;
      }
      return false;
    }
  }
  // [sensor-fim]

  // [ritmo-inicio]
  // ========================================================
  // 6. RITMO PELO MICROFONE
  // ========================================================
  // Batida = energia dos graves (0 a 255) bem acima da média recente. A música começa com 3 batidas
  // nos últimos 3 s e só termina 3 s depois da última. Um som alto e contínuo (sem batidas) não conta.
  class BeatDetector {
    constructor() {
      this.avg = 0;
      this.lastBeat = -Infinity;
      this.beats = [];
      this.playing = false;
    }

    push(t, energy) {
      const beat = energy > 70 && energy > this.avg * 1.3 + 8 && t - this.lastBeat > 260;
      this.avg = this.avg ? this.avg * 0.93 + energy * 0.07 : energy;
      if (beat) {
        this.lastBeat = t;
        this.beats.push(t);
      }
      this.beats = this.beats.filter(b => t - b <= 3000);
      if (this.beats.length >= 3) this.playing = true;
      if (t - this.lastBeat > 3000) this.playing = false;
      return { beat, music: this.playing };
    }
  }
  // [ritmo-fim]

  const ROBO_SPEC = {
    eye: { w: 15, h: 26 },
    shell: ['#f2fdff', '#8fdcf0'],   // casca clara da cabeça e do corpo
    visor: ['#0a2333', '#020b12'],
    ink: '#041622',
    rim: 'rgba(0, 229, 255, 0.35)',
    tagRim: '#00e5ff'
  };

  const STATES = {
    idle: { label: 'Repouso', col: '#00d4ff', tint: 0, eye: 'pill', badge: null },
    working: { label: 'Trabalhando', col: '#00d4ff', tint: 0.65, eye: 'pill', badge: ['dots', '#00d4ff'] },
    multi: { label: 'Multiagente', col: '#00e5ff', tint: 0.85, eye: 'pill', badge: ['dots', '#ff7a45'] },
    thinking: { label: 'Pensando', col: '#b829dd', tint: 0.72, eye: 'pill', badge: ['dots', '#b829dd'] },
    approval: { label: 'Aprovação', col: '#F5A524', tint: 0.78, eye: 'wide', badge: ['bang', '#F5A524'] },
    finished: { label: 'Concluído', col: '#10b981', tint: 0.35, eye: 'happy', badge: ['dot', '#10b981'] },
    error: { label: 'Erro', col: '#F4505E', tint: 0.78, eye: 'flat', badge: ['dot', '#F4505E'] },
    listening: { label: 'Ouvindo', col: '#00d4ff', tint: 0.45, eye: 'dot', badge: ['dots', '#00d4ff'] },
    sleeping: { label: 'Dormindo', col: '#8b5cf6', tint: 0.12, eye: 'sleep', badge: null }
  };

  const EMOTES = {
    love: { label: 'Amor', eye: 'heart' },
    surprised: { label: 'Surpresa', eye: 'dot' },
    proud: { label: 'Orgulho', eye: 'star' },
    happy: { label: 'Feliz', eye: 'happy' }
  };

  // ========================================================
  // 7. CLASSE DO ROBÔ (motor do Echo + desenho, roupas e reações próprios)
  // ========================================================
  class RoboBot {
    constructor(canvas) {
      this.c = canvas;
      this.x = canvas.getContext('2d');
      this.s = {
        yaw: 0, pitch: 0, roll: 0, tilt: 0,
        open: 1, sx: 1, sy: 1, oy: 0, ox: 0,
        tint: 0, morph: 0, hands: 0, blush: 0,
        es: 1, badgeS: 0,
        mouthOpen: 0,
        lean: 0, sway: 0, hatY: 0
      };
      this.tg = { ...this.s };
      this.tw = [];
      this.lock = {};
      this.col = [0, 212, 255];
      this.colT = [0, 212, 255];
      this.colOverride = null;
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
      this.speaking = false;

      this.wardrobe = new Roupas.Wardrobe();
      this.fz = 1;                                   // recuo para chapéu alto
      this.motion = { x: 0, y: 0, vx: 0, vy: 0 };    // movimento da cabeça, para a física das roupas
      this.dance = { sources: new Set(), phase: 0, beatGap: 0.5, lastBeat: 0 };
      this.seq = null;                               // roteiro em andamento (entrada)
      this.waveSide = 0;
      this.waveUntil = 0;
      this.symbol = null;                            // símbolo temporário na tela do peito
      this.base = { x: 140, y: GROUND };
      this.face = faceFrame(0, 0, 0);
      this.onSound = () => {};

      // Formas fixas, montadas uma vez
      this.headPath = superellipse(0, HEAD.cy, HEAD.hw, HEAD.hh, 3.6);
      this.bodyPath = roundedTrapezoid(BODY.cy, BODY.hw, BODY.bottomHw, BODY.hh, BODY.r);

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
        this.wardrobe.kick(0.8);
      } else if (name === 'lupa') {
        this.anim('oy', [[-0.05, 200, E.out], [0, 200, E.back]]);
      } else if (name === 'typing') {
        this.anim('hands', [[1, 150, E.out]]);
      } else if (name === 'coffee') {
        this.anim('hands', [[1, 200, E.out]]);
      }
      clearTimeout(this._accTimer);
      if (duration > 0) {
        this._accTimer = setTimeout(() => {
          if (this.accessory === name) this.accessory = 'none';
        }, duration);
      }
    }

    initConfetti() {
      this.confetti = [];
      const colors = ['#00d4ff', '#b829dd', '#10b981', '#f5a524', '#ff4081', '#ffffff'];
      for (let i = 0; i < 28; i++) {
        this.confetti.push({
          x: (Math.random() - 0.5) * 220,
          y: -250 - Math.random() * 60,
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
      } else if (n === 'error') {
        this.anim('ox', [[0.08, 50, E.out], [-0.08, 70, E.inOut], [0.05, 70, E.inOut], [0, 90, E.out]]);
      } else if (n === 'approval') {
        this.anim('oy', [[-0.2, 140, E.out], [0, 280, E.back]]);
      } else if (n === 'thinking') {
        this.anim('tilt', [[-0.12, 220, E.out]]);
      } else if (n === 'listening') {
        this.anim('tilt', [[0.18, 220, E.out]]);
        this.anim('es', [[1.22, 180, E.out]]);
      } else if (n === 'working') {
        this.anim('sy', [[0.95, 120, E.out], [1, 140, E.inOut]]);
      } else {
        this.blink();
      }
    }

    blink() {
      if (this.lock.open) return;
      this.anim('open', [[0.05, 60, E.inOut], [1, 120, E.out]]);
    }

    squash() {
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

    // ---------- Roteiros e reações próprias ----------

    // Passos com hora marcada (ms desde o início), executados pelo update()
    play(steps) {
      this.seq = { t0: NOW(), steps: steps.slice().sort((a, b) => a.at - b.at), i: 0 };
    }

    // Entrada: cai do alto, amassa no chão, quica, desliza para o lado, acena e volta ao centro
    entrance() {
      this.s.oy = -3.4;
      this.s.ox = 0;
      this.motion = { x: 0, y: this.s.oy * R, vx: 0, vy: 0 };
      this.waveSide = 0;
      this.anim('oy', [[0, 520, E.in]]);
      this.onSound('whoosh');
      this.play([
        { at: 520, run: () => {
          this.onSound('boing');
          this.anim('sy', [[0.72, 80, E.out], [1.1, 140, E.out], [1, 160, E.inOut]]);
          this.anim('sx', [[1.25, 80, E.out], [0.95, 140, E.out], [1, 160, E.inOut]]);
          this.wardrobe.kick(1.2);
        } },
        { at: 620, run: () => this.anim('oy', [[-0.38, 200, E.out], [0, 230, E.in]]) },
        { at: 850, run: () => {
          this.anim('sy', [[0.9, 60, E.out], [1, 140, E.back]]);
          this.wardrobe.kick(0.6);
        } },
        { at: 980, run: () => {
          this.anim('ox', [[0.5, 420, E.inOut]]);
          this.anim('tilt', [[-0.1, 200, E.out], [0, 300, E.inOut]]);
        } },
        { at: 1420, run: () => {
          // Acena com a mão do lado do centro da tela
          this.wave(-1, 1100);
          this.eyeOv = 'happy';
          this.ovUntil = NOW() + 1100;
          this.onSound('chime');
        } },
        { at: 2550, run: () => this.anim('ox', [[0, 450, E.inOut]]) }
      ]);
    }

    wave(side, ms) {
      this.waveSide = side;
      this.waveUntil = NOW() + ms;
    }

    get dancing() {
      return this.dance.sources.size > 0;
    }

    // Quem pediu a dança: "musica" (microfone) ou "botao" (Dançar 10 s)
    setDancing(on, source) {
      if (on) this.dance.sources.add(source);
      else this.dance.sources.delete(source);
    }

    danceBeat() {
      const n = NOW();
      const gap = (n - this.dance.lastBeat) / 1000;
      if (gap > 0.25 && gap < 1.5) this.dance.beatGap = this.dance.beatGap * 0.6 + gap * 0.4;
      this.dance.lastBeat = n;
      this.anim('oy', [[-0.1, 110, E.out], [0, 170, E.in]]);
      this.anim('sy', [[0.94, 90, E.out], [1, 160, E.inOut]]);
      this.wardrobe.kick(0.35);
      if (Math.random() < 0.25) this.emote('happy', 600);
    }

    tap() {
      this.squash();
      this.wardrobe.kick(0.6);
    }

    // Dois toques: pula e gira
    hop() {
      this.anim('oy', [[-0.35, 160, E.out], [0, 280, E.back]]);
      this.roll(700, 1);
      this.wardrobe.kick(1);
      this.onSound('pop');
    }

    // Muitos toques: fica bravo
    angry() {
      this.eyeOv = 'angry';
      this.ovUntil = NOW() + 2000;
      this.colOverride = { col: hexRgb('#F4505E'), until: NOW() + 2000 };
      this.anim('ox', [[0.07, 50, E.out], [-0.07, 70, E.inOut], [0.06, 70, E.inOut], [-0.05, 70, E.inOut], [0, 90, E.out]]);
      this.wardrobe.kick(0.8);
    }

    // Chacoalhar o celular: fica tonto
    dizzy() {
      this.eyeOv = 'spiral';
      this.ovUntil = NOW() + 2200;
      this.anim('tilt', [[0.16, 160, E.out], [-0.16, 260, E.inOut], [0.12, 260, E.inOut], [-0.08, 260, E.inOut], [0, 300, E.inOut]]);
      this.wardrobe.kick(1.4);
    }

    surprise() {
      this.blink();
      this.emote('surprised', 900);
    }

    showSymbol(ch, ms) {
      this.symbol = { ch, until: NOW() + ms };
    }

    hatHop() {
      this.anim('hatY', [[-22, 130, E.out], [0, 300, E.back]]);
      this.wardrobe.kick(1.4);
    }

    // Carinho: olhos felizes, bochechas coradas e corações
    cuddle() {
      this.emote('happy', 1800);
      this.anim('blush', [[1, 250, E.out], [1, 1000, E.lin], [0, 400, E.inOut]]);
      this.emit('heart', 3);
    }

    // Região tocada, em coordenadas do quadro de 280 (desfaz o recuo e a posição do robô)
    regionAt(px, py) {
      const zx = 140 + (px - 140) / this.fz, zy = GROUND + (py - GROUND) / this.fz;
      const rx = zx - this.base.x, ry = zy - this.base.y, f = this.face;
      const hatTop = this.wardrobe.headroom();
      const headTop = HEAD.cy - HEAD.hh;
      if (hatTop && rx > HAT.x - 62 && rx < HAT.x + 62 && ry < headTop + 8 && ry > headTop - hatTop) return 'chapeu';
      if (f.visible && Math.abs(rx - f.x) <= FACE.visor.w / 2 * Math.abs(f.sx) && Math.abs(ry - f.y) <= FACE.visor.h / 2) return 'visor';
      if (rx >= -30 && rx <= 30 && ry >= -64 && ry <= -28) return 'peito';
      if (Math.abs(rx) <= HEAD.hw && ry >= headTop - 10 && ry <= HEAD.cy + HEAD.hh) return 'cabeca';
      if (Math.abs(rx) <= BODY.hw + 20 && ry >= BODY.cy - BODY.hh && ry <= 0) return 'corpo';
      return 'fora';
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

      // Roteiro com hora marcada (entrada)
      while (this.seq && this.seq.i < this.seq.steps.length && n - this.seq.t0 >= this.seq.steps[this.seq.i].at) {
        this.seq.steps[this.seq.i++].run();
      }
      if (this.seq && this.seq.i >= this.seq.steps.length) this.seq = null;

      tg.yaw = clamp(this.look.x * 0.45, -0.42, 0.42);
      tg.pitch = clamp(this.look.y * 0.28, -0.24, 0.16);
      tg.sy = 1 + Math.sin(t * 1.8) * 0.025;
      tg.sx = 1 - Math.sin(t * 1.8) * 0.015;

      // Voz e dança: as mãos aparecem; a dança balança o corpo no ritmo das batidas
      const dancing = this.dancing;
      if (this.speaking) {
        s.mouthOpen = (Math.sin(t * 16) + 1) / 2;
        tg.tilt = Math.sin(t * 6) * 0.06;
        s.hands = 1;
      } else {
        s.mouthOpen = 0;
        s.hands = dancing ? 1 : 0;
        // Sem isso, o alvo "mãos = 1" deixado pelo teclado ou café desenha dois pontinhos a cada quadro
        tg.hands = 0;
      }
      if (dancing) {
        this.dance.phase += dt * Math.PI / Math.max(0.3, this.dance.beatGap);
        tg.sway = Math.sin(this.dance.phase) * 0.13;
      } else {
        tg.sway = 0;
      }

      // Respiração lenta no modo soneca
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

      const colTarget = this.colOverride && n < this.colOverride.until ? this.colOverride.col : this.colT;
      this.col = mix(this.col, colTarget, 1 - Math.pow(0.002, dt));

      // Chapéu alto: recua aos poucos até a peça caber no quadro
      this.fz += (Roupas.headroomZoom(this.wardrobe.headroom()) - this.fz) * kGen;

      // Física das roupas: as partes moles ficam para trás quando a cabeça acelera
      const rot = s.tilt + s.lean + s.sway;
      const hx = s.ox * R + Math.sin(rot) * (PIVOT - HAT.y);
      const hy = s.oy * R + (HAT.y) * (s.sy - 1);
      if (dt > 0.001) {
        const vx = (hx - this.motion.x) / dt, vy = (hy - this.motion.y) / dt;
        const ax = (vx - this.motion.vx) / dt, ay = (vy - this.motion.vy) / dt;
        this.motion = { x: hx, y: hy, vx, vy };
        this.wardrobe.step(dt, n, clamp(-ax * 0.0025, -40, 40), clamp(ay * 0.0012, -40, 40));
      }

      if (this.state !== 'sleeping' && n > this.nextBlink) {
        this.blink();
        this.nextBlink = n + 2200 + Math.random() * 3200;
      }
      if (this.eyeOv && n > this.ovUntil) this.eyeOv = null;
      if (this.waveSide && n > this.waveUntil) this.waveSide = 0;
      if (this.symbol && n > this.symbol.until) this.symbol = null;

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
      const x = this.x, s = this.s, n = NOW();
      const t = (n - this.t0) / 1000;
      x.clearRect(0, 0, 280, 280);

      x.save();
      // Recuo para chapéu alto: escala pela base, para o robô continuar no chão
      x.translate(140, GROUND);
      x.scale(this.fz, this.fz);
      x.translate(-140, -GROUND);

      // Flutuação suave (parado no modo soneca)
      const hover = this.state === 'sleeping' ? 0 : Math.sin(t * 1.6) * 3;
      const bx = 140 + s.ox * R, by = GROUND + s.oy * R + hover;
      this.base = { x: bx, y: by };
      this.drawGlow(by);

      const f = faceFrame(s.yaw, s.pitch, s.roll);
      this.face = f;

      x.save();
      x.translate(bx, by);
      // Achatar e respirar a partir da base; inclinar pelo meio do corpo
      x.scale(s.sx, s.sy);
      x.translate(0, PIVOT);
      x.rotate(s.tilt + s.lean + s.sway);
      x.translate(0, -PIVOT);

      this.drawBody(t);
      this.drawWorn('pescoco', n, t);
      this.drawHead();
      this.drawFace(f, n, t);
      this.drawTag(t);
      // Chapéus: deslizam um pouco junto com o rosto, para parecer que a cabeça gira
      x.save();
      x.translate(HAT.x + f.x * 0.3, HAT.y + s.hatY);
      this.drawWorn('cabeca', n, t);
      x.restore();
      this.drawHands(t);
      this.drawAccessory(t);
      x.restore();

      this.drawParticles(bx, by + HEAD.cy);
      x.restore();
    }

    // Peças de um lugar do guarda-roupa, com a transição de entrada e saída
    drawWorn(slot, n, t) {
      const x = this.x;
      for (const layer of this.wardrobe.layers(slot, n)) {
        if (layer.alpha <= 0.01) continue;
        x.save();
        x.globalAlpha *= layer.alpha;
        x.translate(0, layer.dy);
        x.scale(layer.scale, layer.scale);
        layer.item.draw(x, t, layer.a);
        x.restore();
      }
    }

    // Brilho de flutuação no chão: menor e mais fraco quando o robô sobe
    drawGlow(by) {
      const x = this.x;
      const rise = clamp((GROUND - by) / 40, 0, 1);
      const w = 70 * (1 - rise * 0.3);
      x.save();
      x.translate(140, GROUND + 18);
      x.scale(1, 0.14);
      const g = x.createRadialGradient(0, 0, 0, 0, 0, w);
      g.addColorStop(0, rgba(this.col, 0.6 * (1 - rise * 0.5)));
      g.addColorStop(0.55, rgba(this.col, 0.18 * (1 - rise * 0.5)));
      g.addColorStop(1, rgba(this.col, 0));
      x.fillStyle = g;
      x.beginPath();
      x.arc(0, 0, w, 0, Math.PI * 2);
      x.fill();
      x.restore();
    }

    // Casca clara com a cor do estado subindo de baixo
    fillShell(path, top, bottom) {
      const x = this.x, s = this.s;
      const g = x.createLinearGradient(0, top, 0, bottom);
      g.addColorStop(0, ROBO_SPEC.shell[0]);
      g.addColorStop(1, ROBO_SPEC.shell[1]);
      x.fillStyle = g;
      x.fill(path);
      if (s.tint > 0.01) {
        const tg = x.createLinearGradient(0, bottom, 0, top + (bottom - top) * 0.25);
        tg.addColorStop(0, rgba(this.col, 0.75 * s.tint));
        tg.addColorStop(1, rgba(this.col, 0));
        x.fillStyle = tg;
        x.fill(path);
      }
      x.strokeStyle = ROBO_SPEC.rim;
      x.lineWidth = 1.6;
      x.stroke(path);
    }

    // ">_" com o cursor piscando
    prompt(cx, cy, size, t, color) {
      const x = this.x;
      x.fillStyle = color;
      x.font = `700 ${size}px Consolas, 'Courier New', monospace`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText('>', cx - size * 0.38, cy);
      if (Math.floor(t * 2) % 2 === 0) x.fillText('_', cx + size * 0.32, cy);
    }

    drawBody(t) {
      const x = this.x;
      // Pescoço
      x.fillStyle = '#0b2433';
      rr(x, -30, -90, 60, 14, 7);
      x.fill();
      x.strokeStyle = rgba(this.col, 0.55);
      x.lineWidth = 1.5;
      x.beginPath();
      x.moveTo(-24, -83);
      x.lineTo(24, -83);
      x.stroke();

      // Corpo
      this.fillShell(this.bodyPath, BODY.cy - BODY.hh, BODY.cy + BODY.hh);
      x.save();
      x.clip(this.bodyPath);
      x.fillStyle = 'rgba(255, 255, 255, 0.4)';
      x.beginPath();
      x.ellipse(-22, BODY.cy - BODY.hh + 12, 20, 6, -0.2, 0, Math.PI * 2);
      x.fill();
      x.restore();

      // Tela do peito: ">_" ou o símbolo do toque
      x.fillStyle = ROBO_SPEC.ink;
      rr(x, -30, -64, 60, 36, 10);
      x.fill();
      x.strokeStyle = rgba(this.col, 0.8);
      x.lineWidth = 2;
      x.stroke();
      const light = rgba(mix(this.col, [255, 255, 255], 0.15), 1);
      if (this.symbol) {
        x.fillStyle = light;
        x.font = "700 21px Consolas, 'Courier New', monospace";
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillText(this.symbol.ch, 0, -45);
      } else {
        this.prompt(0, -46, 17, t, light);
      }
    }

    drawHead() {
      const x = this.x;
      this.fillShell(this.headPath, HEAD.cy - HEAD.hh, HEAD.cy + HEAD.hh);
      // Reflexo no alto da cabeça
      x.save();
      x.clip(this.headPath);
      x.fillStyle = 'rgba(255, 255, 255, 0.5)';
      x.beginPath();
      x.ellipse(-30, HEAD.cy - HEAD.hh + 16, 42, 9, -0.08, 0, Math.PI * 2);
      x.fill();
      x.restore();
    }

    // Visor, olhos, bochechas, boca e óculos a partir do mesmo referencial (faceFrame)
    drawFace(f, n, t) {
      const x = this.x, s = this.s, P = ROBO_SPEC;
      if (!f.visible) return;
      const pts = facePoints(f);
      const at = (p, paint) => {
        x.save();
        x.translate(p.x, p.y);
        x.scale(f.sx, f.sy);
        paint();
        x.restore();
      };

      x.save();
      x.clip(this.headPath);

      // Visor
      at(pts.visor, () => {
        const { w, h } = FACE.visor;
        const g = x.createLinearGradient(0, -h / 2, 0, h / 2);
        g.addColorStop(0, P.visor[0]);
        g.addColorStop(1, P.visor[1]);
        x.fillStyle = g;
        rr(x, -w / 2, -h / 2, w, h, h / 2);
        x.fill();
        x.strokeStyle = rgba(this.col, 0.35);
        x.lineWidth = 2;
        x.stroke();
        x.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        x.beginPath();
        x.moveTo(-w / 2 + h / 2, -h / 2 + 5);
        x.lineTo(w / 2 - h / 2, -h / 2 + 5);
        x.stroke();
      });

      // Olhos: luz na cor do estado
      const shape = this.eyeOv || this.cfg.eye;
      const light = rgba(mix(this.col, [255, 255, 255], 0.2), 1);
      pts.eyes.forEach((p, i) => at(p, () => {
        x.fillStyle = light;
        x.strokeStyle = light;
        x.shadowColor = rgba(this.col, 0.9);
        x.shadowBlur = 10;
        this.eye(shape, P.eye.w * s.es, P.eye.h * s.es, s.open, i ? 1 : -1);
      }));

      // Bochechas
      const bl = Math.max(s.blush, 0.32);
      x.fillStyle = `rgba(184, 41, 221, ${0.45 * bl})`;
      pts.cheeks.forEach(p => at(p, () => {
        x.beginPath();
        x.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2);
        x.fill();
      }));

      // Boca: estritamente '_' (fechada) ou 'o' (falando)
      at(pts.mouth, () => {
        if (s.mouthOpen > 0.05) {
          x.fillStyle = P.ink;
          x.beginPath();
          x.ellipse(0, 0, 5, 2.2 + s.mouthOpen * 5.5, 0, 0, Math.PI * 2);
          x.fill();
        } else if (this.state !== 'sleeping') {
          x.strokeStyle = P.ink;
          x.lineWidth = 3;
          x.lineCap = 'round';
          x.beginPath();
          x.moveTo(-5, 0);
          x.lineTo(5, 0);
          x.stroke();
        }
      });

      // Óculos: no mesmo referencial do rosto, então ficam sempre sobre os olhos
      at(pts.visor, () => this.drawWorn('rosto', n, t));

      x.restore();
    }

    // Etiqueta no alto da cabeça: ">_" em repouso; selo do estado nos demais
    drawTag(t) {
      const x = this.x, s = this.s;
      x.save();
      x.translate(TAG.x, TAG.y);
      x.rotate(-0.1);
      x.fillStyle = ROBO_SPEC.ink;
      rr(x, -TAG.w / 2, -TAG.h / 2, TAG.w, TAG.h, 11);
      x.fill();
      x.strokeStyle = ROBO_SPEC.tagRim;
      x.lineWidth = 3;
      x.stroke();

      if (!this.badge) {
        this.prompt(0, 0, 19, t, ROBO_SPEC.tagRim);
      } else {
        const col = this.badgeCol;
        x.scale(s.badgeS, s.badgeS);
        if (this.badge === 'dots') {
          for (let i = 0; i < 3; i++) {
            const ph = ((t * 2.4 - i * 0.22) % 1 + 1) % 1;
            const r = 4.2 * (1 + 0.4 * Math.max(0, Math.sin(ph * Math.PI * 2)));
            x.fillStyle = col;
            x.beginPath();
            x.arc((i - 1) * 15, 0, r, 0, Math.PI * 2);
            x.fill();
          }
        } else if (this.badge === 'bang') {
          x.fillStyle = col;
          x.font = '800 26px -apple-system, sans-serif';
          x.textAlign = 'center';
          x.textBaseline = 'middle';
          x.fillText('!', 0, 1);
        } else {
          x.fillStyle = col;
          x.beginPath();
          x.arc(0, 0, 9, 0, Math.PI * 2);
          x.fill();
        }
      }
      x.restore();
    }

    // Mãos iguais às do Echo atual: aparecem ao falar e ao dançar; uma delas acena na entrada
    drawHands(t) {
      const x = this.x, s = this.s;
      x.fillStyle = '#7fe3f5';
      x.strokeStyle = '#00d4ff';
      x.lineWidth = 2;
      if (s.hands > 0.05) {
        const hr = R * 0.18 * s.hands;
        for (const sd of [-1, 1]) {
          x.beginPath();
          x.arc(sd * BODY.hw * 1.25, BODY.cy + BODY.hh * 0.35 + Math.sin(t * 8 + sd) * 6, hr, 0, Math.PI * 2);
          x.fill();
          x.stroke();
        }
      }
      if (this.waveSide) {
        x.beginPath();
        x.arc(this.waveSide * (HEAD.hw + 14) + Math.sin(t * 16) * 6, HEAD.cy + 22, R * 0.18, 0, Math.PI * 2);
        x.fill();
        x.stroke();
      }
    }

    drawAccessory(t) {
      const x = this.x;
      if (this.accessory === 'lupa') {
        // Na frente do olho direito, orbitando
        const lRad = R * 0.32;
        x.save();
        x.translate(FACE.eyes[1].x + 6 + Math.sin(t * 3.5) * 8, FACE.cy + 10 + Math.cos(t * 2.8) * 6);
        x.fillStyle = 'rgba(0, 212, 255, 0.22)';
        x.beginPath();
        x.arc(0, 0, lRad, 0, Math.PI * 2);
        x.fill();
        x.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        x.lineWidth = 2.5;
        x.beginPath();
        x.arc(0, 0, lRad * 0.78, -Math.PI * 0.85, -Math.PI * 0.15);
        x.stroke();
        x.strokeStyle = '#00d4ff';
        x.lineWidth = 4;
        x.beginPath();
        x.arc(0, 0, lRad, 0, Math.PI * 2);
        x.stroke();
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
        // Teclado na frente da parte de baixo do corpo
        const kw = R * 1.55, kh = R * 0.46;
        const kx = -kw / 2, ky = -30;
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
        // Impressora ao lado do corpo
        const pw = R * 0.85, ph = R * 0.52;
        x.save();
        x.translate(BODY.hw + 38, BODY.cy + 10);
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
          if (ly < -ph / 2) x.fillRect(-rw / 2 + 5, ly, rw - 10, 2);
        }
        x.restore();
      } else if (this.accessory === 'coffee') {
        // Caneca do lado direito do corpo
        const mw = R * 0.55, mh = R * 0.48;
        x.save();
        x.translate(BODY.hw + 16, BODY.cy + 8);
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
        for (let k = -1; k <= 1; k++) {
          const sx = k * 7;
          const wave = Math.sin(t * 3.5 + k) * 4;
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
    }

    // Corações, estrelas, faíscas e zzz saem do alto da cabeça
    drawParticles(cx, cy) {
      const x = this.x;
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

    eye(shape, w, h, open, sd) {
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
        case 'angry':
          // Barra inclinada com a ponta de dentro mais baixa
          x.save();
          x.rotate(-sd * 0.32);
          rr(x, -w * 0.72, -w * 0.22, w * 1.44, w * 0.44, w * 0.2);
          x.fill();
          x.restore();
          break;
        case 'spiral': {
          // Espiral girando (tonto)
          const spin = NOW() / 180 * sd;
          x.lineWidth = w * 0.22;
          x.lineCap = 'round';
          x.beginPath();
          for (let i = 0; i <= 40; i++) {
            const k = i / 40, ang = spin + k * Math.PI * 4.4, r = k * w * 0.62;
            i ? x.lineTo(Math.cos(ang) * r, Math.sin(ang) * r) : x.moveTo(0, 0);
          }
          x.stroke();
          break;
        }
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
          x.fillStyle = '#ff5fd2';
          heart(x, w * 1.2);
          x.fill();
          break;
        case 'star':
          x.fillStyle = '#ffd166';
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
  // 8. SONS PRÓPRIOS (gerados no navegador, sem arquivos)
  // ========================================================
  // Só tocam com o botão "Som" ligado e depois de um toque na tela (regra dos navegadores)
  const Sfx = {
    on: false,
    ctx: null,

    unlock() {
      try {
        if (!this.ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          this.ctx = new AC();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      } catch (_) {
        // Sem áudio: as animações seguem sem som
      }
    },

    play(name) {
      if (!this.on || !this.ctx || this.ctx.state !== 'running') return;
      const c = this.ctx, t = c.currentTime;
      const out = c.createGain();
      out.gain.value = 0.5;
      out.connect(c.destination);
      if (name === 'whoosh') {
        // Assobio da queda: ruído com filtro descendo
        const len = Math.floor(c.sampleRate * 0.45), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = c.createBufferSource();
        src.buffer = buf;
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 2.5;
        bp.frequency.setValueAtTime(2600, t);
        bp.frequency.exponentialRampToValueAtTime(420, t + 0.42);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.35, t + 0.18);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        src.connect(bp).connect(g).connect(out);
        src.start(t);
        src.stop(t + 0.46);
      } else if (name === 'boing') {
        // "Boing" do quique: tom que sobe e desce com vibrato
        const o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(420, t + 0.06);
        o.frequency.exponentialRampToValueAtTime(210, t + 0.32);
        lfo.frequency.value = 18;
        lg.gain.value = 22;
        lfo.connect(lg).connect(o.frequency);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
        o.connect(g).connect(out);
        o.start(t);
        lfo.start(t);
        o.stop(t + 0.4);
        lfo.stop(t + 0.4);
      } else if (name === 'chime' || name === 'pop') {
        // Tom curto do aceno (duas notas) e do pulo (uma nota)
        const notes = name === 'chime' ? [[1046.5, 0], [1568, 0.09]] : [[660, 0]];
        const decay = name === 'chime' ? 0.55 : 0.12;
        for (const [freq, delay] of notes) {
          const o = c.createOscillator(), g = c.createGain();
          o.type = 'sine';
          o.frequency.value = freq;
          g.gain.setValueAtTime(0.0001, t + delay);
          g.gain.exponentialRampToValueAtTime(0.25, t + delay + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + delay + decay);
          o.connect(g).connect(out);
          o.start(t + delay);
          o.stop(t + delay + decay + 0.05);
        }
      }
    }
  };

  // ========================================================
  // 9. PÁGINA: PALCO, LAÇO DE DESENHO E PREFERÊNCIAS
  // ========================================================
  const canvas = document.getElementById('robo-canvas');
  const stage = document.getElementById('robo-stage');
  const controls = document.getElementById('robo-controls');
  const statusEl = document.getElementById('robo-status');
  const robo = new RoboBot(canvas);
  robo.onSound = name => Sfx.play(name);
  // Acesso pelo console do navegador, para testes
  window.robo = robo;

  // Preferências só deste navegador: roupa, modo automático e som
  const PREFS_KEY = 'robo_preferencias';
  function loadPrefs() {
    const base = { auto: true, roupa: {}, som: false };
    try {
      return Object.assign(base, JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'));
    } catch (_) {
      return base;
    }
  }
  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (_) {
      // Sem armazenamento (aba anônima): vale só até fechar a página
    }
  }
  const prefs = loadPrefs();
  Sfx.on = !!prefs.som;

  // Robô do tamanho do palco (ou da janela flutuante, quando aberta)
  let floating = null;
  function layout() {
    if (floating) return;
    const r = stage.getBoundingClientRect();
    robo.setSize(clamp(Math.min(r.width, r.height) * 0.95, 140, 460));
  }
  if (window.ResizeObserver) new ResizeObserver(layout).observe(stage);
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 150));
  layout();

  // Laço de desenho: quadros da página; da janela flutuante do PC; ou um relógio em segundo plano
  // (Worker) para o vídeo flutuante do Android, quando a página fica escondida
  const driver = { gen: 0, worker: null };
  function frame() {
    robo.update();
    robo.draw();
  }
  function startDriver(kind, win = window) {
    driver.gen++;
    const gen = driver.gen;
    if (driver.worker) {
      driver.worker.terminate();
      driver.worker = null;
    }
    if (kind === 'relogio') {
      const src = 'setInterval(() => postMessage(0), 33);';
      driver.worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      driver.worker.onmessage = () => { if (gen === driver.gen) frame(); };
      return;
    }
    const loop = () => {
      if (gen !== driver.gen) return;
      frame();
      win.requestAnimationFrame(loop);
    };
    win.requestAnimationFrame(loop);
  }
  startDriver('quadros');

  // ========================================================
  // 10. GUARDA-ROUPA E MODO AUTOMÁTICO
  // ========================================================
  let testDate = null;
  let lastDay = '';
  const dayKey = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const fmtDate = d => d.toLocaleDateString('pt-BR');
  function currentSeason() {
    return Roupas.seasonFor(testDate || new Date());
  }
  function applyWardrobe() {
    if (prefs.auto) robo.wardrobe.set(currentSeason().outfit, NOW());
    else robo.wardrobe.set(prefs.roupa || {}, NOW());
    lastDay = dayKey(new Date());
    refreshUI();
  }
  // Modo automático: troca sozinho quando vira o dia
  setInterval(() => {
    if (prefs.auto && !testDate && dayKey(new Date()) !== lastDay) applyWardrobe();
  }, 60000);

  function wardrobeAction(id) {
    const now = NOW();
    if (id === 'auto') {
      prefs.auto = !prefs.auto;
      if (!prefs.auto) prefs.roupa = robo.wardrobe.outfit();
      savePrefs();
      applyWardrobe();
      return;
    }
    prefs.auto = false;
    if (id === 'tirar') robo.wardrobe.clear(now);
    else robo.wardrobe.toggle(id, now);
    prefs.roupa = robo.wardrobe.outfit();
    savePrefs();
  }

  // ========================================================
  // 11. DANÇA, MICROFONE, SENSORES E JANELA FLUTUANTE
  // ========================================================
  let danceTimer = 0;
  function danceFor(ms) {
    clearInterval(danceTimer);
    robo.setDancing(true, 'botao');
    robo.danceBeat();
    let left = ms;
    danceTimer = setInterval(() => {
      left -= 500;
      if (left <= 0) {
        clearInterval(danceTimer);
        robo.setDancing(false, 'botao');
        return;
      }
      robo.danceBeat();
    }, 500);
  }

  // Dançar com a música do ambiente: graves do microfone, analisados aqui mesmo (nada é gravado ou enviado)
  const mic = { on: false, stream: null, ctx: null, timer: 0 };
  async function startMicDance() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Microfone indisponível aqui (abra pelo endereço HTTPS).');
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (err) {
      throw new Error(err && err.name === 'NotAllowedError' ? 'Microfone negado. Libere nas permissões do site.' : 'Não foi possível abrir o microfone.');
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.2;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const binHz = ctx.sampleRate / analyser.fftSize;
    const lo = Math.max(1, Math.floor(40 / binHz)), hi = Math.max(lo, Math.ceil(160 / binHz));
    const detector = new BeatDetector();
    Object.assign(mic, { on: true, stream, ctx });
    mic.timer = setInterval(() => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = lo; i <= hi; i++) sum += data[i];
      const result = detector.push(performance.now(), sum / (hi - lo + 1));
      robo.setDancing(result.music, 'musica');
      if (result.beat && result.music) robo.danceBeat();
    }, 33);
  }
  function stopMicDance() {
    clearInterval(mic.timer);
    if (mic.stream) mic.stream.getTracks().forEach(track => track.stop());
    if (mic.ctx) mic.ctx.close().catch(() => {});
    Object.assign(mic, { on: false, stream: null, ctx: null, timer: 0 });
    robo.setDancing(false, 'musica');
  }

  // Sensor de movimento: inclinar e chacoalhar (Android direto; iPhone pede permissão)
  const sensors = { on: false, gotData: false };
  const shake = new ShakeDetector();
  function onOrientation(e) {
    if (e.beta === null && e.gamma === null) return;
    sensors.gotData = true;
    const v = tiltFromOrientation(e.beta, e.gamma);
    robo.look.x = v.lookX;
    robo.look.y = v.lookY;
    robo.tg.lean = v.lean;
  }
  function onMotion(e) {
    const t = performance.now();
    const acc = e.acceleration;
    let shook;
    if (acc && acc.x !== null) {
      sensors.gotData = true;
      shook = shake.push(t, acc.x, acc.y, acc.z);
    } else if (e.accelerationIncludingGravity && e.accelerationIncludingGravity.x !== null) {
      const g = e.accelerationIncludingGravity;
      sensors.gotData = true;
      shook = shake.push(t, Math.abs(Math.hypot(g.x, g.y, g.z) - 9.81), 0, 0);
    }
    if (shook) robo.dizzy();
  }
  async function startSensors() {
    if (typeof DeviceOrientationEvent === 'undefined') throw new Error('Este aparelho não tem sensor de movimento.');
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      const answer = await DeviceOrientationEvent.requestPermission().catch(() => 'denied');
      if (answer !== 'granted') throw new Error('Permissão do sensor negada.');
    }
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      await DeviceMotionEvent.requestPermission().catch(() => 'denied');
    }
    window.addEventListener('deviceorientation', onOrientation);
    window.addEventListener('devicemotion', onMotion);
    sensors.on = true;
    sensors.gotData = false;
    // Sem leitura em 1,5 s: o aparelho não tem sensor ou o endereço não é HTTPS
    setTimeout(() => {
      if (sensors.on && !sensors.gotData) {
        stopSensors();
        setNote('sensores', 'Nenhuma leitura do sensor: este aparelho não tem sensor ou o endereço não é HTTPS.');
        refreshUI();
      }
    }, 1500);
  }
  function stopSensors() {
    window.removeEventListener('deviceorientation', onOrientation);
    window.removeEventListener('devicemotion', onMotion);
    sensors.on = false;
    robo.tg.lean = 0;
  }

  // Janela flutuante: no PC, janela pequena sempre na frente (o robô vai para lá, tocável);
  // no Android, vídeo flutuante do robô por cima dos outros apps (só para ver)
  function returnCanvas() {
    stage.append(canvas);
    canvas.style.position = '';
    canvas.style.transform = '';
    floating = null;
    startDriver('quadros');
    layout();
    refreshUI();
  }
  async function openFloating() {
    // Primeiro a janela tocável (PC); se o navegador recusar, o vídeo flutuante
    if ('documentPictureInPicture' in window) {
      let pip = null;
      try {
        pip = await window.documentPictureInPicture.requestWindow({ width: 300, height: 320 });
      } catch (_) {
        pip = null;
      }
      if (pip) {
        openWindowFloating(pip);
        return;
      }
    }
    await openVideoFloating();
  }

  // PC: o robô muda para a janela pequena (continua tocável) e volta à página quando ela fecha
  function openWindowFloating(pip) {
    pip.document.title = 'Robô do Echo';
    pip.document.body.style.cssText = 'margin:0;height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#020617;touch-action:none';
    canvas.style.position = 'static';
    canvas.style.transform = 'none';
    pip.document.body.append(canvas);
    floating = { kind: 'janela', win: pip };
    const fit = () => robo.setSize(Math.max(120, Math.min(pip.innerWidth, pip.innerHeight) * 0.96));
    pip.addEventListener('resize', fit);
    fit();
    startDriver('quadros', pip);
    pip.addEventListener('pagehide', returnCanvas);
  }

  // Android (e plano B no PC): vídeo do robô flutuando por cima dos outros apps, só para ver

  async function openVideoFloating() {
    const canVideo = document.pictureInPictureEnabled && typeof HTMLVideoElement.prototype.requestPictureInPicture === 'function' && typeof canvas.captureStream === 'function';
    if (!canVideo) throw new Error('Janela flutuante indisponível neste navegador.');
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = canvas.captureStream(30);
    video.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0;pointer-events:none';
    document.body.append(video);
    // Relógio em segundo plano: a página fica escondida enquanto o vídeo flutua sobre outros apps
    startDriver('relogio');
    try {
      await video.play();
      await video.requestPictureInPicture();
    } catch (err) {
      video.srcObject.getTracks().forEach(track => track.stop());
      video.remove();
      startDriver('quadros');
      throw new Error('O navegador não abriu o vídeo flutuante.');
    }
    floating = { kind: 'video', video };
    video.addEventListener('leavepictureinpicture', () => {
      video.srcObject.getTracks().forEach(track => track.stop());
      video.remove();
      floating = null;
      startDriver('quadros');
      refreshUI();
    });
  }
  function closeFloating() {
    if (!floating) return;
    if (floating.kind === 'janela') floating.win.close();
    else if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
  }

  // ========================================================
  // 12. BOTÕES
  // ========================================================
  let followFinger = false;
  let speakTimer = 0;
  const chosen = { estado: 'idle', acessorio: 'none', olhar: 'center' };

  const LOOKS = {
    left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1], center: [0, 0],
    // Como no Echo: em pé o cartão fica embaixo; deitado, à direita
    card: () => (window.innerHeight >= window.innerWidth ? [0, 0.85] : [0.85, 0.05])
  };

  const ACCESSORIES = [['lupa', 'Lupa'], ['typing', 'Teclado'], ['printer', 'Impressora'], ['celebration', 'Comemoração'], ['coffee', 'Café'], ['none', 'Nenhum']];
  const LOOK_LABELS = [['left', '← Esquerda'], ['right', 'Direita →'], ['up', '↑ Cima'], ['down', '↓ Baixo'], ['center', '● Centro'], ['card', 'Para o cartão'], ['follow', 'Seguir o dedo']];
  const CHEST_SYMBOLS = ['♥', ':)', '!', '?', '♪'];
  let chestIndex = 0;

  function wake() {
    robo.setState('idle');
    chosen.estado = 'idle';
    robo.entrance();
    refreshUI();
  }

  const GROUPS = [
    {
      id: 'estados', title: 'Estados',
      items: Object.entries(STATES).map(([id, c]) => [id, c.label]),
      isActive: id => chosen.estado === id,
      run: id => {
        const wasSleeping = robo.state === 'sleeping';
        robo.setState(id);
        chosen.estado = id;
        // Acordar do modo dormindo faz a entrada
        if (wasSleeping && id !== 'sleeping') robo.entrance();
      }
    },
    {
      id: 'expressoes', title: 'Expressões',
      items: Object.entries(EMOTES).map(([id, e]) => [id, e.label]),
      run: id => robo.emote(id, 2500)
    },
    {
      id: 'guarda-roupa', title: 'Guarda-roupa',
      items: [...Object.entries(Roupas.ITEMS).map(([id, it]) => [id, it.label]), ['auto', 'Automático (estação)'], ['tirar', 'Tirar tudo']],
      isActive: id => (id === 'auto' ? prefs.auto : robo.wardrobe.has(id)),
      run: wardrobeAction,
      extra: buildDateField
    },
    {
      id: 'acessorios', title: 'Acessórios de trabalho',
      items: ACCESSORIES,
      isActive: id => chosen.acessorio === id,
      run: id => {
        robo.setAccessory(id);
        chosen.acessorio = id;
      }
    },
    {
      id: 'animacoes', title: 'Animações',
      items: [['entrada', 'Entrada'], ['dancar', 'Dançar (10 s)'], ['musica', 'Dançar com a música'], ['som', 'Som']],
      isActive: id => (id === 'musica' ? mic.on : id === 'som' ? Sfx.on : false),
      run: async id => {
        if (id === 'entrada') robo.entrance();
        else if (id === 'dancar') danceFor(10000);
        else if (id === 'som') {
          Sfx.on = !Sfx.on;
          prefs.som = Sfx.on;
          savePrefs();
          if (Sfx.on) {
            Sfx.unlock();
            Sfx.play('chime');
          }
        } else if (id === 'musica') {
          if (mic.on) stopMicDance();
          else {
            setNote('animacoes', 'Ouvindo a música do ambiente. Nada é gravado nem enviado.');
            await startMicDance();
          }
        }
      }
    },
    {
      id: 'acoes', title: 'Ações',
      items: [['speak', 'Falar'], ['blink', 'Piscar'], ['squash', 'Toque'], ['roll', 'Girar'], ['jump', 'Pular']],
      run: id => {
        if (id === 'speak') {
          robo.speaking = true;
          clearTimeout(speakTimer);
          speakTimer = setTimeout(() => { robo.speaking = false; }, 3000);
        } else if (id === 'blink') robo.blink();
        else if (id === 'squash') robo.tap();
        else if (id === 'roll') robo.roll(850, 1);
        else if (id === 'jump') robo.anim('oy', [[-0.2, 140, E.out], [0, 280, E.back]]);
      }
    },
    {
      id: 'olhar', title: 'Olhar',
      items: LOOK_LABELS,
      isActive: id => chosen.olhar === id,
      run: id => {
        chosen.olhar = id;
        followFinger = id === 'follow';
        if (followFinger) return;
        const v = typeof LOOKS[id] === 'function' ? LOOKS[id]() : LOOKS[id];
        robo.look.x = v[0];
        robo.look.y = v[1];
      }
    },
    {
      id: 'sensores', title: 'Sensores',
      items: [['sensor', 'Sensor de movimento'], ['chacoalhar', 'Chacoalhar (simulado)']],
      isActive: id => id === 'sensor' && sensors.on,
      run: async id => {
        if (id === 'chacoalhar') robo.dizzy();
        else if (sensors.on) stopSensors();
        else {
          setNote('sensores', 'Incline o celular para o robô olhar; chacoalhe para ele ficar tonto.');
          await startSensors();
        }
      }
    },
    {
      id: 'janela', title: 'Janela flutuante',
      items: [['janela', () => (floating ? 'Fechar janela flutuante' : 'Abrir janela flutuante')]],
      isActive: () => !!floating,
      run: async () => {
        if (floating) closeFloating();
        else await openFloating();
      }
    }
  ];

  const notes = {};
  function setNote(groupId, text) {
    const el = notes[groupId];
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !text;
  }

  let dateResult = null;
  function buildDateField() {
    const wrap = document.createElement('label');
    wrap.className = 'robo-date';
    const caption = document.createElement('span');
    caption.textContent = 'Data de teste';
    const input = document.createElement('input');
    input.type = 'date';
    input.addEventListener('change', () => {
      testDate = input.value ? new Date(`${input.value}T12:00:00`) : null;
      // A data de teste mostra o que o modo automático vestiria
      if (testDate) prefs.auto = true;
      savePrefs();
      applyWardrobe();
    });
    dateResult = document.createElement('span');
    dateResult.className = 'robo-date-result';
    wrap.append(caption, input, dateResult);
    return wrap;
  }

  const labelOf = (list, id) => {
    const item = list.find(([key]) => key === id);
    return item ? item[1] : id;
  };

  function updateStatus() {
    const parts = [STATES[chosen.estado].label];
    if (prefs.auto) parts.push(`Automático: ${currentSeason().label}`);
    else {
      const ids = robo.wardrobe.ids();
      if (ids.length) parts.push(ids.map(id => Roupas.ITEMS[id].label).join(', '));
    }
    if (chosen.acessorio !== 'none') parts.push(labelOf(ACCESSORIES, chosen.acessorio));
    if (floating) parts.push('Janela flutuante');
    statusEl.textContent = parts.join(' · ');
    if (dateResult) {
      const season = currentSeason();
      const ids = Object.values(season.outfit);
      dateResult.textContent = `${fmtDate(testDate || new Date())}: ${season.label}${ids.length ? ` → ${ids.map(id => Roupas.ITEMS[id].label).join(', ')}` : ''}`;
    }
  }

  const buttons = [];
  function refreshUI() {
    for (const { group, id, label, btn } of buttons) {
      btn.classList.toggle('active', !!(group.isActive && group.isActive(id)));
      if (typeof label === 'function') btn.textContent = label();
    }
    updateStatus();
  }

  function buildControls() {
    const sections = GROUPS.map(group => {
      const section = document.createElement('section');
      section.className = 'robo-group';
      section.dataset.group = group.id;
      const title = document.createElement('h2');
      title.textContent = group.title;
      const grid = document.createElement('div');
      grid.className = 'robo-buttons';
      for (const [id, label] of group.items) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'robo-btn';
        btn.textContent = typeof label === 'function' ? label() : label;
        btn.dataset.id = id;
        btn.addEventListener('click', async () => {
          Sfx.unlock();
          try {
            await group.run(id);
          } catch (err) {
            setNote(group.id, err.message);
          }
          if (!group.isActive || !group.isActive(id)) {
            btn.classList.add('flash');
            setTimeout(() => btn.classList.remove('flash'), 400);
          }
          refreshUI();
        });
        buttons.push({ group, id, label, btn });
        grid.appendChild(btn);
      }
      const note = document.createElement('p');
      note.className = 'robo-note';
      note.hidden = true;
      notes[group.id] = note;
      section.append(title, grid);
      if (group.extra) section.append(group.extra());
      section.append(note);
      return section;
    });
    controls.replaceChildren(...sections);
  }
  buildControls();
  applyWardrobe();

  // Segurar o robô: abre o guarda-roupa (como o botão direito no Coucou)
  function openWardrobe() {
    const section = controls.querySelector('[data-group="guarda-roupa"]');
    if (!section) return;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section.classList.add('flash');
    setTimeout(() => section.classList.remove('flash'), 1200);
    robo.blink();
  }

  // ========================================================
  // 13. TOQUES NO ROBÔ
  // ========================================================
  const gestures = new GestureReader();
  let pressTimer = 0;
  const toCanvas = e => {
    const r = canvas.getBoundingClientRect();
    return { px: (e.clientX - r.left) / r.width * 280, py: (e.clientY - r.top) / r.height * 280 };
  };
  function handleGestures(events) {
    for (const ev of events) {
      if (ev === 'toque') robo.tap();
      else if (ev === 'duplo') robo.hop();
      else if (ev === 'bravo') robo.angry();
      else if (ev === 'toque-visor') robo.surprise();
      else if (ev === 'toque-peito') robo.showSymbol(CHEST_SYMBOLS[chestIndex++ % CHEST_SYMBOLS.length], 2000);
      else if (ev === 'toque-chapeu') robo.hatHop();
      else if (ev === 'carinho') robo.cuddle();
      else if (ev === 'segurar') openWardrobe();
    }
  }
  canvas.addEventListener('pointerdown', (e) => {
    Sfx.unlock();
    // Tocar no robô dormindo acorda (com a entrada)
    if (robo.state === 'sleeping') {
      wake();
      return;
    }
    const p = toCanvas(e);
    gestures.start(performance.now(), p.px, p.py, robo.regionAt(p.px, p.py));
    // Segue o dedo mesmo se ele sair do robô; se o navegador recusar, o gesto continua valendo
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {}
    clearInterval(pressTimer);
    pressTimer = setInterval(() => handleGestures(gestures.poll(performance.now())), 50);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!gestures.down) return;
    const p = toCanvas(e);
    handleGestures(gestures.move(performance.now(), p.px, p.py));
  });
  canvas.addEventListener('pointerup', () => {
    clearInterval(pressTimer);
    handleGestures(gestures.end(performance.now()));
  });
  canvas.addEventListener('pointercancel', () => {
    clearInterval(pressTimer);
    gestures.down = null;
  });

  // Com "Seguir o dedo", ele olha para onde o dedo ou o mouse está
  window.addEventListener('pointermove', (e) => {
    if (!followFinger) return;
    const rect = canvas.getBoundingClientRect();
    robo.look.x = Math.tanh((e.clientX - (rect.left + rect.width / 2)) / 120);
    robo.look.y = Math.tanh((e.clientY - (rect.top + rect.height / 2)) / 100);
  });
  window.addEventListener('pointerdown', () => Sfx.unlock(), { passive: true });

  // ========================================================
  // 14. ENTRADA AO ABRIR E AO VOLTAR, E TELA ACESA
  // ========================================================
  // Entrada: ao abrir a página e ao voltar depois de mais de 30 min fora
  let hiddenAt = document.visibilityState === 'hidden' ? Date.now() : 0;
  let pendingEntrance = document.visibilityState !== 'visible';
  if (!pendingEntrance) robo.entrance();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    if (pendingEntrance || (hiddenAt && Date.now() - hiddenAt > 30 * 60 * 1000)) {
      pendingEntrance = false;
      robo.entrance();
    }
    hiddenAt = 0;
  });

  // Tela acesa: o navegador solta o pedido quando a página sai da frente; pede de novo ao voltar e a cada toque
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
  document.addEventListener('visibilitychange', requestWakeLock);
  window.addEventListener('pointerdown', requestWakeLock, { passive: true });
  requestWakeLock();
})();
