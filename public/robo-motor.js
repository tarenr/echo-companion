// Robô // motor compartilhado do personagem do Echo
// Usado pelo Echo (app.js) e pela página de testes (robo.js). O motor de animação (tweens, estados,
// expressões, acessórios e partículas) deriva do motor MIT do Coucou (https://github.com/Louis-CFM/coucou);
// o desenho do robô, as roupas (robo-roupas.js), as reações e as animações de entrada e dança são próprios.

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

  // Escala para o canto mais alto (quadro da cabeça ou canto da cabeça) caber no quadro quando o robô inclina
  // em torno do meio do corpo (PIVOT). Sem inclinação dá 1.
  function tiltZoom(rot) {
    const r = Math.min(Math.abs(rot), 0.6);
    const corner = { dx: -(TAG.x - TAG.w / 2), dy: PIVOT - (TAG.y - TAG.h / 2) };   // canto de cima do quadro
    const top = -PIVOT + corner.dy * Math.cos(r) + corner.dx * Math.sin(r);
    return Math.min(1, (GROUND - 12) / top);
  }

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
    // Quadro da cabeça (badge) só nos estados de ação; parado, ouvindo, concluído e erro ficam sem ele
    approval: { label: 'Aprovação', col: '#F5A524', tint: 0.78, eye: 'wide', badge: ['bang', '#F5A524'] },
    finished: { label: 'Concluído', col: '#10b981', tint: 0.35, eye: 'happy', badge: null },
    error: { label: 'Erro', col: '#F4505E', tint: 0.78, eye: 'flat', badge: null },
    listening: { label: 'Ouvindo', col: '#00d4ff', tint: 0.45, eye: 'dot', badge: null },
    sleeping: { label: 'Dormindo', col: '#8b5cf6', tint: 0.12, eye: 'sleep', badge: null }
  };

  // snd: nome do som avisado pelo gancho onSound (o Echo toca os seus sons; a página de testes, os próprios)
  const EMOTES = {
    love: { label: 'Amor', eye: 'heart', snd: 'love' },
    surprised: { label: 'Surpresa', eye: 'dot', snd: 'pop' },
    proud: { label: 'Orgulho', eye: 'star', snd: 'proud' },
    happy: { label: 'Feliz', eye: 'happy' }
  };

  // Som avisado pelo gancho onSound a cada troca de estado (só quando o estado muda de fato)
  const STATE_SOUNDS = { finished: 'finish', error: 'error', approval: 'approval', thinking: 'think', listening: 'listen', working: 'work', sleeping: 'sleep' };

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
      this.tagHoldUntil = 0;                         // até quando o quadro da cabeça espera (entrada)
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
      this.dance = { sources: new Set(), phase: 0, beatGap: 0.5, lastBeat: 0, until: 0, nextBeat: 0 };
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
        this.onSound('finish');
        // Meta batida: dança curta depois do pulo
        setTimeout(() => this.danceFor(4000), 500);
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
        if (!b) return;
        // Durante a entrada o quadro espera ela acabar para aparecer
        const wait = Math.max(0, this.tagHoldUntil - NOW());
        this.anim('badgeS', wait ? [[0, wait, E.lin], [1, 260, E.back]] : [[1, 260, E.back]]);
      }, 90);
    }

    // Tamanho do quadro da cabeça: 0 sem ação (repouso, ouvindo, dormindo, concluído, erro) e durante a entrada
    tagScale() {
      return this.badge ? Math.max(0, this.s.badgeS) : 0;
    }

    setState(n) {
      if (!STATES[n]) return;
      const previous = this.state;
      const changed = previous !== n;
      this.state = n;
      if (changed && STATE_SOUNDS[n]) this.onSound(STATE_SOUNDS[n]);
      // Acordar do modo dormindo faz a entrada
      if (previous === 'sleeping' && n !== 'sleeping') this.entrance();
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
      this.onSound('slap');
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
      if (em.snd) this.onSound(em.snd);
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
      // O robô entra sem o quadro da cabeça; se houver ação, ele aparece no fim da entrada (3 s)
      const hold = 3000;
      this.tagHoldUntil = NOW() + hold;
      this.anim('badgeS', this.badge ? [[0, 80, E.inOut], [0, hold - 80, E.lin], [1, 260, E.back]] : [[0, 80, E.inOut]]);
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
      return this.dance.sources.size > 0 || NOW() < this.dance.until;
    }

    // Dança contínua enquanto alguém pedir (ex.: "musica", pelo microfone; as batidas vêm de fora)
    setDancing(on, source) {
      if (on) this.dance.sources.add(source);
      else this.dance.sources.delete(source);
    }

    // Dança por um tempo, com batidas a cada 0,5 s marcadas pelo próprio update()
    danceFor(ms) {
      const n = NOW();
      this.dance.until = n + ms;
      this.dance.nextBeat = n;
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

      // Dança com tempo marcado: uma batida a cada 0,5 s
      if (n < this.dance.until && n >= this.dance.nextBeat) {
        this.dance.nextBeat = n + 500;
        this.danceBeat();
      }

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

      // Chapéu alto ou robô muito inclinado (celular inclinado + tonto/dança): recua aos poucos até caber
      const rot = s.tilt + s.lean + s.sway;
      this.fz += (Math.min(Roupas.headroomZoom(this.wardrobe.headroom()), tiltZoom(rot)) - this.fz) * kGen;

      // Física das roupas: as partes moles ficam para trás quando a cabeça acelera
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

    // Quadro no alto da cabeça com o selo do estado: só durante ações; cresce ao aparecer e encolhe ao sumir
    drawTag(t) {
      const x = this.x;
      const k = this.tagScale();
      if (k <= 0.01) return;
      x.save();
      x.translate(TAG.x, TAG.y);
      x.rotate(-0.1);
      x.scale(k, k);
      x.fillStyle = ROBO_SPEC.ink;
      rr(x, -TAG.w / 2, -TAG.h / 2, TAG.w, TAG.h, 11);
      x.fill();
      x.strokeStyle = ROBO_SPEC.tagRim;
      x.lineWidth = 3;
      x.stroke();
      const col = this.badgeCol;
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
    // Sons que este módulo sabe tocar; os demais nomes do gancho ficam para quem usa o motor
    names: ['whoosh', 'boing', 'chime', 'pop'],

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
      if (!this.names.includes(name) || !this.on || !this.ctx || this.ctx.state !== 'running') return;
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
  // 9. LAÇO DE DESENHO
  // ========================================================
  // Quadros da janela (ou da janela flutuante do PC) ou um relógio em segundo plano (Worker) para o
  // vídeo flutuante do Android, quando a página fica escondida e o navegador para de entregar quadros
  function createDriver(frame) {
    const state = { gen: 0, worker: null };
    function start(kind, win = window) {
      state.gen++;
      const gen = state.gen;
      if (state.worker) {
        state.worker.terminate();
        state.worker = null;
      }
      if (kind === 'relogio') {
        const src = 'setInterval(() => postMessage(0), 33);';
        state.worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
        state.worker.onmessage = () => { if (gen === state.gen) frame(); };
        return;
      }
      const loop = () => {
        if (gen !== state.gen) return;
        frame();
        win.requestAnimationFrame(loop);
      };
      win.requestAnimationFrame(loop);
    }
    return { start };
  }

  // ========================================================
  // 10. JANELA FLUTUANTE
  // ========================================================
  // PC: o canvas muda para uma janela pequena sempre na frente (continua tocável) e volta quando ela fecha.
  // Android (e plano B no PC): vídeo do canvas flutuando por cima dos outros apps, só para ver.
  // home(canvas) devolve o canvas ao lugar dele na página; onChange() avisa que abriu ou fechou.
  function createFloating({ canvas, robo, driver, home, onChange = () => {} }) {
    let current = null;

    function finish() {
      current = null;
      driver.start('quadros');
      onChange();
    }

    function openWindow(pip) {
      pip.document.title = 'Robô do Echo';
      pip.document.body.style.cssText = 'margin:0;height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#020617;touch-action:none';
      canvas.style.position = 'static';
      canvas.style.transform = 'none';
      pip.document.body.append(canvas);
      current = { kind: 'janela', win: pip };
      const fit = () => robo.setSize(Math.max(120, Math.min(pip.innerWidth, pip.innerHeight) * 0.96));
      pip.addEventListener('resize', fit);
      fit();
      driver.start('quadros', pip);
      pip.addEventListener('pagehide', () => {
        canvas.style.position = '';
        canvas.style.transform = '';
        home(canvas);
        finish();
      });
      onChange();
    }

    async function openVideo() {
      const canVideo = document.pictureInPictureEnabled && typeof HTMLVideoElement.prototype.requestPictureInPicture === 'function' && typeof canvas.captureStream === 'function';
      if (!canVideo) throw new Error('Janela flutuante indisponível neste navegador.');
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = canvas.captureStream(30);
      video.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0;pointer-events:none';
      document.body.append(video);
      // Relógio em segundo plano: a página fica escondida enquanto o vídeo flutua sobre outros apps
      driver.start('relogio');
      try {
        await video.play();
        await video.requestPictureInPicture();
      } catch (err) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.remove();
        driver.start('quadros');
        throw new Error('O navegador não abriu o vídeo flutuante.');
      }
      current = { kind: 'video', video };
      video.addEventListener('leavepictureinpicture', () => {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.remove();
        finish();
      });
      onChange();
    }

    // Primeiro a janela tocável (PC); se o navegador recusar, o vídeo flutuante
    async function open() {
      if (current) return;
      if ('documentPictureInPicture' in window) {
        let pip = null;
        try {
          pip = await window.documentPictureInPicture.requestWindow({ width: 300, height: 320 });
        } catch (_) {
          pip = null;
        }
        if (pip) {
          openWindow(pip);
          return;
        }
      }
      await openVideo();
    }

    function close() {
      if (!current) return;
      if (current.kind === 'janela') current.win.close();
      else if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
    }

    return {
      open,
      close,
      get active() { return current; }
    };
  }

  // ========================================================
  // 11. SENSOR DE MOVIMENTO (inclinar e chacoalhar)
  // ========================================================
  // onTilt(v): inclinação já convertida ({ lookX, lookY, lean }); onShake(): chacoalhou; onStop(): desligou;
  // onNoData(): ligou, mas nenhuma leitura chegou (aparelho sem sensor ou endereço sem HTTPS).
  // O iPhone e as versões recentes do Chrome pedem permissão: start() deve ser chamado num toque.
  function createSensors({ onTilt, onShake, onStop = () => {}, onNoData = () => {}, noDataMs = 1500 }) {
    const state = { on: false, gotData: false, timer: 0 };
    const shake = new ShakeDetector();

    function onOrientation(e) {
      if (e.beta === null && e.gamma === null) return;
      state.gotData = true;
      onTilt(tiltFromOrientation(e.beta, e.gamma));
    }

    function onMotion(e) {
      const t = NOW();
      const acc = e.acceleration;
      let shook = false;
      if (acc && acc.x !== null && acc.x !== undefined) {
        state.gotData = true;
        shook = shake.push(t, acc.x, acc.y, acc.z);
      } else if (e.accelerationIncludingGravity && e.accelerationIncludingGravity.x !== null && e.accelerationIncludingGravity.x !== undefined) {
        const g = e.accelerationIncludingGravity;
        state.gotData = true;
        shook = shake.push(t, Math.abs(Math.hypot(g.x, g.y, g.z) - 9.81), 0, 0);
      }
      if (shook) onShake();
    }

    function stop() {
      clearTimeout(state.timer);
      window.removeEventListener('deviceorientation', onOrientation);
      window.removeEventListener('devicemotion', onMotion);
      const wasOn = state.on;
      state.on = false;
      if (wasOn) onStop();
    }

    async function start() {
      if (state.on) return;
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
      state.on = true;
      state.gotData = false;
      clearTimeout(state.timer);
      // Sem leitura no prazo: desliga e avisa
      state.timer = setTimeout(() => {
        if (state.on && !state.gotData) {
          stop();
          onNoData();
        }
      }, noDataMs);
    }

    return {
      start,
      stop,
      get on() { return state.on; }
    };
  }

  window.RoboMotor = {
    RoboBot, STATES, EMOTES, FACE, faceFrame, facePoints,
    GestureReader, tiltFromOrientation, ShakeDetector, BeatDetector,
    Sfx, E, createDriver, createFloating, createSensors
  };
})();
