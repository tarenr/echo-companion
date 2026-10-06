// Robô // guarda-roupa, estações e física das roupas
// Desenhos próprios, feitos do zero para o robô do Echo (não são cópias das roupas do Mochi/Coucou).
// Coordenadas: as peças da cabeça usam como origem a base do chapéu (no alto da cabeça); as do rosto,
// o centro do visor (olhos em ±35,5); a do pescoço, a base do corpo do robô (y negativo para cima).

(function (root) {
  'use strict';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeBack = t => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

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
  function circle(x, cx, cy, r) {
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
  }
  function linear(x, x0, y0, x1, y1, stops) {
    const g = x.createLinearGradient(x0, y0, x1, y1);
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
    return g;
  }

  // ========================================================
  // MOLA DAS PARTES MOLES (pompom, pontas, orelhas, laço, cachecol)
  // ========================================================
  // "a" é o ângulo de balanço (0 = repouso). fx empurra para os lados; fy só age nas peças com "side"
  // (as que pendem para um lado), para um pulo também balançá-las.
  class Spring {
    constructor(k = 90, c = 7, side = 0) {
      this.k = k;
      this.c = c;
      this.side = side;
      this.a = 0;
      this.v = 0;
    }

    kick(impulse) {
      this.v += impulse;
    }

    step(dt, fx = 0, fy = 0) {
      const force = clamp(fx + fy * this.side, -40, 40);
      let left = clamp(dt, 0, 0.1);
      // Passos curtos: estável mesmo com o navegador entregando quadros espaçados
      while (left > 0) {
        const h = Math.min(left, 1 / 120);
        this.v += (-this.k * this.a - this.c * this.v + force) * h;
        this.a += this.v * h;
        left -= h;
      }
      this.a = clamp(this.a, -1.2, 1.2);
      this.v = clamp(this.v, -30, 30);
    }
  }

  // ========================================================
  // AS 11 PEÇAS
  // ========================================================
  // top: quanto a peça sobe acima da cabeça (para o quadro reservar espaço)
  // springs: [rigidez, amortecimento, lado] de cada parte mole
  const LENS_X = 35.5;   // centro de cada lente = centro de cada olho no visor

  const ITEMS = {
    festa: {
      label: 'Chapéu de festa', slot: 'cabeca', top: 74, springs: [[70, 6, 0]],
      draw(x, t, a) {
        x.save();
        x.rotate(-0.08 + a[0] * 0.22);
        x.beginPath();
        x.moveTo(-26, 2);
        x.lineTo(2, -60);
        x.lineTo(28, 2);
        x.closePath();
        x.fillStyle = linear(x, -26, 2, 20, -60, ['#ec4899', '#a855f7']);
        x.fill();
        x.save();
        x.clip();
        x.strokeStyle = '#fde047';
        x.lineWidth = 5;
        for (let i = 0; i < 5; i++) {
          x.beginPath();
          x.moveTo(-34, -4 - i * 15);
          x.lineTo(36, -18 - i * 15);
          x.stroke();
        }
        x.restore();
        x.fillStyle = '#fde047';
        x.beginPath();
        x.ellipse(1, 1, 29, 5, 0, 0, Math.PI * 2);
        x.fill();
        circle(x, 2, -62, 8);
        x.fillStyle = '#fef08a';
        x.fill();
        circle(x, -1, -65, 3);
        x.fillStyle = 'rgba(255, 255, 255, 0.8)';
        x.fill();
        x.restore();
      }
    },
    gorro: {
      label: 'Gorro', slot: 'cabeca', top: 60, springs: [[60, 5, 0]],
      draw(x, t, a) {
        x.beginPath();
        x.moveTo(-44, -6);
        x.bezierCurveTo(-44, -50, 52, -50, 52, -6);
        x.closePath();
        x.fillStyle = linear(x, 0, -44, 0, -4, ['#0891b2', '#155e75']);
        x.fill();
        x.save();
        x.clip();
        x.fillStyle = 'rgba(34, 211, 238, 0.55)';
        x.fillRect(-50, -30, 110, 7);
        x.restore();
        rr(x, -48, -12, 104, 16, 7);
        x.fillStyle = '#0c4a6e';
        x.fill();
        x.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        x.lineWidth = 2;
        for (let rib = -42; rib <= 50; rib += 8) {
          x.beginPath();
          x.moveTo(rib, -10);
          x.lineTo(rib, 2);
          x.stroke();
        }
        // Pompom balançando no alto
        const px = 4 + Math.sin(a[0]) * 15, py = -45 + Math.abs(Math.sin(a[0])) * 3;
        x.fillStyle = '#e0f2fe';
        for (const [dx, dy, r] of [[0, 0, 11], [-6, -4, 6], [6, -4, 6], [-6, 4, 6], [6, 4, 6]]) {
          circle(x, px + dx, py + dy, r);
          x.fill();
        }
      }
    },
    coroa: {
      label: 'Coroa', slot: 'cabeca', top: 40, springs: [],
      draw(x) {
        const pts = [[-28, 0], [-28, -22], [-17, -10], [-6, -30], [4, -12], [14, -30], [25, -10], [34, -22], [34, 0]];
        x.beginPath();
        pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
        x.closePath();
        x.fillStyle = linear(x, 0, -30, 0, 0, ['#fef08a', '#f59e0b']);
        x.fill();
        x.strokeStyle = '#b45309';
        x.lineWidth = 1.5;
        x.stroke();
        x.fillStyle = '#d97706';
        x.fillRect(-28, -7, 62, 7);
        for (const [gx, col] of [[-15, '#22d3ee'], [3, '#ef4444'], [21, '#22d3ee']]) {
          circle(x, gx, -3.5, 3.2);
          x.fillStyle = col;
          x.fill();
        }
        for (const [px, py] of [[-28, -22], [-6, -30], [14, -30], [34, -22]]) {
          circle(x, px, py, 2.6);
          x.fillStyle = '#fffbeb';
          x.fill();
        }
      }
    },
    bruxa: {
      label: 'Chapéu de bruxa', slot: 'cabeca', top: 94, springs: [[55, 4.5, 0]],
      draw(x, t, a) {
        const tipX = 22 + a[0] * 26, tipY = -84 + Math.abs(a[0]) * 8;
        // Aba
        x.beginPath();
        x.ellipse(8, -2, 50, 9, 0, 0, Math.PI * 2);
        x.fillStyle = '#2e1065';
        x.fill();
        x.strokeStyle = 'rgba(167, 139, 250, 0.6)';
        x.lineWidth = 1.5;
        x.stroke();
        // Cone com a ponta mole
        x.beginPath();
        x.moveTo(-24, -4);
        x.quadraticCurveTo(-6, -48, tipX - 4, tipY);
        x.quadraticCurveTo(16, -44, 38, -4);
        x.closePath();
        x.fillStyle = linear(x, 0, tipY, 0, -4, ['#6d28d9', '#3b0764']);
        x.fill();
        x.stroke();
        // Faixa e fivela
        x.save();
        x.clip();
        x.fillStyle = '#f59e0b';
        x.fillRect(-30, -20, 76, 9);
        x.restore();
        rr(x, 2, -22, 12, 12, 2);
        x.strokeStyle = '#fde68a';
        x.lineWidth = 2;
        x.stroke();
        // Curvinha na ponta
        circle(x, tipX - 4, tipY, 3);
        x.fillStyle = '#7c3aed';
        x.fill();
      }
    },
    noel: {
      label: 'Gorro de Papai Noel', slot: 'cabeca', top: 70, springs: [[50, 4, 1]],
      draw(x, t, a) {
        const tipX = 48 + a[0] * 18, tipY = -26 + Math.abs(a[0]) * 6;
        x.beginPath();
        x.moveTo(-38, -6);
        x.bezierCurveTo(-34, -48, -6, -64, 20, -56);
        x.quadraticCurveTo(tipX - 2, tipY - 22, tipX, tipY);
        x.quadraticCurveTo(24, -36, 40, -6);
        x.closePath();
        x.fillStyle = linear(x, 0, -60, 0, -6, ['#ef4444', '#b91c1c']);
        x.fill();
        x.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        x.lineWidth = 2;
        x.beginPath();
        x.moveTo(-26, -24);
        x.quadraticCurveTo(-14, -48, 8, -52);
        x.stroke();
        // Barra de pelo
        rr(x, -44, -16, 90, 18, 9);
        x.fillStyle = '#f8fafc';
        x.fill();
        x.fillStyle = 'rgba(203, 213, 225, 0.7)';
        for (let fx = -36; fx <= 38; fx += 12) {
          circle(x, fx, -7 + (fx % 24 ? 2 : -2), 3);
          x.fill();
        }
        // Pompom na ponta
        circle(x, tipX, tipY + 4, 9);
        x.fillStyle = '#f8fafc';
        x.fill();
      }
    },
    coelho: {
      label: 'Orelhas de coelho', slot: 'cabeca', top: 76, springs: [[80, 5, -1], [70, 5, 1]],
      draw(x, t, a) {
        // Tiara
        x.strokeStyle = '#f8fafc';
        x.lineWidth = 6;
        x.lineCap = 'round';
        x.beginPath();
        x.moveTo(-30, 3);
        x.quadraticCurveTo(6, -9, 44, 3);
        x.stroke();
        for (const [bx, ang] of [[-12, -0.22 + a[0] * 0.35], [24, 0.2 + a[1] * 0.35]]) {
          x.save();
          x.translate(bx, -2);
          x.rotate(ang);
          x.beginPath();
          x.ellipse(0, -32, 11, 34, 0, 0, Math.PI * 2);
          x.fillStyle = '#f8fafc';
          x.fill();
          x.strokeStyle = '#cbd5e1';
          x.lineWidth = 1.5;
          x.stroke();
          x.beginPath();
          x.ellipse(0, -30, 5.5, 25, 0, 0, Math.PI * 2);
          x.fillStyle = '#f9a8d4';
          x.fill();
          x.restore();
        }
      }
    },
    laco: {
      label: 'Laço', slot: 'cabeca', top: 20, springs: [[110, 6, 0]],
      draw(x, t, a) {
        x.save();
        x.translate(44, -2);
        x.rotate(-0.28 + a[0] * 0.25);
        // Pontas da fita
        x.fillStyle = '#db2777';
        for (const sd of [-1, 1]) {
          x.beginPath();
          x.moveTo(sd * 2, 3);
          x.lineTo(sd * 9, 17);
          x.lineTo(sd * 4, 15);
          x.lineTo(sd * 1, 19);
          x.closePath();
          x.fill();
        }
        // Laçadas
        for (const sd of [-1, 1]) {
          x.beginPath();
          x.moveTo(0, 0);
          x.bezierCurveTo(sd * 10, -16, sd * 26, -14, sd * 24, 0);
          x.bezierCurveTo(sd * 26, 12, sd * 10, 14, 0, 0);
          x.fillStyle = '#ec4899';
          x.fill();
          x.strokeStyle = '#be185d';
          x.lineWidth = 1.5;
          x.stroke();
        }
        rr(x, -5, -5, 10, 10, 4);
        x.fillStyle = '#db2777';
        x.fill();
        x.restore();
      }
    },
    abobora: {
      label: 'Abóbora', slot: 'cabeca', top: 62, springs: [[100, 7, 0]],
      draw(x, t, a) {
        const sq = 1 + a[0] * 0.08;
        x.save();
        x.translate(4, -2);
        x.scale(1 / sq, sq);
        // Gomos
        for (const [cx, rx] of [[-22, 16], [22, 16], [-9, 17], [9, 17], [0, 15]]) {
          x.beginPath();
          x.ellipse(cx, -22, rx, 24, 0, 0, Math.PI * 2);
          x.fillStyle = linear(x, 0, -46, 0, 2, ['#fb923c', '#ea580c']);
          x.fill();
          x.strokeStyle = '#c2410c';
          x.lineWidth = 1.5;
          x.stroke();
        }
        // Carinha
        x.fillStyle = '#431407';
        for (const sd of [-1, 1]) {
          x.beginPath();
          x.moveTo(sd * 12, -30);
          x.lineTo(sd * 6, -22);
          x.lineTo(sd * 18, -22);
          x.closePath();
          x.fill();
        }
        x.beginPath();
        x.moveTo(-14, -14);
        x.quadraticCurveTo(0, -4, 14, -14);
        x.quadraticCurveTo(0, -9, -14, -14);
        x.fill();
        // Talo e folha
        x.strokeStyle = '#65a30d';
        x.lineWidth = 5;
        x.lineCap = 'round';
        x.beginPath();
        x.moveTo(0, -44);
        x.quadraticCurveTo(2, -54, 9, -56);
        x.stroke();
        x.beginPath();
        x.ellipse(-9, -50, 8, 4, -0.5, 0, Math.PI * 2);
        x.fillStyle = '#84cc16';
        x.fill();
        x.restore();
      }
    },
    oculosEscuros: {
      label: 'Óculos escuros', slot: 'rosto', top: 0, springs: [],
      draw(x) {
        x.strokeStyle = '#020617';
        x.lineWidth = 3;
        x.lineCap = 'round';
        for (const sd of [-1, 1]) {
          x.beginPath();
          x.moveTo(sd * (LENS_X + 22), -6);
          x.lineTo(sd * 74, -8);
          x.stroke();
        }
        for (const ex of [-LENS_X, LENS_X]) {
          rr(x, ex - 22, -14, 44, 28, 10);
          x.fillStyle = 'rgba(10, 14, 30, 0.9)';
          x.fill();
          x.strokeStyle = '#020617';
          x.lineWidth = 3;
          x.stroke();
          x.strokeStyle = 'rgba(255, 255, 255, 0.35)';
          x.lineWidth = 2.5;
          x.beginPath();
          x.moveTo(ex - 13, -7);
          x.lineTo(ex - 5, -11);
          x.stroke();
        }
        x.strokeStyle = '#020617';
        x.lineWidth = 3;
        x.beginPath();
        x.moveTo(-LENS_X + 22, -6);
        x.quadraticCurveTo(0, -12, LENS_X - 22, -6);
        x.stroke();
      }
    },
    oculosRedondos: {
      label: 'Óculos redondos', slot: 'rosto', top: 0, springs: [],
      draw(x) {
        x.strokeStyle = '#fbbf24';
        x.lineCap = 'round';
        for (const sd of [-1, 1]) {
          x.lineWidth = 2;
          x.beginPath();
          x.moveTo(sd * (LENS_X + 19), -4);
          x.lineTo(sd * 74, -6);
          x.stroke();
        }
        for (const ex of [-LENS_X, LENS_X]) {
          circle(x, ex, 0, 19);
          x.fillStyle = 'rgba(186, 230, 253, 0.16)';
          x.fill();
          x.lineWidth = 3;
          x.strokeStyle = '#fbbf24';
          x.stroke();
          x.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          x.lineWidth = 2;
          x.beginPath();
          x.arc(ex, 0, 13, Math.PI * 1.1, Math.PI * 1.45);
          x.stroke();
        }
        x.strokeStyle = '#fbbf24';
        x.lineWidth = 2.5;
        x.beginPath();
        x.moveTo(-LENS_X + 19, -2);
        x.quadraticCurveTo(0, -10, LENS_X - 19, -2);
        x.stroke();
      }
    },
    cachecol: {
      label: 'Cachecol', slot: 'pescoco', top: 0, springs: [[60, 4, 1], [70, 4, 1]],
      draw(x, t, a) {
        const stripes = (X, Y, W, H) => {
          x.save();
          x.clip();
          x.strokeStyle = 'rgba(254, 243, 199, 0.85)';
          x.lineWidth = 4;
          for (let s = X - H; s < X + W + H; s += 12) {
            x.beginPath();
            x.moveTo(s, Y + H);
            x.lineTo(s + H, Y);
            x.stroke();
          }
          x.restore();
        };
        // Pontas soltas (atrás do nó)
        for (const [px, ang, len, w] of [[24, 0.18 + a[0] * 0.5, 42, 16], [32, -0.04 + a[1] * 0.5, 33, 14]]) {
          x.save();
          x.translate(px, -79);
          x.rotate(ang);
          rr(x, -w / 2, 0, w, len, 5);
          x.fillStyle = '#dc2626';
          x.fill();
          stripes(-w / 2, 0, w, len);
          x.strokeStyle = '#fca5a5';
          x.lineWidth = 2;
          for (let fx = -w / 2 + 3; fx <= w / 2 - 2; fx += 4) {
            x.beginPath();
            x.moveTo(fx, len);
            x.lineTo(fx, len + 6);
            x.stroke();
          }
          x.restore();
        }
        // Volta no pescoço e nó
        rr(x, -40, -91, 80, 17, 8);
        x.fillStyle = '#dc2626';
        x.fill();
        stripes(-40, -91, 80, 17);
        circle(x, 27, -80, 8);
        x.fillStyle = '#b91c1c';
        x.fill();
      }
    }
  };

  const SLOTS = ['cabeca', 'rosto', 'pescoco'];
  const IN_MS = 450;
  const OUT_MS = 300;

  // ========================================================
  // GUARDA-ROUPA: o que está vestido, troca com transição e física
  // ========================================================
  class Wardrobe {
    constructor() {
      this.worn = { cabeca: null, rosto: null, pescoco: null };
      this.leaving = [];
    }

    has(id) {
      const it = ITEMS[id];
      return !!it && this.worn[it.slot] !== null && this.worn[it.slot].id === id;
    }

    wear(id, now) {
      const it = ITEMS[id];
      if (!it || this.has(id)) return false;
      this.remove(it.slot, now);
      this.worn[it.slot] = { id, t0: now, springs: it.springs.map(([k, c, side]) => new Spring(k, c, side)) };
      return true;
    }

    remove(slot, now) {
      const w = this.worn[slot];
      if (!w) return false;
      this.leaving.push({ ...w, t0: now });
      this.worn[slot] = null;
      return true;
    }

    toggle(id, now) {
      return this.has(id) ? this.remove(ITEMS[id].slot, now) : this.wear(id, now);
    }

    set(outfit, now) {
      for (const slot of SLOTS) {
        const id = outfit && outfit[slot];
        if (id) this.wear(id, now);
        else this.remove(slot, now);
      }
    }

    clear(now) {
      SLOTS.forEach(slot => this.remove(slot, now));
    }

    outfit() {
      const out = {};
      for (const slot of SLOTS) out[slot] = this.worn[slot] ? this.worn[slot].id : null;
      return out;
    }

    ids() {
      return SLOTS.map(slot => this.worn[slot] && this.worn[slot].id).filter(Boolean);
    }

    // Quanto acima da cabeça o quadro precisa reservar
    headroom() {
      const w = this.worn.cabeca;
      return w ? ITEMS[w.id].top : 0;
    }

    kick(amount) {
      for (const slot of SLOTS) {
        const w = this.worn[slot];
        if (w) w.springs.forEach((sp, i) => sp.kick(amount * 6 * (i % 2 ? -1 : 1)));
      }
    }

    step(dt, now, fx, fy) {
      for (const slot of SLOTS) {
        const w = this.worn[slot];
        if (w) w.springs.forEach(sp => sp.step(dt, fx, fy));
      }
      for (const l of this.leaving) l.springs.forEach(sp => sp.step(dt, fx, fy));
      this.leaving = this.leaving.filter(l => now - l.t0 < OUT_MS);
    }

    // Camadas de um lugar: as peças saindo (sobem e somem) e a vestida (cai e quica ao entrar;
    // óculos encolhem até o rosto)
    layers(slot, now) {
      const out = [];
      for (const l of this.leaving) {
        if (ITEMS[l.id].slot !== slot) continue;
        const q = clamp((now - l.t0) / OUT_MS, 0, 1);
        out.push({
          item: ITEMS[l.id], a: l.springs.map(s => s.a),
          dy: (slot === 'cabeca' ? -50 : -20) * easeOut(q), alpha: 1 - q,
          scale: slot === 'pescoco' ? 1 : 1 - 0.2 * q
        });
      }
      const w = this.worn[slot];
      if (w) {
        const p = clamp((now - w.t0) / IN_MS, 0, 1);
        out.push({
          item: ITEMS[w.id], a: w.springs.map(s => s.a),
          dy: slot === 'rosto' ? 0 : -60 * (1 - easeBack(p)),
          alpha: clamp(p / 0.25, 0, 1),
          scale: slot === 'rosto' ? 1 + 0.4 * (1 - easeOut(p)) : 1
        });
      }
      return out;
    }
  }

  // ========================================================
  // FANTASIAS E PEÇAS POR PERSONAGEM
  // ========================================================
  // As 11 peças acima são comuns. Peças com dono (owner) e as fantasias vêm de robo-roupas-echo.js e
  // robo-roupas-luna.js; cada página carrega só o arquivo do seu personagem.
  const SETS = {};

  function itemsFor(owner) {
    return Object.entries(ITEMS).filter(([, it]) => !it.owner || it.owner === owner);
  }

  function setsFor(owner) {
    return Object.entries(SETS).filter(([, set]) => set.owner === owner);
  }

  function setWorn(wardrobe, id) {
    const set = SETS[id];
    return !!set && set.items.every(item => wardrobe.has(item));
  }

  // Roupa ({ lugar: peça }) com a fantasia vestida: serve de padrão para quem começa fantasiado
  function outfitOf(id) {
    const out = {};
    for (const item of (SETS[id] ? SETS[id].items : [])) out[ITEMS[item].slot] = item;
    return out;
  }

  // Veste a fantasia inteira; se ela já estiver vestida, tira as peças dela e veste o que ela pede no
  // lugar (afterRemove, ex.: o laço da Luna)
  function toggleSet(wardrobe, id, now) {
    const set = SETS[id];
    if (!set) return false;
    if (setWorn(wardrobe, id)) {
      for (const item of set.items) wardrobe.remove(ITEMS[item].slot, now);
      for (const item of Object.values(set.afterRemove || {})) wardrobe.wear(item, now);
    } else {
      for (const item of set.items) wardrobe.wear(item, now);
    }
    return true;
  }

  // Forma do corpo para as roupas que o cobrem (terno, vestido): mesmas medidas do corpo em robo-motor.js
  // (BODY; um teste confere) e a tela do peito (rr(-30, -64, 60, 36, 10)) com 1 px de folga para a borda
  const BODY = { cy: -39, hw: 50, bottomHw: 40, hh: 39, r: 24 };
  const SCREEN = { x: -31, y: -65, w: 62, h: 38, r: 11 };

  // Contorno do corpo sem beginPath: entra num caminho composto
  function bodyOutline(x) {
    const { cy, hw, bottomHw, hh, r } = BODY, top = cy - hh, bottom = cy + hh;
    x.moveTo(-hw + r, top);
    x.lineTo(hw - r, top);
    x.quadraticCurveTo(hw, top, hw, top + r);
    x.lineTo(bottomHw, bottom - r);
    x.quadraticCurveTo(bottomHw, bottom, bottomHw - r, bottom);
    x.lineTo(-bottomHw + r, bottom);
    x.quadraticCurveTo(-bottomHw, bottom, -bottomHw, bottom - r);
    x.lineTo(-hw, top + r);
    x.quadraticCurveTo(-hw, top, -hw + r, top);
    x.closePath();
  }

  // Retângulo arredondado sem beginPath (o buraco da tela no caminho composto)
  function roundRectOutline(x, { x: X, y: Y, w: W, h: H, r: R }) {
    x.moveTo(X + R, Y);
    x.arcTo(X + W, Y, X + W, Y + H, R);
    x.arcTo(X + W, Y + H, X, Y + H, R);
    x.arcTo(X, Y + H, X, Y, R);
    x.arcTo(X, Y, X + W, Y, R);
    x.closePath();
  }

  // Costura: curva (from → ctrl → to) com pontos cruzados; count pontos de half px para cada lado
  function stitchedCurve(x, from, ctrl, to, count, half) {
    const point = t => {
      const u = 1 - t;
      return [u * u * from[0] + 2 * u * t * ctrl[0] + t * t * to[0], u * u * from[1] + 2 * u * t * ctrl[1] + t * t * to[1]];
    };
    const normal = t => {
      const dx = 2 * (1 - t) * (ctrl[0] - from[0]) + 2 * t * (to[0] - ctrl[0]);
      const dy = 2 * (1 - t) * (ctrl[1] - from[1]) + 2 * t * (to[1] - ctrl[1]);
      const len = Math.hypot(dx, dy) || 1;
      return [-dy / len, dx / len];
    };
    x.beginPath();
    x.moveTo(from[0], from[1]);
    x.quadraticCurveTo(ctrl[0], ctrl[1], to[0], to[1]);
    x.stroke();
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const [px, py] = point(t), [nx, ny] = normal(t);
      x.beginPath();
      x.moveTo(px - nx * half, py - ny * half);
      x.lineTo(px + nx * half, py + ny * half);
      x.stroke();
    }
  }

  // Recorte do corpo sem a tela do peito: o que for pintado depois só aparece no corpo
  function clipBodyWithoutScreen(x) {
    x.beginPath();
    bodyOutline(x);
    roundRectOutline(x, SCREEN);
    x.clip('evenodd');
  }

  // ========================================================
  // ESPAÇO PARA CHAPÉU ALTO
  // ========================================================
  const HEAD_TOP = 216;   // alto da cabeça acima da base do corpo
  const TAG_TOP = 226;    // alto da etiqueta >_
  const GROUND = 246;     // base do corpo no quadro de 280

  // Escala do robô para a peça mais alta caber no quadro (1 = sem recuo)
  function headroomZoom(top) {
    const needed = Math.max(TAG_TOP, HEAD_TOP + (top || 0));
    return Math.min(1, (GROUND - 12) / needed);
  }

  // ========================================================
  // ESTAÇÕES E DATAS (Brasil)
  // ========================================================
  // Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher)
  function easter(year) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return { y: year, m: month, d: day };
  }

  // O que o modo automático veste num dia (a primeira regra que valer ganha)
  function seasonFor(date) {
    const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
    const md = m * 100 + d;
    const e = easter(y);
    const fromEaster = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(e.y, e.m - 1, e.d)) / 86400000);
    if (md >= 1226 || md <= 102) return { key: 'ano-novo', label: 'Ano Novo', outfit: { cabeca: 'festa' } };
    if (md >= 1201 && md <= 1225) return { key: 'natal', label: 'Natal', outfit: { cabeca: 'noel' } };
    if (fromEaster >= -6 && fromEaster <= 0) return { key: 'pascoa', label: 'Páscoa', outfit: { cabeca: 'coelho' } };
    if (md >= 1025 && md <= 1031) return { key: 'halloween', label: 'Halloween', outfit: { cabeca: 'bruxa' } };
    if (md >= 1101 && md <= 1102) return { key: 'aboboras', label: 'Abóboras', outfit: { cabeca: 'abobora' } };
    if (md >= 621 && md <= 922) return { key: 'inverno', label: 'Inverno', outfit: { cabeca: 'gorro', pescoco: 'cachecol' } };
    if (md >= 1221 || md <= 320) return { key: 'verao', label: 'Verão', outfit: { rosto: 'oculosEscuros' } };
    return { key: 'nenhuma', label: 'Sem data especial', outfit: {} };
  }

  root.RoboRoupas = {
    ITEMS, SLOTS, SETS, LENS_X, Spring, Wardrobe, headroomZoom, easter, seasonFor,
    itemsFor, setsFor, setWorn, toggleSet, outfitOf,
    shape: { BODY, SCREEN, bodyOutline, roundRectOutline, clipBodyWithoutScreen, stitchedCurve }
  };
})(typeof window !== 'undefined' ? window : globalThis);
